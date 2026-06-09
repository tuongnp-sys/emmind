/** No-op platform adapter for local dev and itch.io zip builds. */

export async function platformInit() {
  return true;
}

export function reportLoading() {}

export function loadingFinished() {}

export function gameplayStart() {}

export function gameplayStop() {}

export function happyTime() {}

export function pingLevelComplete() {}

export function pingGameOver() {}

export async function commercialBreak() {}
