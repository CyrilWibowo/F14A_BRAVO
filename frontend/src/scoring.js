const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const round = (v) => Math.round(v * 10) / 10;

const UV_MULTIPLIERS = { tolerant: 5, moderate: 9, sensitive: 14 };
const WIND_THRESHOLDS = { low: 8, moderate: 15, high: 25 };

const tempScore     = (m, ideal) => clamp(100 - Math.abs(m - ideal) * 4, 0, 100);
const humidityScore = (m, ideal) => clamp(100 - Math.abs(m - ideal) * 1.5, 0, 100);
const uvScore       = (m, sens)  => clamp(100 - m * UV_MULTIPLIERS[sens], 0, 100);
const windScore     = (m, tol)   => clamp(100 - Math.max(0, m - WIND_THRESHOLDS[tol]) * 3, 0, 100);
const daylightScore = (hours)    => clamp(100 - Math.abs(hours - 12) * 8, 0, 100);

const precipScore = (m, pref) => {
  if (pref === 'dry') {
    if (m < 0.5) return 100;
    return clamp(100 - (m - 0.5) * 14, 0, 100);
  }
  if (pref === 'wet') {
    if (m < 3)  return clamp(m * 20, 0, 60);
    if (m <= 8) return clamp(60 + (m - 3) / 5 * 40, 60, 100);
    return clamp(100 - (m - 8) * 8, 0, 100);
  }
  // moderate (default)
  if (m < 1)  return clamp(m * 50, 20, 50);
  if (m <= 4) return clamp(50 + (m - 1) / 3 * 50, 50, 100);
  return clamp(100 - (m - 4) * 8, 0, 100);
};

/***************************************************************
                       QoL Scoring (frontend)
***************************************************************/

const safetyScore = (homicideRate) => homicideRate != null ? round(clamp(100 - homicideRate * (100 / 30), 0, 100)) : null;
const internetScore = (pct) => pct != null ? round(clamp(pct, 0, 100)) : null;
const sanitationScore = (pct) => pct != null ? round(clamp(pct, 0, 100)) : null;
const mentalHealthScore = (suicideRate) => suicideRate != null ? round(clamp(100 - suicideRate * (100 / 30), 0, 100)) : null;
const hdiScore = (hdi) => hdi != null ? round(hdi * 100) : null;

/**
 * Counts how many of the 5 QoL source indicators are available for a location.
 * Used to flag potentially unreliable QoL scores — if fewer than 3 are present
 * the score is computed from a very limited sample and the UI shows a warning.
 *
 * The 5 indicators are: HDI, homicide rate, internet users, sanitation, suicide rate.
 *
 * @param {object} loc - a location object from the ranking/score API
 * @returns {number} count of non-null indicators (0–5)
 */
export const countQolIndicators = (loc) =>
  [loc.hdi, loc.homicide_rate, loc.internet_users, loc.sanitation_pct, loc.suicide_rate]
    .filter((v) => v != null).length;

const computeQolScore = (loc, prefs) => {
  const components = [
    { score: hdiScore(loc.hdi), weight: prefs.qolWeights?.hdi ?? 0.35 },
    { score: safetyScore(loc.homicide_rate), weight: prefs.qolWeights?.safety ?? 0.2 },
    { score: internetScore(loc.internet_users), weight: prefs.qolWeights?.internet ?? 0.1 },
    { score: sanitationScore(loc.sanitation_pct), weight: prefs.qolWeights?.sanitation ?? 0.15 },
    { score: mentalHealthScore(loc.suicide_rate), weight: prefs.qolWeights?.mentalHealth ?? 0.2 },
  ];

  const available = components.filter(c => c.score !== null);
  if (available.length === 0) return null;
  const totalWeight = available.reduce((s, c) => s + c.weight, 0);
  return round(available.reduce((s, c) => s + c.score * (c.weight / totalWeight), 0));
};

/***************************************************************
                       Composite Liveability
***************************************************************/

export const computeLiveability = (loc, prefs) => {
  if (
    loc.temperature_mean == null ||
    loc.humidity_mean == null ||
    loc.precipitation_mean == null ||
    loc.wind_speed_mean == null
  ) return null;

  const ts = tempScore(loc.temperature_mean, prefs.idealTemp);
  const hs = humidityScore(loc.humidity_mean, prefs.idealHumidity);
  const comfort = round(ts * 0.6 + hs * 0.4);

  const hasUv = loc.uv_index_mean != null;
  const hasDaylight = loc.daylight_hours != null;

  const uvW = hasUv ? 0.15 : 0;
  const dlW = hasDaylight ? 0.15 : 0;
  const remaining = 0.6 - uvW - dlW;
  const pW = remaining / 2;
  const wW = remaining / 2;

  const climateScore = round(
    comfort * 0.4 +
    (hasUv ? uvScore(loc.uv_index_mean, prefs.uvSensitivity) * uvW : 0) +
    (hasDaylight ? daylightScore(loc.daylight_hours) * dlW : 0) +
    precipScore(loc.precipitation_mean, prefs.precipitation) * pW +
    windScore(loc.wind_speed_mean, prefs.windTolerance) * wW,
  );

  // QoL score (uses raw values from backend)
  const qolScore = computeQolScore(loc, prefs);

  // Composite: user-configurable climate vs QoL weight
  const climateWeight = prefs.climateWeight ?? 0.5;
  const qolWeight = 1 - climateWeight;

  // Affordability toggle — blends in at a fixed 30% weight when enabled.
  // The climate and QoL portions are scaled down by 0.7 so they still sum to 1,
  // and their relative balance (set by climateWeight) is left unchanged.
  // If the country has no HFCE data, affordScore stays null and the toggle is a no-op.
  const affordScore  = loc.affordability_score ?? null;
  const affordWeight = (prefs.prioritiseAffordability && affordScore !== null) ? 0.3 : 0;
  const scale        = 1 - affordWeight;

  let liveability;
  if (qolScore !== null) {
    // Normal path: all three components contribute
    liveability = round(
      climateScore * climateWeight * scale +
      qolScore    * qolWeight    * scale +
      affordScore * affordWeight,
    );
  } else if (affordWeight > 0) {
    // No QoL data, but affordability is on — blend climate + affordability
    liveability = round(climateScore * scale + affordScore * affordWeight);
  } else {
    // Fallback: climate only (no QoL, no affordability)
    liveability = climateScore;
  }

  return { ...loc, liveability, climate_score: climateScore, qol_score: qolScore, comfort_index: comfort };
};

export const PRESETS = {
  temperate:     { label: 'Temperate',     idealTemp: 20, idealHumidity: 50, uvSensitivity: 'moderate',  precipitation: 'moderate', windTolerance: 'moderate', climateWeight: 0.5 },
  mediterranean: { label: 'Mediterranean', idealTemp: 24, idealHumidity: 45, uvSensitivity: 'tolerant',  precipitation: 'dry',      windTolerance: 'moderate', climateWeight: 0.5 },
  tropical:      { label: 'Tropical',      idealTemp: 28, idealHumidity: 65, uvSensitivity: 'tolerant',  precipitation: 'wet',      windTolerance: 'moderate', climateWeight: 0.5 },
  cool:          { label: 'Cool',          idealTemp: 12, idealHumidity: 55, uvSensitivity: 'moderate',  precipitation: 'moderate', windTolerance: 'moderate', climateWeight: 0.5 },
  desert:        { label: 'Desert',        idealTemp: 30, idealHumidity: 25, uvSensitivity: 'tolerant',  precipitation: 'dry',      windTolerance: 'high',     climateWeight: 0.5 },
};

// Default preferences start as Temperate with affordability off.
// prioritiseAffordability is kept separate from the presets so switching
// preset doesn't accidentally reset the toggle the user has set.
export const DEFAULT_PREFS = { ...PRESETS.temperate, prioritiseAffordability: false };