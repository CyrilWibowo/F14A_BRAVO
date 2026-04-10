/**
 * Seed script — reads raw_data.json and directly processes each country
 * into backend/processed/ using the processing pipeline (no HTTP needed).
 *
 * Usage:  node backend/seed.js
 *   (Backend does NOT need to be running)
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { processLocation } from './src/processing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find raw data file — prefer backend copy (has UV), fall back to root
const candidates = [
  join(__dirname, 'raw_data.json'),
  join(__dirname, '..', 'raw_data.json'),
];
let rawPath = null;
for (const c of candidates) {
  try { readFileSync(c, { encoding: 'utf-8', flag: 'r' }).slice(0, 1); rawPath = c; break; } catch {}
}
if (!rawPath) { console.error('Could not find raw_data.json'); process.exit(1); }

console.log(`Reading raw data from: ${rawPath}`);
const raw = JSON.parse(readFileSync(rawPath, 'utf-8').replace(/^\uFEFF/, ''));
console.log(`Processing ${raw.length} countries directly into backend/processed/\n`);

let success = 0;
let failed = 0;

for (let i = 0; i < raw.length; i++) {
  const entry = raw[i];
  const label = `[${i + 1}/${raw.length}] ${entry.country} (${entry.country_code})`;

  try {
    const result = await processLocation(entry);
    console.log(`  ✓ ${label} — liveability: ${result.liveability}`);
    success++;
  } catch (err) {
    console.error(`  ✗ ${label} — ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. ${success} succeeded, ${failed} failed.`);
console.log('Processed files saved to backend/processed/');
