/**
 * GamePix embed + SDK integration QA.
 *
 * Usage:
 *   npm run package:gamepix
 *   npm run preview          # separate terminal
 *   npm run test:gamepix-embed
 *
 * Preview must serve the GamePix build (dist/ after package:gamepix).
 * Override URL: EMMIND_PREVIEW_URL=http://localhost:4173/?platform=gamepix
 */
import { chromium } from 'playwright';

const PREVIEW_URL = process.env.EMMIND_PREVIEW_URL || 'http://localhost:4173/?platform=gamepix';
const GAMEPIX_TITLE = 'Emmind 7 Layers';
const WIDTH = 800;
const HEIGHT = 450;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`OK: ${msg}`);
}

function warn(msg) {
  console.warn(`WARN: ${msg}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

try {
  await page.goto(PREVIEW_URL, { waitUntil: 'networkidle', timeout: 30000 });

  await page.waitForSelector('#btn-start-game', { timeout: 15000 });
  pass('Start button visible');

  await page.waitForFunction(
    () => {
      const btn = document.getElementById('btn-start-game');
      return btn && !btn.disabled;
    },
    { timeout: 20000 },
  );
  pass('Start button enabled after gameLoaded');

  const sdkCore = await page.evaluate(() => ({
    hasGamePix: Boolean(window.GamePix),
    hasBridge: Boolean(window.__emmindGamePixBridge),
    bridgeHandlersBound: Boolean(window.__emmindGamePixBridge?.handlersBound),
    bridgeGameLoaded: Boolean(window.__emmindGamePixBridge?.gameLoadedCalled),
    hostMenuReady: Boolean(window.__emmindPortal?.isReady?.()),
    hasOn: Boolean(window.GamePix?.on),
    pauseFn: typeof window.GamePix?.on?.pause,
    resumeFn: typeof window.GamePix?.on?.resume,
    soundOffFn: typeof window.GamePix?.on?.soundOff,
    gameLoadedFn: typeof window.GamePix?.game?.gameLoaded,
    interstitialFn: typeof window.GamePix?.interstitialAd,
    updateScoreFn: typeof window.GamePix?.updateScore,
    updateLevelFn: typeof window.GamePix?.updateLevel,
    happyMomentFn: typeof window.GamePix?.happyMoment,
    langFn: typeof window.GamePix?.lang,
    localStorageFn: typeof window.GamePix?.localStorage?.setItem,
    portal: window.__emmindPortal ?? null,
  }));

  if (!sdkCore.hasGamePix) fail('window.GamePix missing — check gamepix.js in index.html');
  pass('window.GamePix present');

  if (!sdkCore.hasBridge) fail('__emmindGamePixBridge missing — inline SDK bridge not in HTML');
  pass('Inline GamePix SDK bridge present');

  if (!sdkCore.bridgeHandlersBound) fail('Inline bridge handlersBound=false');
  pass('Inline bridge bound GamePix.on handlers');

  if (!sdkCore.bridgeGameLoaded) fail('Inline bridge gameLoadedCalled=false');
  pass('Inline bridge gameLoaded fired');

  if (!sdkCore.hasOn) fail('GamePix.on missing');
  pass('GamePix.on present');

  if (sdkCore.pauseFn !== 'function' || sdkCore.resumeFn !== 'function') {
    fail('GamePix.on.pause/resume not registered');
  }
  pass('GamePix.on.pause/resume handlers registered');

  if (sdkCore.soundOffFn !== 'function') {
    fail('GamePix.on.soundOff not registered');
  }
  pass('GamePix.on.soundOff handler registered');

  if (!sdkCore.hostMenuReady) {
    fail('hostMenuReady false — Start should only enable after gameLoaded');
  }
  pass('hostMenuReady true after gameLoaded');

  if (sdkCore.portal?.platformId !== 'gamepix') {
    fail(`Wrong platform adapter: ${sdkCore.portal?.platformId ?? 'unknown'} (expected gamepix)`);
  }
  pass('Platform adapter locked to gamepix');

  if (!sdkCore.portal?.probe?.handlersBound) {
    fail('GamePix handlers not bound (handlersBound=false)');
  }
  pass('GamePix handlers bound flag set');

  if (sdkCore.portal?.probe?.langRead !== true) {
    warn('GamePix.lang not read at boot (optional — may still pass toolkit)');
  } else {
    pass(`GamePix.lang read (${sdkCore.portal.probe.lang})`);
  }

  if (sdkCore.updateLevelFn !== 'function') {
    warn('GamePix.updateLevel missing on SDK (optional in some preview hosts)');
  } else if (sdkCore.portal?.probe?.levelUpdates < 1) {
    fail('GamePix.updateLevel not called at boot');
  } else {
    pass('GamePix.updateLevel called at boot');
  }

  if (sdkCore.updateScoreFn !== 'function') {
    warn('GamePix.updateScore missing on SDK (optional in some preview hosts)');
  } else if (sdkCore.portal?.probe?.scoreUpdates < 1) {
    fail('GamePix.updateScore not called at boot');
  } else {
    pass('GamePix.updateScore called at boot');
  }

  if (sdkCore.localStorageFn === 'function' && !sdkCore.portal?.probe?.storageReady) {
    warn('GamePix.localStorage API exists but storageReady=false (init timing)');
  } else if (sdkCore.portal?.probe?.storageReady) {
    pass('GamePix.localStorage active for persistence');
  } else {
    warn('GamePix.localStorage not available in preview (OK on real GamePix host)');
  }

  const title = await page.title();
  if (title !== GAMEPIX_TITLE) {
    fail(`Title must be "${GAMEPIX_TITLE}", got "${title}"`);
  }
  pass('Title matches namespace (Emmind 7 Layers)');

  const startH2 = await page.textContent('#overlay-start h2');
  if (startH2?.trim() !== GAMEPIX_TITLE) {
    fail(`Start h2 must be "${GAMEPIX_TITLE}", got "${startH2?.trim()}"`);
  }
  pass('Start overlay title matches');

  const html = await page.content();
  if (html.includes('Chánh') || html.includes('Kéo rê')) {
    fail('Non-English UI strings found');
  }
  pass('English UI');

  const GAMEPIX_SDK_CDN = 'gamepix.blob.core.windows.net/gpxlib/dev/gamepix.js';
  if (!html.includes('gamepix.js')) {
    fail('Static gamepix.js script tag not in page HTML');
  }
  if (!html.includes(GAMEPIX_SDK_CDN)) {
    fail(`Official GamePix CDN URL missing in HTML (scanner: ${GAMEPIX_SDK_CDN})`);
  }
  pass('Official GamePix CDN script URL in HTML head');
  if (!html.includes('data-emmind-gamepix-bridge')) {
    fail('Inline GamePix SDK bridge missing from HTML');
  }
  pass('Inline GamePix SDK bridge in HTML');

  const scrollBefore = await page.evaluate(() => ({
    doc: document.documentElement.scrollHeight,
    win: window.innerHeight,
  }));
  if (scrollBefore.doc > scrollBefore.win + 2) {
    fail(`Page scrolls before play: ${scrollBefore.doc}px > ${scrollBefore.win}px`);
  }
  pass('No page scroll at menu');

  await page.click('#btn-start-game');
  await page.waitForTimeout(900);

  const playing = await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas');
    const stats = document.getElementById('game-stats-bar');
    const controls = document.getElementById('game-controls');
    const stamp = document.getElementById('game-build-stamp');
    const rect = canvas?.getBoundingClientRect();
    const docH = document.documentElement.scrollHeight;
    const winH = window.innerHeight;
    const bodyText = document.body.innerText.toLowerCase();
    return {
      statsVisible: stats && !stats.classList.contains('is-hidden'),
      controlsVisible: controls && !controls.classList.contains('is-hidden'),
      stampVisible: stamp && !stamp.hidden && stamp.offsetParent !== null,
      stampText: stamp?.textContent ?? '',
      bodyHasGamepix: bodyText.includes('gamepix'),
      canvasBottom: rect ? rect.bottom : 0,
      canvasTop: rect ? rect.top : 0,
      canvasHeight: rect ? rect.height : 0,
      winH,
      docH,
      maxH: getComputedStyle(document.documentElement).getPropertyValue('--game-stage-max-h').trim(),
      playerVisible: (() => {
        const ctx = canvas?.getContext('2d');
        if (!ctx || !rect || rect.width < 10) return null;
        const sy = canvas.height / rect.height;
        const sampleY = Math.floor(rect.height * 0.88 * sy);
        const w = canvas.width;
        let nonBg = 0;
        for (let x = Math.floor(w * 0.35); x < Math.floor(w * 0.65); x += 4) {
          const d = ctx.getImageData(x, sampleY, 1, 1).data;
          if (d[0] + d[1] + d[2] > 30) nonBg++;
        }
        return nonBg > 3;
      })(),
    };
  });

  if (playing.bodyHasGamepix || playing.stampText.toLowerCase().includes('gamepix')) {
    fail('Visible "gamepix" text during gameplay');
  }
  pass('No gamepix mention in gameplay UI');

  if (playing.stampVisible) {
    fail('Build stamp should be hidden in portal mode');
  }
  pass('Build stamp hidden');

  if (!playing.statsVisible) fail('Stats bar not visible during play');
  pass('Stats bar visible');

  if (!playing.controlsVisible) fail('Pause controls not visible');
  pass('Desktop controls visible');

  if (playing.docH > playing.winH + 2) {
    fail(`Page scrolls during play: ${playing.docH}px > ${playing.winH}px`);
  }
  pass('No page scroll during play');

  if (playing.canvasBottom > playing.winH + 1) {
    fail(`Canvas clipped below viewport: bottom=${playing.canvasBottom} winH=${playing.winH}`);
  }
  pass(`Canvas fits viewport (h=${Math.round(playing.canvasHeight)}, max-h=${playing.maxH})`);

  if (playing.playerVisible === false) {
    fail('Player not visible near bottom of canvas (likely clipped)');
  }
  if (playing.playerVisible === null) {
    warn('Could not sample canvas pixels for player');
  } else {
    pass('Player pixels visible near ground line');
  }

  // Manual-test parity: GamePix.on.pause / resume / soundOff
  const pauseProbe = await page.evaluate(() => {
    const portal = window.__emmindPortal;
    const before = portal?.isPaused?.() ?? false;
    window.GamePix?.on?.pause?.();
    const afterPause = portal?.isPaused?.() ?? false;
    window.GamePix?.on?.soundOff?.();
    window.GamePix?.on?.resume?.();
    const afterResume = portal?.isPaused?.() ?? false;
    return { before, afterPause, afterResume, wasPlaying: portal?.isPlaying?.() ?? false };
  });

  if (!pauseProbe.wasPlaying) {
    fail('Game not in playing state after Start');
  }
  if (!pauseProbe.afterPause) {
    fail('GamePix.on.pause did not pause gameplay');
  }
  pass('GamePix.on.pause freezes gameplay');

  if (pauseProbe.afterResume) {
    fail('GamePix.on.resume did not resume gameplay');
  }
  pass('GamePix.on.resume restores gameplay');

  await page.evaluate(() => window.GamePix?.on?.soundOff?.());
  pass('GamePix.on.soundOff callable (Open Tab audio stop path)');

  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForTimeout(600);
  const resized = await page.evaluate(() => {
    const c = document.getElementById('game-canvas')?.getBoundingClientRect();
    return {
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
      canvasBottom: c?.bottom ?? 0,
    };
  });
  if (resized.canvasBottom > resized.winH + 12) {
    fail(`Canvas clipped after iframe resize: bottom=${resized.canvasBottom} winH=${resized.winH}`);
  }
  pass('Canvas fits after iframe resize (640×360)');

  console.log('\nAll GamePix embed + SDK checks passed.');
} catch (err) {
  fail(err.message);
} finally {
  await browser.close();
}
