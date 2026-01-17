import { useState, useEffect } from 'react';
import { FiSave, FiPercent, FiDollarSign, FiAlertCircle, FiCheck, FiInbox } from 'react-icons/fi';

const COMMISSION_SETTINGS_KEY = 'team33_commission_settings';

const defaultSettings = {
  level1: 5,
  level2: 3,
  level3: 1,
  minPayout: 50,
  payoutDay: 'Monday'
};

const Commission = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COMMISSION_SETTINGS_KEY);
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.error('Error loading commission settings:', e);
    }
  }, []);

  // Save settings
  const handleSave = () => {
    try {
      localStorage.setItem(COMMISSION_SETTINGS_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Failed to save settings');
    }
  };

  return (
    <div className="commission-page">
      <div className="page-header">
        <h1 className="page-title">Commission Settings</h1>
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
        <span>Commission calculations require backend API integration. Settings are stored locally.</span>
      </div>

      {/* Commission Rate Settings */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">Commission Rates</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">
                <FiPercent style={{ marginRight: '5px' }} />
                Level 1 Commission (%)
              </label>
              <input
                type="number"
                className="form-input"
                value={settings.level1}
                onChange={(e) => setSettings({ ...settings, level1: Number(e.target.value) })}
                step="0.5"
                min="0"
                max="100"
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>Direct referral commission</small>
            </div>
            <div className="form-group">
              <label className="form-label">
                <FiPercent style={{ marginRight: '5px' }} />
                Level 2 Commission (%)
              </label>
              <input
                type="number"
                className="form-input"
                value={settings.level2}
                onChange={(e) => setSettings({ ...settings, level2: Number(e.target.value) })}
                step="0.5"
                min="0"
                max="100"
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>2nd level referral</small>
            </div>
            <div className="form-group">
              <label className="form-label">
                <FiPercent style={{ marginRight: '5px' }} />
                Level 3 Commission (%)
              </label>
              <input
                type="number"
                className="form-input"
                value={settings.level3}
                onChange={(e) => setSettings({ ...settings, level3: Number(e.target.value) })}
                step="0.5"
                min="0"
                max="100"
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>3rd level referral</small>
            </div>
            <div className="form-group">
              <label className="form-label">
                <FiDollarSign style={{ marginRight: '5px' }} />
                Minimum Payout ($)
              </label>
              <input
                type="number"
                className="form-input"
                value={settings.minPayout}
                onChange={(e) => setSettings({ ...settings, minPayout: Number(e.target.value) })}
                min="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payout Day</label>
              <select
                className="form-select"
                value={settings.payoutDay}
                onChange={(e) => setSettings({ ...settings, payoutDay: e.target.value })}
              >
                <option>Monday</option>
                <option>Tuesday</option>
                <option>Wednesday</option>
                <option>Thursday</option>
                <option>Friday</option>
                <option>Saturday</option>
                <option>Sunday</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Commission History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Commission History</h3>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Agent</th>
                <th>Level</th>
                <th>From User</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Commission history will appear here when backend API is connected</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Commission;
