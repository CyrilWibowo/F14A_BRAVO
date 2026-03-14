import fs from 'fs';
import AsyncLock from 'async-lock';

const lock = new AsyncLock();
const DATABASE_FILE = './database.json';

let locations = {};

try {
  const data = JSON.parse(fs.readFileSync(DATABASE_FILE));
  locations = data.locations || {};
} catch {
  console.log('WARNING: No database found, creating a new one');
  fs.writeFileSync(DATABASE_FILE, JSON.stringify({ locations: {} }, null, 2));
}

const persist = () =>
  new Promise((resolve, reject) => {
    lock.acquire('db', () => {
      try {
        fs.writeFileSync(DATABASE_FILE, JSON.stringify({ locations }, null, 2));
        resolve();
      } catch (err) {
        reject(new Error('Failed to write to database'));
      }
    });
  });

export const getLocation = async (code) => {
  return locations[code] || null;
};

export const getAllLocations = async () => {
  return Object.values(locations);
};

export const setLocation = async (code, data) => {
  locations[code] = data;
  await persist();
};
