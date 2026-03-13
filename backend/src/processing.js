import { InputError } from './error';
import { setLocation } from './db';

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

  const fields = ['temp', 'humidity', 'precipitation', 'wind', 'uv'];
  const rawKeys = [
    'temperature_2m_mean',
    'relative_humidity_2m_mean',
    'precipitation_sum',
    'wind_speed_10m_max',
    'uv_index_max',
  ];

  const cleaned = {};
  for (let f = 0; f < fields.length; f++) {
    const pairs = [];
    for (let i = 0; i < n; i++) {
      const val = daily[rawKeys[f]][i];
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

const tempScore = (m) => clamp(100 - Math.abs(m - 20) * 4, 0, 100);
const humidityScore = (m) => clamp(100 - Math.abs(m - 50) * 1.5, 0, 100);
const uvScore = (m) => clamp(100 - m * 9, 0, 100);
const windScore = (m) => clamp(100 - Math.max(0, m - 15) * 3, 0, 100);
const precipScore = (m) => {
  if (m < 1) return clamp(m * 50, 20, 50);
  if (m <= 4) return clamp(50 + (m - 1) / 3 * 50, 50, 100);
  return clamp(100 - (m - 4) * 8, 0, 100);
};

const uvClassification = (m) => {
  if (m < 3) return 'low';
  if (m < 6) return 'moderate';
  if (m < 8) return 'high';
  if (m < 11) return 'very_high';
  return 'extreme';
};

const computeScoresFromMeans = (means) => {
  const ts = tempScore(means.temp);
  const hs = humidityScore(means.humidity);
  const comfortIndex = round(ts * 0.6 + hs * 0.4);
  const uvRiskValue = round(means.uv);
  const liveability = round(comfortIndex * 0.4 + uvScore(means.uv) * 0.2 + precipScore(means.precipitation) * 0.2 + windScore(means.wind) * 0.2);

  return {
    liveability,
    comfort_index: comfortIndex,
    uv_risk: uvClassification(means.uv),
    uv_index_mean: uvRiskValue,
    temperature_mean: round(means.temp),
    humidity_mean: round(means.humidity),
    precipitation_mean: round(means.precipitation),
    wind_speed_mean: round(means.wind),
  };
};

/***************************************************************
                       Seasonal Computation
***************************************************************/

const SEASON_MONTHS = {
  northern: { spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11], winter: [12, 1, 2] },
  southern: { spring: [9, 10, 11], summer: [12, 1, 2], autumn: [3, 4, 5], winter: [6, 7, 8] },
};

const getMonth = (dateStr) => parseInt(dateStr.split('-')[1], 10);

const computeSeasonalScores = (cleaned, latitude) => {
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
    };
    const hasData = Object.values(vals).every((arr) => arr.length > 0);
    if (!hasData) {
      seasonal[season] = null;
      continue;
    }
    const means = {
      temp: mean(vals.temp.map((p) => p.value)),
      humidity: mean(vals.humidity.map((p) => p.value)),
      precipitation: mean(vals.precipitation.map((p) => p.value)),
      wind: mean(vals.wind.map((p) => p.value)),
      uv: mean(vals.uv.map((p) => p.value)),
    };
    seasonal[season] = computeScoresFromMeans(means);
  }

  return seasonal;
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
    'uv_index_max',
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
    uv: mean(cleaned.uv.map((p) => p.value)),
  };

  const scores = computeScoresFromMeans(overallMeans);
  const seasonal = computeSeasonalScores(cleaned, rawData.latitude);

  await setLocation(rawData.country_code, {
    country: rawData.country,
    country_code: rawData.country_code,
    capital: rawData.capital || null,
    latitude: rawData.latitude,
    longitude: rawData.longitude,
    processed_at: new Date().toISOString(),
    scores,
    seasonal,
  });

  return { country_code: rawData.country_code, ...scores };
};
