import { useState, useEffect } from 'react';
import { FiSave, FiRefreshCw, FiAlertCircle, FiCheck, FiInbox } from 'react-icons/fi';

const REBATE_SETTINGS_KEY = 'team33_rebate_settings';

const defaultSettings = {
  slotRebate: 0.5,
  liveRebate: 0.3,
  sportsRebate: 0.4,
  minBet: 100,
  maxRebate: 10000
};

const Rebate = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(REBATE_SETTINGS_KEY);
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.error('Error loading rebate settings:', e);
    }
  }, []);

  // Save settings
  const handleSave = () => {
    try {
      localStorage.setItem(REBATE_SETTINGS_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Failed to save settings');
    }
  };

  return (
    <div className="rebate-page">
      <div className="page-header">
        <h1 className="page-title">Rebate Management</h1>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><FiCheck /> Saved!</> : <><FiSave /> Save Settings</>}
        </button>
      </div>

      {/* Notice Banner */}
      <div style={{
        padding: '12px 16px',
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: '#92400e',
        fontSize: '13px'
      }}>
        <FiAlertCircle />
        <span>Rebate calculations require backend API integration. Settings are stored locally.</span>
      </div>

      {/* Rebate Settings */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">Rebate Settings</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Slot Games Rebate (%)</label>
              <input
                type="number"
                className="form-input"
                value={settings.slotRebate}
                onChange={(e) => setSettings({ ...settings, slotRebate: Number(e.target.value) })}
                step="0.1"
                min="0"
                max="100"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Live Casino Rebate (%)</label>
              <input
                type="number"
                className="form-input"
                value={settings.liveRebate}
                onChange={(e) => setSettings({ ...settings, liveRebate: Number(e.target.value) })}
                step="0.1"
                min="0"
                max="100"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sports Rebate (%)</label>
              <input
                type="number"
                className="form-input"
                value={settings.sportsRebate}
                onChange={(e) => setSettings({ ...settings, sportsRebate: Number(e.target.value) })}
                step="0.1"
                min="0"
                max="100"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Bet ($)</label>
              <input
                type="number"
                className="form-input"
                value={settings.minBet}
                onChange={(e) => setSettings({ ...settings, minBet: Number(e.target.value) })}
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Rebate per Day ($)</label>
              <input
                type="number"
                className="form-input"
                value={settings.maxRebate}
                onChange={(e) => setSettings({ ...settings, maxRebate: Number(e.target.value) })}
                min="0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rebate History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Rebate History</h3>
          <button className="btn btn-secondary btn-sm" disabled>
            <FiRefreshCw /> Refresh
          </button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Game Type</th>
                <th>Turnover</th>
                <th>Rebate</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Rebate history will appear here when backend API is connected</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Rebate;
