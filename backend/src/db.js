 import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = join(__dirname, '..', 'processed');
const useS3 = !!process.env.S3_BUCKET_NAME;

let s3Get, s3Put, s3List;
if (useS3) {
  ({ s3Get, s3Put, s3List } = await import('./s3.js'));
  console.log('Using S3 storage');
} else {
  if (!existsSync(LOCAL_DIR)) mkdirSync(LOCAL_DIR, { recursive: true });
  console.log(`Using local storage: ${LOCAL_DIR}`);
}

const cache = {};

export const getLocation = async (code) => {
  if (cache[code]) return cache[code];
  
  try {
    let data = null;

    // 1. Try S3 first if enabled
    if (useS3) {
      try {
        data = await s3Get(`processed/${code}.json`);
      } catch (err) {
        console.warn(`S3 fetch failed for ${code}, checking local...`);
      }
    }

    // 2. Fallback to Local if S3 failed or useS3 is false
    if (!data) {
      const file = join(LOCAL_DIR, `${code}.json`);
      if (existsSync(file)) {
        data = JSON.parse(readFileSync(file, 'utf-8'));
      }
    }

    if (data) cache[code] = data;
    return data;
  } catch (error) {
    console.error(`Error loading location ${code}:`, error);
    return null;
  }
};

export const getAllLocations = async () => {
  let keys = [];
  
  if (useS3) {
    keys = await s3List('processed/');
    keys = keys.map((key) => key.replace('processed/', '').replace('.json', ''));
  }

  // Fallback to local if S3 is disabled OR S3 returned nothing
  if (keys.length === 0) {
    if (existsSync(LOCAL_DIR)) {
      keys = readdirSync(LOCAL_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    }
  }

  const results = await Promise.all(keys.map((code) => getLocation(code)));
  return results.filter(Boolean);
};

export const setLocation = async (code, data) => {
  if (useS3) {
    await s3Put(`processed/${code}.json`, data);
  } else {
    writeFileSync(join(LOCAL_DIR, `${code}.json`), JSON.stringify(data, null, 2));
  }
  cache[code] = data;
};
