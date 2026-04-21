import { toAlpha2 } from './Country_code_map.js';
import { InputError } from './error.js';

const CORE5_BASE = 'https://6uy0kye9xi.execute-api.ap-southeast-2.amazonaws.com';
const REQUEST_TIMEOUT_MS = 10000;

/***************************************************************
                       Fetch Helper
***************************************************************/

const core5Fetch = async (path, params) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
  ).toString();
  const url = `${CORE5_BASE}${path}${qs ? `?${qs}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw { isCore5Error: true, status: res.status, message: `CORE5 API returned ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    if (err?.isCore5Error) throw err;
    if (err?.name === 'AbortError') {
      throw { isCore5Error: true, message: 'CORE5 API request timed out' };
    }
    throw { isCore5Error: true, message: 'CORE5 API unavailable — geopolitical data could not be retrieved' };
  } finally {
    clearTimeout(timer);
  }
};

/***************************************************************
                       Risk Computation
***************************************************************/

const computeRiskModifier = (goldsteinAvg, conflictRatio) => {
  const goldsteinPenalty = Math.min(0, goldsteinAvg) * 1.5; // max -15
  const conflictPenalty = conflictRatio * -5;               // max -5
  return Math.round(Math.max(-20, goldsteinPenalty + conflictPenalty) * 10) / 10;
};

/***************************************************************
                       Main Entry
***************************************************************/

export const getGeopoliticalSummary = async (countryCode, months = 6) => {
  if (!countryCode) throw new InputError('Must provide a country_code');

  let iso2;
  try {
    iso2 = toAlpha2(countryCode);
  } catch {
    throw new InputError(`Cannot map country_code to ISO alpha-2: ${countryCode}`);
  }

  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - months);
  const dateFromStr = dateFrom.toISOString().split('T')[0];

  // Two CORE5 calls in parallel. /events gives us everything we need per country.
  // /events/timeline adds the trend chart.
  const [eventsData, timelineData] = await Promise.all([
    core5Fetch('/events', { country: iso2, date_from: dateFromStr, limit: 100 }),
    core5Fetch('/events/timeline', { country: iso2, date_from: dateFromStr, bucket: 'week' }),
  ]);

  const events = Array.isArray(eventsData) ? eventsData : (eventsData?.events ?? []);

  if (events.length === 0) {
    throw new InputError(`No geopolitical events found for ${countryCode} in the last ${months} months`);
  }

  // Helper: safely extract field from an event with both naming conventions
  const getField = (ev, ...keys) => {
    for (const k of keys) {
      const v = ev[k];
      if (v !== undefined && v !== null) return v;
    }
    return null;
  };

  // Goldstein average
  const goldsteinScores = events
    .map((e) => getField(e, 'goldstein_scale', 'goldsteinScale', 'goldstein'))
    .filter((s) => s !== null && !isNaN(s));

  const goldsteinAvg =
    goldsteinScores.length > 0
      ? Math.round((goldsteinScores.reduce((a, b) => a + b, 0) / goldsteinScores.length) * 100) / 100
      : 0;

  // Conflict ratio (quad_class 3 = Verbal Conflict, 4 = Material Conflict)
  const quadClassOf = (e) => getField(e, 'quad_class', 'quadClass') ?? 0;
  const conflictEvents = events.filter((e) => quadClassOf(e) >= 3);
  const conflictRatio = Math.round((conflictEvents.length / events.length) * 100) / 100;

  // Quad class distribution computed from per-country events (not global stats)
  const quadClassDistribution = {
    verbal_cooperation:   events.filter((e) => quadClassOf(e) === 1).length,
    material_cooperation: events.filter((e) => quadClassOf(e) === 2).length,
    verbal_conflict:      events.filter((e) => quadClassOf(e) === 3).length,
    material_conflict:    events.filter((e) => quadClassOf(e) === 4).length,
  };

  // Top 3 most recent conflict events
  const topEvents = conflictEvents.slice(0, 3).map((e) => {
    const a1 = getField(e, 'actor1_name', 'actor1', 'Actor1Name');
    const a2 = getField(e, 'actor2_name', 'actor2', 'Actor2Name');
    const fallback = getField(e, 'event_description', 'summary', 'description');
    return {
      title: [a1, a2].filter(Boolean).join(' — ') || fallback || 'Geopolitical event',
      date: getField(e, 'date_added', 'dateadded', 'event_date', 'date', 'SQLDATE') ?? '',
      quadClass: quadClassOf(e) || null,
      goldstein: getField(e, 'goldstein_scale', 'goldsteinScale', 'goldstein'),
    };
  });

  // Conflict trend from /events/timeline
  const timelineArr = Array.isArray(timelineData) ? timelineData : (timelineData?.buckets ?? []);
  const conflictTrend = timelineArr.map((bucket) => ({
    week:              getField(bucket, 'date', 'week', 'period', 'bucket') ?? '',
    total:             getField(bucket, 'total', 'count') ?? 0,
    verbal_conflict:   getField(bucket, 'verbal_conflict') ?? 0,
    material_conflict: getField(bucket, 'material_conflict') ?? 0,
  }));

  return {
    country_code: countryCode.toUpperCase(),
    iso2,
    periodMonths: months,
    geopoliticalRisk: {
      riskModifier: computeRiskModifier(goldsteinAvg, conflictRatio),
      goldsteinAvg,
      conflictRatio,
      recentEventCount: events.length,
      conflictTrend,
      quadClassDistribution,
      topEvents,
      dataSource: 'CORE5 Fivecore Geopolitical Events API',
      retrievedAt: new Date().toISOString(),
    },
  };
};