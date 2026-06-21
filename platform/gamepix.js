/** GamePix SDK adapter — enable with ?platform=gamepix or VITE_PORTAL_TARGET=gamepix */

let pauseHandler = null;
let resumeHandler = null;
let soundOnHandler = null;
let soundOffHandler = null;

/** Introspection for embed QA / SDK toolkit parity checks. */
export const gamePixProbe = {
  handlersBound: false,
  gameLoadedCalled: false,
  langRead: false,
  lang: 'en',
  scoreUpdates: 0,
  levelUpdates: 0,
  happyMoments: 0,
  interstitialCalls: 0,
  storageReady: false,
};

function getBridge() {
  return typeof window !== 'undefined' ? window.__emmindGamePixBridge : null;
}

function syncProbeFromBridge() {
  const bridge = getBridge();
  if (!bridge) return;
  if (bridge.handlersBound) gamePixProbe.handlersBound = true;
  if (bridge.gameLoadedCalled) gamePixProbe.gameLoadedCalled = true;
}

export function registerGamePixHandlers({ onPause, onResume, onSoundOn, onSoundOff } = {}) {
  pauseHandler = onPause ?? null;
  resumeHandler = onResume ?? null;
  soundOnHandler = onSoundOn ?? null;
  soundOffHandler = onSoundOff ?? null;

  const bridge = getBridge();
  if (bridge?.setHandlers) {
    bridge.setHandlers({
      onPause: () => pauseHandler?.(),
      onResume: () => resumeHandler?.(),
      onSoundOn: () => soundOnHandler?.(),
      onSoundOff: () => soundOffHandler?.(),
    });
  }
  bindGamePixCallbacks();
}

function waitFor(predicate, timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (predicate()) {
      resolve(true);
      return;
    }
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (predicate()) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function waitForGamePix(timeoutMs = 12000) {
  return waitFor(() => Boolean(window.GamePix), timeoutMs);
}

function waitForGamePixOn(timeoutMs = 12000) {
  return waitFor(() => Boolean(window.GamePix?.on), timeoutMs);
}

function waitForGamePixGameApi(timeoutMs = 12000) {
  return waitFor(() => Boolean(window.GamePix?.game?.gameLoaded), timeoutMs);
}

export function waitForGamePixLocalStorage(timeoutMs = 12000) {
  return waitFor(() => Boolean(window.GamePix?.localStorage), timeoutMs);
}

export function bindGamePixCallbacks() {
  const bridge = getBridge();
  if (bridge?.bind?.()) {
    syncProbeFromBridge();
    return true;
  }

  const gp = window.GamePix;
  if (!gp?.on) return false;

  gp.on.pause = () => pauseHandler?.();
  gp.on.resume = () => resumeHandler?.();
  gp.on.soundOn = () => soundOnHandler?.();
  gp.on.soundOff = () => soundOffHandler?.();
  gamePixProbe.handlersBound = true;
  return true;
}

export async function ensureGamePixSdkReady() {
  const root = await waitForGamePix();
  if (!root) return false;
  const onReady = await waitForGamePixOn();
  if (!onReady) {
    console.warn('[Emmind] GamePix.on not available');
    return false;
  }
  bindGamePixCallbacks();
  syncProbeFromBridge();
  return true;
}

export async function platformInit() {
  const ready = await ensureGamePixSdkReady();
  if (!ready) return false;

  readGamePixLang();
  const bridge = getBridge();
  if (bridge?.reportLoading) {
    bridge.reportLoading(0);
  } else {
    window.GamePix?.game?.gameLoading?.(0);
  }
  return true;
}

export function reportLoading(percent) {
  const bridge = getBridge();
  if (bridge?.reportLoading) {
    bridge.reportLoading(percent);
    return;
  }
  const n = Math.max(0, Math.min(100, Math.floor(percent)));
  window.GamePix?.game?.gameLoading?.(n);
}

/** @returns {Promise<boolean>} true only when GamePix.game.gameLoaded callback fired */
export async function loadingFinished() {
  const sdkReady = await ensureGamePixSdkReady();
  if (!sdkReady) {
    console.warn('[Emmind] GamePix SDK not ready — gameLoaded skipped');
    return false;
  }

  const apiReady = await waitForGamePixGameApi();
  if (!apiReady) {
    console.warn('[Emmind] GamePix.game.gameLoaded unavailable');
    return false;
  }

  bindGamePixCallbacks();
  reportLoading(100);

  const bridge = getBridge();
  if (bridge?.callGameLoaded) {
    return new Promise((resolve) => {
      const started = bridge.callGameLoaded(() => {
        gamePixProbe.gameLoadedCalled = true;
        gamePixProbe.handlersBound = true;
        bindGamePixCallbacks();
        bridge.fireOptionalProbe?.();
        requestAnimationFrame(() => {
          readGamePixLang();
          reportLevel(1);
          reportScore(0);
          resolve(true);
        });
      });
      if (!started) resolve(false);
    });
  }

  const gp = window.GamePix.game;
  return new Promise((resolve) => {
    gp.gameLoaded(() => {
      gamePixProbe.gameLoadedCalled = true;
      bindGamePixCallbacks();
      requestAnimationFrame(() => {
        readGamePixLang();
        reportLevel(1);
        reportScore(0);
        resolve(true);
      });
    });
  });
}

/** GamePix uses game.ping — not generic gameplay start/stop. */
export function gameplayStart() {}

export function gameplayStop() {}

export function readGamePixLang() {
  try {
    if (window.GamePix?.lang) {
      const lang = GamePix.lang();
      if (typeof lang === 'string' && lang.length > 0) {
        gamePixProbe.lang = lang;
        gamePixProbe.langRead = true;
        return lang;
      }
    }
  } catch {
    /* ignore */
  }
  gamePixProbe.lang = 'en';
  gamePixProbe.langRead = Boolean(window.GamePix?.lang);
  return 'en';
}

export function happyTime() {
  if (!window.GamePix?.happyMoment) return;
  try {
    GamePix.happyMoment();
    gamePixProbe.happyMoments += 1;
  } catch {
    /* ignore */
  }
}

export function reportScore(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || !window.GamePix?.updateScore) return;
  try {
    GamePix.updateScore(n);
    gamePixProbe.scoreUpdates += 1;
  } catch {
    /* ignore */
  }
}

export function reportLevel(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1 || !window.GamePix?.updateLevel) return;
  try {
    GamePix.updateLevel(n);
    gamePixProbe.levelUpdates += 1;
  } catch {
    /* ignore */
  }
}

function ping(type, payload) {
  window.GamePix?.game?.ping?.(type, payload);
}

export function pingLevelComplete(score, layer, achievements = {}) {
  ping('level_complete', {
    score,
    level: String(layer),
    achievements,
  });
}

export function pingGameOver(score, layer, achievements = {}) {
  ping('game_over', {
    score,
    level: String(layer),
    achievements,
  });
}

/** Pause game before calling; resume in caller after this resolves (GamePix SDK Bible). */
export async function commercialBreak() {
  const gp = window.GamePix;
  if (!gp?.interstitialAd) return { success: false };
  gamePixProbe.interstitialCalls += 1;
  try {
    const result = await gp.interstitialAd();
    return result ?? { success: true };
  } catch {
    return { success: false };
  }
}
