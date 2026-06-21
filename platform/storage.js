/** Portal-safe persistence — localStorage with try/catch; CrazyGames SDK.data; GamePix.localStorage. */

const MIGRATION_FLAG = 'emmind_storage_migrated_v1';

let useCrazyGamesData = false;
let useGamePixStorage = false;

function crazyData() {
  return window.CrazyGames?.SDK?.data ?? null;
}

function gamePixStorage() {
  return window.GamePix?.localStorage ?? null;
}

export function storageGetItem(key) {
  try {
    if (useCrazyGamesData) {
      return crazyData()?.getItem(key) ?? null;
    }
    if (useGamePixStorage) {
      return gamePixStorage()?.getItem(key) ?? null;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSetItem(key, value) {
  try {
    if (useCrazyGamesData) {
      crazyData()?.setItem(key, value);
      return true;
    }
    if (useGamePixStorage) {
      gamePixStorage()?.setItem(key, value);
      return true;
    }
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemoveItem(key) {
  try {
    if (useCrazyGamesData) {
      crazyData()?.removeItem(key);
      return true;
    }
    if (useGamePixStorage) {
      gamePixStorage()?.removeItem(key);
      return true;
    }
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function migrateLocalKeysToCrazyGames() {
  const data = crazyData();
  if (!data) return;

  try {
    if (data.getItem(MIGRATION_FLAG)) return;
  } catch {
    return;
  }

  const keys = [PROFILE_KEY_EXPORT, LEADERBOARD_KEY_EXPORT, USERNAME_KEY_EXPORT];
  for (const key of keys) {
    try {
      const localVal = localStorage.getItem(key);
      if (localVal != null && data.getItem(key) == null) {
        data.setItem(key, localVal);
      }
    } catch {
      /* ignore per-key */
    }
  }
  try {
    data.setItem(MIGRATION_FLAG, '1');
  } catch {
    /* ignore */
  }
}

function migrateLocalKeysToGamePix() {
  const gp = gamePixStorage();
  if (!gp) return;

  try {
    if (gp.getItem(MIGRATION_FLAG)) return;
  } catch {
    return;
  }

  const keys = [PROFILE_KEY_EXPORT, LEADERBOARD_KEY_EXPORT, USERNAME_KEY_EXPORT];
  for (const key of keys) {
    try {
      const localVal = localStorage.getItem(key);
      if (localVal != null && gp.getItem(key) == null) {
        gp.setItem(key, localVal);
      }
    } catch {
      /* ignore per-key */
    }
  }
  try {
    gp.setItem(MIGRATION_FLAG, '1');
  } catch {
    /* ignore */
  }
}

export const PROFILE_KEY_EXPORT = 'emmind_profile';
export const LEADERBOARD_KEY_EXPORT = 'emmind_leaderboard';
export const USERNAME_KEY_EXPORT = 'emmind_username';

async function waitForGamePixStorage(timeoutMs = 12000) {
  if (gamePixStorage()) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (gamePixStorage()) return true;
    await new Promise((r) => requestAnimationFrame(r));
  }
  return Boolean(gamePixStorage());
}

/** Call after platform SDK init. */
export async function initPlatformStorage(platformId) {
  if (platformId === 'gamepix') {
    await waitForGamePixStorage();
  }
  useCrazyGamesData = platformId === 'crazygames' && Boolean(crazyData());
  useGamePixStorage = platformId === 'gamepix' && Boolean(gamePixStorage());

  if (useCrazyGamesData) {
    migrateLocalKeysToCrazyGames();
  }
  if (useGamePixStorage) {
    migrateLocalKeysToGamePix();
    try {
      gamePixStorage()?.setItem('emmind_sdk_probe', String(Date.now()));
    } catch {
      /* ignore */
    }
  }
}

export function isGamePixStorageActive() {
  return useGamePixStorage;
}

export function isUsingCloudStorage() {
  return useCrazyGamesData || useGamePixStorage;
}
