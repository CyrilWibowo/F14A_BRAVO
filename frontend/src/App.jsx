import { useContext, useState } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import Score from './components/Score';
import Ranking from './components/Ranking';
import ComparePage from './components/Compare';
import Preferences from './components/Preferences';
import TopBar from './components/TopBar';
import HomePage from './components/Home';
import Dashboard from './components/Dashboard';
import ScrollingCountries from './components/ScrollingCountries';
import { PrefsContext } from './prefsContext';
import { DEFAULT_PREFS, PRESETS } from './scoring';
import './App.css';

function Layout({ prefs, activePreset, onPrefChange, onPreset }) {
  return (
    <>
      <div className="banner">
        <div className="banner-overlay" />
        <TopBar />
      </div>

      <div className="page-body">
        <aside className="sidebar">
          <div className="sidebar-filters">
            <Preferences
              prefs={prefs}
              activePreset={activePreset}
              onChange={onPrefChange}
              onPreset={onPreset}
            />
          </div>
        </aside>

        <div className="main-content">
          <Outlet />
        </div>

        <div className="sidebar-spacer" />
      </div>

      <ScrollingCountries />
    </>
  );
}

function HomeLayout() {
  return (
    <>
      <div className="banner">
        <div className="banner-overlay" />
        <TopBar />
      </div>

      <div className="page-body">
        <div className="sidebar-spacer" />
        <div className="main-content">
          <Outlet />
        </div>
        <div className="sidebar-spacer" />
      </div>

      <ScrollingCountries />
    </>
  );
}

function RankingsPage() {
  const { prefs } = useContext(PrefsContext);
  return (
    <div className="section-card">
      <Ranking prefs={prefs} />
    </div>
  );
}

function DashboardLayout() {
  return (
    <>
      <div className="page-body">
        <div className="main-content" style={{ maxWidth: '100%' }}>
          <Dashboard />
        </div>
      </div>
    </>
  );
}

function App() {
  const [prefs, setPrefs]               = useState(DEFAULT_PREFS);
  const [activePreset, setActivePreset] = useState('temperate');

  const handlePrefChange = (key, value) => {
    setActivePreset(null);
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const handlePreset = (key) => {
    setActivePreset(key);
    setPrefs((p) => ({ ...PRESETS[key], prioritiseAffordability: p.prioritiseAffordability ?? false }));
  };

  return (
    <PrefsContext.Provider value={{ prefs }}>
      <Routes>
        <Route element={<HomeLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>
        <Route element={
          <Layout
            prefs={prefs}
            activePreset={activePreset}
            onPrefChange={handlePrefChange}
            onPreset={handlePreset}
          />
        }>
          <Route path="/ranking"             element={<RankingsPage />} />
          <Route path="/compare"             element={<ComparePage />} />
          <Route path="/dashboard"           element={<DashboardLayout />} />
          <Route path="/score/:country_code" element={<Score />} />
        </Route>
      </Routes>
    </PrefsContext.Provider>
  );
}

export default App;