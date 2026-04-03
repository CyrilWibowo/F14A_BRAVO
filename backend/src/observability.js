// backend/src/observability.js
// Drop-in observability for F14A BRAVO — structured logging + metrics.
// ES module (matches "type": "module" in backend/package.json).
//
// Usage in server.js:
//   import { requestLogger, errorLogger, healthHandler, metricsHandler } from './observability.js';
//
// Axiom (optional): set AXIOM_DATASET + AXIOM_API_KEY env vars and logs
// are forwarded to Axiom automatically. Without them, stdout only.

import 'dotenv/config';

const AXIOM_DATASET = process.env.AXIOM_DATASET;
const AXIOM_API_KEY = process.env.AXIOM_API_KEY;
const SERVICE      = 'climate-liveability-api';
const ENV          = process.env.NODE_ENV || 'development';

// ─────────────────────────────────────────
// STRUCTURED LOGGER
// ─────────────────────────────────────────

async function shipToAxiom(entry) {
  try {
    await fetch(`https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AXIOM_API_KEY}`,
        'Content-Type': 'application/x-ndjson',
      },
      body: JSON.stringify(entry) + '\n',
    });
  } catch {
    // Never crash the app due to a logging failure
  }
}

function log(level, event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE,
    environment: ENV,
    event,
    ...fields,
  };
  console.log(JSON.stringify(entry));
  if (AXIOM_DATASET && AXIOM_API_KEY) shipToAxiom(entry);
}

export const logger = {
  info:  (event, fields) => log('info',  event, fields),
  warn:  (event, fields) => log('warn',  event, fields),
  error: (event, fields) => log('error', event, fields),
};

// ─────────────────────────────────────────
// IN-MEMORY METRICS
// ─────────────────────────────────────────

const metrics = {
  requests: {
    total: 0,
    errors: 0,
    byEndpoint: {},
    byStatus:   {},
  },
  latency: {
    sum: 0,
    count: 0,
    buckets: { '50': 0, '100': 0, '250': 0, '500': 0, '1000': 0, '2500': 0, 'inf': 0 },
  },
  upstream: {
    s3: { success: 0, error: 0, totalMs: 0 },
  },
  scores: {
    computed: 0,
    histogram: { '0-20': 0, '20-40': 0, '40-60': 0, '60-80': 0, '80-100': 0 },
  },
  startedAt: new Date().toISOString(),
};

function recordLatency(ms) {
  metrics.latency.sum += ms;
  metrics.latency.count += 1;
  for (const t of [50, 100, 250, 500, 1000, 2500]) {
    if (ms <= t) { metrics.latency.buckets[String(t)] += 1; return; }
  }
  metrics.latency.buckets['inf'] += 1;
}

// ─────────────────────────────────────────
// PUBLIC INSTRUMENTATION HELPERS
// ─────────────────────────────────────────

export function recordUpstream(source, success, durationMs, operation) {
  if (!metrics.upstream[source]) metrics.upstream[source] = { success: 0, error: 0, totalMs: 0 };
  metrics.upstream[source][success ? 'success' : 'error'] += 1;
  metrics.upstream[source].totalMs += durationMs;
  logger.info('upstream_call', { source, success, durationMs, operation });
}

export function recordScoreComputed(score, countryCode) {
  metrics.scores.computed += 1;
  if      (score < 20) metrics.scores.histogram['0-20']   += 1;
  else if (score < 40) metrics.scores.histogram['20-40']  += 1;
  else if (score < 60) metrics.scores.histogram['40-60']  += 1;
  else if (score < 80) metrics.scores.histogram['60-80']  += 1;
  else                 metrics.scores.histogram['80-100'] += 1;
  logger.info('score_computed', { score, countryCode });
}

// ─────────────────────────────────────────
// EXPRESS MIDDLEWARE
// ─────────────────────────────────────────

export function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  req.requestId = requestId;

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const { statusCode } = res;
    const key = `${req.method} ${req.path}`;

    metrics.requests.total += 1;
    metrics.requests.byEndpoint[key] = (metrics.requests.byEndpoint[key] || 0) + 1;
    metrics.requests.byStatus[String(statusCode)] = (metrics.requests.byStatus[String(statusCode)] || 0) + 1;
    if (statusCode >= 400) metrics.requests.errors += 1;
    recordLatency(durationMs);

    logger.info('request_complete', {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode,
      durationMs,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.headers['x-forwarded-for'],
    });
  });

  next();
}

export function errorLogger(err, req, res, next) {
  logger.error('unhandled_error', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    errorMessage: err.message,
    stack: ENV === 'development' ? err.stack : undefined,
    statusCode: err.status || 500,
  });
  next(err);
}

// ─────────────────────────────────────────
// ROUTE HANDLERS
// ─────────────────────────────────────────

export function healthHandler(req, res) {
  logger.info('health_check', {});
  res.status(200).json({
    status: 'ok',
    service: SERVICE,
    environment: ENV,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

export function metricsHandler(req, res) {
  const avgLatency = metrics.latency.count > 0
    ? Math.round(metrics.latency.sum / metrics.latency.count)
    : 0;
  const errorRatePct = metrics.requests.total > 0
    ? +((metrics.requests.errors / metrics.requests.total) * 100).toFixed(1)
    : 0;

  res.status(200).json({
    service: SERVICE,
    environment: ENV,
    collectedSince: metrics.startedAt,
    requests: {
      total: metrics.requests.total,
      errors: metrics.requests.errors,
      errorRatePct,
      byEndpoint: metrics.requests.byEndpoint,
      byStatus: metrics.requests.byStatus,
    },
    latency: {
      averageMs: avgLatency,
      totalObservations: metrics.latency.count,
      histogram: metrics.latency.buckets,
    },
    upstream: metrics.upstream,
    scores: metrics.scores,
  });
}