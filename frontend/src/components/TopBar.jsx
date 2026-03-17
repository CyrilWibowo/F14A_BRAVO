import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiCallGet } from '../utils';

const getFlagUrl = (code) =>
  `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

function CountrySearch() {
  const [query, setQuery]         = useState('');
  const [countries, setCountries] = useState([]);
  const [open, setOpen]           = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiCallGet('score/ranking')
      .then((data) => setCountries(data.results ?? data))
      .catch(() => {});
  }, []);

  const filtered = query.length > 0
    ? countries
        .filter((c) => c.country.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.country.localeCompare(b.country))
        .slice(0, 3)
    : [];

  return (
    <div className="search-wrap">
      <input
        className="search-input"
        placeholder="Search countries…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <ul className="search-dropdown">
          {filtered.map((c) => (
            <li
              key={c.country_code}
              className="search-option"
              onMouseDown={() => {
                navigate(`/score/${c.country_code}`);
                setQuery('');
                setOpen(false);
              }}
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

function TopBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="top-bar-outer">
      <div className="top-bar-ph" />
      <div className="top-bar">
        <div className="top-bar-nav">
          <button
            className={`top-bar-btn${pathname === '/' ? ' active' : ''}`}
            onClick={() => navigate('/')}
          >
            Rankings
          </button>
          <button
            className={`top-bar-btn${pathname === '/compare' ? ' active' : ''}`}
            onClick={() => navigate('/compare')}
          >
            Compare
          </button>
        </div>
        <CountrySearch />
      </div>
      <div className="top-bar-ph" />
    </div>
  );
}

export default TopBar;
