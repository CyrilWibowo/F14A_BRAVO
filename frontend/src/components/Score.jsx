import { useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiCallGet } from '../utils';
import { computeLiveability } from '../scoring';
import { PrefsContext } from '../prefsContext';
import './Ranking.css';
import './Score.css';

const getFlagUrl = (code) =>
  `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

const scoreClass = (s) => (s >= 65 ? 'high' : s >= 40 ? 'mid' : 'low');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

  const colLeft  = (i) => i === 0     ? PAD.left            : (x(i - 1) + x(i)) / 2;
  const colRight = (i) => i === n - 1 ? PAD.left + innerW   : (x(i) + x(i + 1)) / 2;

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
        <path d={humPath} fill="none" stroke="#0369a1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={tempPath} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

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

function Score() {
  const { country_code } = useParams();
  const { prefs }                   = useContext(PrefsContext);
  const [result, setResult]         = useState(null);
  const [monthly, setMonthly]       = useState(null);
  const [seasonal, setSeasonal]     = useState(null);
  const [rawRanking, setRawRanking] = useState([]);
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
