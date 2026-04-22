import { useEffect, useRef, useState } from 'react';
import { PRESETS } from '../scoring';
import { apiCallGet } from '../utils';
import './Preferences.css';

const SegControl = ({ value, onChange, options }) => (
  <div className="seg-control">
    {options.map(({ value: v, label }) => (
      <button key={v} className={`seg-btn ${value === v ? 'active' : ''}`} onClick={() => onChange(v)}>
        {label}
      </button>
    ))}
  </div>
);

const statsToPrefs = (loc) => {
  const out = {};
  if (loc.temperature_mean != null)
    out.idealTemp = Math.round(Math.max(0, Math.min(40, loc.temperature_mean)));
  if (loc.humidity_mean != null)
    out.idealHumidity = Math.round(Math.max(10, Math.min(90, loc.humidity_mean)) / 5) * 5;
  if (loc.uv_index_mean != null)
    out.uvSensitivity = loc.uv_index_mean >= 7 ? 'tolerant' : loc.uv_index_mean >= 4 ? 'moderate' : 'sensitive';
  if (loc.precipitation_mean != null)
    out.precipitation = loc.precipitation_mean <= 1 ? 'dry' : loc.precipitation_mean <= 4 ? 'moderate' : 'wet';
  if (loc.wind_speed_mean != null)
    out.windTolerance = loc.wind_speed_mean <= 8 ? 'low' : loc.wind_speed_mean <= 15 ? 'moderate' : 'high';
  return out;
};

function CountrySearch({ onSelect }) {
  const [query, setQuery]       = useState('');
  const [countries, setCountries] = useState([]);
  const [open, setOpen]         = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    apiCallGet('score/ranking')
      .then((data) => {
        const list = data.results ?? data;
        setCountries([...list].sort((a, b) => a.country.localeCompare(b.country)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = query.length >= 1
    ? countries.filter((c) => c.country.toLowerCase().includes(query.toLowerCase())).slice(0, 7)
    : [];

  const handleSelect = (loc) => {
    onSelect(loc);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="country-search" ref={ref}>
      <div className="country-search-wrap">
        <span className="country-search-icon">&#x2315;</span>
        <input
          className="country-search-input"
          placeholder="Match a country's climate…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 1 && setOpen(true)}
        />
        {query && (
          <button className="country-search-clear" onClick={() => { setQuery(''); setOpen(false); }}>×</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="country-search-dropdown">
          {filtered.map((loc) => (
            <button key={loc.country_code} className="country-search-item" onMouseDown={() => handleSelect(loc)}>
              <img
                src={`https://flagcdn.com/w20/${loc.country_code.toLowerCase()}.png`}
                alt=""
                className="country-search-flag"
              />
              <span className="country-search-name">{loc.country}</span>
              {loc.temperature_mean != null && (
                <span className="country-search-temp">{loc.temperature_mean}°C</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Preferences({ prefs, activePreset, onChange, onBulkChange, onPreset }) {
  return (
    <div className="prefs">
      <CountrySearch onSelect={(loc) => onBulkChange(statsToPrefs(loc))} />

      <div className="prefs-presets">
        <span className="prefs-presets-label">Presets</span>
        <div className="prefs-preset-btns">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button key={key} className={`preset-btn ${activePreset === key ? 'active' : ''}`} onClick={() => onPreset(key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="prefs-divider" />

      <div className="prefs-controls">
        <div className="pref-field">
          <span className="pref-label">Ideal Temp</span>
          <div className="pref-slider-row">
            <input
              type="range" min={0} max={40} step={1}
              value={prefs.idealTemp}
              onChange={(e) => onChange('idealTemp', Number(e.target.value))}
              className="pref-slider"
            />
            <span className="pref-slider-val">{prefs.idealTemp}°C</span>
          </div>
        </div>

        <div className="pref-field">
          <span className="pref-label">Ideal Humidity</span>
          <div className="pref-slider-row">
            <input
              type="range" min={10} max={90} step={5}
              value={prefs.idealHumidity}
              onChange={(e) => onChange('idealHumidity', Number(e.target.value))}
              className="pref-slider"
            />
            <span className="pref-slider-val">{prefs.idealHumidity}%</span>
          </div>
        </div>

        <div className="pref-field">
          <span className="pref-label">UV Sensitivity</span>
          <SegControl
            value={prefs.uvSensitivity}
            onChange={(v) => onChange('uvSensitivity', v)}
            options={[{ value: 'tolerant', label: 'Low' }, { value: 'moderate', label: 'Med' }, { value: 'sensitive', label: 'High' }]}
          />
        </div>

        <div className="pref-field">
          <span className="pref-label">Precipitation</span>
          <SegControl
            value={prefs.precipitation}
            onChange={(v) => onChange('precipitation', v)}
            options={[{ value: 'dry', label: 'Dry' }, { value: 'moderate', label: 'Mod' }, { value: 'wet', label: 'Wet' }]}
          />
        </div>

        <div className="pref-field">
          <span className="pref-label">Wind Tolerance</span>
          <SegControl
            value={prefs.windTolerance}
            onChange={(v) => onChange('windTolerance', v)}
            options={[{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Med' }, { value: 'high', label: 'High' }]}
          />
        </div>
      </div>

      <div className="prefs-divider" />

      <div className="prefs-controls">
        <div className="pref-field">
          <span className="pref-label">Climate vs QoL Weight</span>
          <input
            type="range" min={0} max={100} step={5}
            value={(prefs.climateWeight ?? 0.5) * 100}
            onChange={(e) => onChange('climateWeight', Number(e.target.value) / 100)}
            className="pref-slider weight-slider"
            style={{ '--climate-pct': `${Math.round((prefs.climateWeight ?? 0.5) * 100)}%` }}
          />
          <div className="pref-weight-labels-row">
            <span className="pref-weight-label-left">
              <span className="pref-weight-pct">{Math.round((prefs.climateWeight ?? 0.5) * 100)}%</span>
              {' '}<span className="pref-weight-name">Climate</span>
            </span>
            <span className="pref-weight-label-right">
              <span className="pref-weight-name">QoL</span>
              {' '}<span className="pref-weight-pct">{Math.round((1 - (prefs.climateWeight ?? 0.5)) * 100)}%</span>
            </span>
          </div>
        </div>

        <div className="pref-field">
          <div className="pref-toggle-row">
            <div className="pref-toggle-text">
              <span className="pref-label">Prioritise Affordability</span>
              <span className="pref-toggle-sub">Blends cost-of-living into ranking (30%)</span>
            </div>
            <label className="pref-toggle-switch">
              <input
                type="checkbox"
                checked={prefs.prioritiseAffordability ?? false}
                onChange={(e) => onChange('prioritiseAffordability', e.target.checked)}
              />
              <span className="pref-toggle-thumb" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Preferences;
