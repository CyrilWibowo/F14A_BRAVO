import fs from 'fs';
import { s3Put } from './s3.js';

const DATABASE_FILE = './database.json';

let locations = {};

try {
  const data = JSON.parse(fs.readFileSync(DATABASE_FILE));
  locations = data.locations || {};
} catch {
  console.log('WARNING: No database found, creating a new one');
  fs.writeFileSync(DATABASE_FILE, JSON.stringify({ locations: {} }, null, 2));
}

export const getLocation = async (code) => {
  return locations[code] || null;
};

export const getAllLocations = async () => {
  return Object.values(locations);
};

export const setLocation = async (code, data) => {
  await s3Put(`processed/${code}.json`, data);
};