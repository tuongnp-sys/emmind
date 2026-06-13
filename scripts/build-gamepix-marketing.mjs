/**
 * GamePix store assets — title "Emmind 7 Layers" (namespace emmind-7-layers).
 * Embeds PNGs as base64 (Playwright setContent cannot load file:// CSS urls).
 * Output: packages/gamepix-marketing/icon-256.png, cover-1360x850.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'packages', 'itch-marketing');
const outDir = path.join(root, 'packages', 'gamepix-marketing');

const GAMEPIX_TITLE = 'Emmind 7 Layers';
const SUBTITLE = 'A meditative ascent through 7 layers of mind';

const LAYER1_SRC = path.join(srcDir, 'screenshot-02-layer1-gameplay.png');
const LAYER3_SRC = path.join(srcDir, 'screenshot-04-layer3-flight.png');

function dataUri(filePath) {
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/** Dual gameplay panels — no baked-in old title, no flat black. */
function coverHtml(layer1Uri, layer3Uri) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1360px; height: 850px; overflow: hidden; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #3a6a8a; }
  .frame { position: relative; width: 1360px; height: 850px; overflow: hidden; }
  .panels { display: flex; width: 100%; height: 100%; }
  .panel {
    flex: 1; height: 100%;
    background-size: cover; background-position: center; background-repeat: no-repeat;
  }
  .panel-a {
    background-image: url('${layer1Uri}');
    filter: brightness(1.1) saturate(1.15);
    border-right: 2px solid rgba(255,255,255,0.12);
  }
  .panel-b {
    background-image: url('${layer3Uri}');
    filter: brightness(1.08) saturate(1.12);
  }
  .vignette {
    position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(to bottom, rgba(8,14,22,0.15) 0%, transparent 35%, transparent 55%, rgba(8,14,22,0.82) 100%),
      linear-gradient(to right, rgba(8,14,22,0.12) 0%, transparent 8%, transparent 92%, rgba(8,14,22,0.12) 100%);
  }
  .copy {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
    padding: 52px 64px 44px; text-align: center;
  }
  h1 {
    font-size: 4.8rem; font-weight: 700; line-height: 1.08;
    letter-spacing: 0.02em; color: #f8f0e0;
    text-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 32px rgba(0,0,0,0.35);
    margin-bottom: 0.5rem;
  }
  .sub {
    font-size: 1.5rem; font-style: italic; color: #b8e8c8;
    line-height: 1.35;
    text-shadow: 0 1px 6px rgba(0,0,0,0.85);
    margin-bottom: 1rem;
  }
  .tags {
    display: inline-block;
    padding: 0.42rem 1.15rem;
    border: 1px solid rgba(212, 184, 150, 0.7);
    border-radius: 999px;
    font-size: 0.9rem; letter-spacing: 0.14em;
    color: #e8d4b0; text-transform: uppercase;
    background: rgba(12, 18, 26, 0.45);
    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
</style>
</head>
<body>
  <div class="frame">
    <div class="panels">
      <div class="panel panel-a"></div>
      <div class="panel panel-b"></div>
    </div>
    <div class="vignette"></div>
    <div class="copy">
      <h1>${GAMEPIX_TITLE}</h1>
      <p class="sub">${SUBTITLE}</p>
      <div class="tags">HTML5 · Browser · Mobile</div>
    </div>
  </div>
</body>
</html>`;
}

/** Layer 3 flight crop — character, golden orb, stars on blue (not flat green). */
function iconHtml(gameplayUri) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 256px; height: 256px; overflow: hidden; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #4a7a9a; }
  .frame { position: relative; width: 256px; height: 256px; overflow: hidden; }
  .bg {
    position: absolute; inset: -8px;
    background: url('${gameplayUri}') 48% 52% / 135% no-repeat;
    filter: brightness(1.15) saturate(1.22) contrast(1.08);
  }
  .glow {
    position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(to top, rgba(8, 14, 22, 0.88) 0%, rgba(8, 14, 22, 0.2) 28%, transparent 48%);
  }
  .title-bar {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
    padding: 18px 4px 6px; text-align: center;
  }
  h1 {
    font-size: 13.5px; font-weight: 700; line-height: 1.15;
    letter-spacing: 0.03em; color: #faf5eb;
    text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.45);
  }
</style>
</head>
<body>
  <div class="frame">
    <div class="bg"></div>
    <div class="glow"></div>
    <div class="title-bar"><h1>${GAMEPIX_TITLE}</h1></div>
  </div>
</body>
</html>`;
}

async function renderHtml(browser, html, outPath, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: outPath, type: 'png' });
  await page.close();
}

async function captureCanvas(browser, layer = 1) {
  const capturePath = path.join(outDir, `_canvas-layer${layer}.png`);
  const previewUrl =
    process.env.EMMIND_PREVIEW_URL?.replace(/\?.*$/, '') || 'http://localhost:4173';
  const url = `${previewUrl}/?platform=gamepix&layer=${layer}`;

  const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForSelector('#btn-start-game', { timeout: 12000 });
    await page.click('#btn-start-game');
    await page.waitForTimeout(2500);
    await page.locator('#game-canvas').screenshot({ path: capturePath, type: 'png' });
    console.log(`[gamepix-marketing] live canvas layer ${layer} captured`);
    return capturePath;
  } catch (err) {
    console.warn(`[gamepix-marketing] live canvas layer ${layer} skipped:`, err.message);
    return null;
  } finally {
    await page.close();
  }
}

function assertSources() {
  for (const p of [LAYER1_SRC, LAYER3_SRC]) {
    if (!fs.existsSync(p)) {
      console.error(`[gamepix-marketing] missing ${p}`);
      console.error('Run: npm run capture:itch-marketing');
      process.exit(1);
    }
  }
}

function writeReadme() {
  fs.writeFileSync(
    path.join(outDir, 'README-UPLOAD.txt'),
    `# GamePix marketing — upload these

Title on assets: **${GAMEPIX_TITLE}**

| File | Size | GamePix field |
|------|------|---------------|
| icon-256.png | 256×256 | Icon |
| cover-1360x850.png | 1360×850 | Cover |

Regenerate: npm run build:gamepix-marketing
(Optional: npm run preview running replaces layer-1 panel with live capture)
`,
    'utf8',
  );
}

async function main() {
  assertSources();
  fs.mkdirSync(outDir, { recursive: true });

  const iconOut = path.join(outDir, 'icon-256.png');
  const coverOut = path.join(outDir, 'cover-1360x850.png');

  const browser = await chromium.launch();
  console.log(`[gamepix-marketing] title: "${GAMEPIX_TITLE}"`);

  const liveL1 = await captureCanvas(browser, 1);
  const liveL3 = await captureCanvas(browser, 3);
  const layer1Path = liveL1 ?? LAYER1_SRC;
  const layer3Path = liveL3 ?? LAYER3_SRC;
  const layer1Uri = dataUri(layer1Path);
  const layer3Uri = dataUri(layer3Path);
  const iconUri = dataUri(layer3Path);

  const coverNote =
    liveL1 || liveL3
      ? `live capture collage (L1${liveL1 ? '✓' : ''} L3${liveL3 ? '✓' : ''})`
      : 'L1 + L3 screenshot collage';
  console.log(`[gamepix-marketing] rendering cover 1360×850 (${coverNote})...`);
  await renderHtml(browser, coverHtml(layer1Uri, layer3Uri), coverOut, 1360, 850);

  const iconNote = liveL3 ? 'live canvas layer 3' : 'layer 3 screenshot';
  console.log(`[gamepix-marketing] rendering icon 256×256 (${iconNote})...`);
  await renderHtml(browser, iconHtml(iconUri), iconOut, 256, 256);

  await browser.close();
  writeReadme();

  for (const f of [iconOut, coverOut]) {
    const kb = (fs.statSync(f).size / 1024).toFixed(1);
    console.log(`[gamepix-marketing] ${path.basename(f)} — ${kb} KB`);
  }
  console.log('[gamepix-marketing] done → packages/gamepix-marketing/');
}

main().catch((err) => {
  console.error('[gamepix-marketing]', err.message);
  process.exit(1);
});
