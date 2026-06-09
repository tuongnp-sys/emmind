/** Poki SDK adapter — enable with ?platform=poki or on poki.com */

export async function platformInit() {
  const sdk = window.PokiSDK;
  if (!sdk?.init) return false;
  try {
    await sdk.init();
    return true;
  } catch {
    return false;
  }
}

export function reportLoading() {}

export function loadingFinished() {
  window.PokiSDK?.gameLoadingFinished?.();
}

export function gameplayStart() {
  window.PokiSDK?.gameplayStart?.();
}

export function gameplayStop() {
  window.PokiSDK?.gameplayStop?.();
}

export function happyTime() {}

export function pingLevelComplete() {}

export function pingGameOver() {}

export async function commercialBreak() {
  const sdk = window.PokiSDK;
  if (!sdk?.commercialBreak) return;
  try {
    await sdk.commercialBreak();
  } catch {
    /* ad skipped */
  }
}
