/**
 * CrazyGames Details assets: 3 cover sizes + 2 preview videos (max 20s).
 * Output: packages/crazygames-marketing/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'packages', 'itch-marketing');
const outDir = path.join(root, 'packages', 'crazygames-marketing');

const COVER_SRC = path.join(srcDir, 'cover-630x500.png');
const GAMEPLAY_SRC = path.join(srcDir, 'screenshot-04-layer3-flight.png');
const TRAILER_SRC = path.join(srcDir, 'trailer-45s.mp4');

const BG = '0x1a2332';
const VIDEO_SEC = 20;

const OUT = {
  landscapeCover: path.join(outDir, 'cover-landscape-1920x1080.png'),
  portraitCover: path.join(outDir, 'cover-portrait-800x1200.png'),
  squareCover: path.join(outDir, 'cover-square-800x800.png'),
  landscapeVideo: path.join(outDir, 'preview-landscape-20s.mp4'),
  portraitVideo: path.join(outDir, 'preview-portrait-20s.mp4'),
};

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', shell: true });
}

function assertFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
  } catch {
    console.error('[crazygames-marketing] ffmpeg required. Install: winget install ffmpeg');
    process.exit(1);
  }
}

function assertSources() {
  for (const p of [COVER_SRC, GAMEPLAY_SRC, TRAILER_SRC]) {
    if (!fs.existsSync(p)) {
      console.error(`[crazygames-marketing] missing ${p}`);
      console.error('Run: npm run capture:itch-marketing && npm run capture:itch-trailer');
      process.exit(1);
    }
  }
}

function buildLandscapeCover() {
  // Branded itch cover letterboxed to 16:9.
  run(
    `ffmpeg -y -i "${COVER_SRC}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=${BG}" -frames:v 1 "${OUT.landscapeCover}"`
  );
}

function buildPortraitCover() {
  run(
    `ffmpeg -y -i "${COVER_SRC}" -vf "scale=800:1200:force_original_aspect_ratio=decrease,pad=800:1200:(ow-iw)/2:(oh-ih)/2:color=${BG}" -frames:v 1 "${OUT.portraitCover}"`
  );
}

function buildSquareCover() {
  run(
    `ffmpeg -y -i "${COVER_SRC}" -vf "crop=500:500:65:0,scale=800:800:flags=lanczos" -frames:v 1 "${OUT.squareCover}"`
  );
}

function buildLandscapeVideo() {
  run(
    `ffmpeg -y -i "${TRAILER_SRC}" -t ${VIDEO_SEC} -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart -an "${OUT.landscapeVideo}"`
  );
}

function buildPortraitVideo() {
  // 2:3 (800x1200) to match CrazyGames portrait cover spec.
  run(
    `ffmpeg -y -i "${TRAILER_SRC}" -t ${VIDEO_SEC} -vf "scale=800:1200:force_original_aspect_ratio=increase,crop=800:1200,setsar=1" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart -an "${OUT.portraitVideo}"`
  );
}

function report(filePath) {
  const st = fs.statSync(filePath);
  const kb = (st.size / 1024).toFixed(1);
  console.log(`[crazygames-marketing] ${path.basename(filePath)} — ${kb} KB`);
}

function main() {
  assertFfmpeg();
  assertSources();
  fs.mkdirSync(outDir, { recursive: true });

  console.log('[crazygames-marketing] covers...');
  buildLandscapeCover();
  buildPortraitCover();
  buildSquareCover();

  console.log(`[crazygames-marketing] videos (${VIDEO_SEC}s)...`);
  buildLandscapeVideo();
  buildPortraitVideo();

  for (const p of Object.values(OUT)) report(p);
  console.log('[crazygames-marketing] done → packages/crazygames-marketing/');
}

main();
