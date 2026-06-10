/**
 * Centralized SFX and per-layer music — Web Audio API engine.
 *
 * Why WebAudio instead of HTMLAudioElement: iOS Safari ignores `volume` on
 * media elements, pauses overlapping elements unpredictably, and requires a
 * per-element gesture unlock. One AudioContext unlocked once covers all
 * playback forever, mixes music + SFX reliably, and supports real gain ramps.
 */

const SFX_BASE_PATH = 'assets/audio/sfx-';
const MUSIC_BASE_PATH = 'assets/audio/bg-';
const MUSIC_VOLUME = 0.45;
const MUSIC_DUCK_GAMEPLAY_RATIO = 0.3;
const MUSIC_DUCK_STINGER_RATIO = 0.25;
const MUSIC_DUCK_FADE_MS = 200;
const MUSIC_FADE_OUT_MS = 250;
const MUSIC_FADE_IN_MS = 500;
const LAYER_ASCEND_MUSIC_DELAY_MS = 450;
const GAMEPLAY_VOICE_POOL_SIZE = 2;

const DEFAULT_SFX_PROFILE = Object.freeze({
  volume: 0.35,
  maxMs: 1200,
  channel: 'gameplay',
  throttleMs: 0,
});

const SFX_PROFILES = Object.freeze({
  ten: { volume: 0.62, maxMs: 480, channel: 'gameplay', throttleMs: 280 },
  duc: { volume: 0.58, maxMs: 520, channel: 'gameplay', throttleMs: 320 },
  shockwave: { volume: 0.68, maxMs: 550, channel: 'gameplay', throttleMs: 0 },
  'layer-up': { volume: 0.48, maxMs: 1400, channel: 'stinger', throttleMs: 0 },
  victory: { volume: 0.52, maxMs: 4000, channel: 'stinger', throttleMs: 0 },
  gameover: { volume: 0.5, maxMs: 3500, channel: 'stinger', throttleMs: 0 },
  collect: { volume: 0.4, maxMs: 800, channel: 'gameplay', throttleMs: 200 },
  hit: { volume: 0.45, maxMs: 600, channel: 'gameplay', throttleMs: 300 },
});

const KNOWN_SFX = ['collect', 'hit', 'shockwave', 'layer-up', 'victory', 'gameover', 'ten', 'duc'];
const MAX_LAYER = 7;

// --- Audio graph ---------------------------------------------------------------

/** @type {AudioContext | null} */
let audioCtx = null;
/** @type {GainNode | null} */
let masterGain = null;
/** @type {GainNode | null} */
let musicGain = null;
/** @type {GainNode | null} */
let sfxGain = null;

let audioInitialized = false;
let audioUnlocked = false;
/** @type {HTMLAudioElement | null} iOS media-session keeper (silent loop). */
let silenceKeeper = null;

// --- Buffers ---------------------------------------------------------------

/** @type {Map<string, AudioBuffer>} key = 'sfx:name' | 'music:trackKey' */
const bufferCache = new Map();
/** @type {Map<string, Promise<AudioBuffer | null>>} */
const bufferPromises = new Map();
const unavailableSfx = new Set();
const unavailableMusic = new Set();

// --- Music state ---------------------------------------------------------------

/**
 * @type {{
 *   trackKey: string | null,
 *   layerId: number | null,
 *   source: AudioBufferSourceNode | null,
 *   trackGain: GainNode | null,
 *   buffer: AudioBuffer | null,
 *   startedAt: number,
 *   offset: number,
 * }}
 */
const musicState = {
  trackKey: null,
  layerId: null,
  source: null,
  trackGain: null,
  buffer: null,
  startedAt: 0,
  offset: 0,
};

/** True while layer music should be audible (not user-paused/stopped). */
let musicIntendedPlaying = false;
let musicEpoch = 0;
let layerAscendMusicTimer = null;

let musicDucked = false;
let musicDuckIsStinger = false;

// --- Voices ---------------------------------------------------------------

/** @type {Map<string, number>} */
const sfxLastPlayedAt = new Map();
/** @type {Set<number>} */
const activeVoiceIds = new Set();
let nextVoiceId = 1;

/** @type {{ id: number, name: string, source: AudioBufferSourceNode, gain: GainNode, maxTimer: number } | null} */
let activeStinger = null;
/** @type {Array<{ id: number, source: AudioBufferSourceNode, gain: GainNode, startedAt: number, maxTimer: number }>} */
const gameplayVoices = [];

// --- Helpers ---------------------------------------------------------------

function getSfxProfile(name) {
  return SFX_PROFILES[name] ?? DEFAULT_SFX_PROFILE;
}

function ensureContext() {
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = new Ctor();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(audioCtx.destination);

  musicGain = audioCtx.createGain();
  musicGain.gain.value = MUSIC_VOLUME;
  musicGain.connect(masterGain);

  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 1;
  sfxGain.connect(masterGain);

  audioCtx.addEventListener?.('statechange', () => {
    // iOS sets 'interrupted' (notification/call); try to come back automatically.
    if (audioCtx.state !== 'running') tryResumeContext();
  });

  return audioCtx;
}

function tryResumeContext() {
  if (!audioCtx || audioCtx.state === 'running') return;
  const p = audioCtx.resume();
  p?.then?.(() => restartMusicIfDropped()).catch(() => {});
}

/** If music was supposed to play but its source got dropped, restart at saved offset. */
function restartMusicIfDropped() {
  if (!musicIntendedPlaying) return;
  if (musicState.source) return;
  if (musicState.layerId == null) return;
  playLayerMusic(musicState.layerId, false);
}

function rampGain(param, target, ms) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  try {
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(target, t + Math.max(0.001, ms / 1000));
  } catch { /* ignore */ }
}

function stopSourceSafe(source) {
  if (!source) return;
  try {
    source.onended = null;
    source.stop();
  } catch { /* ignore */ }
  try {
    source.disconnect();
  } catch { /* ignore */ }
}

/** Trim a decoded buffer to its playable window — SFX files are padded with silence. */
function trimBuffer(buffer, maxSec) {
  if (!audioCtx || buffer.duration <= maxSec + 0.3) return buffer;
  const frames = Math.min(buffer.length, Math.ceil((maxSec + 0.25) * buffer.sampleRate));
  try {
    const out = audioCtx.createBuffer(buffer.numberOfChannels, frames, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      out.copyToChannel(buffer.getChannelData(ch).subarray(0, frames), ch);
    }
    return out;
  } catch {
    return buffer;
  }
}

function sfxKey(name) {
  return `sfx:${name}`;
}

function musicKey(trackKey) {
  return `music:${trackKey}`;
}

function loadBuffer(cacheKey, url, { trimSec = 0, onFail } = {}) {
  const cached = bufferCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  let promise = bufferPromises.get(cacheKey);
  if (promise) return promise;

  const ctx = ensureContext();
  if (!ctx) return Promise.resolve(null);

  promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      const finalBuffer = trimSec > 0 ? trimBuffer(buffer, trimSec) : buffer;
      bufferCache.set(cacheKey, finalBuffer);
      bufferPromises.delete(cacheKey);
      return finalBuffer;
    })
    .catch(() => {
      bufferPromises.delete(cacheKey);
      onFail?.();
      return null;
    });

  bufferPromises.set(cacheKey, promise);
  return promise;
}

function loadSfxBuffer(name) {
  if (unavailableSfx.has(name)) return Promise.resolve(null);
  const profile = getSfxProfile(name);
  return loadBuffer(sfxKey(name), `${SFX_BASE_PATH}${name}.mp3`, {
    trimSec: profile.maxMs / 1000,
    onFail: () => unavailableSfx.add(name),
  });
}

function loadMusicBuffer(trackKey) {
  if (unavailableMusic.has(trackKey)) return Promise.resolve(null);
  return loadBuffer(musicKey(trackKey), `${MUSIC_BASE_PATH}${trackKey}.mp3`, {
    onFail: () => unavailableMusic.add(trackKey),
  });
}

/** Keep only nearby music buffers decoded (~10MB each) to bound RAM on phones. */
function evictFarMusicBuffers(currentLayerId) {
  const keep = new Set([
    musicKey(`layer-${currentLayerId}`),
    musicKey(`layer-${Math.min(MAX_LAYER, currentLayerId + 1)}`),
    musicKey('music'),
  ]);
  for (const key of bufferCache.keys()) {
    if (key.startsWith('music:') && !keep.has(key)) {
      bufferCache.delete(key);
    }
  }
}

// --- Ducking ---------------------------------------------------------------

function applyMusicDuck(forceStinger = false) {
  if (forceStinger) musicDuckIsStinger = true;
  if (!musicGain) return;

  let ratio = 1;
  if (activeStinger || musicDuckIsStinger) {
    ratio = MUSIC_DUCK_STINGER_RATIO;
  } else if (activeVoiceIds.size > 0) {
    ratio = MUSIC_DUCK_GAMEPLAY_RATIO;
  }

  if (ratio >= 0.95) {
    musicDucked = false;
    musicDuckIsStinger = false;
  } else {
    musicDucked = true;
  }
  rampGain(musicGain.gain, MUSIC_VOLUME * ratio, MUSIC_DUCK_FADE_MS);
}

function releaseVoice(voiceId) {
  if (!activeVoiceIds.has(voiceId)) return;
  activeVoiceIds.delete(voiceId);
  if (!activeStinger && activeVoiceIds.size === 0) {
    musicDuckIsStinger = false;
    applyMusicDuck();
  }
}

// --- SFX voices ---------------------------------------------------------------

function finishVoiceNodes(entry) {
  window.clearTimeout(entry.maxTimer);
  stopSourceSafe(entry.source);
  try {
    entry.gain.disconnect();
  } catch { /* ignore */ }
}

function clearStinger() {
  if (!activeStinger) return;
  const stingerId = activeStinger.id;
  finishVoiceNodes(activeStinger);
  activeStinger = null;
  musicDuckIsStinger = false;
  releaseVoice(stingerId);
}

function finishStinger(stingerId) {
  if (!activeStinger || activeStinger.id !== stingerId) return;
  clearStinger();
}

function startVoice(name, profile) {
  const ctx = ensureContext();
  if (!ctx || !sfxGain) return null;
  const buffer = bufferCache.get(sfxKey(name));
  if (!buffer) {
    // Not decoded yet — kick off the load so the next play works.
    loadSfxBuffer(name);
    return null;
  }

  const gain = ctx.createGain();
  gain.gain.value = profile.volume;
  gain.connect(sfxGain);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);

  try {
    source.start();
  } catch {
    try {
      gain.disconnect();
    } catch { /* ignore */ }
    return null;
  }
  return { source, gain };
}

function playStinger(name, profile) {
  clearStinger();

  const nodes = startVoice(name, profile);
  if (!nodes) return;

  const voiceId = nextVoiceId++;
  const onFinish = () => finishStinger(voiceId);
  nodes.source.onended = onFinish;
  const maxTimer = window.setTimeout(onFinish, profile.maxMs);

  activeStinger = { id: voiceId, name, source: nodes.source, gain: nodes.gain, maxTimer };
  activeVoiceIds.add(voiceId);
  applyMusicDuck(true);
}

function evictOldestGameplayVoice() {
  if (gameplayVoices.length < GAMEPLAY_VOICE_POOL_SIZE) return;
  let oldest = gameplayVoices[0];
  for (const v of gameplayVoices) {
    if (v.startedAt < oldest.startedAt) oldest = v;
  }
  finishVoiceNodes(oldest);
  const idx = gameplayVoices.indexOf(oldest);
  if (idx >= 0) gameplayVoices.splice(idx, 1);
  releaseVoice(oldest.id);
}

function playGameplayVoice(name, profile) {
  evictOldestGameplayVoice();

  const nodes = startVoice(name, profile);
  if (!nodes) return;

  const voiceId = nextVoiceId++;
  const onFinish = () => {
    const idx = gameplayVoices.findIndex((v) => v.id === voiceId);
    if (idx >= 0) {
      finishVoiceNodes(gameplayVoices[idx]);
      gameplayVoices.splice(idx, 1);
    }
    releaseVoice(voiceId);
  };
  nodes.source.onended = onFinish;
  const maxTimer = window.setTimeout(onFinish, profile.maxMs);

  gameplayVoices.push({ id: voiceId, source: nodes.source, gain: nodes.gain, startedAt: performance.now(), maxTimer });
  activeVoiceIds.add(voiceId);
  applyMusicDuck(false);
}

function shouldThrottleSfx(name, profile) {
  if (!profile.throttleMs) return false;
  const last = sfxLastPlayedAt.get(name) ?? 0;
  return performance.now() - last < profile.throttleMs;
}

// --- Unlock + iOS session keeper ------------------------------------------------

// 44.1kHz, 20s: an 8kHz/1s loop made iOS degrade the whole hardware audio
// session (muffled output) and its per-second loop restarts caused ticks.
function buildSilentWavUrl(seconds = 20) {
  const rate = 44100;
  const samples = Math.floor(rate * seconds);
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/**
 * Looping silent HTMLAudio promotes the iOS audio session to "playback" so
 * WebAudio stays audible even with the ring/silent switch on (unmute.js trick).
 */
function startSilenceKeeper() {
  if (silenceKeeper) {
    if (silenceKeeper.paused) silenceKeeper.play()?.catch?.(() => {});
    return;
  }
  try {
    silenceKeeper = new Audio(buildSilentWavUrl());
    silenceKeeper.loop = true;
    silenceKeeper.setAttribute('playsinline', '');
    silenceKeeper.play()?.catch?.(() => {});
  } catch { /* ignore */ }
}

/**
 * Unlock the audio pipeline inside a user gesture. Idempotent; safe to call
 * on every gesture (re-resumes a suspended/interrupted context).
 */
export function unlockAudio() {
  const ctx = ensureContext();
  if (!ctx) return;

  tryResumeContext();

  if (audioUnlocked) return;
  audioUnlocked = true;

  // Play one silent buffer through the graph inside the gesture.
  try {
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050);
    source.connect(ctx.destination);
    source.start(0);
  } catch { /* ignore */ }

  startSilenceKeeper();
}

let watchdogsBound = false;

function bindRecoveryWatchdogs() {
  if (watchdogsBound) return;
  watchdogsBound = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    tryResumeContext();
    if (silenceKeeper?.paused && audioUnlocked) {
      silenceKeeper.play()?.catch?.(() => {});
    }
    restartMusicIfDropped();
  });

  // Persistent (non-once) gesture hook: any tap revives a blocked pipeline.
  window.addEventListener(
    'pointerdown',
    () => {
      if (!audioCtx) return;
      if (audioCtx.state !== 'running') tryResumeContext();
      if (silenceKeeper?.paused && audioUnlocked) {
        silenceKeeper.play()?.catch?.(() => {});
      }
      restartMusicIfDropped();
    },
    { capture: true, passive: true }
  );
}

// --- Public API ---------------------------------------------------------------

export function initAudio() {
  if (audioInitialized) return;
  audioInitialized = true;
  ensureContext();
  bindRecoveryWatchdogs();
  for (const name of KNOWN_SFX) loadSfxBuffer(name);
  // Music is decoded lazily per layer (see playLayerMusic) to bound memory.
  loadMusicBuffer('layer-1');
}

export function preloadAudioAssets(timeoutMs = 600) {
  initAudio();
  return new Promise((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });
}

export function playSfx(name) {
  if (!name || unavailableSfx.has(name)) return;

  const profile = getSfxProfile(name);

  if (shouldThrottleSfx(name, profile)) {
    applyMusicDuck(profile.channel === 'stinger');
    return;
  }

  sfxLastPlayedAt.set(name, performance.now());

  if (profile.channel === 'stinger') {
    playStinger(name, profile);
  } else {
    playGameplayVoice(name, profile);
  }
}

/** Alias for gameplay SFX — same as playSfx. */
export function playGameplaySfx(name) {
  playSfx(name);
}

export function stopStingers() {
  clearStinger();
}

function getMusicForLayer(layerId) {
  const key = `layer-${layerId}`;
  if (!unavailableMusic.has(key)) return key;
  return unavailableMusic.has('music') ? null : 'music';
}

function getMusicPosition() {
  if (!audioCtx || !musicState.source || !musicState.buffer) {
    return musicState.offset || 0;
  }
  const elapsed = Math.max(0, audioCtx.currentTime - musicState.startedAt);
  return (musicState.offset + elapsed) % musicState.buffer.duration;
}

function stopCurrentMusicSource({ fadeOutMs = 0 } = {}) {
  const { source, trackGain } = musicState;
  if (!source) return;
  musicState.source = null;
  musicState.trackGain = null;

  if (fadeOutMs > 0 && trackGain && audioCtx) {
    rampGain(trackGain.gain, 0, fadeOutMs);
    window.setTimeout(() => {
      stopSourceSafe(source);
      try {
        trackGain.disconnect();
      } catch { /* ignore */ }
    }, fadeOutMs + 50);
  } else {
    stopSourceSafe(source);
    try {
      trackGain?.disconnect();
    } catch { /* ignore */ }
  }
}

/**
 * Layer-up stinger first, then crossfade to new layer music after a short delay.
 * @param {number} layerId 1–7
 */
export function playLayerAscendStinger(layerId) {
  if (layerAscendMusicTimer) {
    window.clearTimeout(layerAscendMusicTimer);
    layerAscendMusicTimer = null;
  }

  playSfx('layer-up');
  // Decode the upcoming track while the stinger plays.
  const trackKey = getMusicForLayer(layerId);
  if (trackKey) loadMusicBuffer(trackKey);

  layerAscendMusicTimer = window.setTimeout(() => {
    layerAscendMusicTimer = null;
    playLayerMusic(layerId, true);
  }, LAYER_ASCEND_MUSIC_DELAY_MS);
}

/**
 * Play looping background music for a layer (falls back to bg-music.mp3).
 * @param {number} layerId 1–7
 * @param {boolean} [fadeIn=true]
 */
export function playLayerMusic(layerId, fadeIn = true) {
  const ctx = ensureContext();
  if (!ctx) return;

  const trackKey = getMusicForLayer(layerId);
  if (!trackKey) return;

  if (layerAscendMusicTimer) {
    window.clearTimeout(layerAscendMusicTimer);
    layerAscendMusicTimer = null;
  }

  musicEpoch += 1;
  const epoch = musicEpoch;
  musicIntendedPlaying = true;
  musicState.layerId = layerId;

  tryResumeContext();

  // Same track already playing — keep it, just make sure gain is up.
  if (musicState.trackKey === trackKey && musicState.source) {
    if (musicState.trackGain) rampGain(musicState.trackGain.gain, 1, MUSIC_DUCK_FADE_MS);
    if (activeVoiceIds.size === 0 && !activeStinger) applyMusicDuck();
    prefetchNextLayer(layerId);
    return;
  }

  loadMusicBuffer(trackKey).then((buffer) => {
    if (epoch !== musicEpoch || !buffer) {
      if (!buffer && trackKey !== 'music' && epoch === musicEpoch) {
        // Layer track failed — retry once with the fallback track.
        playLayerMusic(layerId, fadeIn);
      }
      return;
    }

    const resumeSameTrack = musicState.trackKey === trackKey;
    const startOffset = resumeSameTrack ? (musicState.offset % buffer.duration) : 0;

    stopCurrentMusicSource({ fadeOutMs: musicState.trackKey && !resumeSameTrack ? MUSIC_FADE_OUT_MS : 0 });

    const trackGain = ctx.createGain();
    trackGain.gain.value = fadeIn ? 0 : 1;
    trackGain.connect(musicGain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(trackGain);

    try {
      source.start(0, startOffset);
    } catch {
      try {
        trackGain.disconnect();
      } catch { /* ignore */ }
      return;
    }

    musicState.trackKey = trackKey;
    musicState.source = source;
    musicState.trackGain = trackGain;
    musicState.buffer = buffer;
    musicState.startedAt = ctx.currentTime;
    musicState.offset = startOffset;

    if (activeVoiceIds.size === 0 && !activeStinger) {
      musicDucked = false;
      musicDuckIsStinger = false;
      rampGain(musicGain.gain, MUSIC_VOLUME, MUSIC_DUCK_FADE_MS);
    } else {
      applyMusicDuck(musicDuckIsStinger);
    }

    if (fadeIn) {
      rampGain(trackGain.gain, 1, MUSIC_FADE_IN_MS);
    }

    evictFarMusicBuffers(layerId);
    prefetchNextLayer(layerId);
  });
}

function prefetchNextLayer(layerId) {
  const nextId = layerId + 1;
  if (nextId > MAX_LAYER) return;
  const key = `layer-${nextId}`;
  if (!unavailableMusic.has(key)) loadMusicBuffer(key);
}

export function pauseLayerMusic() {
  musicIntendedPlaying = false;
  if (musicState.source) {
    musicState.offset = getMusicPosition();
    stopCurrentMusicSource();
  }
}

export function resumeLayerMusic(layerId) {
  playLayerMusic(layerId, false);
}

export function stopLayerMusic() {
  musicEpoch += 1;
  musicIntendedPlaying = false;
  if (layerAscendMusicTimer) {
    window.clearTimeout(layerAscendMusicTimer);
    layerAscendMusicTimer = null;
  }
  stopCurrentMusicSource();
  musicState.trackKey = null;
  musicState.layerId = null;
  musicState.buffer = null;
  musicState.offset = 0;
  musicDucked = false;
  musicDuckIsStinger = false;
  if (musicGain && audioCtx) {
    rampGain(musicGain.gain, MUSIC_VOLUME, 1);
  }
}

export function stopGameAudio() {
  if (layerAscendMusicTimer) {
    window.clearTimeout(layerAscendMusicTimer);
    layerAscendMusicTimer = null;
  }

  clearStinger();

  for (const voice of [...gameplayVoices]) {
    finishVoiceNodes(voice);
    releaseVoice(voice.id);
  }
  gameplayVoices.length = 0;
  activeVoiceIds.clear();

  musicDucked = false;
  musicDuckIsStinger = false;
  stopLayerMusic();
}
