import { useState, useEffect } from 'react';
import { FiSave, FiDroplet, FiSun, FiMoon, FiRefreshCw, FiCheck } from 'react-icons/fi';

const THEME_KEY = 'team33_theme_settings';

const defaultTheme = {
  primaryColor: '#d4af37',
  secondaryColor: '#1a1a2e',
  accentColor: '#e91e7a',
  backgroundColor: '#16162a',
  cardColor: '#252545',
  textColor: '#ffffff',
  darkMode: true
};

const Theme = () => {
  const [theme, setTheme] = useState(defaultTheme);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored) setTheme({ ...defaultTheme, ...JSON.parse(stored) });
    } catch (e) {
      console.error('Error loading theme:', e);
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(theme));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Failed to save theme');
    }
  };

  const handleReset = () => {
    setTheme(defaultTheme);
    localStorage.removeItem(THEME_KEY);
  };

  const presetThemes = [
    { name: 'Gold & Dark', primary: '#d4af37', secondary: '#1a1a2e', accent: '#e91e7a' },
    { name: 'Blue Ocean', primary: '#3b82f6', secondary: '#1e3a5f', accent: '#22d3ee' },
    { name: 'Green Forest', primary: '#22c55e', secondary: '#14532d', accent: '#84cc16' },
    { name: 'Purple Night', primary: '#8b5cf6', secondary: '#2e1065', accent: '#ec4899' },
    { name: 'Red Fire', primary: '#ef4444', secondary: '#450a0a', accent: '#f97316' },
    { name: 'Classic Black', primary: '#f59e0b', secondary: '#18181b', accent: '#fbbf24' },
  ];

  const applyPreset = (preset) => {
    setTheme({
      ...theme,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent
    });
  };

  return (
    <div className="theme-page">
      <div className="page-header">
        <h1 className="page-title">Theme Settings</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handleReset}>
            <FiRefreshCw /> Reset to Default
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? <><FiCheck /> Saved!</> : <><FiSave /> Apply Theme</>}
          </button>
        </div>
      </div>

      {/* Theme Mode Toggle */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">Theme Mode</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '15px' }}>
            <button
              className={`btn ${theme.darkMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTheme({ ...theme, darkMode: true })}
              style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
            >
              <FiMoon size={24} />
              <span>Dark Mode</span>
            </button>
            <button
              className={`btn ${!theme.darkMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTheme({ ...theme, darkMode: false })}
              style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
            >
              <FiSun size={24} />
              <span>Light Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preset Themes */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">Preset Themes</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
            {presetThemes.map((preset, index) => (
              <button
                key={index}
                onClick={() => applyPreset(preset)}
                style={{
                  padding: '15px',
                  borderRadius: '12px',
                  border: theme.primaryColor === preset.primary ? `2px solid ${preset.primary}` : '2px solid transparent',
                  background: preset.secondary,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', justifyContent: 'center' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: preset.primary }} />
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: preset.accent }} />
                </div>
                <p style={{ color: '#fff', fontSize: '12px', fontWeight: 500, textAlign: 'center', margin: 0 }}>{preset.name}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Colors */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <FiDroplet style={{ marginRight: '10px' }} />
            Custom Colors
          </h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Primary Color</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                  style={{ width: '50px', height: '40px', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Secondary Color</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="color"
                  value={theme.secondaryColor}
                  onChange={(e) => setTheme({ ...theme, secondaryColor: e.target.value })}
                  style={{ width: '50px', height: '40px', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={theme.secondaryColor}
                  onChange={(e) => setTheme({ ...theme, secondaryColor: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Accent Color</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="color"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                  style={{ width: '50px', height: '40px', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Background Color</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="color"
                  value={theme.backgroundColor}
                  onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })}
                  style={{ width: '50px', height: '40px', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={theme.backgroundColor}
                  onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Live Preview</h3>
        </div>
        <div className="card-body">
          <div style={{
            background: theme.secondaryColor,
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ background: theme.primaryColor, padding: '10px 20px', borderRadius: '8px', color: theme.secondaryColor, fontWeight: 600 }}>
                Primary Button
              </div>
              <div style={{ background: theme.accentColor, padding: '10px 20px', borderRadius: '8px', color: '#fff', fontWeight: 600 }}>
                Accent Button
              </div>
            </div>
            <div style={{ color: theme.textColor }}>
              <h4 style={{ marginBottom: '5px' }}>Sample Text</h4>
              <p style={{ opacity: 0.7, margin: 0 }}>This is how your text will appear with the current theme settings.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ background: theme.primaryColor + '20', color: theme.primaryColor, padding: '5px 10px', borderRadius: '20px', fontSize: '12px' }}>Badge 1</span>
              <span style={{ background: theme.accentColor + '20', color: theme.accentColor, padding: '5px 10px', borderRadius: '20px', fontSize: '12px' }}>Badge 2</span>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <div style={{
        marginTop: '20px',
        padding: '15px 20px',
        background: '#fef3c7',
        borderRadius: '8px',
        border: '1px solid #fcd34d',
        color: '#92400e',
        fontSize: '14px'
      }}>
        <strong>Note:</strong> Theme settings are stored locally. Backend API integration required for these settings to affect the live site.
      </div>
    </div>
  );
};

export default Theme;
