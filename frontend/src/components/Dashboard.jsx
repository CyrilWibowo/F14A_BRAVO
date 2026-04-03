import { useEffect, useState, useCallback } from 'react';
import { apiCallGet } from '../utils';
import './Dashboard.css';

// ─── helpers ────────────────────────────────────────────────────────────────

const scoreColour = (pct) => {
  if (pct === null || pct === undefined) return '#aaa';
  if (pct >= 80) return '#2d6a2d';
  if (pct >= 50) return '#7aaa3a';
  if (pct >= 20) return '#e6a817';
  return '#c0392b';
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat-label">{label}</div>
      <div className="dash-stat-value" style={accent ? { color: accent } : {}}>{value}</div>
      {sub && <div className="dash-stat-sub">{sub}</div>}
    </div>
  );
}

function HBar({ label, value, max, colour, fmt }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="hbar-row">
      <div className="hbar-label">{label}</div>
      <div className="hbar-track">
        <div className="hbar-fill" style={{ width: `${pct}%`, background: colour || '#2d6a2d' }} />
      </div>
      <div className="hbar-val">{fmt ? fmt(value) : value}</div>
    </div>
  );
}

function StatusDot({ ok }) {
  return <span className={`status-dot ${ok ? 'ok' : 'down'}`} />;
}

// ─── main component ──────────────────────────────────────────────────────────

const REFRESH_MS = 10_000;

function Dashboard() {
  const [health,  setHealth]  = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error,   setError]   = useState(null);
  const [lastAt,  setLastAt]  = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(() => {
    Promise.all([
      apiCallGet('health').catch(() => null),
      apiCallGet('metrics').catch(() => null),
    ]).then(([h, m]) => {
      setHealth(h);
      setMetrics(m);
      setLastAt(new Date().toLocaleTimeString());
      setError(!h && !m ? 'Backend unreachable — is the server running on port 5005?' : null);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetch_]);

  if (loading) return <div className="dash-status">Loading dashboard…</div>;
  if (error)   return <div className="dash-status dash-error">{error}</div>;

  // ── derived values ──────────────────────────────────────────────────────

  const isUp        = health?.status === 'ok';
  const totalReq    = metrics?.requests?.total ?? 0;
  const errorCount  = metrics?.requests?.errors ?? 0;
  const errorPct    = metrics?.requests?.errorRatePct ?? 0;
  const avgLatency  = metrics?.latency?.averageMs ?? 0;
  const scoresComp  = metrics?.scores?.computed ?? 0;

  const s3           = metrics?.upstream?.s3 ?? {};
  const s3Total      = (s3.success ?? 0) + (s3.error ?? 0);
  const s3SuccessPct = s3Total > 0 ? Math.round((s3.success / s3Total) * 100) : null;
  const s3AvgMs      = s3Total > 0 ? Math.round((s3.totalMs ?? 0) / s3Total) : 0;

  const byEndpoint   = metrics?.requests?.byEndpoint ?? {};
  const byStatus     = metrics?.requests?.byStatus ?? {};
  const scoreHist    = metrics?.scores?.histogram ?? {};
  const latBuckets   = metrics?.latency?.histogram ?? {};

  const maxEndpoint  = Math.max(...Object.values(byEndpoint), 1);
  const maxStatus    = Math.max(...Object.values(byStatus), 1);
  const maxHist      = Math.max(...Object.values(scoreHist), 1);
  const maxLat       = Math.max(...Object.values(latBuckets), 1);

  const uptime       = health?.uptime != null
    ? health.uptime >= 3600
      ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`
      : `${Math.floor(health.uptime / 60)}m ${health.uptime % 60}s`
    : '—';

  return (
    <div className="dash-root">

      {/* ── header ── */}
      <div className="dash-header">
        <div className="dash-header-left">
          <StatusDot ok={isUp} />
          <span className="dash-title">API Observability</span>
          <span className="dash-env">{health?.environment ?? 'unknown'}</span>
        </div>
        <div className="dash-header-right">
          <span className="dash-refresh-label">Refreshes every 10s</span>
          {lastAt && <span className="dash-last">Last updated {lastAt}</span>}
          <button className="dash-refresh-btn" onClick={fetch_}>↺ Refresh</button>
        </div>
      </div>

      {/* ── summary cards ── */}
      <div className="dash-cards">
        <StatCard
          label="Service status"
          value={isUp ? 'Healthy' : 'Down'}
          sub={`Uptime: ${uptime}`}
          accent={isUp ? '#2d6a2d' : '#c0392b'}
        />
        <StatCard
          label="Total requests"
          value={totalReq.toLocaleString()}
          sub={`Since ${metrics?.collectedSince ? new Date(metrics.collectedSince).toLocaleTimeString() : '—'}`}
        />
        <StatCard
          label="Error rate"
          value={`${errorPct}%`}
          sub={`${errorCount} errors`}
          accent={errorPct > 5 ? '#c0392b' : errorPct > 1 ? '#e6a817' : '#2d6a2d'}
        />
        <StatCard
          label="Avg latency"
          value={`${avgLatency} ms`}
          sub="across all endpoints"
          accent={avgLatency > 1000 ? '#c0392b' : avgLatency > 500 ? '#e6a817' : '#2d6a2d'}
        />
        <StatCard
          label="Scores computed"
          value={scoresComp.toLocaleString()}
          sub="liveability scores"
        />
        <StatCard
          label="S3 success rate"
          value={s3SuccessPct !== null ? `${s3SuccessPct}%` : '—'}
          sub={`avg ${s3AvgMs}ms per call`}
          accent={scoreColour(s3SuccessPct)}
        />
      </div>

      {/* ── two column grid ── */}
      <div className="dash-grid">

        {/* requests by endpoint */}
        <div className="dash-panel">
          <div className="dash-panel-title">Requests by endpoint</div>
          {Object.keys(byEndpoint).length === 0
            ? <div className="dash-empty">No requests recorded yet</div>
            : Object.entries(byEndpoint)
                .sort((a, b) => b[1] - a[1])
                .map(([ep, count]) => (
                  <HBar key={ep} label={ep} value={count} max={maxEndpoint}
                    colour="#2d6a2d" fmt={(v) => v.toLocaleString()} />
                ))
          }
        </div>

        {/* S3 upstream health */}
        <div className="dash-panel">
          <div className="dash-panel-title">Upstream — AWS S3</div>
          <div className="dash-upstream-block">
            <div className="dash-upstream-row">
              <span className="dash-upstream-source">S3</span>
              <div className="dash-upstream-bar-wrap">
                <div
                  className="dash-upstream-bar"
                  style={{
                    width: `${s3SuccessPct ?? 0}%`,
                    background: scoreColour(s3SuccessPct),
                  }}
                />
              </div>
              <span className="dash-upstream-pct">{s3SuccessPct !== null ? `${s3SuccessPct}%` : '—'}</span>
              <span className={`dash-badge ${(s3SuccessPct ?? 0) >= 95 ? 'badge-ok' : (s3SuccessPct ?? 0) >= 80 ? 'badge-warn' : 'badge-err'}`}>
                {(s3SuccessPct ?? 0) >= 95 ? 'healthy' : (s3SuccessPct ?? 0) >= 80 ? 'degraded' : 'failing'}
              </span>
            </div>
          </div>

          <div className="dash-upstream-stats">
            <div className="dash-us-stat">
              <span className="dash-us-label">Successful calls</span>
              <span className="dash-us-val">{(s3.success ?? 0).toLocaleString()}</span>
            </div>
            <div className="dash-us-stat">
              <span className="dash-us-label">Failed calls</span>
              <span className="dash-us-val" style={{ color: (s3.error ?? 0) > 0 ? '#c0392b' : 'inherit' }}>
                {(s3.error ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="dash-us-stat">
              <span className="dash-us-label">Total calls</span>
              <span className="dash-us-val">{s3Total.toLocaleString()}</span>
            </div>
            <div className="dash-us-stat">
              <span className="dash-us-label">Avg duration</span>
              <span className="dash-us-val">{s3AvgMs} ms</span>
            </div>
          </div>

          <div className="dash-panel-title" style={{ marginTop: '20px' }}>HTTP status breakdown</div>
          {Object.keys(byStatus).length === 0
            ? <div className="dash-empty">No responses recorded yet</div>
            : Object.entries(byStatus)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([code, count]) => {
                  const c = Number(code);
                  const col = c >= 500 ? '#c0392b' : c >= 400 ? '#e6a817' : '#2d6a2d';
                  return (
                    <HBar key={code} label={`${code}`} value={count} max={maxStatus}
                      colour={col} fmt={(v) => v.toLocaleString()} />
                  );
                })
          }
        </div>

        {/* score distribution */}
        <div className="dash-panel">
          <div className="dash-panel-title">Liveability score distribution</div>
          {Object.values(scoreHist).every((v) => v === 0)
            ? <div className="dash-empty">No scores computed yet</div>
            : Object.entries(scoreHist).map(([bucket, count]) => (
                <HBar key={bucket} label={bucket} value={count} max={maxHist}
                  colour="#5a9a2d" fmt={(v) => `${v} scores`} />
              ))
          }
        </div>

        {/* latency histogram */}
        <div className="dash-panel">
          <div className="dash-panel-title">Latency histogram (ms)</div>
          {Object.values(latBuckets).every((v) => v === 0)
            ? <div className="dash-empty">No requests recorded yet</div>
            : Object.entries(latBuckets).map(([bucket, count]) => {
                const label = bucket === 'inf' ? '>2500 ms' : `≤${bucket} ms`;
                const col = bucket === 'inf' ? '#c0392b'
                  : Number(bucket) > 500 ? '#e6a817'
                  : '#2d6a2d';
                return (
                  <HBar key={bucket} label={label} value={count} max={maxLat}
                    colour={col} fmt={(v) => `${v} req`} />
                );
              })
          }
        </div>

      </div>
    </div>
  );
}

export default Dashboard;