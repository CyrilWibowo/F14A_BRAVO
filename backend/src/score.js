import { InputError } from './error.js';
import { getLocation, getAllLocations } from './db.js';

/***************************************************************
                       Score Query Functions
***************************************************************/

export const getScore = async (countryCode) => {
  if (!countryCode) throw new InputError('Must provide a country_code');
  const loc = await getLocation(countryCode);
  if (!loc) throw new InputError(`No data found for country_code: ${countryCode}`);
  return {
    country_code: countryCode,
    country: loc.country,
    capital: loc.capital,
    latitude: loc.latitude,
    longitude: loc.longitude,
    processed_at: loc.processed_at,
    ...loc.scores,
  };
};

export const compareScores = async (codes) => {
  if (!codes || codes.length === 0) throw new InputError('Must provide at least one location');
  if (codes.length > 20) throw new InputError('Maximum 20 locations per request');
  const results = await Promise.all(
    codes.map(async (code) => {
      const loc = await getLocation(code);
      if (!loc) return { country_code: code, error: 'No data found' };
      return { country_code: code, country: loc.country, capital: loc.capital, ...loc.scores };
    }),
  );
  return results.sort((a, b) => (b.liveability || 0) - (a.liveability || 0));
};

export const getRanking = async (minScore, maxScore, bounds) => {
  let results = (await getAllLocations()).map((loc) => ({
    country_code: loc.country_code,
    country: loc.country,
    capital: loc.capital,
    latitude: loc.latitude,
    longitude: loc.longitude,
    ...loc.scores,
  }));
  if (minScore !== undefined) results = results.filter((r) => r.liveability >= minScore);
  if (maxScore !== undefined) results = results.filter((r) => r.liveability <= maxScore);
  if (bounds) {
    const { minLat, maxLat, minLon, maxLon } = bounds;
    results = results.filter(
      (r) => r.latitude >= minLat && r.latitude <= maxLat && r.longitude >= minLon && r.longitude <= maxLon,
    );
  }
  return results.sort((a, b) => b.liveability - a.liveability);
};

export const getSeasonalScore = async (countryCode) => {
  if (!countryCode) throw new InputError('Must provide a country_code');
  const loc = await getLocation(countryCode);
  if (!loc) throw new InputError(`No data found for country_code: ${countryCode}`);
  return { country_code: countryCode, country: loc.country, capital: loc.capital, seasonal: loc.seasonal };
};

export const getMonthlyAverages = async (countryCode) => {
  if (!countryCode) throw new InputError('Must provide a country_code');
  const loc = await getLocation(countryCode);
  if (!loc) throw new InputError(`No data found for country_code: ${countryCode}`);
  return { country_code: countryCode, country: loc.country, capital: loc.capital, monthly: loc.monthly };
};
