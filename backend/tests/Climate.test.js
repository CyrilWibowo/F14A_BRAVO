/**
 * Two levels of abstraction:
 *   UNIT        — processLocation(), score helpers tested directly
 *   INTEGRATION — all 6 routes tested via supertest on the real Express server
 */

import request from 'supertest';
import { jest } from '@jest/globals';

// ─── Mock db.js before any app imports ───────────────────────────────────────
// Jest will intercept any import of './db.js' or '../src/db.js' with these fakes.

const mockSetLocation = jest.fn().mockResolvedValue(undefined);
const mockGetLocation = jest.fn();
const mockGetAllLocations = jest.fn();

jest.unstable_mockModule('../src/db.js', () => ({
  setLocation:    mockSetLocation,
  getLocation:    mockGetLocation,
  getAllLocations: mockGetAllLocations,
}));

// ─── Import app AFTER mocks are registered ────────────────────────────────────
const { default: server }         = await import('../src/server.js');
const { processLocation }         = await import('../src/processing.js');

// ─── Shared fixtures ──────────────────────────────────────────────────────────

/**
 * Build a minimal valid raw payload for POST /process.
 * Generates `days` entries of daily climate data starting 2025-01-01.
 */
function makePayload(days = 60, overrides = {}) {
  const time                    = [];
  const temperature_2m_mean     = [];
  const relative_humidity_2m_mean = [];
  const precipitation_sum       = [];
  const wind_speed_10m_max      = [];
  const uv_index_max            = [];

  const start = new Date('2025-01-01');
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    time.push(d.toISOString().split('T')[0]);
    temperature_2m_mean.push(20);
    relative_humidity_2m_mean.push(50);
    precipitation_sum.push(2.5);
    wind_speed_10m_max.push(15);
    uv_index_max.push(9);
  }

  return {
    country: 'Australia',
    country_code: 'AUS',
    latitude: -25.3,
    longitude: 133.8,
    daily: { time, temperature_2m_mean, relative_humidity_2m_mean, precipitation_sum, wind_speed_10m_max, uv_index_max },
    ...overrides,
  };
}

/** Stored location shape returned by mockGetLocation */
const MOCK_AUS_LOCATION = {
  country_code:  'AUS',
  country:       'Australia',
  capital:       'Canberra',
  latitude:      -25.3,
  longitude:     133.8,
  processed_at:  '2025-01-01T00:00:00.000Z',
  scores: {
    liveability:        72.4,
    comfort_index:      68.1,
    uv_risk:            'very_high',
    uv_index_mean:      9.0,
    temperature_mean:   20.0,
    humidity_mean:      50.0,
    precipitation_mean: 2.5,
    wind_speed_mean:    15.0,
  },
  seasonal: {
    spring: { liveability: 80.1, comfort_index: 75.0 },
    summer: { liveability: 55.3, comfort_index: 50.0 },
    autumn: { liveability: 78.9, comfort_index: 73.0 },
    winter: { liveability: 70.2, comfort_index: 65.0 },
  },
  monthly: [
    { month: 'Jan', temp: 25.1, humidity: 48.3, precipitation: 3.2, wind: 16.1, uv: 10.4 },
    { month: 'Feb', temp: 24.8, humidity: 50.1, precipitation: 2.9, wind: 15.8, uv: 10.1 },
    { month: 'Mar', temp: 22.3, humidity: 52.0, precipitation: 2.5, wind: 15.0, uv: 8.5  },
    { month: 'Apr', temp: 18.5, humidity: 54.2, precipitation: 2.0, wind: 14.2, uv: 6.2  },
    { month: 'May', temp: 14.8, humidity: 56.0, precipitation: 1.8, wind: 13.5, uv: 4.3  },
    { month: 'Jun', temp: 11.2, humidity: 58.1, precipitation: 1.5, wind: 12.8, uv: 3.1  },
    { month: 'Jul', temp: 10.5, humidity: 57.3, precipitation: 1.4, wind: 12.5, uv: 3.0  },
    { month: 'Aug', temp: 12.1, humidity: 55.0, precipitation: 1.6, wind: 13.0, uv: 4.0  },
    { month: 'Sep', temp: 15.6, humidity: 52.5, precipitation: 2.0, wind: 13.8, uv: 5.8  },
    { month: 'Oct', temp: 19.3, humidity: 50.2, precipitation: 2.4, wind: 14.5, uv: 7.9  },
    { month: 'Nov', temp: 22.4, humidity: 48.8, precipitation: 2.8, wind: 15.5, uv: 9.5  },
    { month: 'Dec', temp: 24.5, humidity: 47.5, precipitation: 3.1, wind: 16.0, uv: 10.2 },
  ],
};

const MOCK_NZL_LOCATION = {
  ...MOCK_AUS_LOCATION,
  country_code: 'NZL',
  country: 'New Zealand',
  capital: 'Wellington',
  latitude: -40.9,
  longitude: 174.9,
  scores: { ...MOCK_AUS_LOCATION.scores, liveability: 78.1 },
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: AUS is known, everything else returns null
  mockGetLocation.mockImplementation((code) => {
    if (code === 'AUS') return Promise.resolve(MOCK_AUS_LOCATION);
    if (code === 'NZL') return Promise.resolve(MOCK_NZL_LOCATION);
    return Promise.resolve(null);
  });
  mockGetAllLocations.mockResolvedValue([MOCK_AUS_LOCATION, MOCK_NZL_LOCATION]);
  mockSetLocation.mockResolvedValue(undefined);
});

afterAll(() => {
  server.close();
});

// =============================================================================
// UNIT TESTS — processLocation() from processing.js
// Tests the pure logic: normalisation, scoring, seasonal, monthly
// No HTTP. db.js is mocked so setLocation is a no-op.
// =============================================================================

describe('UNIT — processLocation()', () => {

  // ✅ PASSING
  it('[PASS] returns country_code and all score fields', async () => {
    const result = await processLocation(makePayload());
    expect(result.country_code).toBe('AUS');
    expect(result).toHaveProperty('liveability');
    expect(result).toHaveProperty('comfort_index');
    expect(result).toHaveProperty('uv_risk');
    expect(result).toHaveProperty('uv_index_mean');
    expect(result).toHaveProperty('temperature_mean');
    expect(result).toHaveProperty('humidity_mean');
    expect(result).toHaveProperty('precipitation_mean');
    expect(result).toHaveProperty('wind_speed_mean');
  });

  it('[PASS] liveability is between 0 and 100', async () => {
    const result = await processLocation(makePayload());
    expect(result.liveability).toBeGreaterThanOrEqual(0);
    expect(result.liveability).toBeLessThanOrEqual(100);
  });

  it('[PASS] comfort_index is between 0 and 100', async () => {
    const result = await processLocation(makePayload());
    expect(result.comfort_index).toBeGreaterThanOrEqual(0);
    expect(result.comfort_index).toBeLessThanOrEqual(100);
  });

  it('[PASS] uv_risk is one of the five valid enum values', async () => {
    const result = await processLocation(makePayload());
    expect(['low', 'moderate', 'high', 'very_high', 'extreme']).toContain(result.uv_risk);
  });

  it('[PASS] temperature_mean matches the input when all values are identical', async () => {
    const payload = makePayload(10);
    payload.daily.temperature_2m_mean = Array(10).fill(22);
    const result = await processLocation(payload);
    expect(result.temperature_mean).toBeCloseTo(22, 1);
  });

  it('[PASS] humidity_mean matches the input when all values are identical', async () => {
    const payload = makePayload(10);
    payload.daily.relative_humidity_2m_mean = Array(10).fill(60);
    const result = await processLocation(payload);
    expect(result.humidity_mean).toBeCloseTo(60, 1);
  });

  it('[PASS] low UV input produces low uv_risk', async () => {
    const payload = makePayload(10);
    payload.daily.uv_index_max = Array(10).fill(1);
    const result = await processLocation(payload);
    expect(result.uv_risk).toBe('low');
    expect(result.uv_index_mean).toBeCloseTo(1, 1);
  });

  it('[PASS] UV between 8–10 produces very_high uv_risk', async () => {
    const payload = makePayload(10);
    payload.daily.uv_index_max = Array(10).fill(9);
    const result = await processLocation(payload);
    expect(result.uv_risk).toBe('very_high');
  });

  it('[PASS] UV >= 11 produces extreme uv_risk', async () => {
    const payload = makePayload(10);
    payload.daily.uv_index_max = Array(10).fill(12);
    const result = await processLocation(payload);
    expect(result.uv_risk).toBe('extreme');
  });

  it('[PASS] UV 3–5 produces moderate uv_risk', async () => {
    const payload = makePayload(10);
    payload.daily.uv_index_max = Array(10).fill(4);
    const result = await processLocation(payload);
    expect(result.uv_risk).toBe('moderate');
  });

  it('[PASS] UV 6–7 produces high uv_risk', async () => {
    const payload = makePayload(10);
    payload.daily.uv_index_max = Array(10).fill(7);
    const result = await processLocation(payload);
    expect(result.uv_risk).toBe('high');
  });

  it('[PASS] setLocation is called once with correct country_code', async () => {
    await processLocation(makePayload());
    expect(mockSetLocation).toHaveBeenCalledTimes(1);
    expect(mockSetLocation.mock.calls[0][0]).toBe('AUS');
  });

  it('[PASS] setLocation receives processed_at as an ISO timestamp', async () => {
    await processLocation(makePayload());
    const storedData = mockSetLocation.mock.calls[0][1];
    expect(Date.parse(storedData.processed_at)).not.toBeNaN();
  });

  it('[PASS] setLocation receives seasonal and monthly in stored data', async () => {
    await processLocation(makePayload(365));
    const storedData = mockSetLocation.mock.calls[0][1];
    expect(storedData).toHaveProperty('seasonal');
    expect(storedData).toHaveProperty('monthly');
    expect(storedData.monthly).toHaveLength(12);
  });

  it('[PASS] optional capital is passed through to setLocation', async () => {
    await processLocation(makePayload(10, { capital: 'Canberra' }));
    const storedData = mockSetLocation.mock.calls[0][1];
    expect(storedData.capital).toBe('Canberra');
  });

  it('[PASS] null values in daily arrays are skipped without crashing', async () => {
    const payload = makePayload(10);
    payload.daily.temperature_2m_mean[3] = null;
    payload.daily.uv_index_max[5] = null;
    const result = await processLocation(payload);
    expect(result).toHaveProperty('liveability');
  });

  it('[PASS] outlier removal does not crash with fewer than 4 data points', async () => {
    const result = await processLocation(makePayload(3));
    expect(result).toHaveProperty('liveability');
  });

  it('[PASS] southern hemisphere payload produces seasonal data', async () => {
    await processLocation(makePayload(365, { latitude: -33.8 }));
    const storedData = mockSetLocation.mock.calls[0][1];
    expect(storedData.seasonal).toHaveProperty('summer');
    expect(storedData.seasonal).toHaveProperty('winter');
  });

  it('[PASS] northern hemisphere payload produces seasonal data', async () => {
    await processLocation(makePayload(365, { latitude: 51.5, longitude: -0.1, country: 'UK', country_code: 'GBR' }));
    const storedData = mockSetLocation.mock.calls[0][1];
    expect(storedData.seasonal).toHaveProperty('summer');
    expect(storedData.seasonal).toHaveProperty('winter');
  });

  it('[PASS] monthly averages array has exactly 12 entries', async () => {
    await processLocation(makePayload(365));
    const storedData = mockSetLocation.mock.calls[0][1];
    expect(storedData.monthly).toHaveLength(12);
  });

  it('[PASS] monthly entries have correct field names', async () => {
    await processLocation(makePayload(365));
    const storedData = mockSetLocation.mock.calls[0][1];
    for (const m of storedData.monthly) {
      expect(m).toHaveProperty('month');
      expect(m).toHaveProperty('temp');
      expect(m).toHaveProperty('humidity');
      expect(m).toHaveProperty('precipitation');
      expect(m).toHaveProperty('wind');
      expect(m).toHaveProperty('uv');
    }
  });

  // ❌ FAILING
  it('[FAIL] throws InputError when country is missing', async () => {
    const payload = makePayload();
    delete payload.country;
    await expect(processLocation(payload)).rejects.toThrow('Missing required field: country');
  });

  it('[FAIL] throws InputError when country_code is missing', async () => {
    const payload = makePayload();
    delete payload.country_code;
    await expect(processLocation(payload)).rejects.toThrow('Missing required field: country_code');
  });

  it('[FAIL] throws InputError when latitude is missing', async () => {
    const payload = makePayload();
    delete payload.latitude;
    await expect(processLocation(payload)).rejects.toThrow('Missing required field: latitude');
  });

  it('[FAIL] throws InputError when longitude is missing', async () => {
    const payload = makePayload();
    delete payload.longitude;
    await expect(processLocation(payload)).rejects.toThrow('Missing required field: longitude');
  });

  it('[FAIL] throws InputError when daily is missing', async () => {
    const payload = makePayload();
    delete payload.daily;
    await expect(processLocation(payload)).rejects.toThrow('Missing required field: daily');
  });

  it('[FAIL] throws InputError when daily.time is missing', async () => {
    const payload = makePayload();
    delete payload.daily.time;
    await expect(processLocation(payload)).rejects.toThrow('Missing required daily field: time');
  });

  it('[FAIL] throws InputError when daily.temperature_2m_mean is missing', async () => {
    const payload = makePayload();
    delete payload.daily.temperature_2m_mean;
    await expect(processLocation(payload)).rejects.toThrow('Missing required daily field: temperature_2m_mean');
  });

  it('[FAIL] throws InputError when daily.relative_humidity_2m_mean is missing', async () => {
    const payload = makePayload();
    delete payload.daily.relative_humidity_2m_mean;
    await expect(processLocation(payload)).rejects.toThrow('Missing required daily field: relative_humidity_2m_mean');
  });

  it('[FAIL] throws InputError when daily.precipitation_sum is missing', async () => {
    const payload = makePayload();
    delete payload.daily.precipitation_sum;
    await expect(processLocation(payload)).rejects.toThrow('Missing required daily field: precipitation_sum');
  });

  it('[FAIL] throws InputError when daily.wind_speed_10m_max is missing', async () => {
    const payload = makePayload();
    delete payload.daily.wind_speed_10m_max;
    await expect(processLocation(payload)).rejects.toThrow('Missing required daily field: wind_speed_10m_max');
  });

  it('[PASS] processes without error when daily.uv_index_max is missing (optional)', async () => {
    const payload = makePayload();
    delete payload.daily.uv_index_max;
    const result = await processLocation(payload);
    expect(result).toHaveProperty('liveability');
    expect(result.uv_risk).toBeNull();
    expect(result.uv_index_mean).toBeNull();
  });

  // ⚠️  EDGE
  it('[EDGE] exactly 1 day of data processes without crashing', async () => {
    const result = await processLocation(makePayload(1));
    expect(result).toHaveProperty('liveability');
  });

  it('[EDGE] 365 days of data processes without crashing', async () => {
    const result = await processLocation(makePayload(365));
    expect(result).toHaveProperty('liveability');
    expect(result.liveability).toBeGreaterThanOrEqual(0);
    expect(result.liveability).toBeLessThanOrEqual(100);
  });

  it('[EDGE] ideal temperature (20°C) and humidity (50%) produce high comfort_index', async () => {
    const payload = makePayload(10);
    payload.daily.temperature_2m_mean = Array(10).fill(20);
    payload.daily.relative_humidity_2m_mean = Array(10).fill(50);
    const result = await processLocation(payload);
    expect(result.comfort_index).toBeGreaterThan(80);
  });

  it('[EDGE] extreme temperature (50°C) produces lower liveability than 20°C', async () => {
    const hotPayload = makePayload(10);
    hotPayload.daily.temperature_2m_mean = Array(10).fill(50);
    const idealPayload = makePayload(10);
    idealPayload.daily.temperature_2m_mean = Array(10).fill(20);

    const hot    = await processLocation(hotPayload);
    const ideal  = await processLocation(idealPayload);
    expect(hot.liveability).toBeLessThan(ideal.liveability);
  });

  it('[EDGE] latitude exactly 0 (equator) does not crash', async () => {
    const result = await processLocation(makePayload(10, { latitude: 0 }));
    expect(result).toHaveProperty('liveability');
  });

  it('[EDGE] season with no data entries returns null for that season', async () => {
    // Only January data → other seasons (for southern hemisphere) will be null
    const payload = makePayload(31); // Jan only
    payload.latitude = -25.3; // southern
    await processLocation(payload);
    const storedData = mockSetLocation.mock.calls[0][1];
    // Summer (DJF southern) has data, but spring/autumn/winter should be null
    expect(storedData.seasonal.winter).toBeNull();
  });

  it('[EDGE] all-null uv_index_max array results in null uv_risk', async () => {
    const payload = makePayload(10);
    payload.daily.uv_index_max = Array(10).fill(null);
    const result = await processLocation(payload);
    expect(result.uv_risk).toBeNull();
    expect(result.uv_index_mean).toBeNull();
  });
});

// =============================================================================
// INTEGRATION — POST /process
// Real Express + real processing.js logic. db.js mocked.
// =============================================================================

describe('INTEGRATION — POST /process', () => {

  // ✅ PASSING
  it('[PASS] returns 200 with all score fields for valid payload', async () => {
    const res = await request(server).post('/process').send(makePayload());
    expect(res.status).toBe(200);
    expect(res.body.country_code).toBe('AUS');
    expect(res.body).toHaveProperty('liveability');
    expect(res.body).toHaveProperty('comfort_index');
    expect(res.body).toHaveProperty('uv_risk');
    expect(res.body).toHaveProperty('temperature_mean');
    expect(res.body).toHaveProperty('humidity_mean');
    expect(res.body).toHaveProperty('precipitation_mean');
    expect(res.body).toHaveProperty('wind_speed_mean');
  });

  it('[PASS] liveability in response is between 0 and 100', async () => {
    const res = await request(server).post('/process').send(makePayload());
    expect(res.status).toBe(200);
    expect(res.body.liveability).toBeGreaterThanOrEqual(0);
    expect(res.body.liveability).toBeLessThanOrEqual(100);
  });

  it('[PASS] uv_risk is a valid enum value', async () => {
    const res = await request(server).post('/process').send(makePayload());
    expect(res.status).toBe(200);
    expect(['low', 'moderate', 'high', 'very_high', 'extreme']).toContain(res.body.uv_risk);
  });

  it('[PASS] optional capital field does not cause error', async () => {
    const res = await request(server).post('/process').send(makePayload(30, { capital: 'Canberra' }));
    expect(res.status).toBe(200);
  });

  it('[PASS] db.setLocation is called after successful process', async () => {
    await request(server).post('/process').send(makePayload());
    expect(mockSetLocation).toHaveBeenCalledTimes(1);
  });

  // ❌ FAILING
  it('[FAIL] returns 400 when country is missing', async () => {
    const payload = makePayload();
    delete payload.country;
    const res = await request(server).post('/process').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 when country_code is missing', async () => {
    const payload = makePayload();
    delete payload.country_code;
    const res = await request(server).post('/process').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 when latitude is missing', async () => {
    const payload = makePayload();
    delete payload.latitude;
    const res = await request(server).post('/process').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 when longitude is missing', async () => {
    const payload = makePayload();
    delete payload.longitude;
    const res = await request(server).post('/process').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 when daily object is missing', async () => {
    const payload = makePayload();
    delete payload.daily;
    const res = await request(server).post('/process').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 when daily.time is missing', async () => {
    const payload = makePayload();
    delete payload.daily.time;
    const res = await request(server).post('/process').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 when daily.temperature_2m_mean is missing', async () => {
    const payload = makePayload();
    delete payload.daily.temperature_2m_mean;
    const res = await request(server).post('/process').send(payload);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[PASS] returns 200 when daily.uv_index_max is missing (optional)', async () => {
    const payload = makePayload();
    delete payload.daily.uv_index_max;
    const res = await request(server).post('/process').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.uv_risk).toBeNull();
    expect(res.body.uv_index_mean).toBeNull();
  });

  it('[FAIL] returns 400 when body is completely empty', async () => {
    const res = await request(server).post('/process').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ⚠️  EDGE
  it('[EDGE] 1-day payload returns 200 without crashing', async () => {
    const res = await request(server).post('/process').send(makePayload(1));
    expect(res.status).toBe(200);
  });

  it('[EDGE] 365-day payload returns 200 without crashing', async () => {
    const res = await request(server).post('/process').send(makePayload(365));
    expect(res.status).toBe(200);
  });

  it('[EDGE] all-null uv_index_max is accepted and returns null uv_risk', async () => {
    const payload = makePayload(10);
    payload.daily.uv_index_max = Array(10).fill(null);
    const res = await request(server).post('/process').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.uv_risk).toBeNull();
  });
});

// =============================================================================
// INTEGRATION — GET /score
// =============================================================================

describe('INTEGRATION — GET /score', () => {

  // ✅ PASSING
  it('[PASS] returns 200 with full score shape for AUS', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(res.body.country_code).toBe('AUS');
    expect(res.body).toHaveProperty('country');
    expect(res.body).toHaveProperty('capital');
    expect(res.body).toHaveProperty('latitude');
    expect(res.body).toHaveProperty('longitude');
    expect(res.body).toHaveProperty('processed_at');
    expect(res.body).toHaveProperty('liveability');
    expect(res.body).toHaveProperty('comfort_index');
    expect(res.body).toHaveProperty('uv_risk');
    expect(res.body).toHaveProperty('temperature_mean');
    expect(res.body).toHaveProperty('humidity_mean');
    expect(res.body).toHaveProperty('precipitation_mean');
    expect(res.body).toHaveProperty('wind_speed_mean');
  });

  it('[PASS] processed_at is a valid ISO timestamp', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(Date.parse(res.body.processed_at)).not.toBeNaN();
  });

  it('[PASS] liveability is between 0 and 100', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(res.body.liveability).toBeGreaterThanOrEqual(0);
    expect(res.body.liveability).toBeLessThanOrEqual(100);
  });

  it('[PASS] uv_risk is a valid enum value', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(['low', 'moderate', 'high', 'very_high', 'extreme']).toContain(res.body.uv_risk);
  });

  it('[PASS] getLocation is called with the correct country_code', async () => {
    await request(server).get('/score').query({ country_code: 'AUS' });
    expect(mockGetLocation).toHaveBeenCalledWith('AUS');
  });

  // ❌ FAILING
  it('[FAIL] returns 400 when country_code is missing', async () => {
    const res = await request(server).get('/score');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 for unknown country_code', async () => {
    const res = await request(server).get('/score').query({ country_code: 'ZZZ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ⚠️  EDGE
  it('[EDGE] country just processed via POST is retrievable via GET', async () => {
    // Process first (registers the country in the mock)
    await request(server).post('/process').send(makePayload());
    // Now make GET return data (mock already returns AUS by default)
    const res = await request(server).get('/score').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(res.body.country_code).toBe('AUS');
  });

  it('[EDGE] latitude and longitude are numbers, not strings', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(typeof res.body.latitude).toBe('number');
    expect(typeof res.body.longitude).toBe('number');
  });
});

// =============================================================================
// INTEGRATION — GET /score/compare
// =============================================================================

describe('INTEGRATION — GET /score/compare', () => {

  // ✅ PASSING
  it('[PASS] returns 200 with results array for AUS,NZL', async () => {
    const res = await request(server).get('/score/compare').query({ codes: 'AUS,NZL' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBe(2);
  });

  it('[PASS] results are sorted descending by liveability', async () => {
    const res = await request(server).get('/score/compare').query({ codes: 'AUS,NZL' });
    expect(res.status).toBe(200);
    const scores = res.body.results
      .filter((r) => !r.error)
      .map((r) => r.liveability);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it('[PASS] unknown code returns error field inline (not a 404)', async () => {
    const res = await request(server).get('/score/compare').query({ codes: 'AUS,ZZZ' });
    expect(res.status).toBe(200);
    const bad = res.body.results.find((r) => r.country_code === 'ZZZ');
    expect(bad).toHaveProperty('error', 'No data found');
  });

  it('[PASS] single code returns one result', async () => {
    const res = await request(server).get('/score/compare').query({ codes: 'AUS' });
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBe(1);
  });

  it('[PASS] spaces around commas are trimmed correctly', async () => {
    const res = await request(server).get('/score/compare').query({ codes: 'AUS, NZL' });
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBe(2);
  });

  it('[PASS] all known results have expected fields', async () => {
    const res = await request(server).get('/score/compare').query({ codes: 'AUS,NZL' });
    expect(res.status).toBe(200);
    for (const r of res.body.results.filter((r) => !r.error)) {
      expect(r).toHaveProperty('country_code');
      expect(r).toHaveProperty('country');
      expect(r).toHaveProperty('liveability');
    }
  });

  // ❌ FAILING
  it('[FAIL] returns 400 when codes param is missing', async () => {
    const res = await request(server).get('/score/compare');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 when codes is empty string', async () => {
    const res = await request(server).get('/score/compare').query({ codes: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 for more than 20 codes', async () => {
    const codes = Array(21).fill('AUS').join(',');
    const res = await request(server).get('/score/compare').query({ codes });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ⚠️  EDGE
  it('[EDGE] exactly 20 codes (max allowed) does not return 400', async () => {
    const codes = Array(20).fill('AUS').join(',');
    const res = await request(server).get('/score/compare').query({ codes });
    expect(res.status).toBe(200);
  });

  it('[EDGE] all unknown codes returns array of error objects only', async () => {
    const res = await request(server).get('/score/compare').query({ codes: 'ZZZ,YYY' });
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(r).toHaveProperty('error', 'No data found');
    }
  });

  it('[EDGE] duplicate codes return one entry per occurrence', async () => {
    const res = await request(server).get('/score/compare').query({ codes: 'AUS,AUS' });
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBe(2);
  });
});

// =============================================================================
// INTEGRATION — GET /score/ranking
// =============================================================================

describe('INTEGRATION — GET /score/ranking', () => {

  // ✅ PASSING
  it('[PASS] returns 200 with results array (no filters)', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('[PASS] results are sorted descending by liveability', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    const scores = res.body.results.map((r) => r.liveability);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it('[PASS] each result has all expected fields', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(r).toHaveProperty('country_code');
      expect(r).toHaveProperty('country');
      expect(r).toHaveProperty('liveability');
      expect(r).toHaveProperty('latitude');
      expect(r).toHaveProperty('longitude');
    }
  });

  it('[PASS] min_score filter excludes countries below threshold', async () => {
    const res = await request(server).get('/score/ranking').query({ min_score: 75 });
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(r.liveability).toBeGreaterThanOrEqual(75);
    }
  });

  it('[PASS] max_score filter excludes countries above threshold', async () => {
    const res = await request(server).get('/score/ranking').query({ max_score: 75 });
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(r.liveability).toBeLessThanOrEqual(75);
    }
  });

  it('[PASS] combined min and max score filters work together', async () => {
    const res = await request(server).get('/score/ranking').query({ min_score: 70, max_score: 80 });
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(r.liveability).toBeGreaterThanOrEqual(70);
      expect(r.liveability).toBeLessThanOrEqual(80);
    }
  });

  it('[PASS] bounding box filter only returns countries inside the box', async () => {
    // AUS lat=-25.3, lon=133.8 — within this box. NZL lat=-40.9 — outside.
    const res = await request(server)
      .get('/score/ranking')
      .query({ min_lat: -30, max_lat: -20, min_lon: 100, max_lon: 150 });
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(r.latitude).toBeGreaterThanOrEqual(-30);
      expect(r.latitude).toBeLessThanOrEqual(-20);
    }
  });

  it('[PASS] getAllLocations is called once', async () => {
    await request(server).get('/score/ranking');
    expect(mockGetAllLocations).toHaveBeenCalledTimes(1);
  });

  // ❌ FAILING  (server passes raw params to getRanking — invalid values just filter oddly,
  //              but score.js itself doesn't validate. Tests confirm no 500.)
  it('[FAIL] non-numeric min_score does not cause a 500', async () => {
    const res = await request(server).get('/score/ranking').query({ min_score: 'abc' });
    expect(res.status).not.toBe(500);
  });

  // ⚠️  EDGE
  it('[EDGE] min_score higher than all stored scores returns empty results', async () => {
    const res = await request(server).get('/score/ranking').query({ min_score: 999 });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('[EDGE] bounding box with no matching countries returns empty array', async () => {
    const res = await request(server)
      .get('/score/ranking')
      .query({ min_lat: 80, max_lat: 90, min_lon: 0, max_lon: 10 });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('[EDGE] no filters returns all stored countries', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBe(2); // matches mockGetAllLocations mock
  });
});

// =============================================================================
// INTEGRATION — GET /score/seasonal
// =============================================================================

describe('INTEGRATION — GET /score/seasonal', () => {

  // ✅ PASSING
  it('[PASS] returns 200 with seasonal object for AUS', async () => {
    const res = await request(server).get('/score/seasonal').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(res.body.country_code).toBe('AUS');
    expect(res.body).toHaveProperty('country');
    expect(res.body).toHaveProperty('capital');
    expect(res.body).toHaveProperty('seasonal');
  });

  it('[PASS] seasonal has all four season keys', async () => {
    const res = await request(server).get('/score/seasonal').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(res.body.seasonal).toHaveProperty('spring');
    expect(res.body.seasonal).toHaveProperty('summer');
    expect(res.body.seasonal).toHaveProperty('autumn');
    expect(res.body.seasonal).toHaveProperty('winter');
  });

  it('[PASS] each present season has liveability and comfort_index', async () => {
    const res = await request(server).get('/score/seasonal').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    for (const [, val] of Object.entries(res.body.seasonal)) {
      if (val !== null) {
        expect(val).toHaveProperty('liveability');
        expect(val).toHaveProperty('comfort_index');
      }
    }
  });

  it('[PASS] getLocation is called with correct country_code', async () => {
    await request(server).get('/score/seasonal').query({ country_code: 'AUS' });
    expect(mockGetLocation).toHaveBeenCalledWith('AUS');
  });

  // ❌ FAILING
  it('[FAIL] returns 400 when country_code is missing', async () => {
    const res = await request(server).get('/score/seasonal');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 for unknown country_code', async () => {
    const res = await request(server).get('/score/seasonal').query({ country_code: 'ZZZ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ⚠️  EDGE
  it('[EDGE] season with null value in mock is returned as null (not missing key)', async () => {
    const locWithNullSeason = {
      ...MOCK_AUS_LOCATION,
      seasonal: { ...MOCK_AUS_LOCATION.seasonal, winter: null },
    };
    mockGetLocation.mockResolvedValueOnce(locWithNullSeason);
    const res = await request(server).get('/score/seasonal').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(res.body.seasonal.winter).toBeNull();
  });
});

// =============================================================================
// INTEGRATION — GET /score/monthly
// =============================================================================

describe('INTEGRATION — GET /score/monthly', () => {

  // ✅ PASSING
  it('[PASS] returns 200 with monthly array for AUS', async () => {
    const res = await request(server).get('/score/monthly').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(res.body.country_code).toBe('AUS');
    expect(res.body).toHaveProperty('country');
    expect(res.body).toHaveProperty('capital');
    expect(res.body).toHaveProperty('monthly');
    expect(Array.isArray(res.body.monthly)).toBe(true);
  });

  it('[PASS] monthly array has exactly 12 entries', async () => {
    const res = await request(server).get('/score/monthly').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    expect(res.body.monthly).toHaveLength(12);
  });

  it('[PASS] each monthly entry has all required fields', async () => {
    const res = await request(server).get('/score/monthly').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    for (const m of res.body.monthly) {
      expect(m).toHaveProperty('month');
      expect(m).toHaveProperty('temp');
      expect(m).toHaveProperty('humidity');
      expect(m).toHaveProperty('precipitation');
      expect(m).toHaveProperty('wind');
      expect(m).toHaveProperty('uv');
    }
  });

  it('[PASS] months are in correct Jan–Dec calendar order', async () => {
    const EXPECTED = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const res = await request(server).get('/score/monthly').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    const months = res.body.monthly.map((m) => m.month);
    expect(months).toEqual(EXPECTED);
  });

  it('[PASS] all numeric fields in monthly entries are numbers (or null)', async () => {
    const res = await request(server).get('/score/monthly').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    for (const m of res.body.monthly) {
      for (const field of ['temp', 'humidity', 'precipitation', 'wind', 'uv']) {
        expect(m[field] === null || typeof m[field] === 'number').toBe(true);
      }
    }
  });

  it('[PASS] getLocation is called with correct country_code', async () => {
    await request(server).get('/score/monthly').query({ country_code: 'AUS' });
    expect(mockGetLocation).toHaveBeenCalledWith('AUS');
  });

  // ❌ FAILING
  it('[FAIL] returns 400 when country_code is missing', async () => {
    const res = await request(server).get('/score/monthly');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[FAIL] returns 400 for unknown country_code', async () => {
    const res = await request(server).get('/score/monthly').query({ country_code: 'ZZZ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ⚠️  EDGE
  it('[EDGE] monthly uv values are non-negative where not null', async () => {
    const res = await request(server).get('/score/monthly').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    for (const m of res.body.monthly) {
      if (m.uv !== null) expect(m.uv).toBeGreaterThanOrEqual(0);
    }
  });

  it('[EDGE] monthly precipitation values are non-negative where not null', async () => {
    const res = await request(server).get('/score/monthly').query({ country_code: 'AUS' });
    expect(res.status).toBe(200);
    for (const m of res.body.monthly) {
      if (m.precipitation !== null) expect(m.precipitation).toBeGreaterThanOrEqual(0);
    }
  });
});