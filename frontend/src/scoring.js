const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const round = (v) => Math.round(v * 10) / 10;

const UV_MULTIPLIERS = { tolerant: 5, moderate: 9, sensitive: 14 };
const WIND_THRESHOLDS = { low: 8, moderate: 15, high: 25 };

const tempScore     = (m, ideal) => clamp(100 - Math.abs(m - ideal) * 4, 0, 100);
const humidityScore = (m, ideal) => clamp(100 - Math.abs(m - ideal) * 1.5, 0, 100);
const uvScore       = (m, sens)  => clamp(100 - m * UV_MULTIPLIERS[sens], 0, 100);
const windScore     = (m, tol)   => clamp(100 - Math.max(0, m - WIND_THRESHOLDS[tol]) * 3, 0, 100);

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
  const uvW = hasUv ? 0.2 : 0;
  const otherW = (0.6 - uvW) / 2;

  const live = round(
    comfort * 0.4 +
    (hasUv ? uvScore(loc.uv_index_mean, prefs.uvSensitivity) * uvW : 0) +
    precipScore(loc.precipitation_mean, prefs.precipitation) * otherW +
    windScore(loc.wind_speed_mean, prefs.windTolerance) * otherW,
  );

  return { ...loc, liveability: live, comfort_index: comfort };
};

export const PRESETS = {
  temperate:     { label: 'Temperate',     idealTemp: 20, idealHumidity: 50, uvSensitivity: 'moderate',  precipitation: 'moderate', windTolerance: 'moderate' },
  mediterranean: { label: 'Mediterranean', idealTemp: 24, idealHumidity: 45, uvSensitivity: 'tolerant',  precipitation: 'dry',      windTolerance: 'moderate' },
  tropical:      { label: 'Tropical',      idealTemp: 28, idealHumidity: 65, uvSensitivity: 'tolerant',  precipitation: 'wet',      windTolerance: 'moderate' },
  cool:          { label: 'Cool',          idealTemp: 12, idealHumidity: 55, uvSensitivity: 'moderate',  precipitation: 'moderate', windTolerance: 'moderate' },
  desert:        { label: 'Desert',        idealTemp: 30, idealHumidity: 25, uvSensitivity: 'tolerant',  precipitation: 'dry',      windTolerance: 'high'     },
};

export const DEFAULT_PREFS = PRESETS.temperate;
