import * as local from './local.js';
import * as crazygames from './crazygames.js';
import * as poki from './poki.js';
import * as gamepix from './gamepix.js';
import { loadPlatformSdk } from './bootstrap.js';
import { initPlatformStorage } from './storage.js';

function detectPlatformId() {
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('platform');
  if (forced === 'crazygames' || forced === 'poki' || forced === 'gamepix' || forced === 'local') {
    return forced;
  }

  const host = window.location.hostname.toLowerCase();
  if (host.includes('crazygames')) return 'crazygames';
  if (host.includes('poki')) return 'poki';
  if (host.includes('gamepix')) return 'gamepix';
  return 'local';
}

const adapters = { local, crazygames, poki, gamepix };
const activeId = detectPlatformId();
const active = adapters[activeId] || local;

export const platformId = activeId;

export const isPortalMode =
  activeId !== 'local' || import.meta.env.VITE_PORTAL === '1';

export const reportLoading = active.reportLoading;
export const loadingFinished = active.loadingFinished;
export const gameplayStart = active.gameplayStart;
export const gameplayStop = active.gameplayStop;
export const commercialBreak = active.commercialBreak;
export const happyTime = active.happyTime;
export const pingLevelComplete = active.pingLevelComplete;
export const pingGameOver = active.pingGameOver;
export const registerGamePixHandlers = gamepix.registerGamePixHandlers;

export async function platformBootstrap(onProgress) {
  onProgress?.(5);
  if (activeId !== 'local') {
    await loadPlatformSdk(activeId);
  }
  onProgress?.(15);

  const sdkOk = await active.platformInit();
  onProgress?.(30);

  await initPlatformStorage(activeId);
  onProgress?.(40);

  return sdkOk;
}

export const platformInit = platformBootstrap;
