import { s3Get, s3Put, s3List } from './s3.js';

const cache = {};

export const getLocation = async (code) => {
  if (cache[code]) return cache[code];
  try {
    const data = await s3Get(`processed/${code}.json`);
    cache[code] = data;
    return data;
  } catch {
    return null;
  }
};

export const getAllLocations = async () => {
  const keys = await s3List('processed/');
  const results = await Promise.all(
    keys.map(async (key) => {
      const code = key.replace('processed/', '').replace('.json', '');
      return getLocation(code);
    }),
  );
  return results.filter(Boolean);
};

export const setLocation = async (code, data) => {
  await s3Put(`processed/${code}.json`, data);
  cache[code] = data;
};