import { useState, useEffect } from 'react';
import { FiSave, FiGlobe, FiDollarSign, FiClock, FiShield, FiMail, FiAlertCircle, FiCheck } from 'react-icons/fi';

const SETTINGS_KEY = 'team33_admin_settings';

const defaultSettings = {
  siteName: 'Team33',
  siteUrl: 'https://team33.mx',
  currency: 'AUD',
  timezone: 'Australia/Sydney',
  minDeposit: 10,
  maxDeposit: 50000,
  minWithdraw: 20,
  maxWithdraw: 10000,
  withdrawFee: 0,
  dailyWithdrawLimit: 50000,
  supportEmail: 'support@team33.mx',
  supportPhone: '+61 400 000 000',
  maintenanceMode: false
};

const Setting = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }, []);

  // Save settings
  const handleSave = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Failed to save settings');
    }
  };

  return (
    <div className="setting-page">
      <div className="page-header">
        <h1 className="page-title">System Settings</h1>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><FiCheck /> Saved!</> : <><FiSave /> Save Changes</>}
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
        <span>Settings are stored locally. Backend API integration required for production use.</span>
      </div>

      {/* General Settings */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <FiGlobe style={{ marginRight: '10px' }} />
            General Settings
          </h3>
        </div>
        <div className="card-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Site Name</label>
              <input
                type="text"
                className="form-input"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Site URL</label>
              <input
                type="text"
                className="form-input"
                value={settings.siteUrl}
                onChange={(e) => setSettings({ ...settings, siteUrl: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select
                className="form-select"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              >
                <option value="AUD">Australian Dollar ($)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="EUR">Euro (€)</option>
                <option value="GBP">British Pound (£)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                <FiClock style={{ marginRight: '5px' }} />
                Timezone
              </label>
              <select
                className="form-select"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              >
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                <option value="Australia/Melbourne">Australia/Melbourne (AEST)</option>
                <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                <option value="Australia/Perth">Australia/Perth (AWST)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Settings */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <FiDollarSign style={{ marginRight: '10px' }} />
            Financial Settings
          </h3>
        </div>
        <div className="card-body">
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Minimum Deposit ($)</label>
              <input
                type="number"
                className="form-input"
                value={settings.minDeposit}
                onChange={(e) => setSettings({ ...settings, minDeposit: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Maximum Deposit ($)</label>
              <input
                type="number"
                className="form-input"
                value={settings.maxDeposit}
                onChange={(e) => setSettings({ ...settings, maxDeposit: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Withdrawal ($)</label>
              <input
                type="number"
                className="form-input"
                value={settings.minWithdraw}
                onChange={(e) => setSettings({ ...settings, minWithdraw: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Maximum Withdrawal ($)</label>
              <input
                type="number"
                className="form-input"
                value={settings.maxWithdraw}
                onChange={(e) => setSettings({ ...settings, maxWithdraw: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Withdrawal Fee ($)</label>
              <input
                type="number"
                className="form-input"
                value={settings.withdrawFee}
                onChange={(e) => setSettings({ ...settings, withdrawFee: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Daily Withdrawal Limit ($)</label>
              <input
                type="number"
                className="form-input"
                value={settings.dailyWithdrawLimit}
                onChange={(e) => setSettings({ ...settings, dailyWithdrawLimit: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact Settings */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <FiMail style={{ marginRight: '10px' }} />
            Contact Information
          </h3>
        </div>
        <div className="card-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Support Email</label>
              <input
                type="email"
                className="form-input"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Support Phone</label>
              <input
                type="text"
                className="form-input"
                value={settings.supportPhone}
                onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <FiShield style={{ marginRight: '10px' }} />
            Security Settings
          </h3>
        </div>
        <div className="card-body">
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Maintenance Mode</label>
              <select
                className="form-select"
                value={settings.maintenanceMode ? 'on' : 'off'}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.value === 'on' })}
              >
                <option value="off">Off - Site Active</option>
                <option value="on">On - Maintenance Mode</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Two-Factor Auth (Staff)</label>
              <select className="form-select" defaultValue="required">
                <option value="required">Required for All</option>
                <option value="optional">Optional</option>
                <option value="admin">Admin Only</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Session Timeout</label>
              <select className="form-select" defaultValue="60">
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
                <option value="120">2 Hours</option>
                <option value="480">8 Hours</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Setting;
