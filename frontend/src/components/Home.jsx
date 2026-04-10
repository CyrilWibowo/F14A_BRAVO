import { useNavigate } from 'react-router-dom';
import './Home.css';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="section-card home-page">

      {/* hero */}
      <div className="home-hero">
        <div className="home-hero-bg">
          <div className="home-hero-orb home-hero-orb-1" />
          <div className="home-hero-orb home-hero-orb-2" />
          <div className="home-hero-grid" />
        </div>
        <div className="home-hero-content">
          <div className="home-eyebrow">
            <span className="home-eyebrow-dot" />
            Climate Intelligence Platform
          </div>
          <h1 className="home-title">
            Find your own<br />
            <span className="home-title-accent">perfect world.</span>
          </h1>
          <p className="home-desc">
            Liveability scores for 180+ countries, built on real climate data
            and shaped entirely around your personal preferences.
          </p>
          <div className="home-actions">
            <button className="home-btn-primary" onClick={() => navigate('/ranking')}>
              Explore Rankings
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 6.5h8M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="home-btn-secondary" onClick={() => navigate('/compare')}>
              Compare Countries
            </button>
          </div>
        </div>

        {/* stat cards */}
        <div className="home-hero-stats">
          <div className="home-hero-stat">
            <span className="home-hero-stat-num">180+</span>
            <span className="home-hero-stat-label">Countries</span>
          </div>
          <div className="home-hero-stat">
            <span className="home-hero-stat-num">12</span>
            <span className="home-hero-stat-label">Variables</span>
          </div>
          <div className="home-hero-stat">
            <span className="home-hero-stat-num">4</span>
            <span className="home-hero-stat-label">Seasons</span>
          </div>
        </div>
      </div>

      {/* features grid */}
      <div className="home-features">
        <div className="home-feature-card home-feature-card--wide">
          <div className="home-feature-card-top">
            <div className="home-feature-tag">Rankings</div>
            <div className="home-feature-card-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="10" width="3" height="8" rx="1" fill="currentColor" opacity="0.4"/>
                <rect x="7" y="6" width="3" height="12" rx="1" fill="currentColor" opacity="0.65"/>
                <rect x="12" y="2" width="3" height="16" rx="1" fill="currentColor"/>
                <path d="M17 5l-3-3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="home-feature-card-title">Global Rankings</div>
          <div className="home-feature-card-desc">
            Every country ranked by liveability score. Adjust your preferences in the sidebar and the entire ranking recalculates instantly, tailored to you.
          </div>
        </div>

        <div className="home-feature-card">
          <div className="home-feature-card-top">
            <div className="home-feature-tag">Compare</div>
            <div className="home-feature-card-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="4" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <rect x="11" y="4" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M9 10h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div className="home-feature-card-title">Side-by-Side Compare</div>
          <div className="home-feature-card-desc">
            Pick any two countries and compare temperature, humidity, UV risk, precipitation and liveability head-to-head.
          </div>
        </div>

        <div className="home-feature-card">
          <div className="home-feature-card-top">
            <div className="home-feature-tag">Seasonal</div>
            <div className="home-feature-card-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M10 2.5V10l4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="home-feature-card-title">Your preferences,<br/>your ranking.</div>
          <div className="home-feature-card-desc">
            Set your ideal temperature, humidity, UV sensitivity, wind tolerance and precipitation preference. The sidebar updates every score in real time.
          </div>
        </div>
      </div>

    </div>
  );
}

export default HomePage;