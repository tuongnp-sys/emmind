/** GamePix SDK adapter — enable with ?platform=gamepix */

let pauseHandler = null;
let resumeHandler = null;
let soundOnHandler = null;
let soundOffHandler = null;

export function registerGamePixHandlers({ onPause, onResume, onSoundOn, onSoundOff } = {}) {
  pauseHandler = onPause ?? null;
  resumeHandler = onResume ?? null;
  soundOnHandler = onSoundOn ?? null;
  soundOffHandler = onSoundOff ?? null;
}

function bindGamePixCallbacks() {
  const gp = window.GamePix;
  if (!gp?.on) return;

  gp.on.pause = () => pauseHandler?.();
  gp.on.resume = () => resumeHandler?.();
  gp.on.soundOn = () => soundOnHandler?.();
  gp.on.soundOff = () => soundOffHandler?.();
}

function waitForGamePix(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (window.GamePix) {
      resolve(true);
      return;
    }
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (window.GamePix) {
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

export async function platformInit() {
  const ready = window.GamePix ? true : await waitForGamePix();
  bindGamePixCallbacks();
  window.GamePix?.game?.gameLoading?.(0);
  return ready && Boolean(window.GamePix);
}

export function reportLoading(percent) {
  const n = Math.max(0, Math.min(100, Math.floor(percent)));
  window.GamePix?.game?.gameLoading?.(n);
}

export function loadingFinished() {
  return new Promise((resolve) => {
    const gp = window.GamePix?.game;
    if (!gp?.gameLoaded) {
      resolve();
      return;
    }
    gp.gameLoaded(() => resolve());
  });
}

/** GamePix uses game.ping — not generic gameplay start/stop. */
export function gameplayStart() {}

export function gameplayStop() {}

export function happyTime() {}

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

export async function commercialBreak() {
  const fn = window.GamePix?.interstitialAd;
  if (!fn) return;
  try {
    await fn.call(window.GamePix);
  } catch {
    /* portal may skip ad */
  }
}
