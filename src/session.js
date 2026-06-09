import {
  storageGetItem,
  storageSetItem,
  storageRemoveItem,
  PROFILE_KEY_EXPORT,
  LEADERBOARD_KEY_EXPORT,
  USERNAME_KEY_EXPORT,
} from '../platform/storage.js';

const PROFILE_KEY = PROFILE_KEY_EXPORT;
const LEADERBOARD_KEY = LEADERBOARD_KEY_EXPORT;
const USERNAME_KEY = USERNAME_KEY_EXPORT;

export function mapProfile(profile) {
  return {
    username: profile.username || 'Player',
    displayName: profile.displayName || profile.username || 'Player',
    highScore: profile.highScore ?? 0,
    maxLayer: profile.maxLayer ?? 0,
    energy: 99,
    isVip: true,
    goldBalance: 0,
  };
}

function readJson(key, fallback) {
  try {
    const raw = storageGetItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  storageSetItem(key, JSON.stringify(value));
}

export function getStoredUsername() {
  return storageGetItem(USERNAME_KEY) || '';
}

export function setStoredUsername(username) {
  storageSetItem(USERNAME_KEY, username);
}

export function clearSession() {
  storageRemoveItem(PROFILE_KEY);
  storageRemoveItem(USERNAME_KEY);
}

function defaultProfile(username) {
  return {
    username,
    displayName: username,
    highScore: 0,
    maxLayer: 0,
  };
}

export async function getProfile(username) {
  const name = String(username || getStoredUsername() || '').trim();
  if (!name) return null;

  const profiles = readJson(PROFILE_KEY, {});
  const profile = profiles[name] || defaultProfile(name);
  return mapProfile(profile);
}

function saveProfileRow(username, patch) {
  const profiles = readJson(PROFILE_KEY, {});
  const base = profiles[username] || defaultProfile(username);
  profiles[username] = { ...base, ...patch, username };
  writeJson(PROFILE_KEY, profiles);
  return mapProfile(profiles[username]);
}

export async function login(username) {
  const name = String(username || '').trim().slice(0, 24);
  if (!name) throw new Error('Enter a name to play.');
  setStoredUsername(name);
  return getProfile(name);
}

export async function startGame(username) {
  const user = await getProfile(username);
  if (!user) throw new Error('Not signed in.');
  return { allowed: true, user };
}

export async function saveScore(username, score, maxLayer) {
  const name = String(username || getStoredUsername() || '').trim();
  if (!name) return { isNewRecord: false, user: null };

  const profiles = readJson(PROFILE_KEY, {});
  const prev = profiles[name] || defaultProfile(name);
  const parsedScore = Math.floor(Number(score) || 0);
  const parsedLayer =
    Number.isFinite(maxLayer) && maxLayer >= 1 && maxLayer <= 7
      ? Math.floor(maxLayer)
      : prev.maxLayer;

  const isNewRecord = parsedScore > (prev.highScore || 0);
  const nextMaxLayer = Math.max(prev.maxLayer || 0, parsedLayer);

  const user = saveProfileRow(name, {
    highScore: isNewRecord ? parsedScore : prev.highScore,
    maxLayer: nextMaxLayer,
  });

  if (isNewRecord) {
    const board = readJson(LEADERBOARD_KEY, []);
    const filtered = board.filter((e) => e.username !== name);
    filtered.push({
      username: name,
      highScore: parsedScore,
      maxLayer: nextMaxLayer,
    });
    filtered.sort((a, b) => b.highScore - a.highScore);
    writeJson(LEADERBOARD_KEY, filtered.slice(0, 50));
  }

  return { isNewRecord, user };
}

export async function getLeaderboard(limit = 10) {
  const board = readJson(LEADERBOARD_KEY, []);
  const profiles = readJson(PROFILE_KEY, {});
  const merged = new Map();

  for (const entry of board) {
    merged.set(entry.username, entry);
  }
  for (const [username, profile] of Object.entries(profiles)) {
    if (!merged.has(username) && profile.highScore > 0) {
      merged.set(username, {
        username,
        highScore: profile.highScore,
        maxLayer: profile.maxLayer ?? 0,
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.highScore - a.highScore)
    .slice(0, limit);
}
