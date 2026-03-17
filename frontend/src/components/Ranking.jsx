import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiCallGet } from '../utils';
import { computeLiveability } from '../scoring';
import './Ranking.css';

const getFlagUrl = (code) =>
  `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

const scoreClass = (s) => (s >= 65 ? 'high' : s >= 40 ? 'mid' : 'low');
const rankClass  = (i) => (i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '');

function Ranking({ prefs }) {
  const [raw, setRaw]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    apiCallGet('score/ranking')
      .then((data) => setRaw(data.results))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    return raw
      .map((loc) => computeLiveability(loc, prefs))
      .filter(Boolean)
      .sort((a, b) => b.liveability - a.liveability);
  }, [raw, prefs]);

  if (loading) return <div className="leaderboard-status">Loading...</div>;
  if (error)   return <div className="leaderboard-status error">Error: {error}</div>;

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-table">
        <div className="table-row table-header">
          <div className="col left" />
          <div className="col left" />
          <div className="col left" />
          <div className="col" style={{ color: 'var(--score-high)', fontWeight: 700 }}>Score</div>
          <div className="col">Comfort</div>
          <div className="col">UV Risk</div>
          <div className="col">Temp</div>
          <div className="col">Humidity</div>
          <div className="col">Precip</div>
          <div className="col">Wind</div>
        </div>

        {results.map((loc, i) => {
          const rc = rankClass(i);
          const sc = scoreClass(loc.liveability);
          const uvClass = loc.uv_risk ? `uv-${loc.uv_risk}` : '';
          return (
            <Link key={loc.country_code} to={`/score/${loc.country_code}`} className={`table-row table-data ${rc}`}>
              <div className={`col left col-rank ${rc}`}>{i + 1}</div>
              <div className="col left col-flag">
                <img src={getFlagUrl(loc.country_code)} alt={loc.country_code} width="32" height="21" />
              </div>
              <div className="col left col-country">{loc.country}</div>
              <div className={`col col-score ${sc}`}>{loc.liveability != null ? loc.liveability.toFixed(1) : '—'}</div>
              <div className="col">{loc.comfort_index != null ? loc.comfort_index.toFixed(1) : '—'}</div>
              <div className={`col ${uvClass}`}>{loc.uv_risk ? loc.uv_risk.replace('_', ' ') : '—'}</div>
              <div className="col">{loc.temperature_mean != null ? `${loc.temperature_mean}°C` : '—'}</div>
              <div className="col">{loc.humidity_mean != null ? `${loc.humidity_mean}%` : '—'}</div>
              <div className="col">{loc.precipitation_mean != null ? `${loc.precipitation_mean}mm` : '—'}</div>
              <div className="col">{loc.wind_speed_mean != null ? `${loc.wind_speed_mean}km/h` : '—'}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default Ranking;
