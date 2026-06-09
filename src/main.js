import {
  Background,
  LAYER_TRANSITION_DURATION,
  MAX_LAYER,
  MAX_DOWNGRADE_STRIKES,
  getLayerConfig,
  getLayerDuration,
  getLayerName,
  getLayerAscendMessage,
  getLayerDescendMessage,
  getLayerPracticeTarget,
  getLayerSpeedFactor,
} from './background.js';
import { ParticleSystem } from './particles.js';
import { evaluateAchievements, getAchievementLabel } from './achievements.js';
import { Player } from './player.js';
import {
  WorldManager,
  clearTemptationsInShockwave,
  circleIntersectsRect,
  rectsOverlap,
} from './obstacle.js';
import {
  preloadAudioAssets,
  playSfx,
  playLayerMusic,
  playLayerAscendStinger,
  pauseLayerMusic,
  resumeLayerMusic,
  stopGameAudio,
} from './audio.js';
import { TouchJoystick } from './touch-joystick.js';
import {
  mapProfile,
  login as sessionLogin,
  getProfile as sessionGetProfile,
  getStoredUsername,
  setStoredUsername,
  clearSession,
  startGame as sessionStartGame,
  saveScore as sessionSaveScore,
  getLeaderboard as sessionGetLeaderboard,
} from './session.js';
import {
  platformBootstrap,
  platformId,
  isPortalMode,
  reportLoading,
  loadingFinished,
  gameplayStart,
  gameplayStop,
  commercialBreak,
  happyTime,
  pingLevelComplete,
  pingGameOver,
  registerGamePixHandlers,
} from '../platform/index.js';

/** Emmind standalone — no backend, no energy gate, no commerce. */
const STANDALONE = true;


const POINTS_PER_CLEAR = 10;
const POINTS_SCRIPTURE = 20;
const POINTS_SURVIVAL_INTERVAL = 3;
const POINTS_SURVIVAL_AMOUNT = 2;
const SCORE_LAYER_ASCEND_BASE = 40;
const SCORE_LAYER_ASCEND_BONUS_MAX = 60;
const COMBO_SCRIPTURE_THRESHOLD = 5;
const COMBO_SCORE_MULTIPLIER = 2;
const MAX_SHOCKWAVE_CLEARS_SCORED = 8;
const HALO_SCRIPTURE_GAIN = 25;
const HALO_SHOCKWAVE_COST = 30;
const HALO_MAX = 100;
const MINDFULNESS_ASCEND_THRESHOLD = 80;
const MINDFULNESS_HIT_SHIELD = 10;
const MINDFULNESS_HIT_DIRECT = 50;
/** Mobile: obstacles move 10% slower for easier reaction time. */
const MOBILE_OBSTACLE_SPEED_FACTOR = 0.9;
/** Mobile: extra inset on player hurtbox (~10% more forgiving). */
const MOBILE_HURTBOX_INSET = 3;
/** Matches portrait phones and landscape phones (wide but short viewport). */
const MOBILE_VIEWPORT_MQ =
  '(max-width: 768px), (max-height: 520px) and (max-width: 1100px) and (pointer: coarse)';
const MOBILE_OVERLAY_MQ = '(max-width: 768px)';
const DEFAULT_ENERGY_MAX = 5;
const HIT_FLASH_DURATION = 0.15;
const HIT_FLASH_MAX_ALPHA = 0.22;
const FLOATING_TEXT_MAX = 12;
const FLOATING_TEXT_DURATION = 0.8;
const FLOATING_TEXT_RISE = 48;
const PROTECTIVE_CHARGES_MAX = 2;
const ENLIGHTENMENT_HALO_RADIUS = 72;
const ENLIGHTENMENT_OVERLAY_DURATION = 2.5;
const DOWNGRADE_LAYER_AUDIO_DELAY_MS = 350;

/** Layout reference — game logic always uses this coordinate space; CSS scales display. */
const CANVAS_REF_WIDTH = 900;
const CANVAS_REF_HEIGHT = 520;
const CANVAS_MAX_WIDTH = CANVAS_REF_WIDTH;
const CANVAS_ASPECT = CANVAS_REF_HEIGHT / CANVAS_REF_WIDTH;
const USERNAME_STORAGE_KEY = 'emmind_username';

const GameState = Object.freeze({
  IDLE: 'IDLE',
  START: 'START',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY',
  SURRENDER: 'SURRENDER',
  ENLIGHTENMENT: 'ENLIGHTENMENT',
});

// --- DOM ---------------------------------------------------------------------

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let logicalWidth = CANVAS_REF_WIDTH;
let logicalHeight = CANVAS_REF_HEIGHT;
let resizeDebounceTimer = null;

const authPanel = document.getElementById('auth-panel');
const gameSection = document.getElementById('game-section');
const authError = document.getElementById('auth-error');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const rememberMeCheckbox = document.getElementById('remember-me');

const hudUsername = document.getElementById('hud-username');
const hudHighscore = document.getElementById('hud-highscore');
const hudEnergy = document.getElementById('hud-energy');
const hudEnergyCountdown = document.getElementById('hud-energy-countdown');
const btnLogout = document.getElementById('btn-logout');

const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardEmpty = document.getElementById('leaderboard-empty');
const leaderboardError = document.getElementById('leaderboard-error');
const vipBadge = document.getElementById('vip-badge');
const layerNameEl = document.getElementById('layer-name');
const gameAnnouncements = document.getElementById('game-announcements');

const leaderboardPanel = document.getElementById('leaderboard-panel');
const gamePlayStack = document.querySelector('.game-play-stack');
const gameStage = document.getElementById('game-stage');
const gameStageViewport = document.getElementById('game-stage-viewport');
const canvasWrap = document.querySelector('.canvas-wrap');
const gameStatsBar = document.getElementById('game-stats-bar');
const statLayer = document.getElementById('stat-layer');
const statProgress = document.getElementById('stat-progress');
const statCombo = document.getElementById('stat-combo');
const statLayerProgressFill = document.getElementById('stat-layer-progress-fill');
const statScore = document.getElementById('stat-score');
const statBest = document.getElementById('stat-best');
const statHalo = document.getElementById('stat-halo');
const statEnergy = document.getElementById('stat-energy');
const statShield = document.getElementById('stat-shield');
const statDowngrades = document.getElementById('stat-downgrades');
const statHaloFill = document.getElementById('stat-halo-fill');

const overlayStart = document.getElementById('overlay-start');
const startError = document.getElementById('start-error');
const btnStartGame = document.getElementById('btn-start-game');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const surrenderOverlay = document.getElementById('surrenderOverlay');
const overlayLayer = document.getElementById('overlay-layer');
const overlayEnlightenment = document.getElementById('overlay-enlightenment');
const victoryOverlay = document.getElementById('victoryOverlay');

const gameControls = document.getElementById('game-controls');
const gameSessionBar = document.getElementById('game-session-bar');
const sessionHudEnergy = document.getElementById('session-hud-energy');
const sessionHudEnergyCountdown = document.getElementById('session-hud-energy-countdown');
const btnPauseMobile = document.getElementById('btn-pause-mobile');
const btnResumeMobile = document.getElementById('btn-resume-mobile');
const btnStopMobile = document.getElementById('btn-stop-mobile');
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnStop = document.getElementById('btn-stop');

const touchControls = document.getElementById('touch-controls');
const touchDpad = document.getElementById('touch-dpad');
const touchJoystickMount = document.getElementById('touch-joystick-mount');
const touchLeft = document.getElementById('touch-left');
const touchRight = document.getElementById('touch-right');
const touchFlyUp = document.getElementById('touch-fly-up');
const touchFlyDown = document.getElementById('touch-fly-down');
const touchJump = document.getElementById('touch-jump');
const touchDown = document.getElementById('touch-down');
const touchShockwave = document.getElementById('touch-shockwave');

/** @type {TouchJoystick | null} */
let mobileJoystick = null;

const gameoverMessage = document.getElementById('gameover-message');
const finalScoreEl = document.getElementById('final-score');
const recordMessage = document.getElementById('record-message');
const surrenderMessage = document.getElementById('surrender-message');
const surrenderScoreEl = document.getElementById('surrender-score');
const surrenderRecordMessage = document.getElementById('surrender-record-message');
const layerTransitionTitle = document.getElementById('layer-transition-title');
const layerTransitionDesc = document.getElementById('layer-transition-desc');
const victoryScoreEl = document.getElementById('victory-score');
const victoryBestEl = document.getElementById('victory-best');
const victoryRecordMessage = document.getElementById('victory-record-message');
const gameoverRunSummary = document.getElementById('gameover-run-summary');
const surrenderRunSummary = document.getElementById('surrender-run-summary');
const victoryRunSummary = document.getElementById('victory-run-summary');

const MENU_OVERLAYS = [overlayStart];
const END_OVERLAYS = [victoryOverlay, gameOverOverlay, surrenderOverlay];
const ALL_OVERLAYS = [
  overlayStart,
  gameOverOverlay,
  surrenderOverlay,
  overlayLayer,
  overlayEnlightenment,
  victoryOverlay,
];

// --- Runtime state -----------------------------------------------------------

let currentUser = null;
let background = null;
let player = null;
let world = null;
let keys = {};

let gameState = GameState.IDLE;
let sessionToken = 0;
/** @type {'gameover' | 'victory' | 'surrender' | null} */
let lastRunEndState = null;
let isPaused = false;

let score = 0;
let currentLayer = 1;
let downgradeStrikes = 0;
let haloEnergy = 0;
let protectiveCharges = 0;
let layerElapsed = 0;
let layerDuration = 45;
let lastTime = 0;
let animFrameId = null;
let layerTransitionTimer = 0;
let layerTransitionAscending = false;
let pendingLayerUp = false;
let enlightenmentPulse = 0;
let hitFlashTimer = 0;
let suppressCanvasClickUntil = 0;
let lastShockwaveTouchMs = 0;
let victoryStingerPlayedThisRun = false;
let viewportSyncTimer = null;
/** @type {Set<HTMLElement>} */
const activePointerHolds = new Set();
/** Normalized analog from joystick when enabled (-1..1). */
const touchMoveVector = { x: 0, y: 0 };
let energyCountdownTimer = null;
/** @type {{ energy: number, isVip: boolean, nextRefillAt: string | null, msUntilRefill: number } | null} */
let energyStatus = null;
let rememberUsername = true;

let practiceScore = 0;
let practiceTarget = 180;
let survivalTimer = 0;
let scriptureCombo = 0;
let maxScriptureCombo = 0;
let scripturesCollectedRun = 0;
let shockwaveClearsThisWave = 0;
let enlightenmentMode = false;
let enlightenmentOverlayTimer = 0;
let practiceMindfulnessHintShown = false;
let enlightenmentClickBound = false;
/** @type {ParticleSystem | null} */
let particles = null;

// --- Floating feedback text --------------------------------------------------

const floatingTexts = {
  items: [],

  reset() {
    this.items = [];
  },

  spawn(x, y, label, kind = 'default') {
    if (this.items.length >= FLOATING_TEXT_MAX) {
      this.items.shift();
    }
    this.items.push({ x, y, label, kind, elapsed: 0 });
  },

  update(dt) {
    for (const item of this.items) {
      item.elapsed += dt;
    }
    this.items = this.items.filter((item) => item.elapsed < FLOATING_TEXT_DURATION);
  },

  draw(ctx) {
    for (const item of this.items) {
      const t = item.elapsed / FLOATING_TEXT_DURATION;
      const alpha = 1 - t;
      const drawY = item.y - t * FLOATING_TEXT_RISE;

      ctx.save();
      ctx.font = '600 14px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2;

      if (item.kind === 'halo') {
        ctx.fillStyle = `rgba(255, 240, 160, ${alpha})`;
        ctx.strokeStyle = `rgba(212, 184, 150, ${alpha * 0.55})`;
      } else if (item.kind === 'score') {
        ctx.fillStyle = `rgba(126, 184, 154, ${alpha})`;
        ctx.strokeStyle = `rgba(90, 140, 115, ${alpha * 0.55})`;
      } else if (item.kind === 'penalty') {
        ctx.fillStyle = `rgba(232, 160, 160, ${alpha})`;
        ctx.strokeStyle = `rgba(180, 90, 90, ${alpha * 0.55})`;
      } else {
        ctx.fillStyle = `rgba(232, 238, 242, ${alpha})`;
        ctx.strokeStyle = `rgba(138, 155, 168, ${alpha * 0.55})`;
      }

      ctx.strokeText(item.label, item.x, drawY);
      ctx.fillText(item.label, item.x, drawY);
      ctx.restore();
    }
  },
};

// --- Overlay control ---------------------------------------------------------

function announceGame(message) {
  if (!gameAnnouncements || !message) return;
  gameAnnouncements.textContent = '';
  gameAnnouncements.textContent = message;
}

function hideOverlay(el) {
  if (!el) return;
  el.classList.remove('is-visible');
  el.classList.add('is-hidden');
  el.setAttribute('aria-hidden', 'true');
  el.style.display = 'none';
}

function showOverlay(el) {
  if (!el) return;
  el.classList.remove('is-hidden');
  el.classList.add('is-visible');
  el.setAttribute('aria-hidden', 'false');
  el.style.display = 'flex';
}

function hideAllOverlays() {
  for (const el of ALL_OVERLAYS) hideOverlay(el);
}

function hideEndOverlays() {
  for (const el of END_OVERLAYS) hideOverlay(el);
}

function markTouchUiActive() {
  suppressCanvasClickUntil = Date.now() + 400;
}

function showGameControls(visible) {
  if (gameControls) {
    if (visible && !isMobileViewport()) {
      gameControls.classList.remove('is-hidden');
      gameControls.setAttribute('aria-hidden', 'false');
    } else {
      gameControls.classList.add('is-hidden');
      gameControls.setAttribute('aria-hidden', 'true');
    }
  }
  syncMobilePlayChrome(visible);
  syncTouchControls(visible);
  if (visible && isCompactPlayMode()) {
    remeasurePlayChromeAfterLayout();
  }
}

function isMobileViewport() {
  return window.matchMedia(MOBILE_VIEWPORT_MQ).matches;
}

/** Real phones/tablets — not desktop browser with a small iframe panel (e.g. IDE preview). */
function isTrueMobilePlay() {
  if (!isPlaying() || !isMobileViewport()) return false;
  if (window.self !== window.top && window.matchMedia('(pointer: fine)').matches) {
    return false;
  }
  return true;
}

/** Phone/tablet compact UI while a run is active. */
function isCompactPlayMode() {
  return isTrueMobilePlay();
}

function syncMobilePlayChrome(playingVisible) {
  if (!gameSection) return;
  const compact = playingVisible && isCompactPlayMode();
  gameSection.classList.toggle('is-playing-mobile', compact);
  document.body.classList.toggle('game-mobile-play', compact);

  if (gameSessionBar) {
    if (compact) {
      gameSessionBar.classList.remove('is-hidden');
      gameSessionBar.setAttribute('aria-hidden', 'false');
    } else {
      gameSessionBar.classList.add('is-hidden');
      gameSessionBar.setAttribute('aria-hidden', 'true');
    }
  }
  syncPauseButtons();
}

function isMobileOverlayViewport() {
  return window.matchMedia(MOBILE_OVERLAY_MQ).matches;
}

function shouldUseTouchControls() {
  return isMobileViewport() || 'ontouchstart' in window;
}

function syncLeaderboardPanelOpen() {
  if (!leaderboardPanel) return;
  if (isMobileViewport()) {
    leaderboardPanel.removeAttribute('open');
  } else {
    leaderboardPanel.setAttribute('open', '');
  }
}

function isLandscapeLayout() {
  return isMobileViewport() && window.matchMedia('(orientation: landscape)').matches;
}

function measurePlayChrome(compact) {
  if (!compact) {
    return { statsH: 0, sessionH: 0, touchH: 0, headerH: 0 };
  }

  let statsH = 0;
  let sessionH = 0;
  let touchH = 0;

  if (gameStatsBar && !gameStatsBar.classList.contains('is-hidden')) {
    statsH = gameStatsBar.offsetHeight || 0;
  }
  if (gameSessionBar && !gameSessionBar.classList.contains('is-hidden')) {
    sessionH = gameSessionBar.offsetHeight || 0;
  }
  if (touchControls?.classList.contains('is-visible')) {
    touchH = touchControls.offsetHeight || 0;
  } else if (touchControls) {
    const minH = parseFloat(getComputedStyle(touchControls).minHeight);
    touchH = Number.isFinite(minH) && minH > 0 ? minH : 48;
  }

  return { statsH, sessionH, touchH, headerH: 4 };
}

function remeasurePlayChromeAfterLayout() {
  requestAnimationFrame(() => {
    requestAnimationFrame(syncGameViewport);
  });
}

function scheduleSyncGameViewport() {
  if (viewportSyncTimer) clearTimeout(viewportSyncTimer);
  viewportSyncTimer = setTimeout(() => {
    viewportSyncTimer = null;
    syncGameViewport();
  }, 50);
}

/** Fit canvas to viewport — portrait taller, landscape column layout, desktop scrollable. */
function syncGameViewport() {
  const vv = window.visualViewport;
  const vh = Math.floor(vv?.height ?? window.innerHeight);
  const vw = Math.floor(vv?.width ?? window.innerWidth);
  const mobile = isMobileViewport();
  const landscape = isLandscapeLayout();
  const compact = isCompactPlayMode();

  let maxH;
  let maxW = CANVAS_MAX_WIDTH;

  if (mobile) {
    const overlayChrome = compact && isMobileOverlayViewport();
    const { statsH, sessionH, touchH, headerH } = measurePlayChrome(compact);
    const chromePad = compact ? 8 : 16;
    const overlayReserved = landscape ? 104 : 186;
    const chromeTotal = overlayChrome
      ? overlayReserved
      : statsH + sessionH + touchH + headerH + chromePad;
    const minStageH = landscape ? 120 : 180;
    const availableH = Math.max(minStageH, vh - chromeTotal);

    maxW = overlayChrome
      ? Math.min(CANVAS_MAX_WIDTH, Math.floor(vw))
      : Math.min(CANVAS_MAX_WIDTH, Math.floor(vw - 12));
    maxH = Math.min(availableH, Math.round(maxW * CANVAS_ASPECT));
    maxH = Math.max(minStageH, maxH);

    document.documentElement.style.setProperty('--touch-controls-h', `${touchH}px`);
  } else {
    maxW = Math.min(CANVAS_MAX_WIDTH, Math.floor(vw - 40));
    maxH = Math.round(maxW * CANVAS_ASPECT);
    const vhCap = Math.floor(vh * 0.82);
    if (maxH > vhCap) {
      maxH = vhCap;
      maxW = Math.round(maxH / CANVAS_ASPECT);
    }
    maxH = Math.max(480, maxH);
    document.documentElement.style.removeProperty('--touch-controls-h');
  }

  document.documentElement.style.setProperty('--game-stage-max-h', `${maxH}px`);
  document.documentElement.style.setProperty('--game-stage-max-w', `${maxW}px`);

  if (gamePlayStack) {
    gamePlayStack.classList.toggle('game-layout-landscape', landscape && mobile);
    gamePlayStack.classList.toggle('game-layout-portrait', mobile && !landscape);
    gamePlayStack.classList.toggle('game-layout-mobile', mobile);
    gamePlayStack.classList.toggle('game-layout-compact', compact);
  }

  scheduleResizeCanvas();
}

function scrollToGameCanvas() {
  const target = gameStage || gamePlayStack || canvasWrap;
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function isOutOfEnergy() {
  return STANDALONE ? false : Boolean(currentUser && !currentUser.isVip && currentUser.energy <= 0);
}

function clearTouchMovementKeys(force = false) {
  if (!force && activePointerHolds.size > 0) return;
  setLeft(false);
  setRight(false);
  setUp(false);
  setDown(false);
  touchMoveVector.x = 0;
  touchMoveVector.y = 0;
}

function hasActiveTouchMovement() {
  return activePointerHolds.size > 0 || touchMoveVector.x !== 0 || touchMoveVector.y !== 0;
}

function resetTouchInputForModeChange() {
  mobileJoystick?.release();
  activePointerHolds.clear();
  clearTouchMovementKeys(true);
}

function syncTouchLayout() {
  const inEnlightenment = isEnlightenment();
  const freeMove = !inEnlightenment && currentLayer >= 2;
  const groundMove = !inEnlightenment && currentLayer < 2;

  if (touchJoystickMount) {
    const showJoystick = groundMove;
    touchJoystickMount.classList.toggle('is-hidden', !showJoystick);
    touchJoystickMount.hidden = !showJoystick;
    touchJoystickMount.setAttribute('aria-hidden', showJoystick ? 'false' : 'true');
    if (!showJoystick) {
      mobileJoystick?.release();
    } else {
      mobileJoystick?.setLockAxis('x');
    }
  }

  if (touchDpad) {
    const showDpad = freeMove;
    touchDpad.classList.toggle('is-hidden', !showDpad);
    touchDpad.hidden = !showDpad;
    if (showDpad) {
      touchDpad.classList.remove('touch-dpad--ground');
      touchDpad.classList.add('touch-dpad--fly');
    }
  }

  for (const el of [touchLeft, touchRight]) {
    if (!el) continue;
    el.classList.add('is-hidden');
    el.hidden = true;
  }

  const showVert = freeMove;
  for (const el of [touchFlyUp, touchFlyDown]) {
    if (!el) continue;
    el.classList.toggle('is-hidden', !showVert);
    el.hidden = !showVert;
  }

  if (touchJump) {
    touchJump.classList.toggle('is-hidden', freeMove);
    touchJump.hidden = freeMove;
    if (!freeMove) {
      touchJump.textContent = 'Jump';
      touchJump.setAttribute('aria-label', 'Jump');
    }
  }

  if (touchDown) {
    touchDown.classList.add('is-hidden');
    touchDown.hidden = true;
  }
}

function setTouchMoveVector(dx, dy) {
  touchMoveVector.x = dx;
  touchMoveVector.y = dy;
}

function getPlayerMoveOptions() {
  if (isEnlightenment()) {
    return { cosmicDrift: true };
  }
  if (currentLayer < 2) {
    const opts = { freeMove: false };
    if (touchMoveVector.x !== 0) {
      opts.groundMoveX = touchMoveVector.x;
    }
    return opts;
  }

  let moveVector = null;
  if (touchMoveVector.x !== 0 || touchMoveVector.y !== 0) {
    moveVector = { x: touchMoveVector.x, y: touchMoveVector.y };
  }
  return { freeMove: true, moveVector };
}

function bindPointerHold(el, onPress, onRelease) {
  if (!el) return;

  let capturedId = null;

  const finish = (e) => {
    if (capturedId === null || e.pointerId !== capturedId) return;
    e.preventDefault();
    e.stopPropagation();
    if (el.hasPointerCapture?.(capturedId)) {
      el.releasePointerCapture(capturedId);
    }
    capturedId = null;
    el.classList.remove('is-pressed');
    activePointerHolds.delete(el);
    onRelease();
  };

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (capturedId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    markTouchUiActive();
    if (!isPlaying() || isPaused) return;
    capturedId = e.pointerId;
    try {
      el.setPointerCapture(capturedId);
    } catch {
      /* ignore */
    }
    el.classList.add('is-pressed');
    activePointerHolds.add(el);
    onPress();
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
  el.addEventListener('lostpointercapture', finish);
}

function setLeft(pressed) {
  keys.ArrowLeft = pressed;
  keys.KeyA = pressed;
  keys.a = pressed;
}

function setRight(pressed) {
  keys.ArrowRight = pressed;
  keys.KeyD = pressed;
  keys.d = pressed;
}

function setUp(pressed) {
  keys.ArrowUp = pressed;
  keys.KeyW = pressed;
  keys.w = pressed;
}

function setDown(pressed) {
  keys.ArrowDown = pressed;
  keys.KeyS = pressed;
  keys.s = pressed;
}

function syncShockwaveButton() {
  if (!touchShockwave) return;
  const showMobile =
    shouldUseTouchControls() &&
    isPlaying() &&
    !isEnlightenment() &&
    !isPaused &&
    (isCompactPlayMode() || touchControls?.classList.contains('is-visible'));
  const ready = haloEnergy >= HALO_SHOCKWAVE_COST;
  if (showMobile) {
    touchShockwave.removeAttribute('hidden');
    touchShockwave.hidden = false;
    touchShockwave.style.display = 'flex';
    touchShockwave.disabled = !ready;
    touchShockwave.classList.toggle('is-ready', ready);
    touchShockwave.classList.toggle('touch-btn-shockwave--dim', !ready);
  } else {
    touchShockwave.hidden = true;
    touchShockwave.style.display = '';
    touchShockwave.disabled = true;
    touchShockwave.classList.remove('is-ready', 'touch-btn-shockwave--dim');
  }
}

function getMobileObstacleSpeedFactor() {
  return isCompactPlayMode() && shouldUseTouchControls() ? MOBILE_OBSTACLE_SPEED_FACTOR : 1;
}

/** Player collision bounds — smaller hurtbox on mobile for forgiveness. */
function getPlayerCollisionBounds() {
  if (!player) return null;
  const b = player.getBounds();
  if (!isCompactPlayMode() || !shouldUseTouchControls()) return b;
  const inset = MOBILE_HURTBOX_INSET;
  return {
    x: b.x + inset,
    y: b.y + inset,
    w: Math.max(4, b.w - inset * 2),
    h: Math.max(4, b.h - inset * 2),
  };
}

function syncTouchControls(visible) {
  if (!touchControls) return;

  const show = visible && isPlaying() && shouldUseTouchControls();
  if (show) {
    touchControls.classList.remove('is-hidden');
    touchControls.classList.add('is-visible');
    touchControls.setAttribute('aria-hidden', 'false');
    syncTouchLayout();
    syncShockwaveButton();
    remeasurePlayChromeAfterLayout();
  } else {
    touchControls.classList.add('is-hidden');
    touchControls.classList.remove('is-visible');
    touchControls.setAttribute('aria-hidden', 'true');
    mobileJoystick?.release();
    activePointerHolds.clear();
    clearTouchMovementKeys(true);
    syncShockwaveButton();
    if (isMobileViewport()) scheduleSyncGameViewport();
  }
}

function syncSessionHudEnergy() {
  if (!currentUser || !sessionHudEnergy) return;

  sessionHudEnergy.textContent = currentUser.isVip ? '∞' : String(currentUser.energy);
  sessionHudEnergy.classList.remove(
    'session-energy-high',
    'session-energy-mid',
    'session-energy-low',
    'session-energy-vip'
  );

  if (currentUser.isVip) {
    sessionHudEnergy.classList.add('session-energy-vip');
  } else if (currentUser.energy > 2) {
    sessionHudEnergy.classList.add('session-energy-high');
  } else if (currentUser.energy >= 1) {
    sessionHudEnergy.classList.add('session-energy-mid');
  } else {
    sessionHudEnergy.classList.add('session-energy-low');
  }

}

function syncStatEnergyBadge() {
  if (!statEnergy) return;
  statEnergy.hidden = true;
}

function syncPauseButtons() {
  const paused = isPaused;
  const pairs = [
    [btnPause, btnResume],
    [btnPauseMobile, btnResumeMobile],
  ];
  for (const [pauseBtn, resumeBtn] of pairs) {
    if (!pauseBtn || !resumeBtn) continue;
    if (paused) {
      pauseBtn.classList.add('is-hidden');
      pauseBtn.hidden = true;
      resumeBtn.classList.remove('is-hidden');
      resumeBtn.hidden = false;
    } else {
      pauseBtn.classList.remove('is-hidden');
      pauseBtn.hidden = false;
      resumeBtn.classList.add('is-hidden');
      resumeBtn.hidden = true;
    }
  }
}

function setPaused(paused) {
  if (!isPlaying()) return;
  isPaused = paused;
  syncPauseButtons();
  syncShockwaveButton();
  if (isPaused) {
    pauseLayerMusic();
    gameplayStop();
  } else {
    lastTime = performance.now();
    resumeLayerMusic(currentLayer);
    gameplayStart();
  }
}

/** Fit canvas backing store to CSS size × DPR; game logic uses logicalWidth/Height. */
function resizeCanvas() {
  if (!canvas) return;

  const container = gameStageViewport || canvas.parentElement;
  if (!container) return;

  const maxW = Math.floor(container.clientWidth) || CANVAS_MAX_WIDTH;
  const maxHFromCss = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--game-stage-max-h'),
    10
  );
  const maxH =
    Math.floor(container.clientHeight) ||
    (Number.isFinite(maxHFromCss) && maxHFromCss > 0
      ? maxHFromCss
      : Math.round(maxW * CANVAS_ASPECT));

  const maxWCap = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--game-stage-max-w'),
    10
  );
  const boxW =
    Number.isFinite(maxWCap) && maxWCap > 0
      ? Math.min(maxW, maxWCap, Math.floor(container.clientWidth) || maxW)
      : Math.min(maxW, Math.floor(container.clientWidth) || CANVAS_MAX_WIDTH);

  let cssHeight = maxH > 0 ? maxH : Math.round(boxW * CANVAS_ASPECT);
  let cssWidth = Math.round(cssHeight / CANVAS_ASPECT);
  if (cssWidth > boxW) {
    cssWidth = boxW;
    cssHeight = Math.round(cssWidth * CANVAS_ASPECT);
  }

  const minW = isMobileViewport() ? 260 : 320;
  cssWidth = Math.max(minW, Math.min(cssWidth, CANVAS_MAX_WIDTH));
  cssHeight = Math.round(cssWidth * CANVAS_ASPECT);

  if (gameStageViewport) {
    gameStageViewport.style.height = `${cssHeight}px`;
    gameStageViewport.style.width = `${cssWidth}px`;
  }
  if (canvasWrap) {
    canvasWrap.style.width = `${cssWidth}px`;
    canvasWrap.style.height = `${cssHeight}px`;
  }

  const dpr = window.devicePixelRatio || 1;
  const scaleX = cssWidth / CANVAS_REF_WIDTH;
  const scaleY = cssHeight / CANVAS_REF_HEIGHT;

  logicalWidth = CANVAS_REF_WIDTH;
  logicalHeight = CANVAS_REF_HEIGHT;

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  ctx.setTransform(scaleX * dpr, 0, 0, scaleY * dpr, 0, 0);

  player?.onCanvasResize(CANVAS_REF_WIDTH, CANVAS_REF_HEIGHT);
  world?.setDimensions(CANVAS_REF_WIDTH, CANVAS_REF_HEIGHT);
  background?.setDimensions(CANVAS_REF_WIDTH, CANVAS_REF_HEIGHT);
}

function scheduleResizeCanvas() {
  if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = setTimeout(() => {
    resizeDebounceTimer = null;
    resizeCanvas();
    if (!isPlaying()) {
      syncTouchControls(false);
    }
  }, 150);
}

// --- State -------------------------------------------------------------------

function setGameState(next) {
  gameState = next;
  syncGameplayChrome();
}

function syncGameplayChrome() {
  const inRun = gameState === GameState.PLAYING || gameState === GameState.ENLIGHTENMENT;
  document.body.classList.toggle('game-active', inRun);
  if (gameSection) {
    gameSection.classList.toggle('is-playing-session', inRun);
  }
  if (gameStatsBar) {
    if (inRun) {
      gameStatsBar.classList.remove('is-hidden');
      gameStatsBar.setAttribute('aria-hidden', 'false');
    } else {
      gameStatsBar.classList.add('is-hidden');
      gameStatsBar.setAttribute('aria-hidden', 'true');
    }
  }
  if (gamePlayStack) {
    gamePlayStack.classList.toggle('game-view-locked', inRun);
  }
  if (inRun) {
    remeasurePlayChromeAfterLayout();
  } else if (isMobileViewport()) {
    syncGameViewport();
  }
}

function bumpSession() {
  sessionToken += 1;
  return sessionToken;
}

function isSessionActive(token) {
  return token === sessionToken;
}

function isPlaying() {
  return gameState === GameState.PLAYING || gameState === GameState.ENLIGHTENMENT;
}

function isEnlightenment() {
  return gameState === GameState.ENLIGHTENMENT;
}

function resetRunVariables() {
  score = 0;
  currentLayer = 1;
  downgradeStrikes = 0;
  haloEnergy = 0;
  protectiveCharges = 0;
  layerElapsed = 0;
  layerDuration = getLayerDuration(haloEnergy, HALO_MAX);
  practiceScore = 0;
  practiceTarget = getLayerPracticeTarget(1);
  survivalTimer = 0;
  scriptureCombo = 0;
  maxScriptureCombo = 0;
  scripturesCollectedRun = 0;
  shockwaveClearsThisWave = 0;
  enlightenmentMode = false;
  enlightenmentOverlayTimer = 0;
  practiceMindfulnessHintShown = false;
  unbindEnlightenmentClick();
  player?.setEnlightenment(0);
  player?.clearCosmicDrift();
  pendingLayerUp = false;
  layerTransitionTimer = 0;
  layerTransitionAscending = false;
  enlightenmentPulse = 0;
  isPaused = false;
  hitFlashTimer = 0;
  floatingTexts.reset();
  background?.setCosmicEnlightenment(false);
  background?.setVictoryGlow(0);
  particles?.reset();
  world?.reset();
  background?.setVictoryGlow(0);
  background?.setLayerElapsed(0);
  player?.setProtectiveCharges(0);
  victoryStingerPlayedThisRun = false;
}

function refreshLayerDuration() {
  layerDuration = getLayerDuration(haloEnergy, HALO_MAX);
}

function resetLayerTimer() {
  layerElapsed = 0;
  resetLayerProgress();
  background?.setLayerElapsed(0);
}

function stopGameLoop() {
  if (animFrameId != null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function startGameLoop() {
  stopGameLoop();
  lastTime = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);
}

function clampHalo(value) {
  return Math.max(0, Math.min(HALO_MAX, value));
}

function addHalo(amount) {
  haloEnergy = clampHalo(haloEnergy + amount);
}

function getMindfulnessPracticeFactor() {
  if (haloEnergy >= 30) return 1;
  if (haloEnergy >= 10) return 0.5;
  return 0.25;
}

function loseMindfulness(amount, options = {}) {
  if (!amount || amount <= 0 || !isPlaying() || isEnlightenment()) return 0;
  const before = haloEnergy;
  haloEnergy = clampHalo(haloEnergy - amount);
  const lost = Math.round(before - haloEnergy);
  if (lost > 0 && options.x != null && options.y != null) {
    floatingTexts.spawn(options.x, options.y, `-${lost}`, 'default');
  }
  refreshLayerDuration();
  if (
    practiceTarget > 0 &&
    practiceScore >= practiceTarget &&
    haloEnergy < MINDFULNESS_ASCEND_THRESHOLD
  ) {
    practiceMindfulnessHintShown = false;
  }
  return lost;
}

function grantProtectiveCharges() {
  const gained = 1 + Math.floor(Math.random() * 2);
  protectiveCharges = Math.min(PROTECTIVE_CHARGES_MAX, protectiveCharges + gained);
  player?.setProtectiveCharges(protectiveCharges);
  player?.triggerPickupFlash();
  return gained;
}

function getDisplayBestScore() {
  const saved = currentUser?.highScore ?? 0;
  return Math.max(saved, score);
}

function getScoreMultiplier() {
  return scriptureCombo >= COMBO_SCRIPTURE_THRESHOLD ? COMBO_SCORE_MULTIPLIER : 1;
}

function addScore(amount, options = {}) {
  if (!amount || amount <= 0 || !isPlaying()) return 0;
  const mult = options.applyCombo === false ? 1 : getScoreMultiplier();
  const gained = Math.round(amount * mult);
  score += gained;
  if (!isEnlightenment()) {
    const practiceGain = Math.round(gained * getMindfulnessPracticeFactor());
    if (practiceGain > 0) {
      practiceScore += practiceGain;
    }
  }
  if (options.x != null && options.y != null) {
    const label = mult > 1 ? `+${gained} x${mult}` : `+${gained}`;
    floatingTexts.spawn(options.x, options.y, label, options.kind || 'score');
  }
  return gained;
}

function resetLayerProgress() {
  practiceScore = 0;
  practiceTarget = getLayerPracticeTarget(currentLayer);
  survivalTimer = 0;
  refreshLayerDuration();
}

function getRunStatsSnapshot(victory = false) {
  return {
    score,
    maxLayer: currentLayer,
    victory,
    downgradeStrikes,
    scripturesCollected: scripturesCollectedRun,
    maxCombo: maxScriptureCombo,
  };
}

function formatRunSummaryLines() {
  return [
    `Layer reached: ${currentLayer} / ${MAX_LAYER}`,
    `Scriptures: ${scripturesCollectedRun} · Best flow: ${maxScriptureCombo}`,
    `Gentle reminders: ${downgradeStrikes} / ${MAX_DOWNGRADE_STRIKES}`,
  ];
}

function fillRunSummaryElement(el, achievementIds = []) {
  if (!el) return;
  const lines = formatRunSummaryLines();
  if (achievementIds.length > 0) {
    const names = achievementIds.map(getAchievementLabel).join(', ');
    lines.push(`New focus: ${names}`);
  }
  el.textContent = lines.join(' · ');
}

// --- Run stats (DOM above canvas) --------------------------------------------

function updateRunStatsDom() {
  if (!gameStatsBar || !isPlaying()) return;

  const best = getDisplayBestScore();
  const strikeColors = ['#8a9ba8', '#d4a574', '#c97b7b'];
  const strikeIdx = Math.min(downgradeStrikes, 2);
  const progressPct =
    practiceTarget > 0
      ? Math.min(100, (practiceScore / practiceTarget) * 100)
      : 100;

  if (statLayer) statLayer.textContent = `${currentLayer} / ${MAX_LAYER}`;
  if (statProgress) {
    statProgress.textContent =
      practiceTarget > 0 ? `${practiceScore} / ${practiceTarget}` : `${practiceScore}`;
  }
  if (statCombo) {
    const mult = getScoreMultiplier();
    statCombo.textContent = mult > 1 ? `${scriptureCombo} x${mult}` : String(scriptureCombo);
  }
  if (statScore) statScore.textContent = String(score);
  if (statBest) statBest.textContent = String(best);
  if (statHalo) statHalo.textContent = `${Math.round(haloEnergy)}%`;
  if (statHaloFill) statHaloFill.style.width = `${(haloEnergy / HALO_MAX) * 100}%`;
  if (statLayerProgressFill) {
    statLayerProgressFill.style.width = `${progressPct}%`;
  }

  if (statShield) {
    if (protectiveCharges > 0) {
      statShield.hidden = false;
      statShield.textContent = `Shield ${protectiveCharges}/${PROTECTIVE_CHARGES_MAX}`;
    } else {
      statShield.hidden = true;
    }
  }

  if (statDowngrades) {
    statDowngrades.textContent = `Gentle reminders ${downgradeStrikes}/${MAX_DOWNGRADE_STRIKES}`;
    statDowngrades.style.color = strikeColors[strikeIdx];
  }

  syncStatEnergyBadge();
}

function drawHitFlash() {
  if (hitFlashTimer <= 0) return;

  const alpha = (hitFlashTimer / HIT_FLASH_DURATION) * HIT_FLASH_MAX_ALPHA;
  ctx.save();
  ctx.fillStyle = `rgba(201, 123, 123, ${alpha})`;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  ctx.restore();
}

function drawPlayerHaloAura() {
  if (!player) return;

  const c = player.getCenter();
  const pulse = 0.85 + Math.sin(performance.now() * 0.004) * 0.15;

  if (isEnlightenment()) {
    const r = ENLIGHTENMENT_HALO_RADIUS;
    ctx.save();
    const glow = ctx.createRadialGradient(c.x, c.y, r * 0.2, c.x, c.y, r);
    glow.addColorStop(0, `rgba(255, 252, 220, ${0.75 * pulse})`);
    glow.addColorStop(0.45, `rgba(255, 230, 140, ${0.45 * pulse})`);
    glow.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 248, 200, ${0.85 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (haloEnergy <= 0) return;
  const r = 24 + (haloEnergy / HALO_MAX) * 14;

  ctx.save();
  ctx.strokeStyle = `rgba(255, 220, 140, ${0.35 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = `rgba(212, 184, 150, ${0.08 * pulse})`;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnlightenmentHint() {
  if (!isEnlightenment() || enlightenmentOverlayTimer > 0) return;
  ctx.save();
  ctx.font = '600 16px Outfit, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 248, 220, 0.92)';
  ctx.textAlign = 'center';
  ctx.fillText('When you feel ready, touch anywhere to rest in completion', logicalWidth / 2, logicalHeight - 28);
  ctx.textAlign = 'left';
  ctx.restore();
}

function paintFrame() {
  if (!background || !player || !world) return;
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  background.draw();
  world.draw(ctx);
  drawPlayerHaloAura();
  player.draw(ctx);
  particles?.draw(ctx);
  floatingTexts.draw(ctx);
  updateRunStatsDom();
  drawHitFlash();
  drawEnlightenmentHint();
}

function updateDomHud() {
  if (!currentUser) return;
  hudUsername.textContent = currentUser.username;
  hudHighscore.textContent = String(getDisplayBestScore());
  hudEnergy.textContent = currentUser.isVip ? '∞' : String(currentUser.energy);
  syncHudEnergyStyle();
  vipBadge.hidden = !currentUser.isVip;
  layerNameEl.textContent = getLayerName(currentLayer);
  if (isPlaying()) syncStatEnergyBadge();
}

function syncHudEnergyStyle() {
  if (!hudEnergy || !currentUser) return;

  hudEnergy.classList.remove('hud-energy-high', 'hud-energy-mid', 'hud-energy-low', 'hud-energy-vip');

  if (currentUser.isVip) {
    hudEnergy.classList.add('hud-energy-vip');
    return;
  }

  const energy = currentUser.energy;
  if (energy > 2) {
    hudEnergy.classList.add('hud-energy-high');
  } else if (energy >= 1) {
    hudEnergy.classList.add('hud-energy-mid');
  } else {
    hudEnergy.classList.add('hud-energy-low');
  }
}

// --- Session (local) ---------------------------------------------------------

function applyUserFromProfile(profile) {
  currentUser = mapProfile(profile);
  updateDomHud();
}

function stopEnergyCountdown() {}

function showEnergyStatusError() {}

function updateEnergyCountdownDisplay() {}

function syncStartButtonState() {
  if (!btnStartGame) return;
  btnStartGame.disabled = false;
  btnStartGame.classList.remove('is-disabled');
  btnStartGame.setAttribute('aria-disabled', 'false');
  btnStartGame.textContent = 'Start Meditation';
  btnStartGame.setAttribute('aria-label', 'Start meditation game');
}

function showPostLoginMenuOverlay() {
  showOverlay(overlayStart);
}

function startEnergyCountdown() {}

async function fetchLeaderboard() {
  try {
    return await sessionGetLeaderboard(10);
  } catch {
    return null;
  }
}

function renderLeaderboard(entries) {
  if (!leaderboardList || !leaderboardEmpty || !leaderboardError) return;

  leaderboardList.innerHTML = '';
  leaderboardError.hidden = true;

  if (entries === null) {
    leaderboardEmpty.hidden = true;
    leaderboardList.hidden = true;
    leaderboardError.hidden = false;
    return;
  }

  if (entries.length === 0) {
    leaderboardEmpty.hidden = false;
    leaderboardList.hidden = true;
    return;
  }

  leaderboardEmpty.hidden = true;
  leaderboardList.hidden = false;

  entries.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'leaderboard-entry';
    if (currentUser && entry.username === currentUser.username) {
      li.classList.add('is-current-user');
    }

    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = `${index + 1}.`;

    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = entry.username;

    const score = document.createElement('span');
    score.className = 'leaderboard-score';
    const layerNote =
      entry.maxLayer && entry.maxLayer > 0 ? ` · L${entry.maxLayer}` : '';
    score.textContent = `${entry.highScore}${layerNote}`;

    li.append(rank, name, score);
    leaderboardList.appendChild(li);
  });
}

async function refreshLeaderboard() {
  if (!currentUser) return;
  const entries = await fetchLeaderboard();
  renderLeaderboard(entries);
}

function showAuthError(message) {
  authError.textContent = message;
  authError.hidden = !message;
}

function showStartError(message) {
  if (!startError) return;
  startError.textContent = message;
  startError.hidden = !message;
}

function clearStartError() {
  showStartError('');
}

function saveRememberedUsername(username) {
  try {
    localStorage.setItem(USERNAME_STORAGE_KEY, username);
    setStoredUsername(username);
  } catch {
    /* storage blocked — ignore */
  }
}

function clearRememberedUsername() {
  try {
    localStorage.removeItem(USERNAME_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function getRememberedUsername() {
  try {
    return localStorage.getItem(USERNAME_STORAGE_KEY) || getStoredUsername() || '';
  } catch {
    return '';
  }
}

function initRememberUsername() {
  if (!usernameInput) return;
  const saved = getRememberedUsername() || getStoredUsername();
  if (saved) usernameInput.value = saved;
}

function persistUsernamePreference(username) {
  rememberUsername = Boolean(rememberMeCheckbox?.checked);
  if (rememberUsername) {
    saveRememberedUsername(username);
  } else {
    clearRememberedUsername();
  }
}

function handleLogout() {
  bumpSession();
  stopGameLoop();
  stopGameAudio();
  gameplayStop();
  hideAllOverlays();
  hideEndOverlays();
  showGameControls(false);
  clearStartError();
  showAuthError('');
  currentUser = null;
  energyStatus = null;
  clearSession();
  authPanel.hidden = false;
  gameSection.hidden = true;
  setGameState(GameState.IDLE);
  if (usernameInput) {
    usernameInput.value = getRememberedUsername() || '';
    usernameInput.focus();
  }
}

async function enterMenuAfterLogin() {
  resetRunVariables();
  hideAllOverlays();
  hideEndOverlays();
  showGameControls(false);
  clearStartError();
  setGameState(GameState.START);
  syncLeaderboardPanelOpen();
  updateDomHud();
  syncStartButtonState();
  showPostLoginMenuOverlay();
  refreshLeaderboard();
  scrollToGameCanvas();
}

// --- Session flow ------------------------------------------------------------

function enterPlayingMode(token) {
  if (!isSessionActive(token)) return;

  resetRunVariables();
  hideAllOverlays();
  hideEndOverlays();

  if (!background) background = new Background(canvas);
  if (!player) player = new Player(canvas);
  if (!world) world = new WorldManager(logicalWidth, logicalHeight);
  else world.reset();
  if (!particles) particles = new ParticleSystem();

  player.onJump = (center) => {
    particles?.spawnBurst(center.x, center.y, 'dust');
  };

  resizeCanvas();
  player.resetPosition();
  background.setLayer(1);
  resetLayerProgress();

  setGameState(GameState.PLAYING);
  isPaused = false;
  syncPauseButtons();
  showGameControls(true);
  stopEnergyCountdown();
  updateDomHud();
  startGameLoop();
  playLayerMusic(currentLayer);
  resetTouchInputForModeChange();
  syncTouchLayout();
  gameplayStart();
}

function shouldRunCommercialBreak() {
  if (!isPortalMode || !lastRunEndState) return false;
  if (platformId === 'gamepix') {
    return lastRunEndState === 'gameover' || lastRunEndState === 'victory';
  }
  return true;
}

async function runCommercialBreak() {
  if (!shouldRunCommercialBreak()) return;
  gameplayStop();
  stopGameLoop();
  stopGameAudio();
  const prevPaused = isPaused;
  isPaused = true;
  try {
    await commercialBreak();
  } finally {
    isPaused = prevPaused;
    lastRunEndState = null;
  }
}

async function beginNewRun() {
  if (!currentUser) return;

  const token = bumpSession();
  stopGameLoop();
  stopGameAudio();
  gameplayStop();
  hideAllOverlays();
  hideEndOverlays();
  showGameControls(false);
  resetRunVariables();
  clearStartError();
  setGameState(GameState.START);
  updateDomHud();

  try {
    const data = await sessionStartGame(currentUser.username);
    if (!isSessionActive(token)) return;
    if (data.user) applyUserFromProfile(data.user);
    await runCommercialBreak();
    if (!isSessionActive(token)) return;
    enterPlayingMode(token);
  } catch (err) {
    if (!isSessionActive(token)) return;
    setGameState(GameState.START);
    showOverlay(overlayStart);
    showStartError(err.message || 'Could not start game.');
  }
}

async function persistScoreAsync(token) {
  if (!currentUser || !isSessionActive(token)) return false;
  try {
    const data = await sessionSaveScore(currentUser.username, score, currentLayer);
    if (!isSessionActive(token)) return false;
    if (data.user) applyUserFromProfile(data.user);
    return data.isNewRecord;
  } catch (err) {
    console.error('[Emmind] save-score failed:', err.message);
    return false;
  }
}

function showVictoryScreen() {
  hideAllOverlays();
  showGameControls(false);
  victoryScoreEl.textContent = String(score);
  victoryBestEl.textContent = String(getDisplayBestScore());
  showOverlay(victoryOverlay);
  announceGame(
    `Right fruition attained. May joy and compassion radiate from your practice. Final score: ${score}. Best score: ${getDisplayBestScore()}.`
  );
}

function showGameOverScreen() {
  hideAllOverlays();
  showGameControls(false);
  finalScoreEl.textContent = String(score);
  showOverlay(gameOverOverlay);
  announceGame(`A gentle pause. ${gameoverMessage.textContent} Final score: ${score}.`);
}

function showSurrenderScreen() {
  hideAllOverlays();
  showGameControls(false);
  surrenderMessage.textContent = 'You chose to rest — honor that choice with compassion.';
  surrenderScoreEl.textContent = String(score);
  showOverlay(surrenderOverlay);
  announceGame(`A moment of rest. ${surrenderMessage.textContent} Final score: ${score}.`);
}

function finishRun({ victory = false, surrender = false, reason = '' } = {}) {
  enlightenmentMode = false;
  enlightenmentOverlayTimer = 0;
  unbindEnlightenmentClick();
  hideOverlay(overlayEnlightenment);
  player?.clearCosmicDrift();
  background?.setCosmicEnlightenment(false);

  const token = sessionToken;
  const runStats = getRunStatsSnapshot(victory);
  const newAchievements = evaluateAchievements(runStats);
  fillRunSummaryElement(gameoverRunSummary, newAchievements);
  fillRunSummaryElement(surrenderRunSummary, newAchievements);
  fillRunSummaryElement(victoryRunSummary, newAchievements);

  stopGameLoop();
  stopGameAudio();
  gameplayStop();
  isPaused = false;
  showGameControls(false);

  lastRunEndState = victory ? 'victory' : surrender ? 'surrender' : 'gameover';

  pingGameOver(score, currentLayer, { unlocked: newAchievements });

  if (victory) {
    setGameState(GameState.VICTORY);
    gameoverMessage.textContent = reason;
    enlightenmentPulse = 1;
    background?.setVictoryGlow(1);
    player?.setEnlightenment(1);
    if (!victoryStingerPlayedThisRun) {
      playSfx('victory');
    }
    showVictoryScreen();
  } else if (surrender) {
    setGameState(GameState.SURRENDER);
    showSurrenderScreen();
  } else {
    setGameState(GameState.GAMEOVER);
    gameoverMessage.textContent = reason;
    playSfx('gameover');
    showGameOverScreen();
  }

  persistScoreAsync(token).then((isNew) => {
    if (!isSessionActive(token)) return;

    if (victory && victoryBestEl) {
      victoryBestEl.textContent = String(currentUser?.highScore ?? score);
    }

    const targets = surrender
      ? [recordMessage, surrenderRecordMessage]
      : victory
        ? [recordMessage, victoryRecordMessage]
        : [recordMessage];

    for (const el of targets) {
      if (!el) continue;
      if (isNew) {
        el.classList.remove('is-hidden');
        el.hidden = false;
      } else {
        el.classList.add('is-hidden');
        el.hidden = true;
      }
    }

    if (isNew) {
      announceGame('Your practice deepens — a beautiful new milestone!');
      refreshLeaderboard();
    }
  });
}

function endGame(reason, { victory = false } = {}) {
  finishRun({ victory, reason });
}

function handleStopMeditation() {
  if (!isPlaying()) return;
  finishRun({ surrender: true });
}

// --- Shockwave & halo --------------------------------------------------------

function tryTriggerShockwave() {
  if (!isPlaying() || isEnlightenment() || isPaused || !player) return;
  if (haloEnergy < HALO_SHOCKWAVE_COST) return;
  if (!player.triggerShockwave()) return;
  haloEnergy = clampHalo(haloEnergy - HALO_SHOCKWAVE_COST);
  shockwaveClearsThisWave = 0;
  const c = player.getCenter();
  particles?.spawnBurst(c.x, c.y, 'ripple');
  playSfx('shockwave');
}

function processShockwaveClears() {
  const wave = player.getShockwaveCircle();
  if (!wave || !world) return;
  const clearedPositions = clearTemptationsInShockwave(world.temptations, wave);
  if (clearedPositions.length > 0) {
    const toScore = Math.min(
      clearedPositions.length,
      Math.max(0, MAX_SHOCKWAVE_CLEARS_SCORED - shockwaveClearsThisWave)
    );
    shockwaveClearsThisWave += toScore;
    for (let i = 0; i < toScore; i++) {
      const pos = clearedPositions[i];
      addScore(POINTS_PER_CLEAR, { x: pos.x, y: pos.y, kind: 'score' });
      particles?.spawnBurst(pos.x, pos.y, 'ripple', { count: 10 });
    }
    if (clearedPositions[0]) {
      floatingTexts.spawn(
        clearedPositions[0].x,
        clearedPositions[0].y,
        `Cleared ${clearedPositions.length}`,
        'halo'
      );
    }
    updateDomHud();
  }
}

// --- Victory & layers (score-based ascend) -----------------------------------

function ascendLayer() {
  if (!isPlaying() || isEnlightenment() || pendingLayerUp) return;
  if (currentLayer >= MAX_LAYER) return;

  pendingLayerUp = true;
  practiceMindfulnessHintShown = false;
  const haloRatio = haloEnergy / HALO_MAX;
  const ascendBonus = Math.round(
    SCORE_LAYER_ASCEND_BASE + SCORE_LAYER_ASCEND_BONUS_MAX * haloRatio
  );
  addScore(ascendBonus, { applyCombo: false });
  const c = player?.getCenter();
  if (c) particles?.spawnBurst(c.x, c.y, 'ascend');

  currentLayer += 1;
  background.setLayer(currentLayer);
  world?.reset();
  showLayerTransition(currentLayer);
  playLayerAscendStinger(currentLayer);
  announceGame(`Layer ascended. ${getLayerName(currentLayer)}. +${ascendBonus} focus.`);
  happyTime();
  pingLevelComplete(score, currentLayer, {});
}

function checkLayerProgress(dt) {
  if (!isPlaying() || isEnlightenment() || isPaused || pendingLayerUp || layerTransitionTimer > 0) return;

  layerElapsed += dt;
  background?.setLayerElapsed(layerElapsed);
  refreshLayerDuration();

  survivalTimer += dt;
  if (survivalTimer >= POINTS_SURVIVAL_INTERVAL) {
    survivalTimer -= POINTS_SURVIVAL_INTERVAL;
    addScore(POINTS_SURVIVAL_AMOUNT, { applyCombo: true });
  }

  const practiceReady = practiceTarget > 0 && practiceScore >= practiceTarget;
  const mindfulnessReady = haloEnergy >= MINDFULNESS_ASCEND_THRESHOLD;

  if (practiceReady && !mindfulnessReady && !practiceMindfulnessHintShown) {
    practiceMindfulnessHintShown = true;
    announceGame(
      `Practice complete — raise Mindfulness to ${MINDFULNESS_ASCEND_THRESHOLD}% to ascend.`
    );
  }

  if (practiceReady && mindfulnessReady) {
    if (currentLayer >= MAX_LAYER) {
      startEnlightenmentPhase();
    } else {
      ascendLayer();
    }
  }
}

function bindEnlightenmentClick() {
  if (!canvas || enlightenmentClickBound) return;
  canvas.addEventListener('click', onEnlightenmentClick);
  enlightenmentClickBound = true;
}

function unbindEnlightenmentClick() {
  if (!canvas || !enlightenmentClickBound) return;
  canvas.removeEventListener('click', onEnlightenmentClick);
  enlightenmentClickBound = false;
}

function onEnlightenmentClick(event) {
  if (!isEnlightenment() || enlightenmentOverlayTimer > 0) return;
  event.preventDefault();
  event.stopPropagation();
  endGame('You have attained right fruition — may this peace bless all beings.', { victory: true });
}

function startEnlightenmentPhase() {
  if (!isPlaying() || isEnlightenment() || pendingLayerUp) return;

  pendingLayerUp = true;
  enlightenmentMode = true;
  haloEnergy = HALO_MAX;
  practiceScore = practiceTarget;
  enlightenmentPulse = 1;
  background?.setCosmicEnlightenment(true);
  background?.setVictoryGlow(1);
  player?.setEnlightenment(1);
  player?.resetCosmicDrift();
  player?.setProtectiveCharges(0);
  protectiveCharges = 0;

  if (overlayEnlightenment) {
    showOverlay(overlayEnlightenment);
    enlightenmentOverlayTimer = ENLIGHTENMENT_OVERLAY_DURATION;
  }

  playSfx('victory');
  victoryStingerPlayedThisRun = true;
  happyTime();
  announceGame(
    'Right fruition attained. Drift freely through cosmic space — when ready, touch anywhere to complete your session.'
  );
  updateDomHud();
  resetTouchInputForModeChange();
  syncTouchLayout();
}

function finishEnlightenmentIntro() {
  enlightenmentOverlayTimer = 0;
  pendingLayerUp = false;
  hideOverlay(overlayEnlightenment);
  setGameState(GameState.ENLIGHTENMENT);
  syncGameplayChrome();
  resetTouchInputForModeChange();
  showGameControls(true);
  syncTouchControls(true);
  bindEnlightenmentClick();
  lastTime = performance.now();
  if (!animFrameId) startGameLoop();
}

function processEnlightenmentCollisions() {
  if (!isEnlightenment() || !player || !world) return;

  const c = player.getCenter();
  const r = ENLIGHTENMENT_HALO_RADIUS;

  for (const t of world.temptations) {
    if (t.cleared) continue;
    if (!circleIntersectsRect(c.x, c.y, r, t.getBounds())) continue;
    t.cleared = true;
    const px = t.x + t.width / 2;
    const py = t.y + t.height / 2;
    particles?.spawnBurst(px, py, 'ripple', { count: 14 });
    floatingTexts.spawn(px, py, 'Cleared', 'halo');
  }

  for (const s of world.scriptures) {
    if (s.collected) continue;
    if (!circleIntersectsRect(c.x, c.y, r, s.getBounds())) continue;
    s.collected = true;
    const px = s.x + s.width / 2;
    const py = s.y + s.height / 2;
    particles?.spawnBurst(px, py, 'gold', { count: 12 });
    floatingTexts.spawn(px, py, 'Dissolved', 'halo');
  }

  world.temptations = world.temptations.filter((t) => !t.cleared && !t.isOffScreen());
  world.scriptures = world.scriptures.filter((s) => !s.collected && !s.isOffScreen());
}

function showLayerTransition(layer, descending = false) {
  const info = getLayerConfig(layer);
  const layerTitle = `Layer ${layer}: ${info?.name || 'Ascent'}`;
  const transitionText = descending
    ? getLayerDescendMessage(layer)
    : getLayerAscendMessage(layer);
  layerTransitionTitle.textContent = descending ? 'Be Gentle With Yourself…' : 'Congratulations!';
  layerTransitionDesc.textContent = `${layerTitle}. ${transitionText}`;
  layerTransitionAscending = !descending;
  showOverlay(overlayLayer);
  layerTransitionTimer = LAYER_TRANSITION_DURATION;
  if (background) background.setAscentBorderPulse(0);
  updateDomHud();
  resetTouchInputForModeChange();
  syncTouchLayout();
  announceGame(`${layerTitle}. ${transitionText}`);
}

function finishLayerTransition() {
  const wasAscending = layerTransitionAscending;
  layerTransitionTimer = 0;
  pendingLayerUp = false;
  layerTransitionAscending = false;
  hideOverlay(overlayLayer);
  if (background) background.setAscentBorderPulse(0);
  if (isPlaying() && !isEnlightenment()) {
    if (wasAscending) {
      haloEnergy = 0;
      protectiveCharges = 0;
      player?.setProtectiveCharges(0);
      practiceMindfulnessHintShown = false;
    }
    resetLayerTimer();
    scriptureCombo = 0;
  }
}

function updateLayerTransitionState(dt) {
  if (layerTransitionTimer <= 0) {
    if (background) background.setAscentBorderPulse(0);
    return false;
  }

  layerTransitionTimer -= dt;
  if (layerTransitionTimer <= 0) {
    finishLayerTransition();
    return false;
  }

  if (layerTransitionAscending && background) {
    const progress = 1 - layerTransitionTimer / LAYER_TRANSITION_DURATION;
    background.setAscentBorderPulse(Math.sin(progress * Math.PI));
  } else if (background) {
    background.setAscentBorderPulse(0);
  }

  return true;
}

function handleTemptationCollision() {
  if (!isPlaying() || isEnlightenment() || isPaused) return;

  const c = player.getCenter();

  hitFlashTimer = HIT_FLASH_DURATION;
  player.invincible = 1.2;

  if (protectiveCharges > 0) {
    const lost = Math.min(protectiveCharges, 1 + Math.floor(Math.random() * 2));
    protectiveCharges = Math.max(0, protectiveCharges - lost);
    player.setProtectiveCharges(protectiveCharges);
    particles?.spawnBurst(c.x, c.y, 'shieldPop');
    floatingTexts.spawn(c.x, c.y - 10, '-Shield', 'halo');
    loseMindfulness(MINDFULNESS_HIT_SHIELD, { x: c.x, y: c.y - 8 });
    playSfx('duc');
    announceGame(
      protectiveCharges > 0
        ? `Your shield softens — stay present. ${protectiveCharges} shield layer${protectiveCharges > 1 ? 's' : ''} remain.`
        : 'Your shield has dissolved — breathe, you are still whole.'
    );
    return;
  }

  playSfx('duc');
  loseMindfulness(MINDFULNESS_HIT_DIRECT, { x: c.x, y: c.y - 8 });
  scriptureCombo = 0;
  particles?.spawnBurst(c.x, c.y, 'dull');

  downgradeStrikes += 1;
  announceGame(`A wandering thought arose — meet it with kindness. Gentle reminders: ${downgradeStrikes} of ${MAX_DOWNGRADE_STRIKES}.`);

  if (downgradeStrikes >= MAX_DOWNGRADE_STRIKES) {
    endGame('Your ascent pauses here. Breathe with kindness — each return is a gift.');
    return;
  }

  if (currentLayer > 1) {
    currentLayer -= 1;
    background.setLayer(currentLayer);
    player.resetPosition();
    world?.reset();
    const layer = currentLayer;
    const token = sessionToken;
    window.setTimeout(() => {
      if (!isSessionActive(token) || !isPlaying()) return;
      playLayerMusic(layer);
      showLayerTransition(layer, true);
    }, DOWNGRADE_LAYER_AUDIO_DELAY_MS);
  } else {
    resetLayerTimer();
    world?.reset();
    announceGame(getLayerDescendMessage(1));
  }
}

// --- Main loop ---------------------------------------------------------------

function drawPausedBanner() {
  ctx.save();
  ctx.fillStyle = 'rgba(12, 18, 24, 0.55)';
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  ctx.font = '600 22px Outfit, system-ui, sans-serif';
  ctx.fillStyle = '#e8eef2';
  ctx.textAlign = 'center';
  ctx.fillText('Paused — Press Resume or Escape', logicalWidth / 2, logicalHeight / 2);
  ctx.textAlign = 'left';
  ctx.restore();
}

function gameLoop(timestamp) {
  if (!isPlaying()) {
    animFrameId = null;
    return;
  }

  animFrameId = requestAnimationFrame(gameLoop);

  if (isPaused) {
    paintFrame();
    drawPausedBanner();
    return;
  }

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (enlightenmentOverlayTimer > 0) {
    enlightenmentOverlayTimer = Math.max(0, enlightenmentOverlayTimer - dt);
    if (enlightenmentOverlayTimer <= 0) {
      finishEnlightenmentIntro();
    }
    background.update(dt);
    particles?.update(dt);
    floatingTexts.update(dt);
    paintFrame();
    return;
  }

  if (hitFlashTimer > 0) {
    hitFlashTimer = Math.max(0, hitFlashTimer - dt);
  }

  // Layer overlay (~1.8s): player frozen; spawns paused; existing entities drift at 25% speed.
  const inLayerTransition = updateLayerTransitionState(dt);
  const inEnlightenment = isEnlightenment();

  background.update(dt);

  if (!inLayerTransition) {
    player.update(dt, keys, getPlayerMoveOptions());
    if (!inEnlightenment) {
      checkLayerProgress(dt);
    }
    particles?.update(dt);
  } else if (particles) {
    particles.update(dt);
  }

  const worldDt = inLayerTransition ? dt * 0.25 : dt;
  const layerSpeed = getLayerSpeedFactor(currentLayer);
  world.update(worldDt, currentLayer, {
    spawnPaused: inLayerTransition,
    layerElapsed,
    layerDuration,
    speedFactor: getMobileObstacleSpeedFactor() * layerSpeed,
  });
  floatingTexts.update(dt);

  if (!inLayerTransition) {
    if (inEnlightenment) {
      processEnlightenmentCollisions();
    } else {
      const playerBounds = getPlayerCollisionBounds();
      const scripturePickups = world.collectScriptures(playerBounds);
      if (scripturePickups.length > 0) {
        addHalo(scripturePickups.length * HALO_SCRIPTURE_GAIN);
        refreshLayerDuration();
        grantProtectiveCharges();
        playSfx('ten');
        for (const pos of scripturePickups) {
          scriptureCombo += 1;
          scripturesCollectedRun += 1;
          maxScriptureCombo = Math.max(maxScriptureCombo, scriptureCombo);
          addScore(POINTS_SCRIPTURE, { x: pos.x, y: pos.y, kind: 'score' });
          floatingTexts.spawn(pos.x, pos.y - 14, '+Scripture', 'halo');
          floatingTexts.spawn(pos.x, pos.y, '+Shield', 'halo');
          particles?.spawnBurst(pos.x, pos.y, 'gold');
        }
        updateDomHud();
      }

      processShockwaveClears();

      for (const t of world.temptations) {
        if (t.cleared) continue;
        if (player.invincible <= 0 && rectsOverlap(playerBounds, t.getBounds())) {
          handleTemptationCollision();
          if (!isPlaying()) return;
          break;
        }
      }
    }
  }

  syncShockwaveButton();
  paintFrame();
}

// --- Input -------------------------------------------------------------------

function onRestartClick(event) {
  event.preventDefault();
  event.stopPropagation();
  beginNewRun();
}

function bindRestartButtons() {
  document.querySelectorAll('.restart-btn').forEach((btn) => {
    btn.addEventListener('click', onRestartClick);
  });
}

function syncPortalChrome() {
  document.body.classList.toggle('portal-mode', isPortalMode);
  const header = document.querySelector('.header');
  const footer = document.querySelector('.footer');
  if (authPanel) authPanel.hidden = isPortalMode;
  if (header) header.hidden = isPortalMode;
  if (footer) footer.hidden = isPortalMode;
  if (btnLogout) btnLogout.hidden = isPortalMode;
  if (leaderboardPanel) {
    leaderboardPanel.hidden = isPortalMode;
    if (isPortalMode) leaderboardPanel.removeAttribute('open');
  }
}

async function ensureGameObjects() {
  if (!background) background = new Background(canvas);
  if (!player) player = new Player(canvas);
  if (!world) world = new WorldManager(logicalWidth, logicalHeight);
  resizeCanvas();
}

async function initPortalSession() {
  syncPortalChrome();
  const guestName = getStoredUsername() || 'Guest';
  if (!getStoredUsername()) setStoredUsername(guestName);

  const profile = await sessionGetProfile(guestName);
  if (!profile) throw new Error('Could not load profile.');
  applyUserFromProfile(profile);
  authPanel.hidden = true;
  gameSection.hidden = false;
  await ensureGameObjects();
  await enterMenuAfterLogin();
  console.log('[Emmind] Portal session ready:', currentUser.username);
}

async function initSession() {
  if (isPortalMode) {
    try {
      await initPortalSession();
    } catch (err) {
      console.error('[Emmind] portal session failed:', err.message);
      setGameState(GameState.IDLE);
    }
    return;
  }

  const savedName = getStoredUsername();
  if (!savedName) {
    authPanel.hidden = false;
    gameSection.hidden = true;
    setGameState(GameState.IDLE);
    initRememberUsername();
    return;
  }

  try {
    const profile = await sessionGetProfile(savedName);
    if (!profile) throw new Error('Could not load profile.');
    applyUserFromProfile(profile);
    authPanel.hidden = true;
    gameSection.hidden = false;
    await ensureGameObjects();
    await enterMenuAfterLogin();
    console.log('[Emmind] Session ready:', currentUser.username);
  } catch (err) {
    clearSession();
    authPanel.hidden = false;
    gameSection.hidden = true;
    showAuthError(err.message || 'Could not restore session.');
    setGameState(GameState.IDLE);
    initRememberUsername();
  }
}

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = usernameInput?.value?.trim();
  if (!name) {
    showAuthError('Enter a name to play.');
    return;
  }
  showAuthError('');
  try {
    persistUsernamePreference(name);
    const profile = await sessionLogin(name);
    applyUserFromProfile(profile);
    authPanel.hidden = true;
    gameSection.hidden = false;
    await ensureGameObjects();
    await enterMenuAfterLogin();
  } catch (err) {
    showAuthError(err.message || 'Could not sign in.');
  }
});

btnLogout?.addEventListener('click', (e) => {
  e.preventDefault();
  handleLogout();
});

document.getElementById('btn-surrender-back')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  bumpSession();
  stopGameLoop();
  stopGameAudio();
  showGameControls(false);
  hideEndOverlays();
  setGameState(GameState.START);
  showOverlay(overlayStart);
});

const onPauseClick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (isPlaying() && !isPaused) setPaused(true);
};
const onResumeClick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (isPlaying() && isPaused) setPaused(false);
};
const onStopClick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  handleStopMeditation();
};

btnPause?.addEventListener('click', onPauseClick);
btnResume?.addEventListener('click', onResumeClick);
btnStop?.addEventListener('click', onStopClick);
btnPauseMobile?.addEventListener('click', onPauseClick);
btnResumeMobile?.addEventListener('click', onResumeClick);
btnStopMobile?.addEventListener('click', onStopClick);
btnStopMobile?.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    onStopClick(e);
  },
  { passive: false }
);
bindRestartButtons();
bindTouchControls();

function bindTouchControls() {
  if (touchJoystickMount) {
    mobileJoystick = new TouchJoystick(touchJoystickMount, {
      onChange: (dx, dy) => {
        if (!isPlaying() || isPaused || isEnlightenment()) return;
        if (currentLayer < 2) {
          setTouchMoveVector(dx, 0);
        } else {
          setTouchMoveVector(dx, dy);
        }
      },
    });
  }

  bindPointerHold(touchLeft, () => setLeft(true), () => setLeft(false));
  bindPointerHold(touchRight, () => setRight(true), () => setRight(false));
  bindPointerHold(touchFlyUp, () => setUp(true), () => setUp(false));
  bindPointerHold(touchFlyDown, () => setDown(true), () => setDown(false));

  const onJumpPress = () => {
    if (!isPlaying() || isPaused) return;
    if (currentLayer >= 2) setUp(true);
    else player?.jump();
  };
  const onJumpRelease = () => {
    if (currentLayer >= 2) setUp(false);
  };

  const bindActionTap = (el, onPress, onRelease = () => {}) => {
    if (!el) return;
    const press = (e) => {
      e.preventDefault();
      e.stopPropagation();
      markTouchUiActive();
      if (!isPlaying() || isPaused) return;
      el.classList.add('is-pressed');
      onPress();
    };
    const release = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('is-pressed');
      onRelease();
    };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
  };

  bindActionTap(touchJump, onJumpPress, onJumpRelease);

  const onPulsePointerUp = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    markTouchUiActive();
    const now = Date.now();
    if (now - lastShockwaveTouchMs < 350) return;
    lastShockwaveTouchMs = now;
    tryTriggerShockwave();
  };
  touchShockwave?.addEventListener('pointerup', onPulsePointerUp);
}

window.addEventListener('resize', scheduleResizeCanvas);
window.addEventListener('resize', syncLeaderboardPanelOpen);
window.addEventListener('resize', scheduleSyncGameViewport);
window.addEventListener('orientationchange', () => {
  const refreshMobileLayout = () => {
    syncLeaderboardPanelOpen();
    if (isPlaying()) {
      showGameControls(true);
      syncTouchLayout();
      syncPauseButtons();
    }
    remeasurePlayChromeAfterLayout();
  };
  setTimeout(refreshMobileLayout, 100);
  setTimeout(refreshMobileLayout, 350);
});
window.visualViewport?.addEventListener('resize', scheduleResizeCanvas);
window.visualViewport?.addEventListener('resize', scheduleSyncGameViewport);

const GAME_SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  keys[e.key] = true;

  if (isPlaying() && GAME_SCROLL_KEYS.has(e.code)) {
    e.preventDefault();
  }

  if (e.code === 'Space') {
    e.preventDefault();
    if (isPlaying() && !isPaused) {
      if (currentLayer >= 2) {
        keys.ArrowUp = true;
        keys.KeyW = true;
        keys.w = true;
      } else {
        player?.jump();
      }
    }
  }

  if (e.code === 'Escape' && isPlaying()) {
    e.preventDefault();
    setPaused(!isPaused);
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  keys[e.key] = false;
  if (e.code === 'Space' && currentLayer >= 2) {
    keys.ArrowUp = false;
    keys.KeyW = false;
    keys.w = false;
  }
});

canvas.addEventListener('click', (e) => {
  if (Date.now() < suppressCanvasClickUntil) return;
  if (isMobileViewport() && shouldUseTouchControls()) return;
  e.preventDefault();
  if (isPlaying() && !isPaused) tryTriggerShockwave();
});

// --- Boot --------------------------------------------------------------------

function showBuildStamp() {
  const el = document.getElementById('game-build-stamp');
  if (!el) return;
  const label = isPortalMode ? `emmind-portal · ${platformId}` : `emmind-standalone · ${platformId}`;
  el.textContent = label;
  el.hidden = false;
}

function bindPortalPauseHandlers() {
  registerGamePixHandlers({
    onPause: () => {
      if (isPlaying()) {
        syncTouchControls(false);
        if (!isPaused) setPaused(true);
      }
      stopGameAudio();
    },
    onResume: () => {
      if (isPlaying() && isPaused) {
        setPaused(false);
        syncTouchControls(true);
      }
    },
    onSoundOn: () => {
      if (isPlaying() && !isPaused) resumeLayerMusic(currentLayer);
    },
    onSoundOff: () => stopGameAudio(),
  });
}

async function boot() {
  reportLoading(0);
  bindPortalPauseHandlers();

  await platformBootstrap((pct) => reportLoading(pct));
  reportLoading(50);
  showBuildStamp();
  syncPortalChrome();
  initRememberUsername();
  syncLeaderboardPanelOpen();
  syncGameViewport();
  resizeCanvas();
  hideAllOverlays();
  hideEndOverlays();
  showGameControls(false);
  syncPauseButtons();
  setGameState(GameState.IDLE);

  reportLoading(65);
  await initSession();
  reportLoading(85);
  await preloadAudioAssets();
  reportLoading(100);
  await loadingFinished();
  console.log('[Emmind] Ready. Platform:', platformId, 'portal:', isPortalMode);
}

boot();
