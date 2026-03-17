import { useContext, useEffect, useMemo, useState } from 'react';
import { apiCallGet } from '../utils';
import { computeLiveability } from '../scoring';
import { PrefsContext } from '../prefsContext';
import './Compare.css';

const getFlagUrl = (code) =>
  `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

const scoreClass = (s) => (s >= 65 ? 'high' : s >= 40 ? 'mid' : 'low');

function CountryPicker({ value, onChange, allCountries, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);

  const filtered = query.length > 0
    ? allCountries
        .filter((c) => c.country.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.country.localeCompare(b.country))
        .slice(0, 3)
    : [];

  if (value) {
    return (
      <div className="cpicker-selected">
        <img src={getFlagUrl(value.country_code)} width="28" height="19" alt="" />
        <span className="cpicker-name">{value.country}</span>
        <button className="cpicker-clear" onClick={() => onChange(null)}>×</button>
      </div>
    );
  }

  return (
    <div className="cpicker-wrap">
      <input
        className="cpicker-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <ul className="cpicker-dropdown">
          {filtered.map((c) => (
            <li
              key={c.country_code}
              className="cpicker-option"
              onMouseDown={() => { onChange(c); setQuery(''); setOpen(false); }}
            >
              <img src={getFlagUrl(c.country_code)} width="20" height="13" alt="" />
              {c.country}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATS = [
  { label: 'Liveability',   get: (r) => r.liveability,         fmt: (v) => v?.toFixed(1) ?? '—',             higherBetter: true  },
  { label: 'Comfort',       get: (r) => r.comfort_index,       fmt: (v) => v?.toFixed(1) ?? '—',             higherBetter: true  },
  { label: 'Avg Temp',      get: (r) => r.temperature_mean,    fmt: (v) => v != null ? `${v}°C`   : '—',     higherBetter: null  },
  { label: 'Humidity',      get: (r) => r.humidity_mean,       fmt: (v) => v != null ? `${v}%`    : '—',     higherBetter: null  },
  { label: 'Precipitation', get: (r) => r.precipitation_mean,  fmt: (v) => v != null ? `${v}mm`   : '—',     higherBetter: false },
  { label: 'Wind Speed',    get: (r) => r.wind_speed_mean,     fmt: (v) => v != null ? `${v}km/h` : '—',     higherBetter: false },
];

function CompareResult({ a, b }) {
  return (
    <div className="compare-result">
      <div className="compare-headers">
        <div className="compare-country-hd">
          <img src={getFlagUrl(a.country_code)} width="44" height="30" alt="" />
          <div className="compare-hd-text">
            <div className="compare-hd-name">{a.country}</div>
            <div className="compare-hd-meta">{a.capital}</div>
          </div>
          <div className={`compare-hd-score ${scoreClass(a.liveability)}`}>
            {a.liveability?.toFixed(1)}
          </div>
        </div>

        <div className="compare-vs-divider">vs</div>

        <div className="compare-country-hd compare-country-hd-right">
          <div className={`compare-hd-score ${scoreClass(b.liveability)}`}>
            {b.liveability?.toFixed(1)}
          </div>
          <div className="compare-hd-text compare-hd-text-right">
            <div className="compare-hd-name">{b.country}</div>
            <div className="compare-hd-meta">{b.capital}</div>
          </div>
          <img src={getFlagUrl(b.country_code)} width="44" height="30" alt="" />
        </div>
      </div>

      <div className="compare-table">
        {STATS.map((stat) => {
          const va = stat.get(a);
          const vb = stat.get(b);
          let winA = false, winB = false;
          if (stat.higherBetter !== null && va != null && vb != null) {
            winA = stat.higherBetter ? va > vb : va < vb;
            winB = stat.higherBetter ? vb > va : vb < va;
          }
          return (
            <div key={stat.label} className="compare-row">
              <div className={`compare-val compare-val-a${winA ? ' win' : winB ? ' lose' : ''}`}>
                {stat.fmt(va)}
              </div>
              <div className="compare-row-label">{stat.label}</div>
              <div className={`compare-val compare-val-b${winB ? ' win' : winA ? ' lose' : ''}`}>
                {stat.fmt(vb)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparePage() {
  const { prefs }                       = useContext(PrefsContext);
  const [allCountries, setAllCountries] = useState([]);
  const [countryA, setCountryA]         = useState(null);
  const [countryB, setCountryB]         = useState(null);

  useEffect(() => {
    apiCallGet('score/ranking')
      .then((data) => setAllCountries(data.results ?? data))
      .catch(() => {});
  }, []);

  const computedA = useMemo(
    () => (countryA ? computeLiveability(countryA, prefs) : null),
    [countryA, prefs],
  );
  const computedB = useMemo(
    () => (countryB ? computeLiveability(countryB, prefs) : null),
    [countryB, prefs],
  );

  return (
    <div className="section-card">
      <div className="compare-pickers">
        <CountryPicker
          value={countryA}
          onChange={setCountryA}
          allCountries={allCountries}
          placeholder="First country…"
        />
        <div className="compare-pickers-vs">vs</div>
        <CountryPicker
          value={countryB}
          onChange={setCountryB}
          allCountries={allCountries}
          placeholder="Second country…"
        />
      </div>

      {computedA && computedB
        ? <CompareResult a={computedA} b={computedB} />
        : (
          <div className="compare-empty">
            {!countryA && !countryB
              ? 'Select two countries to compare'
              : 'Select a second country to compare'}
          </div>
        )
      }
    </div>
  );
}

export default ComparePage;
