/**
 * patch_affordability.js
 * One-shot script to backfill `affordability_score` into already-processed country JSONs.
 *
 * This was needed when the affordability feature was added after the initial data was
 * seeded. Going forward, processLocation() in processing.js handles this automatically,
 * so you only need to re-run this if you have processed files that pre-date that change.
 *
 * Normalisation strategy (inverted HFCE):
 *   Low HFCE  → high affordability score (cheaper to live)
 *   High HFCE → low affordability score  (expensive to live)
 *
 * Formula:
 *   raw = hfce_data[code]  (USD constant 2015 per capita)
 *   score = clamp(100 - (raw / MAX_HFCE) * 100, 0, 100)
 *   where MAX_HFCE = 60000 (Liechtenstein, upper bound)
 *
 * Usage:  node backend/patch_affordability.js
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROCESSED_DIR = join(__dirname, 'processed');
const HFCE_PATH     = join(__dirname, 'src', 'hfce_data.json');

const hfce = JSON.parse(readFileSync(HFCE_PATH, 'utf-8'));

// Use 60000 as the practical maximum (LI / MC / CH range)
const MAX_HFCE = 60000;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round(v * 10) / 10;

// Only pick up files that look like country codes (e.g. AU.json, NZ.json).
// The length <= 7 filter excludes anything that's not a 2–4 char code + ".json".
const files = readdirSync(PROCESSED_DIR).filter(f => f.endsWith('.json') && f.length <= 7);

let patched = 0;
let missing = 0;

for (const file of files) {
  const code = file.replace('.json', '');
  const path = join(PROCESSED_DIR, file);
  const data = JSON.parse(readFileSync(path, 'utf-8'));

  const raw = hfce[code] ?? null;
  const affordability_score = raw !== null
    ? round1(clamp(100 - (raw / MAX_HFCE) * 100, 0, 100))
    : null;

  if (raw === null) {
    missing++;
    console.warn(`  ⚠  No HFCE data for ${code} — affordability_score set to null`);
  }

  // Merge into the existing scores object rather than replacing it entirely,
  // so all other fields (climate, QoL, etc.) are left untouched.
  data.scores = { ...data.scores, affordability_score, hfce_per_capita: raw };

  writeFileSync(path, JSON.stringify(data, null, 2));
  patched++;
}

console.log(`\nDone. ${patched} files patched, ${missing} missing HFCE entries.`);
