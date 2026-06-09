/** Centralized SFX and per-layer music — music / stinger / gameplay channels. */

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

const unavailableSfx = new Set();
/** @type {Map<string, number>} */
const sfxLastPlayedAt = new Map();

/** @type {Map<string, HTMLAudioElement>} */
const musicCache = new Map();
const unavailableMusic = new Set();

let currentMusicLayer = null;
let musicFadeRaf = null;
let sfxDuckRaf = null;
let musicEpoch = 0;
let layerAscendMusicTimer = null;

let musicDucked = false;
let musicDuckIsStinger = false;
let musicTargetVolume = MUSIC_VOLUME;

/** @type {Set<number>} */
const activeVoiceIds = new Set();
let nextVoiceId = 1;

/** @type {{ id: number, name: string, audio: HTMLAudioElement, maxTimer: number, endedHandler: () => void } | null} */
let activeStinger = null;

/** @type {Array<{ id: number, audio: HTMLAudioElement, startedAt: number, maxTimer: number, endedHandler: () => void }>} */
const gameplayVoices = [];

function getSfxProfile(name) {
  return SFX_PROFILES[name] ?? DEFAULT_SFX_PROFILE;
}

function createSfxUrl(name) {
  return `${SFX_BASE_PATH}${name}.mp3`;
}

function createMusicElement(trackKey) {
  const audio = new Audio(`${MUSIC_BASE_PATH}${trackKey}.mp3`);
  audio.preload = 'auto';
  audio.loop = true;
  audio.volume = 0;
  return audio;
}

function markUnavailableSfx(name) {
  unavailableSfx.add(name);
}

function markUnavailableMusic(trackKey) {
  unavailableMusic.add(trackKey);
  musicCache.delete(trackKey);
}

function bindMusicLoadHandlers(trackKey, audio) {
  audio.addEventListener('error', () => markUnavailableMusic(trackKey), { once: true });
}

function getCurrentMusicAudio() {
  return currentMusicLayer ? musicCache.get(currentMusicLayer) : null;
}

function fadeAudioVolume(audio, targetVolume, durationMs, onDone, rafRef = 'music') {
  if (!audio) {
    onDone?.();
    return;
  }
  if (rafRef === 'duck' && sfxDuckRaf) cancelAnimationFrame(sfxDuckRaf);
  if (rafRef === 'music' && musicFadeRaf) cancelAnimationFrame(musicFadeRaf);

  const start = audio.volume;
  const startTime = performance.now();

  const step = (now) => {
    const t = Math.min(1, (now - startTime) / durationMs);
    audio.volume = start + (targetVolume - start) * t;
    if (t < 1) {
      if (rafRef === 'duck') sfxDuckRaf = requestAnimationFrame(step);
      else musicFadeRaf = requestAnimationFrame(step);
    } else {
      if (rafRef === 'duck') sfxDuckRaf = null;
      else musicFadeRaf = null;
      onDone?.();
    }
  };
  if (rafRef === 'duck') sfxDuckRaf = requestAnimationFrame(step);
  else musicFadeRaf = requestAnimationFrame(step);
}

function getMusicDuckTarget() {
  if (activeStinger || musicDuckIsStinger) {
    return musicTargetVolume * MUSIC_DUCK_STINGER_RATIO;
  }
  if (activeVoiceIds.size > 0) {
    return musicTargetVolume * MUSIC_DUCK_GAMEPLAY_RATIO;
  }
  return musicTargetVolume;
}

function applyMusicDuck(forceStinger = false) {
  if (forceStinger) musicDuckIsStinger = true;
  const audio = getCurrentMusicAudio();
  if (!audio) return;

  const target = getMusicDuckTarget();
  if (target >= musicTargetVolume * 0.95) {
    musicDucked = false;
    musicDuckIsStinger = false;
    fadeAudioVolume(audio, musicTargetVolume, MUSIC_DUCK_FADE_MS, undefined, 'duck');
    return;
  }

  musicDucked = true;
  fadeAudioVolume(audio, target, MUSIC_DUCK_FADE_MS, undefined, 'duck');
}

function releaseVoice(voiceId) {
  if (!activeVoiceIds.has(voiceId)) return;
  activeVoiceIds.delete(voiceId);
  if (!activeStinger && activeVoiceIds.size === 0) {
    musicDuckIsStinger = false;
    applyMusicDuck();
  }
}

function stopVoiceEntry(entry) {
  if (!entry) return;
  window.clearTimeout(entry.maxTimer);
  entry.audio.removeEventListener('ended', entry.endedHandler);
  try {
    entry.audio.pause();
    entry.audio.currentTime = 0;
  } catch { /* ignore */ }
  releaseVoice(entry.id);
}

function clearStinger() {
  if (!activeStinger) return;
  const stingerId = activeStinger.id;
  window.clearTimeout(activeStinger.maxTimer);
  activeStinger.audio.removeEventListener('ended', activeStinger.endedHandler);
  try {
    activeStinger.audio.pause();
    activeStinger.audio.currentTime = 0;
  } catch { /* ignore */ }
  activeStinger = null;
  musicDuckIsStinger = false;
  releaseVoice(stingerId);
}

function finishStinger(stingerId) {
  if (!activeStinger || activeStinger.id !== stingerId) return;
  window.clearTimeout(activeStinger.maxTimer);
  activeStinger.audio.removeEventListener('ended', activeStinger.endedHandler);
  try {
    activeStinger.audio.pause();
    activeStinger.audio.currentTime = 0;
  } catch { /* ignore */ }
  activeStinger = null;
  musicDuckIsStinger = false;
  releaseVoice(stingerId);
}

function playStinger(name, profile) {
  if (unavailableSfx.has(name)) return;

  clearStinger();

  const voiceId = nextVoiceId++;
  const audio = new Audio(createSfxUrl(name));
  audio.preload = 'auto';
  audio.volume = profile.volume;

  const onFinish = () => finishStinger(voiceId);
  audio.addEventListener('ended', onFinish, { once: true });
  audio.addEventListener('error', () => {
    markUnavailableSfx(name);
    finishStinger(voiceId);
  }, { once: true });

  const maxTimer = window.setTimeout(onFinish, profile.maxMs);

  activeStinger = { id: voiceId, name, audio, maxTimer, endedHandler: onFinish };
  activeVoiceIds.add(voiceId);
  applyMusicDuck(true);

  try {
    const p = audio.play();
    if (p?.catch) p.catch(() => finishStinger(voiceId));
  } catch {
    markUnavailableSfx(name);
    finishStinger(voiceId);
  }
}

function acquireGameplayVoice() {
  if (gameplayVoices.length < GAMEPLAY_VOICE_POOL_SIZE) {
    return null;
  }
  let oldest = gameplayVoices[0];
  for (const v of gameplayVoices) {
    if (v.startedAt < oldest.startedAt) oldest = v;
  }
  stopVoiceEntry(oldest);
  const idx = gameplayVoices.indexOf(oldest);
  if (idx >= 0) gameplayVoices.splice(idx, 1);
  return null;
}

function playGameplayVoice(name, profile) {
  if (unavailableSfx.has(name)) return;

  acquireGameplayVoice();

  const voiceId = nextVoiceId++;
  const audio = new Audio(createSfxUrl(name));
  audio.preload = 'auto';
  audio.volume = profile.volume;

  const onFinish = () => {
    const idx = gameplayVoices.findIndex((v) => v.id === voiceId);
    if (idx >= 0) gameplayVoices.splice(idx, 1);
    audio.removeEventListener('ended', onFinish);
    window.clearTimeout(maxTimer);
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch { /* ignore */ }
    releaseVoice(voiceId);
  };

  audio.addEventListener('ended', onFinish, { once: true });
  audio.addEventListener('error', () => {
    markUnavailableSfx(name);
    onFinish();
  }, { once: true });

  const maxTimer = window.setTimeout(onFinish, profile.maxMs);
  gameplayVoices.push({ id: voiceId, audio, startedAt: performance.now(), maxTimer, endedHandler: onFinish });
  activeVoiceIds.add(voiceId);
  applyMusicDuck(false);

  try {
    const p = audio.play();
    if (p?.catch) p.catch(() => onFinish());
  } catch {
    markUnavailableSfx(name);
    onFinish();
  }
}

function shouldThrottleSfx(name, profile) {
  if (!profile.throttleMs) return false;
  const last = sfxLastPlayedAt.get(name) ?? 0;
  return performance.now() - last < profile.throttleMs;
}

function preloadSfxProbe(name) {
  if (unavailableSfx.has(name)) return;
  const probe = new Audio(createSfxUrl(name));
  probe.preload = 'auto';
  probe.addEventListener('error', () => markUnavailableSfx(name), { once: true });
  try {
    probe.load();
  } catch {
    markUnavailableSfx(name);
  }
}

function preloadMusic(trackKey) {
  if (unavailableMusic.has(trackKey) || musicCache.has(trackKey)) return;
  const audio = createMusicElement(trackKey);
  bindMusicLoadHandlers(trackKey, audio);
  audio.addEventListener(
    'canplaythrough',
    () => {
      if (!unavailableMusic.has(trackKey)) musicCache.set(trackKey, audio);
    },
    { once: true }
  );
  try {
    audio.load();
  } catch {
    markUnavailableMusic(trackKey);
  }
}

export function initAudio() {
  for (const name of KNOWN_SFX) preloadSfxProbe(name);
  for (let i = 1; i <= 7; i++) preloadMusic(`layer-${i}`);
  preloadMusic('music');
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

function pauseAllMusicExcept(next) {
  for (const [key, audio] of musicCache.entries()) {
    if (audio === next) continue;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
    } catch { /* ignore */ }
  }
}

function getMusicForLayer(layerId) {
  const key = `layer-${layerId}`;
  if (!unavailableMusic.has(key)) return key;
  return unavailableMusic.has('music') ? null : 'music';
}

function getOrCreateMusic(trackKey) {
  if (!trackKey || unavailableMusic.has(trackKey)) return null;

  let audio = musicCache.get(trackKey);
  if (!audio) {
    audio = createMusicElement(trackKey);
    bindMusicLoadHandlers(trackKey, audio);
    musicCache.set(trackKey, audio);
  }
  return audio;
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
  const trackKey = getMusicForLayer(layerId);
  if (!trackKey) return;

  const next = getOrCreateMusic(trackKey);
  if (!next) return;

  if (layerAscendMusicTimer) {
    window.clearTimeout(layerAscendMusicTimer);
    layerAscendMusicTimer = null;
  }

  musicEpoch += 1;
  const epoch = musicEpoch;
  const prev = getCurrentMusicAudio();

  pauseAllMusicExcept(next);

  if (prev && prev !== next) {
    try {
      prev.pause();
    } catch { /* ignore */ }
    fadeAudioVolume(prev, 0, MUSIC_FADE_OUT_MS, () => {
      if (epoch !== musicEpoch) return;
      try {
        prev.pause();
        prev.currentTime = 0;
        prev.volume = 0;
      } catch { /* ignore */ }
    });
  }

  currentMusicLayer = trackKey;
  musicTargetVolume = MUSIC_VOLUME;

  if (activeVoiceIds.size === 0 && !activeStinger) {
    musicDucked = false;
    musicDuckIsStinger = false;
  }

  const targetVol = musicDucked ? getMusicDuckTarget() : fadeIn ? 0 : MUSIC_VOLUME;
  next.volume = targetVol;

  const p = next.play();
  const onPlaying = () => {
    if (epoch !== musicEpoch) {
      try {
        next.pause();
        next.currentTime = 0;
        next.volume = 0;
      } catch { /* ignore */ }
      return;
    }
    if (musicDucked) {
      applyMusicDuck(musicDuckIsStinger);
    } else if (fadeIn) {
      fadeAudioVolume(next, MUSIC_VOLUME, MUSIC_FADE_IN_MS);
    } else {
      next.volume = MUSIC_VOLUME;
    }
  };

  if (p?.then) p.then(onPlaying).catch(() => {});
  else onPlaying();
}

export function pauseLayerMusic() {
  if (musicFadeRaf) {
    cancelAnimationFrame(musicFadeRaf);
    musicFadeRaf = null;
  }
  const audio = getCurrentMusicAudio();
  if (audio) {
    try {
      audio.pause();
    } catch { /* ignore */ }
  }
}

export function resumeLayerMusic(layerId) {
  playLayerMusic(layerId, false);
}

export function stopLayerMusic() {
  musicEpoch += 1;
  if (layerAscendMusicTimer) {
    window.clearTimeout(layerAscendMusicTimer);
    layerAscendMusicTimer = null;
  }
  if (musicFadeRaf) {
    cancelAnimationFrame(musicFadeRaf);
    musicFadeRaf = null;
  }
  if (sfxDuckRaf) {
    cancelAnimationFrame(sfxDuckRaf);
    sfxDuckRaf = null;
  }
  musicDucked = false;
  musicDuckIsStinger = false;
  musicTargetVolume = MUSIC_VOLUME;
  for (const audio of musicCache.values()) {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
    } catch { /* ignore */ }
  }
  currentMusicLayer = null;
}

export function stopGameAudio() {
  if (layerAscendMusicTimer) {
    window.clearTimeout(layerAscendMusicTimer);
    layerAscendMusicTimer = null;
  }

  clearStinger();

  for (const voice of [...gameplayVoices]) {
    stopVoiceEntry(voice);
  }
  gameplayVoices.length = 0;
  activeVoiceIds.clear();

  musicDucked = false;
  musicDuckIsStinger = false;
  stopLayerMusic();
}
