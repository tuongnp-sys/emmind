/** CrazyGames SDK adapter — enable with ?platform=crazygames or on crazygames.com */

function sdkAvailable() {
  const env = window.CrazyGames?.SDK?.environment;
  return env === 'local' || env === 'crazygames';
}

export async function platformInit() {
  const sdk = window.CrazyGames?.SDK;
  if (!sdk?.init) return false;
  try {
    await sdk.init();
    return sdkAvailable();
  } catch {
    return false;
  }
}

export function reportLoading() {}

export async function loadingFinished() {
  if (!sdkAvailable()) return true;
  window.CrazyGames?.SDK?.game?.sdkGameLoadingStop?.();
  return true;
}

export function gameplayStart() {
  if (!sdkAvailable()) return;
  window.CrazyGames?.SDK?.game?.gameplayStart?.();
}

export function gameplayStop() {
  if (!sdkAvailable()) return;
  window.CrazyGames?.SDK?.game?.gameplayStop?.();
}

export function happyTime() {
  if (!sdkAvailable()) return;
  window.CrazyGames?.SDK?.game?.happyTime?.();
}

export function reportScore() {}

export function reportLevel() {}

export function readGamePixLang() {
  return 'en';
}

export function pingLevelComplete() {}

export function pingGameOver() {}

export async function commercialBreak() {
  const ad = window.CrazyGames?.SDK?.ad;
  if (!ad?.requestAd || !sdkAvailable()) return;
  try {
    await ad.requestAd('midgame');
  } catch {
    /* ad skipped */
  }
}
