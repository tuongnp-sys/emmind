/**
 * GamePix embed QA — 800×450 iframe fit, title namespace, no gamepix UI text, SDK in HTML.
 * Usage: npm run package:gamepix && npm run preview (separate terminal) && npm run test:gamepix-embed
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
    { timeout: 15000 },
  );
  pass('Start enabled only after host SDK ready (gameLoaded)');

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

  if (!html.includes('gamepix.js')) {
    fail('gamepix.js script not in page');
  }
  pass('GamePix SDK script present');

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
    console.warn('WARN: Could not sample canvas pixels for player');
  } else {
    pass('Player pixels visible near ground line');
  }

  await page.setViewportSize({ width: 640, height: 360 });
  await page.waitForTimeout(400);
  const resized = await page.evaluate(() => {
    const c = document.getElementById('game-canvas')?.getBoundingClientRect();
    return {
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
      canvasBottom: c?.bottom ?? 0,
    };
  });
  if (resized.canvasBottom > resized.winH + 2) {
    fail(`Canvas clipped after iframe resize: bottom=${resized.canvasBottom} winH=${resized.winH}`);
  }
  pass('Canvas fits after iframe resize (640×360)');

  console.log('\nAll GamePix embed checks passed.');
} catch (err) {
  fail(err.message);
} finally {
  await browser.close();
}
