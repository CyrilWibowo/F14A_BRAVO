import { useState } from 'react';
import { apiCallGet } from '../utils';

function Seasonal() {
  const [countryCode, setCountryCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      const data = await apiCallGet(`score/seasonal?country_code=${encodeURIComponent(countryCode)}`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Seasonal Breakdown</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Country Code:{' '}
          <input
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            placeholder="e.g. AUS"
            required
          />
        </label>{' '}
        <button type="submit">Get Seasonal</button>
      </form>
      {error && <p>Error: {error}</p>}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

export default Seasonal;
