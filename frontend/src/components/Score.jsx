import { useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiCallGet } from '../utils';
import { computeLiveability, countQolIndicators } from '../scoring';
import { PrefsContext } from '../prefsContext';
import './Ranking.css';
import './Score.css';

const getFlagUrl = (code) =>
  `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

const scoreClass = (s) => (s >= 65 ? 'high' : s >= 40 ? 'mid' : 'low');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Geopolitical Risk Card ────────────────────────────────────────────────────

const QUAD_LABELS = {
  verbal_cooperation:   { label: 'Verbal Cooperation',  color: '#16a34a' },
  material_cooperation: { label: 'Material Cooperation', color: '#0891b2' },
  verbal_conflict:      { label: 'Verbal Conflict',      color: '#d97706' },
  material_conflict:    { label: 'Material Conflict',    color: '#dc2626' },
};

const riskColor = (modifier) => {
  if (modifier >= -3)  return '#16a34a';
  if (modifier >= -8)  return '#d97706';
  return '#dc2626';
};

const riskLabel = (modifier) => {
  if (modifier >= -3)  return 'Low Risk';
  if (modifier >= -8)  return 'Moderate Risk';
  return 'High Risk';
};

function GeopoliticalCard({ geo }) {
  if (!geo) return null;
  const { geopoliticalRisk, iso2 } = geo;
  if (!geopoliticalRisk) return null;

  const {
    riskModifier,
    goldsteinAvg,
    conflictRatio,
    recentEventCount,
    conflictTrend,
    quadClassDistribution,
    topEvents,
    retrievedAt,
  } = geopoliticalRisk;

  const color     = riskColor(riskModifier);
  const label     = riskLabel(riskModifier);
  const quadTotal = Object.values(quadClassDistribution ?? {}).reduce((a, b) => a + b, 0) || 1;
  const trendData = (conflictTrend ?? []).slice(-12);
  const maxTotal  = Math.max(...trendData.map((t) => t.total), 1);

  return (
    <div className="profile-inner-card">
      <div className="geo-section">

        <div className="geo-header">
          <div className="geo-header-left">
            <h2 className="qol-title">Geopolitical Risk</h2>
            <span className="qol-subtitle">
              Powered by CORE5 · GDELT data · ISO {iso2} · Last {geo.periodMonths} months
            </span>
          </div>
          <div className="geo-risk-badge" style={{ background: `${color}18`, border: `1.5px solid ${color}40` }}>
            <span className="geo-risk-modifier" style={{ color }}>{riskModifier > 0 ? '+' : ''}{riskModifier}</span>
            <span className="geo-risk-label" style={{ color }}>{label}</span>
          </div>
        </div>

        <div className="geo-stats-row">
          {[
            { label: 'Goldstein Avg',   value: goldsteinAvg?.toFixed(2) ?? '—',                                                              sub: 'stability index (−10 to +10)', color: goldsteinAvg >= 0 ? '#16a34a' : '#dc2626' },
            { label: 'Conflict Ratio',  value: conflictRatio != null ? `${(conflictRatio * 100).toFixed(0)}%` : '—',                         sub: 'events classified as conflict', color: conflictRatio > 0.4 ? '#dc2626' : conflictRatio > 0.2 ? '#d97706' : '#16a34a' },
            { label: 'Events Analysed', value: recentEventCount ?? '—',                                                                       sub: 'GDELT events retrieved',        color: '#0369a1' },
            { label: 'Risk Modifier',   value: riskModifier != null ? `${riskModifier > 0 ? '+' : ''}${riskModifier}` : '—',                 sub: 'liveability score impact',      color },
          ].map((s) => (
            <div key={s.label} className="geo-stat-tile">
              <div className="geo-stat-label">{s.label}</div>
              <div className="geo-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="geo-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="geo-bottom-row">

          {quadClassDistribution && (
            <div className="geo-quad-section">
              <div className="geo-sub-title">Event Distribution</div>
              <div className="geo-quad-bars">
                {Object.entries(QUAD_LABELS).map(([key, meta]) => {
                  const count = quadClassDistribution[key] ?? 0;
                  const pct   = Math.round((count / quadTotal) * 100);
                  return (
                    <div key={key} className="geo-quad-row">
                      <div className="geo-quad-label">{meta.label}</div>
                      <div className="geo-quad-track">
                        <div className="geo-quad-fill" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                      <div className="geo-quad-pct" style={{ color: meta.color }}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {trendData.length > 1 && (
            <div className="geo-trend-section">
              <div className="geo-sub-title">Weekly Event Trend</div>
              <div className="geo-sparkline-wrap">
                <svg viewBox={`0 0 ${trendData.length * 20} 60`} className="geo-sparkline">
                  {trendData.map((t, i) => {
                    const barH      = (t.total / maxTotal) * 44;
                    const conflictH = ((t.verbal_conflict + t.material_conflict) / maxTotal) * 44;
                    const x         = i * 20 + 2;
                    return (
                      <g key={i}>
                        <rect x={x} y={48 - barH}      width={16} height={barH}      fill="#d1fae5" rx="2" />
                        <rect x={x} y={48 - conflictH} width={16} height={conflictH} fill="#fca5a5" rx="2" />
                      </g>
                    );
                  })}
                </svg>
                <div className="geo-sparkline-legend">
                  <span className="geo-spark-dot" style={{ background: '#d1fae5', border: '1px solid #16a34a' }} /> Total events
                  <span className="geo-spark-dot" style={{ background: '#fca5a5', border: '1px solid #dc2626', marginLeft: 10 }} /> Conflict events
                </div>
              </div>
            </div>
          )}

        </div>

        {topEvents && topEvents.length > 0 && (
          <div className="geo-events-section">
            <div className="geo-sub-title">Recent Conflict Events</div>
            <div className="geo-events-list">
              {topEvents.map((ev, i) => (
                <div key={i} className="geo-event-row">
                  <div
                    className="geo-event-quad"
                    style={{
                      background: ev.quadClass === 4 ? '#fee2e2' : '#fef3c7',
                      color:      ev.quadClass === 4 ? '#dc2626'  : '#d97706',
                    }}
                  >
                    {ev.quadClass === 4 ? 'Material Conflict' : 'Verbal Conflict'}
                  </div>
                  <div className="geo-event-title">{ev.title}</div>
                  <div className="geo-event-meta">
                    {ev.date && <span>{ev.date}</span>}
                    {ev.goldstein != null && (
                      <span style={{ color: ev.goldstein >= 0 ? '#16a34a' : '#dc2626' }}>
                        Goldstein: {ev.goldstein > 0 ? '+' : ''}{ev.goldstein}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {retrievedAt && (
          <div className="geo-footer">
            Data retrieved {new Date(retrievedAt).toLocaleString()} · Source: CORE5 Fivecore Geopolitical Events API
          </div>
        )}

      </div>
    </div>
  );
}

// ── Monthly Chart ─────────────────────────────────────────────────────────────

function MonthlyChart({ monthly, prefs, latitude }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!monthly || monthly.length === 0) return null;

  const W = 560, H = 200;
  const PAD = { top: 20, right: 38, bottom: 28, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = monthly.length;

  const x = (i) => PAD.left + (i / (n - 1)) * innerW;

  const isNorth = latitude == null || latitude >= 0;
  const SEASON_BANDS = [
    { name: 'Spring', months: isNorth ? [2,3,4]  : [8,9,10], fill: '#bbf7d0', labelColor: '#14532d' },
    { name: 'Summer', months: isNorth ? [5,6,7]  : [11,0,1], fill: '#fde68a', labelColor: '#78350f' },
    { name: 'Autumn', months: isNorth ? [8,9,10] : [2,3,4],  fill: '#fed7aa', labelColor: '#7c2d12' },
    { name: 'Winter', months: isNorth ? [11,0,1] : [5,6,7],  fill: '#bfdbfe', labelColor: '#1e3a8a' },
  ];

  const colLeft  = (i) => i === 0     ? PAD.left          : (x(i - 1) + x(i)) / 2;
  const colRight = (i) => i === n - 1 ? PAD.left + innerW : (x(i) + x(i + 1)) / 2;

  const seasonRects = (months) => {
    const sorted = [...months].sort((a, b) => a - b);
    const runs = [];
    let s = sorted[0], p = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === p + 1) { p = sorted[i]; }
      else { runs.push([s, p]); s = sorted[i]; p = sorted[i]; }
    }
    runs.push([s, p]);
    const primaryIdx = runs.reduce((bi, r, i) => r[1] - r[0] > runs[bi][1] - runs[bi][0] ? i : bi, 0);
    return runs.map(([first, last], i) => {
      const rx = colLeft(first);
      const rw = colRight(last) - rx;
      return { rx, rw, midX: rx + rw / 2, primary: i === primaryIdx };
    });
  };

  const niceStep = (range, n) => {
    const raw = range / n;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / pow;
    return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
  };
  const niceTicks = (lo, hi, n = 4) => {
    const step = niceStep(hi - lo || 1, n);
    const start = Math.floor(lo / step) * step;
    const end   = Math.ceil(hi  / step) * step;
    const ticks = [];
    for (let t = start; t <= end + step * 0.001; t += step) ticks.push(Math.round(t * 1000) / 1000);
    return ticks;
  };

  const temps = monthly.map((m) => m.temp).filter((v) => v != null);
  const rawTMin = Math.min(...temps), rawTMax = Math.max(...temps);
  const tempTicks = niceTicks(rawTMin, rawTMax);
  const tMin = tempTicks[0], tMax = tempTicks[tempTicks.length - 1];
  const yTemp = (t) => PAD.top + innerH - ((t - tMin) / (tMax - tMin)) * innerH;
  const yHum  = (h) => PAD.top + innerH - (h / 100) * innerH;

  const rawMaxP   = Math.max(...monthly.map((m) => m.precipitation || 0), 1);
  const precipTicks = niceTicks(0, rawMaxP);
  const maxP      = precipTicks[precipTicks.length - 1];
  const yPrecip   = (p) => PAD.top + innerH - ((p || 0) / maxP) * innerH;

  const clampY = (y) => Math.max(PAD.top, Math.min(PAD.top + innerH, y));

  const tempPath = monthly
    .map((m, i) => m.temp != null
      ? `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yTemp(m.temp).toFixed(1)}`
      : null)
    .filter(Boolean).join(' ');

  const humPath = monthly
    .map((m, i) => m.humidity != null
      ? `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yHum(m.humidity).toFixed(1)}`
      : null)
    .filter(Boolean).join(' ');

  const precipPath = monthly
    .map((m, i) => m.precipitation != null
      ? `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yPrecip(m.precipitation).toFixed(1)}`
      : null)
    .filter(Boolean).join(' ');

  const idealTempY = clampY(yTemp(prefs.idealTemp));
  const idealHumY  = yHum(prefs.idealHumidity);

  const hitLeft  = (i) => i === 0 ? PAD.left : (x(i) + x(i - 1)) / 2;
  const hitRight = (i) => i === n - 1 ? PAD.left + innerW : (x(i) + x(i + 1)) / 2;

  const hItem = hoveredIdx != null ? monthly[hoveredIdx] : null;
  const tooltipW = 114;
  const tooltipLines = hItem ? [
    { text: MONTHS[hoveredIdx], bold: true },
    hItem.temp          != null && { text: `Temp: ${hItem.temp}°C` },
    hItem.humidity      != null && { text: `Humidity: ${hItem.humidity}%` },
    hItem.precipitation != null && { text: `Precip: ${hItem.precipitation}mm` },
    hItem.wind          != null && { text: `Wind: ${hItem.wind} km/h` },
    hItem.uv            != null && { text: `UV index: ${hItem.uv}` },
  ].filter(Boolean) : [];
  const tooltipH = tooltipLines.length * 14 + 12;
  const tooltipX = hoveredIdx != null
    ? (x(hoveredIdx) + 14 + tooltipW < W - PAD.right ? x(hoveredIdx) + 14 : x(hoveredIdx) - tooltipW - 14)
    : 0;

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span className="legend-item legend-temp">— Temperature (°C)</span>
        <span className="legend-item legend-hum">— Humidity (%)</span>
        <span className="legend-item legend-precip">— Precipitation (mm)</span>
        <span className="legend-item legend-ideal-temp">— Ideal temp</span>
        <span className="legend-item legend-ideal-hum">— Ideal humidity</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        <defs>
          <filter id="tt-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
          </filter>
        </defs>

        {SEASON_BANDS.map(({ name, months, fill, labelColor }) =>
          seasonRects(months).map(({ rx, rw, midX, primary }, ri) => (
            <g key={`${name}-${ri}`}>
              <rect x={rx} y={PAD.top} width={rw} height={innerH} fill={fill} opacity="0.55" />
              {primary && (
                <text x={midX} y={PAD.top - 5} textAnchor="middle" fontSize="8.5"
                  fill={labelColor} fontWeight="700"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
                  {name}
                </text>
              )}
            </g>
          ))
        )}

        {tempTicks.map((t) => (
          <text key={t} x={PAD.left - 4} y={yTemp(t) + 3} textAnchor="end" fontSize="8" fill="#9ca3af"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
            {t}°
          </text>
        ))}

        {precipTicks.map((p) => {
          const gy = yPrecip(p);
          return (
            <text key={p} x={W - PAD.right + 4} y={gy + 3} textAnchor="start" fontSize="8" fill="#7c3aed"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
              {p}
            </text>
          );
        })}

        <line
          x1={PAD.left} y1={idealTempY} x2={W - PAD.right} y2={idealTempY}
          stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.5"
        />
        <line
          x1={PAD.left} y1={idealHumY} x2={W - PAD.right} y2={idealHumY}
          stroke="#0369a1" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.45"
        />

        <path d={precipPath} fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={humPath}    fill="none" stroke="#0369a1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={tempPath}   fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {monthly.map((_, i) => (
          <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize="9.5"
            fill={hoveredIdx === i ? '#0f1f0f' : '#5a7060'}
            fontWeight={hoveredIdx === i ? 700 : 400}
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          >
            {MONTHS[i]}
          </text>
        ))}

        {hItem && (
          <g style={{ pointerEvents: 'none' }}>
            <line
              x1={x(hoveredIdx)} y1={PAD.top}
              x2={x(hoveredIdx)} y2={PAD.top + innerH}
              stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 2"
            />
            {hItem.temp != null && (
              <circle cx={x(hoveredIdx)} cy={yTemp(hItem.temp)} r="3.5"
                fill="#f97316" stroke="white" strokeWidth="1.5" />
            )}
            {hItem.humidity != null && (
              <circle cx={x(hoveredIdx)} cy={yHum(hItem.humidity)} r="3"
                fill="#0369a1" stroke="white" strokeWidth="1.5" />
            )}
            {hItem.precipitation != null && (
              <circle cx={x(hoveredIdx)} cy={yPrecip(hItem.precipitation)} r="3"
                fill="#7c3aed" stroke="white" strokeWidth="1.5" />
            )}
            <rect x={tooltipX} y={PAD.top + 4} width={tooltipW} height={tooltipH}
              fill="white" stroke="#d1d5db" rx="4" filter="url(#tt-shadow)" />
            {tooltipLines.map((line, li) => (
              <text key={li}
                x={tooltipX + 8} y={PAD.top + 14 + li * 14}
                fontSize="9.5"
                fill={li === 0 ? '#0f1f0f' : '#5a7060'}
                fontWeight={li === 0 ? 700 : 400}
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              >
                {line.text}
              </text>
            ))}
          </g>
        )}

        {monthly.map((_, i) => (
          <rect key={i}
            x={hitLeft(i)} y={PAD.top}
            width={hitRight(i) - hitLeft(i)} height={innerH}
            fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        ))}
      </svg>
    </div>
  );
}

// ── Score Page ────────────────────────────────────────────────────────────────

function Score() {
  const { country_code } = useParams();
  const { prefs }                   = useContext(PrefsContext);
  const [result, setResult]         = useState(null);
  const [monthly, setMonthly]       = useState(null);
  const [seasonal, setSeasonal]     = useState(null);
  const [rawRanking, setRawRanking] = useState([]);
  const [geo, setGeo]               = useState(null);
  const [geoError, setGeoError]     = useState(null);
  const [error, setError]           = useState(null);

  useEffect(() => {
    const code = encodeURIComponent(country_code);
    Promise.all([
      apiCallGet(`score?country_code=${code}`),
      apiCallGet(`score/monthly?country_code=${code}`),
      apiCallGet(`score/seasonal?country_code=${code}`),
      apiCallGet('score/ranking'),
    ])
      .then(([score, mon, seas, ranking]) => {
        setResult(score);
        setMonthly(mon.monthly);
        setSeasonal(seas.seasonal);
        setRawRanking(ranking.results ?? ranking);
      })
      .catch((err) => setError(err.message));

    // Geopolitical fetch is independent — CORE5 failure won't break the page
    apiCallGet(`score/geopolitical?country_code=${code}`)
      .then(setGeo)
      .catch((err) => setGeoError(err.message));
  }, [country_code]);

  const computed = useMemo(
    () => result ? computeLiveability(result, prefs) : null,
    [result, prefs],
  );

  const computedSeasons = useMemo(() => {
    if (!seasonal) return null;
    const ORDER = ['spring', 'summer', 'autumn', 'winter'];
    const META  = {
      spring: { label: 'Spring', bg: '#bbf7d0', color: '#14532d' },
      summer: { label: 'Summer', bg: '#fde68a', color: '#78350f' },
      autumn: { label: 'Autumn', bg: '#fed7aa', color: '#7c2d12' },
      winter: { label: 'Winter', bg: '#bfdbfe', color: '#1e3a8a' },
    };
    return ORDER
      .filter((s) => seasonal[s] != null)
      .map((s) => {
        const c = computeLiveability(seasonal[s], prefs) ?? seasonal[s];
        return { key: s, ...META[s], ...c };
      });
  }, [seasonal, prefs]);

  const rank = useMemo(() => {
    if (!rawRanking.length) return null;
    const sorted = rawRanking
      .map((loc) => computeLiveability(loc, prefs))
      .filter(Boolean)
      .sort((a, b) => b.liveability - a.liveability);
    const pos = sorted.findIndex((r) => r.country_code === country_code);
    return pos >= 0 ? pos + 1 : null;
  }, [rawRanking, prefs, country_code]);

  if (error)   return <div className="leaderboard-status error">Error: {error}</div>;
  if (!result) return <div className="leaderboard-status">Loading...</div>;

  const liveability = computed?.liveability   ?? result.liveability;
  const comfort     = computed?.comfort_index ?? result.comfort_index;
  const sc          = scoreClass(liveability);
  const uvClass     = result.uv_risk ? `uv-${result.uv_risk}` : '';

  return (
    <div className="content-section">
      <div className="profile-outer">

        {/* ── Hero card ── */}
        <div className="profile-inner-card">
          <div className="info-row">

            <div className="info-identity">
              <div className="info-flag-name">
                <img src={getFlagUrl(country_code)} alt={country_code}
                  width="48" height="32" className="profile-flag" />
                <div>
                  <h1 className="info-country">{result.country}</h1>
                  <span className="info-meta">
                    {result.capital}
                    {result.latitude != null && ` · ${result.latitude}°, ${result.longitude}°`}
                  </span>
                </div>
              </div>
              {rank != null && (
                <div className="info-rank">
                  <span className="info-rank-num">#{rank}</span>
                  <span className="info-rank-label">Global Rank</span>
                </div>
              )}
            </div>

            <div className="info-vdivider" />

            <div className="info-live">
              <div className={`info-live-score ${sc}`}>{liveability?.toFixed(1) ?? '—'}</div>
              <div className="info-live-label">Liveability</div>
            </div>

            <div className="info-vdivider" />

            <div className="info-rest">
              {[
                { label: 'Comfort',       value: comfort?.toFixed(1) ?? '—' },
                { label: 'UV Risk',       value: result.uv_risk?.replace(/_/g, ' ') ?? '—', cls: uvClass },
                { label: 'Avg Temp',      value: result.temperature_mean   != null ? `${result.temperature_mean}°C`   : '—' },
                { label: 'Humidity',      value: result.humidity_mean      != null ? `${result.humidity_mean}%`       : '—' },
                { label: 'Precipitation', value: result.precipitation_mean != null ? `${result.precipitation_mean}mm` : '—' },
                { label: 'Wind Speed',    value: result.wind_speed_mean    != null ? `${result.wind_speed_mean}km/h`  : '—' },
              ].map((s) => (
                <div key={s.label} className="info-stat">
                  <div className="info-stat-label">{s.label}</div>
                  <div className={`info-stat-value${s.cls ? ` ${s.cls}` : ''}`}>{s.value}</div>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Quality of Life breakdown ── */}
        <div className="profile-inner-card">
          <div className="qol-section">
            <div className="qol-header">
              <div className="qol-header-left">
                <h2 className="qol-title">Quality of Life</h2>
                <span className="qol-subtitle">HDI & supplementary indicators</span>
              </div>
              <div className="qol-header-scores">
                <div className="qol-header-pill">
                  <span className="qol-pill-label">Climate</span>
                  <span className={`qol-pill-value ${scoreClass(computed?.climate_score)}`}>
                    {computed?.climate_score?.toFixed(1) ?? '—'}
                  </span>
                </div>
                <div className="qol-header-pill">
                  <span className="qol-pill-label">QoL</span>
                  <span className={`qol-pill-value ${scoreClass(computed?.qol_score)}`}>
                    {computed?.qol_score?.toFixed(1) ?? '—'}
                  </span>
                </div>
              </div>
            </div>

            {countQolIndicators(result) < 3 && (
              <div className="qol-data-warning">
                <span className="qol-warn-icon">⚠️</span>
                <span>
                  <strong>Partial data</strong> — only {countQolIndicators(result)} of 5 QoL indicators are
                  available for this country. The QoL score may not be representative.
                </span>
              </div>
            )}

            <div className="qol-grid">
              {[
                { label: 'HDI Index',     value: result.hdi,            fmt: (v) => v?.toFixed(3) ?? '—',                                   score: result.hdi_score,           color: '#2563eb' },
                { label: 'Safety',        value: result.homicide_rate,  fmt: (v) => v != null ? `${v.toFixed(1)} / 100k` : '—',             score: result.safety_score,        color: '#059669' },
                { label: 'Internet',      value: result.internet_users, fmt: (v) => v != null ? `${v.toFixed(1)}%` : '—',                   score: result.internet_score,      color: '#7c3aed' },
                { label: 'Sanitation',    value: result.sanitation_pct, fmt: (v) => v != null ? `${v.toFixed(1)}%` : '—',                   score: result.sanitation_score,    color: '#0891b2' },
                { label: 'Mental Health', value: result.suicide_rate,   fmt: (v) => v != null ? `${v.toFixed(1)} / 100k` : '—',             score: result.mental_health_score, color: '#db2777' },
                { label: 'Affordability', value: result.hfce_per_capita,fmt: (v) => v != null ? `$${Math.round(v).toLocaleString()}` : '—', score: result.affordability_score, color: '#b45309' },
              ].map((ind) => (
                <div key={ind.label} className="qol-tile">
                  <div className="qol-tile-bar" style={{ background: ind.color }} />
                  <div className="qol-tile-body">
                    <div className="qol-tile-label">{ind.label}</div>
                    <div className="qol-tile-value">{ind.fmt(ind.value)}</div>
                    <div className="qol-tile-score-row">
                      <div className="qol-tile-score-track">
                        <div
                          className="qol-tile-score-fill"
                          style={{
                            width: `${ind.score != null ? ind.score : 0}%`,
                            background: ind.color,
                          }}
                        />
                      </div>
                      <span className="qol-tile-score-num" style={{ color: ind.color }}>
                        {ind.score != null ? ind.score.toFixed(0) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Geopolitical Risk ── */}
        {geo
          ? <GeopoliticalCard geo={geo} />
          : geoError
            ? (
              <div className="profile-inner-card">
                <div className="geo-section">
                  <div className="geo-header">
                    <div className="geo-header-left">
                      <h2 className="qol-title">Geopolitical Risk</h2>
                      <span className="qol-subtitle">Powered by CORE5 · GDELT data</span>
                    </div>
                  </div>
                  <div className="qol-data-warning">
                    <span className="qol-warn-icon">⚠️</span>
                    <span><strong>Geopolitical data unavailable</strong> — {geoError}</span>
                  </div>
                </div>
              </div>
            )
            : (
              <div className="profile-inner-card">
                <div className="geo-section">
                  <div className="geo-header">
                    <div className="geo-header-left">
                      <h2 className="qol-title">Geopolitical Risk</h2>
                      <span className="qol-subtitle">Loading CORE5 data…</span>
                    </div>
                  </div>
                  <div className="geo-loading-bar">
                    <div className="geo-loading-fill" />
                  </div>
                </div>
              </div>
            )
        }

        {/* ── Seasonal breakdown ── */}
        {computedSeasons && computedSeasons.length > 0 && (
          <div className="profile-inner-card">
            <div className="season-grid">
              {computedSeasons.map((s) => (
                <div key={s.key} className="season-tile" style={{ background: s.bg }}>
                  <div className="season-body">
                    <div className="season-name" style={{ color: s.color }}>{s.label}</div>
                    <div className="season-content">
                      <div className="season-left">
                        <div className="season-score" style={{ color: s.color }}>
                          {s.liveability?.toFixed(1) ?? '—'}
                        </div>
                        <div className="season-score-label" style={{ color: s.color }}>Liveability</div>
                      </div>
                      <div className="season-stats">
                        {[
                          { label: 'Temp',   value: s.temperature_mean   != null ? `${s.temperature_mean}°C`   : '—' },
                          { label: 'Humid',  value: s.humidity_mean      != null ? `${s.humidity_mean}%`       : '—' },
                          { label: 'Precip', value: s.precipitation_mean != null ? `${s.precipitation_mean}mm` : '—' },
                          { label: 'Wind',   value: s.wind_speed_mean    != null ? `${s.wind_speed_mean}km/h`  : '—' },
                        ].map((st) => (
                          <div key={st.label} className="season-stat">
                            <span className="season-stat-label" style={{ color: s.color }}>{st.label}</span>
                            <span className="season-stat-value" style={{ color: s.color }}>{st.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Monthly chart ── */}
        {monthly && monthly.length > 0 && (
          <div className="profile-inner-card chart-inner-card">
            <div className="chart-card-title">Monthly Averages</div>
            <MonthlyChart monthly={monthly} prefs={prefs} latitude={result.latitude} />
          </div>
        )}

      </div>
    </div>
  );
}

export default Score;