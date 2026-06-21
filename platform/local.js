/** No-op platform adapter for local dev and itch.io zip builds. */

export async function platformInit() {
  return true;
}

export function reportLoading() {}

export async function loadingFinished() {
  return true;
}

export function gameplayStart() {}

export function gameplayStop() {}

export function happyTime() {}

export function reportScore() {}

export function reportLevel() {}

export function readGamePixLang() {
  return 'en';
}

export function pingLevelComplete() {}

export function pingGameOver() {}

export async function commercialBreak() {}
