import { useState, useEffect } from 'react';
import { FiSave, FiSliders, FiPercent, FiDollarSign, FiCheck } from 'react-icons/fi';

const GAME_SETTINGS_KEY = 'team33_game_settings';

const defaultSettings = {
  slotMinBet: 1,
  slotMaxBet: 10000,
  liveMinBet: 10,
  liveMaxBet: 50000,
  sportsMinBet: 5,
  sportsMaxBet: 100000,
  rtpSlot: 96,
  rtpLive: 98,
  maxWinMultiplier: 5000,
  autoApproveLimit: 10000,
  maintenanceMode: 'off',
  newGameDisplay: '7'
};

const GameSetting = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GAME_SETTINGS_KEY);
      if (stored) setSettings({ ...defaultSettings, ...JSON.parse(stored) });
    } catch (e) {
      console.error('Error loading game settings:', e);
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(GAME_SETTINGS_KEY, JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Failed to save settings');
    }
  };

  const gameTypes = [
    { name: 'Slot Games', icon: '🎰', minBet: 'slotMinBet', maxBet: 'slotMaxBet', rtp: 'rtpSlot' },
    { name: 'Live Casino', icon: '🃏', minBet: 'liveMinBet', maxBet: 'liveMaxBet', rtp: 'rtpLive' },
    { name: 'Sports Betting', icon: '⚽', minBet: 'sportsMinBet', maxBet: 'sportsMaxBet', rtp: null },
  ];

  return (
    <div className="game-setting-page">
      <div className="page-header">
        <h1 className="page-title">Game Settings</h1>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><FiCheck /> Saved!</> : <><FiSave /> Save All Settings</>}
        </button>
      </div>

      {/* Bet Limits per Game Type */}
      {gameTypes.map((game, index) => (
        <div key={index} className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <span style={{ marginRight: '10px', fontSize: '24px' }}>{game.icon}</span>
              {game.name} Settings
            </h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">
                  <FiDollarSign style={{ marginRight: '5px' }} />
                  Minimum Bet ($)
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={settings[game.minBet]}
                  onChange={(e) => setSettings({ ...settings, [game.minBet]: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  <FiDollarSign style={{ marginRight: '5px' }} />
                  Maximum Bet ($)
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={settings[game.maxBet]}
                  onChange={(e) => setSettings({ ...settings, [game.maxBet]: Number(e.target.value) })}
                />
              </div>
              {game.rtp && (
                <div className="form-group">
                  <label className="form-label">
                    <FiPercent style={{ marginRight: '5px' }} />
                    RTP (%)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings[game.rtp]}
                    onChange={(e) => setSettings({ ...settings, [game.rtp]: Number(e.target.value) })}
                    step="0.1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Global Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <FiSliders style={{ marginRight: '10px' }} />
            Global Settings
          </h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Max Win Multiplier</label>
              <input
                type="number"
                className="form-input"
                value={settings.maxWinMultiplier}
                onChange={(e) => setSettings({ ...settings, maxWinMultiplier: Number(e.target.value) })}
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>Maximum win = bet × multiplier</small>
            </div>
            <div className="form-group">
              <label className="form-label">Auto-Approve Win Limit ($)</label>
              <input
                type="number"
                className="form-input"
                value={settings.autoApproveLimit}
                onChange={(e) => setSettings({ ...settings, autoApproveLimit: Number(e.target.value) })}
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>Wins above this need manual approval</small>
            </div>
            <div className="form-group">
              <label className="form-label">Maintenance Mode</label>
              <select
                className="form-select"
                value={settings.maintenanceMode}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.value })}
              >
                <option value="off">Off - All Games Active</option>
                <option value="slots">Slots Only</option>
                <option value="live">Live Casino Only</option>
                <option value="sports">Sports Only</option>
                <option value="all">All Games - Maintenance</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">New Game Display</label>
              <select
                className="form-select"
                value={settings.newGameDisplay}
                onChange={(e) => setSettings({ ...settings, newGameDisplay: e.target.value })}
              >
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days</option>
              </select>
              <small style={{ color: '#6b7280', fontSize: '12px' }}>How long to show "NEW" badge</small>
            </div>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div style={{
        marginTop: '20px',
        padding: '15px 20px',
        background: '#fef3c7',
        borderRadius: '8px',
        border: '1px solid #fcd34d',
        color: '#92400e',
        fontSize: '14px'
      }}>
        <strong>Note:</strong> Settings are stored locally. Backend API integration required for these settings to affect live games.
      </div>
    </div>
  );
};

export default GameSetting;
