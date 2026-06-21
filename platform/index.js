import * as local from './local.js';
import * as crazygames from './crazygames.js';
import * as poki from './poki.js';
import * as gamepix from './gamepix.js';
import { loadPlatformSdk } from './bootstrap.js';
import { initPlatformStorage, isGamePixStorageActive } from './storage.js';

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

/** GamePix ZIP must use gamepix adapter on any host (review CDN may not include "gamepix" in hostname). */
function resolvePlatformId() {
  const builtIn = import.meta.env.VITE_PORTAL_TARGET;
  if (builtIn === 'gamepix' || builtIn === 'poki' || builtIn === 'crazygames') {
    return builtIn;
  }
  return detectPlatformId();
}

const adapters = { local, crazygames, poki, gamepix };
const activeId = resolvePlatformId();
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
export const reportScore = active.reportScore;
export const reportLevel = active.reportLevel;
export const readGamePixLang = active.readGamePixLang;
export const pingLevelComplete = active.pingLevelComplete;
export const pingGameOver = active.pingGameOver;
export const registerGamePixHandlers = gamepix.registerGamePixHandlers;
export const gamePixProbe = gamepix.gamePixProbe;

export async function platformBootstrap(onProgress) {
  onProgress?.(5);
  if (activeId !== 'local') {
    await loadPlatformSdk(activeId);
  }
  onProgress?.(15);

  const sdkOk = await active.platformInit();
  onProgress?.(30);

  await initPlatformStorage(activeId);
  if (activeId === 'gamepix') {
    gamepix.gamePixProbe.storageReady = isGamePixStorageActive();
  }
  onProgress?.(40);

  return sdkOk;
}

export const platformInit = platformBootstrap;
