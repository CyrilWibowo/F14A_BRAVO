import { InputError } from './error.js';
import { setLocation } from './db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/***************************************************************
                       QoL Data Loading
***************************************************************/

let hdiData = {};
let qolData = {};
let hfceData = {};
try {
  hdiData = JSON.parse(readFileSync(join(__dirname, 'hdi_data.json'), 'utf-8'));
} catch { console.warn('hdi_data.json not found — HDI scores will be null'); }
try {
  qolData = JSON.parse(readFileSync(join(__dirname, 'qol_data.json'), 'utf-8'));
} catch { console.warn('qol_data.json not found — supplementary QoL scores will be null'); }
try {
  hfceData = JSON.parse(readFileSync(join(__dirname, 'hfce_data.json'), 'utf-8'));
  // hfce_data.json holds World Bank HFCE per capita (NE.CON.PRVT.PC.KD, constant 2015 USD)
  // keyed by ISO alpha-2 country code. Generated manually from WB bulk download.
} catch { console.warn('hfce_data.json not found — affordability scores will be null'); }

// ── ADDED ────────────────────────────────────────────────────────────────────
import { recordScoreComputed } from './observability.js';
// ────────────────────────────────────────────────────────────────────────────

/***************************************************************
                       Normalisation Helpers
***************************************************************/

const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

const removeOutliers = (pairs) => {
  if (pairs.length < 4) return pairs;
  const sorted = [...pairs.map((p) => p.value)].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return pairs.filter((p) => p.value >= q1 - 1.5 * iqr && p.value <= q3 + 1.5 * iqr);
};

const normalise = (raw) => {
  const { daily } = raw;
  const n = daily.time.length;

  const fields = ['temp', 'humidity', 'precipitation', 'wind', 'uv', 'daylight'];
  const rawKeys = [
    'temperature_2m_mean',
    'relative_humidity_2m_mean',
    'precipitation_sum',
    'wind_speed_10m_max',
    'uv_index_max',
    'daylight_duration',
  ];

  const cleaned = {};
  for (let f = 0; f < fields.length; f++) {
    const pairs = [];
    const arr = daily[rawKeys[f]];
    if (!arr) { cleaned[fields[f]] = []; continue; }
    for (let i = 0; i < n; i++) {
      const val = arr[i];
      if (val !== null && val !== undefined && !isNaN(val)) {
        pairs.push({ time: daily.time[i], value: val });
      }
    }
    cleaned[fields[f]] = removeOutliers(pairs);
  }

  return cleaned;
};

/***************************************************************
                       Score Computation
***************************************************************/

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const round = (val) => Math.round(val * 10) / 10;

// TOOO: add custom temp scoring (ideal temp is different for everyone)
const tempScore = (m) => clamp(100 - Math.abs(m - 20) * 4, 0, 100);
const humidityScore = (m) => clamp(100 - Math.abs(m - 50) * 1.5, 0, 100);
const uvScore = (m) => clamp(100 - m * 9, 0, 100);
const windScore = (m) => clamp(100 - Math.max(0, m - 15) * 3, 0, 100);
const precipScore = (m) => {
  if (m < 1) return clamp(m * 50, 20, 50);
  if (m <= 4) return clamp(50 + (m - 1) / 3 * 50, 50, 100);
  return clamp(100 - (m - 4) * 8, 0, 100);
};

// Daylight score: ideal ~12 hours (43200 seconds). Penalise extremes.
const daylightScore = (m) => {
  const hours = m / 3600;
  return clamp(100 - Math.abs(hours - 12) * 8, 0, 100);
};

const uvClassification = (m) => {
  if (m < 3) return 'low';
  if (m < 6) return 'moderate';
  if (m < 8) return 'high';
  if (m < 11) return 'very_high';
  return 'extreme';
};

// countryCode is threaded through from processLocation so we can log it
const computeScoresFromMeans = (means, countryCode) => {
  const ts = tempScore(means.temp);
  const hs = humidityScore(means.humidity);
  const comfortIndex = round(ts * 0.6 + hs * 0.4);

  const hasUv = means.uv !== null && means.uv !== undefined && !isNaN(means.uv);
  const hasDaylight = means.daylight !== null && means.daylight !== undefined && !isNaN(means.daylight);

  // Distribute weights: comfort 40%, then uv/daylight/precip/wind share 60%
  const uvWeight = hasUv ? 0.15 : 0;
  const dlWeight = hasDaylight ? 0.15 : 0;
  const remaining = 0.6 - uvWeight - dlWeight;  
  const precipWeight = remaining / 2;
  const windWeight = remaining / 2;

  const climateScore = round(
    comfortIndex * 0.4 +
    (hasUv ? uvScore(means.uv) * uvWeight : 0) +
    (hasDaylight ? daylightScore(means.daylight) * dlWeight : 0) +
    precipScore(means.precipitation) * precipWeight +
    windScore(means.wind) * windWeight,
  );

  // ── ADDED ──────────────────────────────────────────────────────────────────
  recordScoreComputed(liveability, countryCode);
  // ── END ADDED ──────────────────────────────────────────────────────────────

  return {
    climate_score: climateScore,
    comfort_index: comfortIndex,
    uv_risk: hasUv ? uvClassification(means.uv) : null,
    uv_index_mean: hasUv ? round(means.uv) : null,
    daylight_hours: hasDaylight ? round(means.daylight / 3600) : null,
    temperature_mean: round(means.temp),
    humidity_mean: round(means.humidity),
    precipitation_mean: round(means.precipitation),
    wind_speed_mean: round(means.wind),
  };
};

/***************************************************************
                       Monthly Averages
***************************************************************/

const computeMonthlyAverages = (cleaned) => {
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fields = ['temp', 'humidity', 'precipitation', 'wind', 'uv', 'daylight'];

  const buckets = Array.from({ length: 12 }, () => ({ temp: [], humidity: [], precipitation: [], wind: [], uv: [], daylight: [] }));

  for (const field of fields) {
    for (const { time, value } of cleaned[field]) {
      const month = getMonth(time) - 1;
      buckets[month][field].push(value);
    }
  }

  return buckets.map((b, i) => ({
    month: MONTH_NAMES[i],
    temp: b.temp.length > 0 ? round(mean(b.temp)) : null,
    humidity: b.humidity.length > 0 ? round(mean(b.humidity)) : null,
    precipitation: b.precipitation.length > 0 ? round(mean(b.precipitation)) : null,
    wind: b.wind.length > 0 ? round(mean(b.wind)) : null,
    uv: b.uv.length > 0 ? round(mean(b.uv)) : null,
    daylight_hours: b.daylight.length > 0 ? round(mean(b.daylight) / 3600) : null,
  }));
};

/***************************************************************
                       Seasonal Computation
***************************************************************/

const getMonth = (dateStr) => parseInt(dateStr.split('-')[1], 10);

const SEASON_MONTHS = {
  northern: { spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11], winter: [12, 1, 2] },
  southern: { spring: [9, 10, 11], summer: [12, 1, 2], autumn: [3, 4, 5], winter: [6, 7, 8] },
};

const computeSeasonalScores = (cleaned, latitude, countryCode) => {
  const hemisphere = latitude >= 0 ? 'northern' : 'southern';
  const seasons = SEASON_MONTHS[hemisphere];
  const seasonal = {};

  for (const [season, months] of Object.entries(seasons)) {
    const filter = (pairs) => pairs.filter((p) => months.includes(getMonth(p.time)));
    const vals = {
      temp: filter(cleaned.temp),
      humidity: filter(cleaned.humidity),
      precipitation: filter(cleaned.precipitation),
      wind: filter(cleaned.wind),
      uv: filter(cleaned.uv),
      daylight: filter(cleaned.daylight),
    };
    const hasData = ['temp', 'humidity', 'precipitation', 'wind'].every((k) => vals[k].length > 0);
    if (!hasData) {
      seasonal[season] = null;
      continue;
    }
    const means = {
      temp: mean(vals.temp.map((p) => p.value)),
      humidity: mean(vals.humidity.map((p) => p.value)),
      precipitation: mean(vals.precipitation.map((p) => p.value)),
      wind: mean(vals.wind.map((p) => p.value)),
      uv: vals.uv.length > 0 ? mean(vals.uv.map((p) => p.value)) : null,
      daylight: vals.daylight.length > 0 ? mean(vals.daylight.map((p) => p.value)) : null,
    };
    // ── MODIFIED: pass countryCode through so seasonal scores are also logged ─
    seasonal[season] = computeScoresFromMeans(means, countryCode);
  }

  return seasonal;
};

/***************************************************************
                       QoL Score Computation
***************************************************************/

const computeQolScores = (countryCode) => {
  const hdi = hdiData[countryCode] ?? null;
  const supp = qolData[countryCode] ?? {};

  // HDI is already 0-1, scale to 0-100
  const hdiScore = hdi !== null ? round(hdi * 100) : null;

  // Homicide rate: lower is better. 0 = 100, 30+ = 0
  const homicideRate = supp.homicide_rate ?? null;
  const safetyScore = homicideRate !== null ? round(clamp(100 - homicideRate * (100 / 30), 0, 100)) : null;

  // Internet users %: directly a 0-100 score
  const internetPct = supp.internet_users ?? null;
  const internetScore = internetPct !== null ? round(clamp(internetPct, 0, 100)) : null;

  // Sanitation %: directly a 0-100 score
  const sanitationPct = supp.sanitation ?? null;
  const sanitationScore = sanitationPct !== null ? round(clamp(sanitationPct, 0, 100)) : null;

  // Suicide rate: lower is better. 0 = 100, 30+ = 0
  const suicideRate = supp.suicide_rate ?? null;
  const mentalHealthScore = suicideRate !== null ? round(clamp(100 - suicideRate * (100 / 30), 0, 100)) : null;

  // Composite QoL: weighted average of available indicators
  // TODO: justify default weighting scores
  const components = [
    { score: hdiScore, weight: 0.5 },
    { score: safetyScore, weight: 0.2 },
    { score: internetScore, weight: 0.05 },
    { score: sanitationScore, weight: 0.15 },
    { score: mentalHealthScore, weight: 0.1 },
  ];

  const available = components.filter(c => c.score !== null);
  let qolScore = null;
  if (available.length > 0) {
    const totalWeight = available.reduce((s, c) => s + c.weight, 0);
    qolScore = round(available.reduce((s, c) => s + c.score * (c.weight / totalWeight), 0));
  }

  return {
    qol_score: qolScore,
    hdi,
    hdi_score: hdiScore,
    safety_score: safetyScore,
    internet_score: internetScore,
    sanitation_score: sanitationScore,
    mental_health_score: mentalHealthScore,
    // Raw values for frontend re-computation with user weights
    homicide_rate: homicideRate,
    internet_users: internetPct,
    sanitation_pct: sanitationPct,
    suicide_rate: suicideRate,
  };
};

/***************************************************************
                       Affordability Score
 The patch_affordability.js script also writes this field to existing
 processed JSON files, but computing it here means any future call to
 processLocation() will include it automatically without a re-patch.
***************************************************************/

// 60000 USD is used as the practical ceiling — it covers Liechtenstein, Monaco,
// and Switzerland, the most expensive countries in the dataset. Anything above
// this gets clamped to a score of 0 rather than going negative.
const MAX_HFCE = 60000;

/**
 * Converts a raw HFCE per-capita figure into an affordability score (0–100).
 * The scale is inverted: lower cost of living → higher score.
 * Returns null for both fields when the country has no HFCE data.
 *
 * Formula: affordability_score = 100 − (hfce / MAX_HFCE) × 100, clamped to [0, 100]
 *
 * @param {string} countryCode - ISO alpha-2 code
 * @returns {{ affordability_score: number|null, hfce_per_capita: number|null }}
 */
const computeAffordabilityScore = (countryCode) => {
  const raw = hfceData[countryCode] ?? null;
  if (raw === null) return { affordability_score: null, hfce_per_capita: null };
  const score = round(clamp(100 - (raw / MAX_HFCE) * 100, 0, 100));
  return { affordability_score: score, hfce_per_capita: raw };
};

/***************************************************************
                       Main Pipeline
***************************************************************/

export const processLocation = async (rawData) => {
  const required = ['country', 'country_code', 'latitude', 'longitude', 'daily'];
  for (const field of required) {
    if (rawData[field] === undefined) throw new InputError(`Missing required field: ${field}`);
  }
 
  const requiredDaily = [
    'time',
    'temperature_2m_mean',
    'relative_humidity_2m_mean',
    'precipitation_sum',
    'wind_speed_10m_max',
  ];
  for (const field of requiredDaily) {
    if (!Array.isArray(rawData.daily[field])) throw new InputError(`Missing required daily field: ${field}`);
  }
 
  const cleaned = normalise(rawData);
 
  const overallMeans = {
    temp: mean(cleaned.temp.map((p) => p.value)),
    humidity: mean(cleaned.humidity.map((p) => p.value)),
    precipitation: mean(cleaned.precipitation.map((p) => p.value)),
    wind: mean(cleaned.wind.map((p) => p.value)),
    uv: cleaned.uv.length > 0 ? mean(cleaned.uv.map((p) => p.value)) : null,
    daylight: cleaned.daylight.length > 0 ? mean(cleaned.daylight.map((p) => p.value)) : null,
  };
 
  // FIX 3: removed duplicate `const scores` — pass countryCode here instead
  const climateScores      = computeScoresFromMeans(overallMeans, rawData.country_code);
  const qolScores          = computeQolScores(rawData.country_code);
  const affordabilityScores = computeAffordabilityScore(rawData.country_code);
 
  let liveability = climateScores.climate_score;
  if (qolScores.qol_score !== null) {
    liveability = round(climateScores.climate_score * 0.5 + qolScores.qol_score * 0.5);
  }
 
  const scores = {
    liveability,
    ...climateScores,
    ...qolScores,
    ...affordabilityScores,
  };
 
  const seasonal = computeSeasonalScores(cleaned, rawData.latitude, rawData.country_code);
  const monthly = computeMonthlyAverages(cleaned);
 
  await setLocation(rawData.country_code, {
    country: rawData.country,
    country_code: rawData.country_code,
    capital: rawData.capital || null,
    latitude: rawData.latitude,
    longitude: rawData.longitude,
    processed_at: new Date().toISOString(),
    scores,
    seasonal,
    monthly,
  });
 
  return { country_code: rawData.country_code, ...scores };
};
 