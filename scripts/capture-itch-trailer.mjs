/**
 * Record a ~45s gameplay trailer for itch.io (YouTube/Vimeo link).
 * Output: packages/itch-marketing/trailer-45s.mp4
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'packages', 'itch-marketing');
const tmpDir = path.join(outDir, '_trailer_tmp');
const PREVIEW_PORT = 5200;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;
const VIEWPORT = { width: 1280, height: 720 };
const OUT_MP4 = path.join(outDir, 'trailer-45s.mp4');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildPortal() {
  console.log('[trailer] building portal dist...');
  execSync('npm run build:portal', { cwd: root, stdio: 'inherit' });
}

async function startPreview() {
  const child = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: root, stdio: 'pipe', shell: true }
  );
  child.stdout.on('data', (c) => process.stdout.write(c));
  child.stderr.on('data', (c) => process.stderr.write(c));
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return child;
    } catch {
      /* retry */
    }
    await sleep(400);
  }
  child.kill('SIGTERM');
  throw new Error('Preview server did not become reachable');
}

async function waitForGameReady(page) {
  await page.waitForSelector('#game-canvas', { state: 'visible', timeout: 25000 });
  await page.waitForSelector('#btn-start-game', { state: 'visible', timeout: 25000 });
  await sleep(500);
}

async function startRun(page) {
  await page.locator('#btn-start-game').click();
  await page.waitForFunction(
    () => {
      const o = document.getElementById('overlay-start');
      return o?.classList.contains('is-hidden') || o?.hidden;
    },
    { timeout: 10000 }
  );
  await page.locator('#game-canvas').click({ position: { x: 450, y: 260 } });
  await sleep(400);
}

async function tapKey(page, key, ms) {
  await page.keyboard.down(key);
  await sleep(ms);
  await page.keyboard.up(key);
}

/** Layer 1: run, jump, dodge rhythm for trailer. */
async function automateLayer1(page, totalMs) {
  const end = Date.now() + totalMs;
  let right = true;
  while (Date.now() < end) {
    const key = right ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    await sleep(1400 + Math.random() * 400);
    await page.keyboard.up(key);
    if (Math.random() > 0.35) {
      await page.keyboard.press('Space');
      await sleep(350);
    }
    right = !right;
  }
}

/** Layer 2+: fly in a diamond pattern. */
async function automateFlight(page, totalMs) {
  const pattern = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  const end = Date.now() + totalMs;
  let i = 0;
  while (Date.now() < end) {
    const key = pattern[i % pattern.length];
    await page.keyboard.down(key);
    await sleep(1100);
    await page.keyboard.up(key);
    i += 1;
    await sleep(80);
  }
}

async function recordSegment(browser, label, url, runScene) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: tmpDir, size: VIEWPORT },
  });
  const page = await context.newPage();
  console.log(`[trailer] recording segment: ${label}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await waitForGameReady(page);
  await runScene(page);
  const video = page.video();
  await context.close();
  const webmPath = await video.path();
  const dest = path.join(tmpDir, `${label}.webm`);
  if (webmPath !== dest) fs.renameSync(webmPath, dest);
  console.log('[trailer] segment saved', path.relative(root, dest));
  return dest;
}

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function concatToMp4(segmentPaths, outPath) {
  const listFile = path.join(tmpDir, 'concat.txt');
  const lines = segmentPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(listFile, lines, 'utf8');

  // Re-encode for consistent fps/codec (concat copy often fails across webm segments).
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart -an "${outPath}"`,
    { cwd: root, stdio: 'inherit' }
  );
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(tmpDir)) {
    for (const f of fs.readdirSync(tmpDir)) {
      fs.unlinkSync(path.join(tmpDir, f));
    }
  }

  if (!hasFfmpeg()) {
    console.error('[trailer] ffmpeg is required. Install: winget install ffmpeg');
    process.exit(1);
  }

  const { chromium } = await import('playwright');

  buildPortal();
  console.log('[trailer] starting preview...');
  const preview = await startPreview();

  const browser = await chromium.launch();

  try {
    // Segment A (~22s): start menu + layer 1
    const seg1 = await recordSegment(browser, 'seg1-layer1', `${BASE}/`, async (page) => {
      await sleep(3500); // start overlay
      await startRun(page);
      await automateLayer1(page, 17500);
    });

    // Segment B (~23s): layer 3 flight
    const seg2 = await recordSegment(browser, 'seg2-layer3', `${BASE}/?layer=3`, async (page) => {
      await sleep(2500);
      await startRun(page);
      await automateFlight(page, 19500);
      await sleep(800);
    });

    console.log('[trailer] encoding trailer-45s.mp4...');
    concatToMp4([seg1, seg2], OUT_MP4);

    const mb = (fs.statSync(OUT_MP4).size / (1024 * 1024)).toFixed(2);
    console.log(`[trailer] wrote ${path.relative(root, OUT_MP4)} (${mb} MB)`);

    const yt = `# YouTube upload (copy-paste)

**Title:** Emmind — 7 Layers of Ascent | Gameplay Trailer

**Description:**
A meditative HTML5 ascent through 7 layers of mind.
Play free on itch.io: [paste your itch page URL]

Desktop: Arrow keys / WASD · Space to jump
Mobile: Drag anywhere on the play area to move · Tap to jump

**Visibility:** Unlisted

Then paste the YouTube link into itch.io → Edit project → Gameplay video or trailer.
`;
    fs.writeFileSync(path.join(outDir, 'youtube-upload.txt'), yt, 'utf8');
  } finally {
    await browser.close();
    preview.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('[trailer] FAILED:', err.message);
  process.exit(1);
});
