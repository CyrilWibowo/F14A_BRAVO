/**
 * Scoring.test.js
 *
 * Tests for features introduced after the initial release:
 *   1. QoL partial-data detection  — countQolIndicators()  (frontend scoring.js logic, mirrored here)
 *   2. Affordability score field    — affordability_score / hfce_per_capita flow through API
 *   3. Affordability blend          — prioritiseAffordability toggle effect on liveability
 *
 * Two levels of abstraction (matching Climate.test.js conventions):
 *   UNIT        — pure scoring helpers tested directly via processLocation()
 *   INTEGRATION — API routes tested via supertest against the real Express server
 *
 * Legend: [PASS] happy-path, [FAIL] expected error/rejection, [EDGE] boundary condition
 */

import request from 'supertest';
import { jest } from '@jest/globals';

// ─── Mock db.js before any app imports ───────────────────────────────────────

const mockSetLocation    = jest.fn().mockResolvedValue(undefined);
const mockGetLocation    = jest.fn();
const mockGetAllLocations = jest.fn();

jest.unstable_mockModule('../src/db.js', () => ({
  setLocation:    mockSetLocation,
  getLocation:    mockGetLocation,
  getAllLocations: mockGetAllLocations,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
const { default: server }  = await import('../src/server.js');
const { processLocation }  = await import('../src/processing.js');

// ─── Shared fixtures ──────────────────────────────────────────────────────────

/** Minimal valid raw payload (identical style to Climate.test.js makePayload). */
function makePayload(days = 60, overrides = {}) {
  const time                      = [];
  const temperature_2m_mean       = [];
  const relative_humidity_2m_mean = [];
  const precipitation_sum         = [];
  const wind_speed_10m_max        = [];

  const start = new Date('2025-01-01');
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    time.push(d.toISOString().split('T')[0]);
    temperature_2m_mean.push(20);
    relative_humidity_2m_mean.push(50);
    precipitation_sum.push(2.5);
    wind_speed_10m_max.push(15);
  }

  return {
    country:      'Australia',
    country_code: 'AU',          // must match a key in hdi_data.json / qol_data.json
    latitude:     -25.3,
    longitude:    133.8,
    daily: { time, temperature_2m_mean, relative_humidity_2m_mean, precipitation_sum, wind_speed_10m_max },
    ...overrides,
  };
}

/**
 * Location fixture WITH affordability data — simulates a fully-patched processed file.
 * Reflects the shape written by patch_affordability.js.
 */
const MOCK_AU_FULL = {
  country_code: 'AU',
  country:      'Australia',
  capital:      'Canberra',
  latitude:     -25.3,
  longitude:    133.8,
  processed_at: '2025-01-01T00:00:00.000Z',
  scores: {
    liveability:         79.4,
    climate_score:       66.6,
    comfort_index:       67.2,
    uv_risk:             null,
    uv_index_mean:       null,
    temperature_mean:    20.0,
    humidity_mean:       50.0,
    precipitation_mean:  2.5,
    wind_speed_mean:     15.0,
    qol_score:           92.2,
    hdi:                 0.958,
    hdi_score:           95.8,
    safety_score:        97.2,
    internet_score:      97.1,
    sanitation_score:    95.8,
    mental_health_score: 56.4,
    homicide_rate:       0.854,
    internet_users:      97.06,
    sanitation_pct:      95.77,
    suicide_rate:        13.08,
    // ← new fields added by patch_affordability.js
    affordability_score: 50.0,    // 100 - (30000 / 60000) * 100 = 50
    hfce_per_capita:     30000,
  },
  seasonal: {
    spring: { climate_score: 65.0, comfort_index: 70.0 },
    summer: { climate_score: 72.0, comfort_index: 88.0 },
    autumn: { climate_score: 66.0, comfort_index: 66.0 },
    winter: { climate_score: 57.0, comfort_index: 47.0 },
  },
  monthly: Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
    temp: 15, humidity: 60, precipitation: 2.0, wind: 14, uv: null,
  })),
};

/**
 * Location fixture WITHOUT affordability data — simulates an un-patched file
 * (e.g. a micro-state with no HFCE entry).
 */
const MOCK_MC_NO_AFFORD = {
  ...MOCK_AU_FULL,
  country_code:       'MC',
  country:            'Monaco',
  capital:            'Monaco',
  scores: {
    ...MOCK_AU_FULL.scores,
    // Monaco has only internet + sanitation in qol_data.json
    hdi:                 null,
    hdi_score:           null,
    safety_score:        null,
    mental_health_score: null,
    homicide_rate:       null,
    suicide_rate:        null,
    qol_score:           99.6,   // inflated because only 2/5 indicators present
    affordability_score: null,   // no HFCE data
    hfce_per_capita:     null,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetLocation.mockImplementation((code) => {
    if (code === 'AU') return Promise.resolve(MOCK_AU_FULL);
    if (code === 'MC') return Promise.resolve(MOCK_MC_NO_AFFORD);
    return Promise.resolve(null);
  });
  mockGetAllLocations.mockResolvedValue([MOCK_AU_FULL, MOCK_MC_NO_AFFORD]);
  mockSetLocation.mockResolvedValue(undefined);
});

afterAll(() => {
  server.close();
});

// =============================================================================
// UNIT — QoL indicator counting logic
//
// countQolIndicators counts non-null values across the 5 source fields:
//   hdi, homicide_rate, internet_users, sanitation_pct, suicide_rate
//
// These tests validate the threshold used by the "Partial data" warning:
//   < 3 indicators → show warning
// =============================================================================

describe('UNIT — QoL indicator counting (countQolIndicators logic)', () => {

  // Helper that mirrors the frontend countQolIndicators() exactly.
  const countQolIndicators = (loc) =>
    [loc.hdi, loc.homicide_rate, loc.internet_users, loc.sanitation_pct, loc.suicide_rate]
      .filter((v) => v != null).length;

  // ✅ PASSING
  it('[PASS] returns 5 when all indicators are present', () => {
    const loc = {
      hdi: 0.9, homicide_rate: 1.0, internet_users: 95, sanitation_pct: 90, suicide_rate: 10,
    };
    expect(countQolIndicators(loc)).toBe(5);
  });

  it('[PASS] returns 0 when all indicators are null', () => {
    const loc = {
      hdi: null, homicide_rate: null, internet_users: null, sanitation_pct: null, suicide_rate: null,
    };
    expect(countQolIndicators(loc)).toBe(0);
  });

  it('[PASS] returns 2 for Monaco-like fixture (only internet + sanitation)', () => {
    const loc = {
      hdi: null, homicide_rate: null, internet_users: 98, sanitation_pct: 100, suicide_rate: null,
    };
    expect(countQolIndicators(loc)).toBe(2);
  });

  it('[PASS] returns 3 when exactly 3 indicators are present', () => {
    const loc = {
      hdi: 0.7, homicide_rate: null, internet_users: 60, sanitation_pct: null, suicide_rate: 8,
    };
    expect(countQolIndicators(loc)).toBe(3);
  });

  it('[PASS] value of 0 (numeric zero) is counted as present, not null', () => {
    // homicide_rate of 0 is a valid data point
    const loc = {
      hdi: null, homicide_rate: 0, internet_users: null, sanitation_pct: null, suicide_rate: null,
    };
    expect(countQolIndicators(loc)).toBe(1);
  });

  // ❌ FAILING (threshold boundary)
  it('[FAIL] count < 3 triggers the partial-data threshold (< 3)', () => {
    const below = { hdi: 0.8, homicide_rate: null, internet_users: null, sanitation_pct: null, suicide_rate: null };
    const above = { hdi: 0.8, homicide_rate: 2, internet_users: 80, sanitation_pct: null, suicide_rate: null };
    expect(countQolIndicators(below) < 3).toBe(true);
    expect(countQolIndicators(above) < 3).toBe(false);
  });

  it('[FAIL] undefined fields are treated the same as null', () => {
    // A field simply absent on the object → undefined → filtered out
    const loc = { hdi: 0.8 }; // missing 4 fields entirely
    expect(countQolIndicators(loc)).toBe(1);
  });

  // ⚠️  EDGE
  it('[EDGE] returns 1 when only hdi is present', () => {
    const loc = { hdi: 0.5, homicide_rate: null, internet_users: null, sanitation_pct: null, suicide_rate: null };
    expect(countQolIndicators(loc)).toBe(1);
  });

  it('[EDGE] boundary: count of exactly 3 does NOT trigger the warning', () => {
    const loc = {
      hdi: 0.8, homicide_rate: 2.0, internet_users: 75, sanitation_pct: null, suicide_rate: null,
    };
    expect(countQolIndicators(loc) < 3).toBe(false);
  });

  it('[EDGE] count of exactly 2 triggers the warning', () => {
    const loc = {
      hdi: null, homicide_rate: null, internet_users: 95, sanitation_pct: 90, suicide_rate: null,
    };
    expect(countQolIndicators(loc) < 3).toBe(true);
  });
});

// =============================================================================
// UNIT — Affordability score normalisation (patch_affordability.js formula)
//
// Formula: affordability_score = clamp(100 - (hfce / 60000) * 100, 0, 100)
// Lower HFCE → higher score (more affordable).
// =============================================================================

describe('UNIT — Affordability score normalisation formula', () => {

  const MAX_HFCE = 60000;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const affordScore = (hfce) =>
    hfce != null ? Math.round((clamp(100 - (hfce / MAX_HFCE) * 100, 0, 100)) * 10) / 10 : null;

  // ✅ PASSING
  it('[PASS] $0 HFCE yields maximum score of 100', () => {
    expect(affordScore(0)).toBe(100);
  });

  it('[PASS] $60000 HFCE (max) yields minimum score of 0', () => {
    expect(affordScore(60000)).toBe(0);
  });

  it('[PASS] $30000 HFCE yields score of exactly 50', () => {
    expect(affordScore(30000)).toBe(50);
  });

  it('[PASS] null HFCE returns null (no data)', () => {
    expect(affordScore(null)).toBeNull();
  });

  it('[PASS] score is always between 0 and 100 for any realistic HFCE', () => {
    const testValues = [500, 1200, 4800, 14000, 30000, 45000, 55000];
    for (const v of testValues) {
      const s = affordScore(v);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it('[PASS] lower HFCE always produces a higher or equal score', () => {
    expect(affordScore(5000)).toBeGreaterThan(affordScore(20000));
    expect(affordScore(1000)).toBeGreaterThan(affordScore(50000));
  });

  // ❌ FAILING / boundary
  it('[FAIL] HFCE exceeding 60000 is clamped to 0 (not negative)', () => {
    expect(affordScore(80000)).toBe(0);
    expect(affordScore(120000)).toBe(0);
  });

  // ⚠️  EDGE
  it('[EDGE] very low HFCE (e.g. $380 / Burundi) yields score near 100', () => {
    expect(affordScore(380)).toBeGreaterThan(99);
  });

  it('[EDGE] Swiss-level HFCE ($40000) produces a relatively low score (< 35)', () => {
    expect(affordScore(40000)).toBeLessThan(35);
  });
});

// =============================================================================
// UNIT — Affordability blend in liveability (prioritiseAffordability toggle)
//
// When prioritiseAffordability = true:
//   liveability = climateScore * climateWeight * 0.7
//               + qolScore    * qolWeight    * 0.7
//               + affordScore * 0.3
//
// Mirrors src/scoring.js computeLiveability() logic exactly.
// =============================================================================

describe('UNIT — Affordability blend in liveability score', () => {

  const round = (v) => Math.round(v * 10) / 10;

  /**
   * Minimal stand-alone implementation of the liveability blend so we
   * can test the formula without depending on the frontend module.
   */
  function computeBlend({ climateScore, qolScore, affordScore, climateWeight = 0.5, prioritiseAffordability = false }) {
    const qolWeight   = 1 - climateWeight;
    const affordWeight = (prioritiseAffordability && affordScore != null) ? 0.3 : 0;
    const scale        = 1 - affordWeight;

    if (qolScore != null) {
      return round(climateScore * climateWeight * scale + qolScore * qolWeight * scale + affordScore * affordWeight);
    } else if (affordWeight > 0) {
      return round(climateScore * scale + affordScore * affordWeight);
    } else {
      return climateScore;
    }
  }

  // ✅ PASSING
  it('[PASS] toggle OFF: liveability equals classic climate/QoL blend', () => {
    const result = computeBlend({ climateScore: 70, qolScore: 90, affordScore: 50, climateWeight: 0.5, prioritiseAffordability: false });
    expect(result).toBeCloseTo(70 * 0.5 + 90 * 0.5, 1);
  });

  it('[PASS] toggle ON: liveability differs from toggle-off result', () => {
    const base   = computeBlend({ climateScore: 70, qolScore: 90, affordScore: 50, prioritiseAffordability: false });
    const afford = computeBlend({ climateScore: 70, qolScore: 90, affordScore: 50, prioritiseAffordability: true });
    expect(afford).not.toEqual(base);
  });

  it('[PASS] toggle ON: affordability score shifts the result towards affordScore', () => {
    // With a very low affordScore, the blended score should be lower than the base
    const base   = computeBlend({ climateScore: 80, qolScore: 85, affordScore: 10, prioritiseAffordability: false });
    const afford = computeBlend({ climateScore: 80, qolScore: 85, affordScore: 10, prioritiseAffordability: true });
    expect(afford).toBeLessThan(base);
  });

  it('[PASS] toggle ON: high affordScore pushes liveability above base', () => {
    const base   = computeBlend({ climateScore: 60, qolScore: 70, affordScore: 95, prioritiseAffordability: false });
    const afford = computeBlend({ climateScore: 60, qolScore: 70, affordScore: 95, prioritiseAffordability: true });
    expect(afford).toBeGreaterThan(base);
  });

  it('[PASS] toggle ON with null affordScore falls back to classic blend', () => {
    const base   = computeBlend({ climateScore: 70, qolScore: 80, affordScore: null, prioritiseAffordability: false });
    const afford = computeBlend({ climateScore: 70, qolScore: 80, affordScore: null, prioritiseAffordability: true });
    expect(afford).toEqual(base);
  });

  it('[PASS] climate/QoL ratio is preserved proportionally when toggle is ON', () => {
    // With climateWeight=0.5, both sides scale by (1 - 0.3) = 0.7
    const result = computeBlend({ climateScore: 60, qolScore: 80, affordScore: 50, climateWeight: 0.5, prioritiseAffordability: true });
    const expected = round(60 * 0.5 * 0.7 + 80 * 0.5 * 0.7 + 50 * 0.3);
    expect(result).toBeCloseTo(expected, 1);
  });

  it('[PASS] result is always between 0 and 100 for all-extreme inputs', () => {
    const combos = [
      { climateScore: 0,   qolScore: 0,   affordScore: 0   },
      { climateScore: 100, qolScore: 100, affordScore: 100 },
      { climateScore: 0,   qolScore: 100, affordScore: 50  },
    ];
    for (const c of combos) {
      const r = computeBlend({ ...c, prioritiseAffordability: true });
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(100);
    }
  });

  // ❌ FAILING (cases that should not produce the base value)
  it('[FAIL] toggle ON + non-null affordScore never equals toggle-OFF result (unless they coincide numerically)', () => {
    // If affordScore === qolScore, the result is the same — otherwise it must differ
    const climateScore = 70, qolScore = 80, affordScore = 30;
    const base   = computeBlend({ climateScore, qolScore, affordScore, prioritiseAffordability: false });
    const afford = computeBlend({ climateScore, qolScore, affordScore, prioritiseAffordability: true });
    expect(afford).not.toEqual(base);
  });

  // ⚠️  EDGE
  it('[EDGE] climateWeight = 1.0 (all climate, no QoL): toggle ON still blends affordability', () => {
    const result = computeBlend({ climateScore: 80, qolScore: 60, affordScore: 40, climateWeight: 1.0, prioritiseAffordability: true });
    const expected = round(80 * 1.0 * 0.7 + 60 * 0.0 * 0.7 + 40 * 0.3);
    expect(result).toBeCloseTo(expected, 1);
  });

  it('[EDGE] climateWeight = 0.0 (all QoL): toggle ON uses qolScore + affordability', () => {
    const result = computeBlend({ climateScore: 50, qolScore: 90, affordScore: 20, climateWeight: 0.0, prioritiseAffordability: true });
    const expected = round(50 * 0.0 * 0.7 + 90 * 1.0 * 0.7 + 20 * 0.3);
    expect(result).toBeCloseTo(expected, 1);
  });

  it('[EDGE] when qolScore is null and toggle ON, climateScore + affordability are combined', () => {
    const result = computeBlend({ climateScore: 70, qolScore: null, affordScore: 60, prioritiseAffordability: true });
    const expected = round(70 * 0.7 + 60 * 0.3);
    expect(result).toBeCloseTo(expected, 1);
  });

  it('[EDGE] affordability weight is exactly 30% of final score composition when toggle ON', () => {
    // With climateScore=100, qolScore=100, affordScore=0:
    // result = 100*0.5*0.7 + 100*0.5*0.7 + 0*0.3 = 70
    // The drop from base 100 to 70 is exactly 30 points → 30% weight confirmed
    const result = computeBlend({ climateScore: 100, qolScore: 100, affordScore: 0, climateWeight: 0.5, prioritiseAffordability: true });
    expect(result).toBeCloseTo(70, 1);
  });
});

// =============================================================================
// UNIT — processLocation() affordability field presence
//
// Confirms that processLocation() stores affordability_score as a field
// (when backed by hfce_data.json) and that the shape is correct.
// =============================================================================

describe('UNIT — processLocation() affordability field', () => {

  it('[PASS] processLocation result includes affordability_score field', async () => {
    const result = await processLocation(makePayload());
    // The field key should exist (value may be null if AU isn't in hfce_data.json in test env)
    expect(Object.prototype.hasOwnProperty.call(result, 'affordability_score')).toBe(true);
  });

  it('[PASS] processLocation result includes hfce_per_capita field', async () => {
    const result = await processLocation(makePayload());
    expect(Object.prototype.hasOwnProperty.call(result, 'hfce_per_capita')).toBe(true);
  });

  it('[PASS] affordability_score is null or a number in range 0–100', async () => {
    const result = await processLocation(makePayload());
    if (result.affordability_score !== null) {
      expect(result.affordability_score).toBeGreaterThanOrEqual(0);
      expect(result.affordability_score).toBeLessThanOrEqual(100);
    } else {
      expect(result.affordability_score).toBeNull();
    }
  });

  it('[PASS] setLocation stores affordability_score in scores object', async () => {
    await processLocation(makePayload());
    const stored = mockSetLocation.mock.calls[0][1];
    expect(Object.prototype.hasOwnProperty.call(stored.scores, 'affordability_score')).toBe(true);
  });

  it('[PASS] unknown country_code stores null affordability_score (no HFCE data)', async () => {
    await processLocation(makePayload(10, { country: 'Neverland', country_code: 'XX' }));
    const stored = mockSetLocation.mock.calls[0][1];
    expect(stored.scores.affordability_score).toBeNull();
    expect(stored.scores.hfce_per_capita).toBeNull();
  });

  // ⚠️  EDGE
  it('[EDGE] hfce_per_capita is null when no HFCE entry exists for country_code', async () => {
    await processLocation(makePayload(10, { country_code: 'ZZZZ' }));
    const stored = mockSetLocation.mock.calls[0][1];
    expect(stored.scores.hfce_per_capita).toBeNull();
  });
});

// =============================================================================
// INTEGRATION — GET /score  (affordability fields in response)
// =============================================================================

describe('INTEGRATION — GET /score — affordability fields', () => {

  // ✅ PASSING
  it('[PASS] response includes affordability_score field for AU', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AU' });
    expect(res.status).toBe(200);
    expect(Object.prototype.hasOwnProperty.call(res.body, 'affordability_score')).toBe(true);
  });

  it('[PASS] response includes hfce_per_capita field for AU', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AU' });
    expect(res.status).toBe(200);
    expect(Object.prototype.hasOwnProperty.call(res.body, 'hfce_per_capita')).toBe(true);
  });

  it('[PASS] affordability_score for AU is 50.0 (matches fixture)', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AU' });
    expect(res.status).toBe(200);
    expect(res.body.affordability_score).toBe(50.0);
  });

  it('[PASS] hfce_per_capita for AU is 30000 (matches fixture)', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AU' });
    expect(res.status).toBe(200);
    expect(res.body.hfce_per_capita).toBe(30000);
  });

  it('[PASS] affordability_score is null for Monaco (no HFCE data)', async () => {
    const res = await request(server).get('/score').query({ country_code: 'MC' });
    expect(res.status).toBe(200);
    expect(res.body.affordability_score).toBeNull();
  });

  it('[PASS] affordability_score is a number or null — never undefined', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AU' });
    expect(res.status).toBe(200);
    expect(res.body.affordability_score === null || typeof res.body.affordability_score === 'number').toBe(true);
  });

  it('[PASS] affordability_score is between 0 and 100 when not null', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AU' });
    expect(res.status).toBe(200);
    if (res.body.affordability_score !== null) {
      expect(res.body.affordability_score).toBeGreaterThanOrEqual(0);
      expect(res.body.affordability_score).toBeLessThanOrEqual(100);
    }
  });

  // ❌ FAILING
  it('[FAIL] returns 400 for unknown country (no change from base behaviour)', async () => {
    const res = await request(server).get('/score').query({ country_code: 'ZZZ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // ⚠️  EDGE
  it('[EDGE] affordability_score is null for a country with no HFCE entry', async () => {
    const res = await request(server).get('/score').query({ country_code: 'MC' });
    expect(res.status).toBe(200);
    expect(res.body.affordability_score).toBeNull();
    expect(res.body.hfce_per_capita).toBeNull();
  });
});

// =============================================================================
// INTEGRATION — GET /score/ranking  (affordability fields present in list)
// =============================================================================

describe('INTEGRATION — GET /score/ranking — affordability fields', () => {

  // ✅ PASSING
  it('[PASS] every result in ranking includes affordability_score key', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(Object.prototype.hasOwnProperty.call(r, 'affordability_score')).toBe(true);
    }
  });

  it('[PASS] every result in ranking includes hfce_per_capita key', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(Object.prototype.hasOwnProperty.call(r, 'hfce_per_capita')).toBe(true);
    }
  });

  it('[PASS] AU entry has affordability_score of 50 (matches fixture)', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    const au = res.body.results.find((r) => r.country_code === 'AU');
    expect(au).toBeDefined();
    expect(au.affordability_score).toBe(50.0);
  });

  it('[PASS] MC entry has null affordability_score (matches fixture)', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    const mc = res.body.results.find((r) => r.country_code === 'MC');
    expect(mc).toBeDefined();
    expect(mc.affordability_score).toBeNull();
  });

  it('[PASS] affordability_score where present is between 0 and 100', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      if (r.affordability_score !== null) {
        expect(r.affordability_score).toBeGreaterThanOrEqual(0);
        expect(r.affordability_score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('[PASS] ranking still sorted by liveability (affordability does not change sort order server-side)', async () => {
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    const scores = res.body.results.map((r) => r.liveability);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  // ⚠️  EDGE
  it('[EDGE] results with null affordability_score do not break the ranking sort', async () => {
    // MC has null affordability — the sort should still succeed without NaN propagation
    const res = await request(server).get('/score/ranking');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  it('[EDGE] min_score filter still works when affordability_score fields are present', async () => {
    const res = await request(server).get('/score/ranking').query({ min_score: 70 });
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(r.liveability).toBeGreaterThanOrEqual(70);
    }
  });
});

// =============================================================================
// INTEGRATION — GET /score  (QoL partial-data fields)
//
// Confirms that the raw QoL source fields needed for countQolIndicators
// (homicide_rate, internet_users, sanitation_pct, suicide_rate, hdi) are
// present in the /score response so the frontend can compute the count.
// =============================================================================

describe('INTEGRATION — GET /score — QoL source fields for partial-data detection', () => {

  const QOL_SOURCE_FIELDS = ['hdi', 'homicide_rate', 'internet_users', 'sanitation_pct', 'suicide_rate'];

  // ✅ PASSING
  it('[PASS] all 5 QoL source fields are present in /score response for AU', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AU' });
    expect(res.status).toBe(200);
    for (const field of QOL_SOURCE_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(res.body, field)).toBe(true);
    }
  });

  it('[PASS] Monaco response has null hdi (partial data scenario)', async () => {
    const res = await request(server).get('/score').query({ country_code: 'MC' });
    expect(res.status).toBe(200);
    expect(res.body.hdi).toBeNull();
  });

  it('[PASS] Monaco response has null homicide_rate (partial data scenario)', async () => {
    const res = await request(server).get('/score').query({ country_code: 'MC' });
    expect(res.status).toBe(200);
    expect(res.body.homicide_rate).toBeNull();
  });

  it('[PASS] Monaco response has null suicide_rate (partial data scenario)', async () => {
    const res = await request(server).get('/score').query({ country_code: 'MC' });
    expect(res.status).toBe(200);
    expect(res.body.suicide_rate).toBeNull();
  });

  it('[PASS] AU response has non-null values for all 5 QoL source fields', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AU' });
    expect(res.status).toBe(200);
    for (const field of QOL_SOURCE_FIELDS) {
      expect(res.body[field]).not.toBeNull();
    }
  });

  // ⚠️  EDGE
  it('[EDGE] qol_score for Monaco is non-null despite missing indicators (weighted average of available)', async () => {
    const res = await request(server).get('/score').query({ country_code: 'MC' });
    expect(res.status).toBe(200);
    // Monaco should still have a qol_score (computed from its 2 available indicators)
    expect(res.body.qol_score).not.toBeNull();
  });

  it('[EDGE] QoL source fields are numbers or null — never undefined', async () => {
    const res = await request(server).get('/score').query({ country_code: 'AU' });
    expect(res.status).toBe(200);
    for (const field of QOL_SOURCE_FIELDS) {
      const v = res.body[field];
      expect(v === null || typeof v === 'number').toBe(true);
    }
  });
});
