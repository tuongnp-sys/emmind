import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const target = process.argv[2] || 'itch';

const outputs = {
  itch: 'emmind-itch.zip',
  poki: 'emmind-poki.zip',
  crazygames: 'emmind-crazygames.zip',
  gamepix: 'emmind-gamepix.zip',
};

const env = { ...process.env };
if (target !== 'itch') {
  env.VITE_PORTAL = '1';
  env.VITE_PORTAL_TARGET = target;
}

process.chdir(root);
console.log(`[package] building for ${target}...`);
execSync('npm run build', { stdio: 'inherit', env });

console.log('[package] measuring dist...');
execSync('node scripts/measure-dist.mjs', { stdio: 'inherit' });

const dist = path.join(root, 'dist');
const outName = outputs[target] || `emmind-${target}.zip`;
const outPath = path.join(root, 'packages', outName);

fs.mkdirSync(path.dirname(outPath), { recursive: true });

if (process.platform === 'win32') {
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  // NOTE: Compress-Archive (and .NET Framework ZipFile) write backslash entry
  // paths, which breaks extraction on the Linux servers of itch/Poki/CrazyGames
  // (assets end up as literal "assets\foo.js" files → blank game). Windows'
  // built-in bsdtar writes spec-compliant forward slashes; it also expands *.
  execSync(`tar -a -cf "${outPath}" *`, { cwd: dist, stdio: 'inherit' });
} else {
  execSync(`zip -r "${outPath}" .`, { cwd: dist, stdio: 'inherit' });
}

function countFiles(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countFiles(path.join(dir, entry.name));
    else total += 1;
  }
  return total;
}

const fileCount = countFiles(dist);
if (fileCount > 1000) {
  console.error(`FAIL: ${fileCount} files exceeds itch.io 1000 file limit.`);
  process.exit(1);
}

console.log(`\n[package] wrote ${outPath} (${fileCount} files)`);
