/**
 * Download GamePix SDK into public/sdk/ for offline ZIP (toolkit scanner + no CDN block).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SDK_URL = 'https://gamepix.blob.core.windows.net/gpxlib/dev/gamepix.js';
const outDir = path.join(root, 'public', 'sdk');
const outFile = path.join(outDir, 'gamepix.js');

fs.mkdirSync(outDir, { recursive: true });

const res = await fetch(SDK_URL);
if (!res.ok) {
  console.error(`[gamepix-sdk] fetch failed: ${res.status} ${SDK_URL}`);
  process.exit(1);
}

const body = await res.text();
if (!body.includes('GamePix')) {
  console.error('[gamepix-sdk] response does not look like GamePix SDK');
  process.exit(1);
}

fs.writeFileSync(outFile, body, 'utf8');
console.log(`[gamepix-sdk] wrote ${outFile} (${(body.length / 1024).toFixed(1)} KB)`);
