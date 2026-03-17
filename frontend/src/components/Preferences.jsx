import { PRESETS } from '../scoring';
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

function Preferences({ prefs, activePreset, onChange, onPreset }) {
  return (
    <div className="prefs">
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
    </div>
  );
}

export default Preferences;
