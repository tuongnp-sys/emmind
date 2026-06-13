/**
 * Capture itch.io cover (630×500 with title) + gameplay screenshots.
 * Output: packages/itch-marketing/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'packages', 'itch-marketing');
const distDir = path.join(root, 'dist');
const PREVIEW_PORT = 5199;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;

const COVER_W = 630;
const COVER_H = 500;
const TITLE = 'Emmind — 7 Layers of Ascent';
const TAGLINE = 'A meditative ascent through 7 layers of mind';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildPortal() {
  console.log('[capture] building portal dist (clean chrome for shots)...');
  execSync('npm run build:portal', { cwd: root, stdio: 'inherit' });
}

async function startPreview() {
  const child = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'pipe',
    shell: true,
  });
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
  await sleep(600);
}

async function shotElement(page, selector, filePath) {
  const el = page.locator(selector);
  await el.waitFor({ state: 'visible', timeout: 15000 });
  await sleep(350);
  await el.screenshot({ path: filePath, type: 'png' });
  console.log('[capture] wrote', path.relative(root, filePath));
}

async function startRun(page) {
  const btn = page.locator('#btn-start-game');
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  await btn.click();
  await page.waitForFunction(
    () => {
      const o = document.getElementById('overlay-start');
      return o?.classList.contains('is-hidden') || o?.hidden;
    },
    { timeout: 10000 }
  );
  await sleep(800);
}

function coverHtml(bgDataUrl) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${COVER_W}px; height: ${COVER_H}px; overflow: hidden;
    font-family: Georgia, 'Times New Roman', serif;
    background: #1a2332;
  }
  .wrap { position: relative; width: 100%; height: 100%; }
  .bg {
    position: absolute; inset: 0;
    background: url('${bgDataUrl}') center / cover no-repeat;
    filter: brightness(0.72) saturate(1.05);
  }
  .shade {
    position: absolute; inset: 0;
    background: linear-gradient(180deg,
      rgba(12,18,28,0.55) 0%,
      rgba(12,18,28,0.25) 45%,
      rgba(12,18,28,0.82) 100%);
  }
  .text {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 24px; text-align: center;
  }
  h1 {
    color: #f4e8c8;
    font-size: 34px; font-weight: 700;
    line-height: 1.15;
    text-shadow: 0 2px 12px rgba(0,0,0,0.85);
    max-width: 580px;
  }
  p {
    margin-top: 14px;
    color: #b8d4a8;
    font-size: 15px; font-style: italic;
    text-shadow: 0 1px 8px rgba(0,0,0,0.8);
    max-width: 520px;
  }
  .badge {
    margin-top: 18px;
    padding: 6px 14px;
    border: 1px solid rgba(255,215,120,0.45);
    border-radius: 999px;
    color: #ffe566;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: rgba(0,0,0,0.35);
  }
</style></head>
<body><div class="wrap">
  <div class="bg"></div><div class="shade"></div>
  <div class="text">
    <h1>${TITLE}</h1>
    <p>${TAGLINE}</p>
    <div class="badge">HTML5 · Browser · Mobile</div>
  </div>
</div></body></html>`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const { chromium } = await import('playwright');

  buildPortal();
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('dist/index.html missing after build');
  }

  console.log('[capture] starting preview server...');
  const preview = await startPreview();
  console.log('[capture] preview ready at', BASE);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 960, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    // --- 1. Start overlay ---
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await waitForGameReady(page);
    await shotElement(
      page,
      '.game-stage-viewport',
      path.join(outDir, 'screenshot-01-start-menu.png')
    );

    // --- 2. Layer 1 gameplay ---
    await startRun(page);
    await sleep(1200);
    await shotElement(
      page,
      '.game-stage-viewport',
      path.join(outDir, 'screenshot-02-layer1-gameplay.png')
    );

    // --- 3. HUD / stats visible ---
    await shotElement(
      page,
      '.game-play-stack',
      path.join(outDir, 'screenshot-03-hud-and-canvas.png')
    );

    // --- 4. Layer 3 flight ---
    await page.goto(`${BASE}/?layer=3`, { waitUntil: 'networkidle' });
    await waitForGameReady(page);
    await startRun(page);
    await sleep(1200);
    await shotElement(
      page,
      '.game-stage-viewport',
      path.join(outDir, 'screenshot-04-layer3-flight.png')
    );

    // --- Cover: composite title over best gameplay frame ---
    const bgShot = path.join(outDir, 'screenshot-04-layer3-flight.png');
    const bgBuf = fs.readFileSync(bgShot);
    const bgDataUrl = `data:image/png;base64,${bgBuf.toString('base64')}`;

    const coverPage = await context.newPage();
    await coverPage.setViewportSize({ width: COVER_W, height: COVER_H });
    await coverPage.setContent(coverHtml(bgDataUrl), { waitUntil: 'load' });
    await sleep(200);
    await coverPage.screenshot({
      path: path.join(outDir, 'cover-630x500.png'),
      type: 'png',
    });
    console.log('[capture] wrote', path.relative(root, path.join(outDir, 'cover-630x500.png')));

    // --- README for upload ---
    const readme = `# itch.io marketing assets

Upload these on **Edit project** → cover / screenshots gallery.

| File | Use on itch.io |
|------|----------------|
| \`cover-630x500.png\` | **Cover image** (630×500) |
| \`screenshot-01-start-menu.png\` | Screenshot — start overlay |
| \`screenshot-02-layer1-gameplay.png\` | Screenshot — Layer 1 |
| \`screenshot-03-hud-and-canvas.png\` | Screenshot — HUD + canvas |
| \`screenshot-04-layer3-flight.png\` | Screenshot — Layer 3 flight |

**Suggested gallery order:** 02 → 04 → 01 → 03 (gameplay first).

Generated from production build (\`npm run build:portal\`) at ${new Date().toISOString()}.

Title on cover: **${TITLE}**
`;
    fs.writeFileSync(path.join(outDir, 'README-upload.txt'), readme, 'utf8');
    console.log('[capture] done → packages/itch-marketing/');
  } finally {
    await browser.close();
    preview.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('[capture] FAILED:', err.message);
  process.exit(1);
});
