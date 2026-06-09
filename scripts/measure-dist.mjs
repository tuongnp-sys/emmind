import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const WARN_MB = 45;
const HARD_MB = 50;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const files = walk(DIST);
let total = 0;
const rows = [];

for (const file of files) {
  const stat = fs.statSync(file);
  total += stat.size;
  rows.push({ rel: path.relative(DIST, file), size: stat.size });
}

rows.sort((a, b) => b.size - a.size);
const totalMb = total / (1024 * 1024);

console.log(`\n[Emmind] dist size: ${totalMb.toFixed(2)} MB (${files.length} files)`);
console.log('\nLargest files:');
for (const row of rows.slice(0, 12)) {
  console.log(`  ${(row.size / 1024).toFixed(1)} KB  ${row.rel}`);
}

if (totalMb > HARD_MB) {
  console.error(`\nFAIL: exceeds CrazyGames ${HARD_MB} MB limit.`);
  process.exit(1);
}
if (totalMb > WARN_MB) {
  console.warn(`\nWARN: approaching CrazyGames ${HARD_MB} MB limit (>${WARN_MB} MB).`);
}
