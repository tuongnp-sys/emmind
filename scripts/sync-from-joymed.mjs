#!/usr/bin/env node
/**
 * One-way copy of game mechanics from Joymed → Emmind.
 * READ ONLY on Joymed — never writes to web_hoc_stripe.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMMIND = join(__dirname, '..');
const JOYMED_GAME = join(EMMIND, '..', 'joymed', 'web_hoc_stripe', 'frontend', 'public', 'game');

const COPY_TO_SRC = [
  'js/background.js',
  'js/player.js',
  'js/obstacle.js',
  'js/particles.js',
  'js/audio.js',
  'js/touch-joystick.js',
  'js/achievements.js',
];

const COPY_TO_PUBLIC = ['css/style.css'];

async function cp(rel, destDir) {
  const src = join(JOYMED_GAME, rel);
  const base = rel.split('/').pop();
  const dest = join(destDir, base);
  await mkdir(destDir, { recursive: true });
  await copyFile(src, dest);
  console.log(`  ${rel} → ${dest}`);
}

async function main() {
  console.log('Sync from Joymed (read-only)…');
  for (const rel of COPY_TO_SRC) {
    await cp(rel, join(EMMIND, 'src'));
  }
  for (const rel of COPY_TO_PUBLIC) {
    await cp(rel, join(EMMIND, 'public', 'css'));
  }
  console.log('Done. main.js and session.js are NOT overwritten — merge manually if needed.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
