import { useState } from 'react';
import { FiLock, FiShield, FiAlertTriangle, FiEye, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

const Security = () => {
  const [settings, setSettings] = useState({
    twoFactor: true,
    loginAlerts: true,
    ipWhitelist: false,
    sessionTimeout: true,
  });

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const recentActivity = [
    { action: 'Login', ip: '192.168.1.1', time: '2 minutes ago', status: 'success' },
    { action: 'Password Change', ip: '192.168.1.1', time: '1 hour ago', status: 'success' },
    { action: 'Failed Login', ip: '10.0.0.45', time: '3 hours ago', status: 'failed' },
    { action: 'Login', ip: '192.168.1.1', time: '1 day ago', status: 'success' },
  ];

  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiLock style={{ marginRight: '10px' }} /> Security Settings</h1>
        <p>Manage security and access controls</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3><FiShield /> Security Options</h3>
          </div>
          <div className="card-body">
            {[
              { key: 'twoFactor', label: 'Two-Factor Authentication', desc: 'Require 2FA for admin login' },
              { key: 'loginAlerts', label: 'Login Alerts', desc: 'Email notifications for new logins' },
              { key: 'ipWhitelist', label: 'IP Whitelist', desc: 'Restrict access to specific IPs' },
              { key: 'sessionTimeout', label: 'Session Timeout', desc: 'Auto logout after 30 min inactivity' },
            ].map(item => (
              <div key={item.key} className="setting-row">
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.desc}</p>
                </div>
                <button className="toggle-btn" onClick={() => toggleSetting(item.key)}>
                  {settings[item.key] ? <FiToggleRight size={28} color="#10b981" /> : <FiToggleLeft size={28} color="#ccc" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><FiEye /> Recent Activity</h3>
          </div>
          <div className="card-body">
            {recentActivity.map((item, i) => (
              <div key={i} className="activity-row">
                <div>
                  <strong>{item.action}</strong>
                  <p>IP: {item.ip} - {item.time}</p>
                </div>
                <span className={`badge ${item.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; }
        .page-header h1 { display: flex; align-items: center; font-size: 24px; margin-bottom: 8px; }
        .page-header p { color: #666; }
        .card-header { padding: 16px 20px; border-bottom: 1px solid #eee; }
        .card-header h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; }
        .card-body { padding: 16px 20px; }
        .setting-row, .activity-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
        .setting-row:last-child, .activity-row:last-child { border-bottom: none; }
        .setting-row p, .activity-row p { color: #666; font-size: 12px; margin: 4px 0 0; }
        .toggle-btn { background: none; border: none; cursor: pointer; padding: 0; }
      `}</style>
    </div>
  );
};

export default Security;
