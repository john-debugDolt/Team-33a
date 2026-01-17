import { FiMonitor, FiDatabase, FiRefreshCw, FiTerminal, FiActivity, FiServer } from 'react-icons/fi';

const AdminTool = () => {
  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiMonitor style={{ marginRight: '10px' }} /> Admin Tools</h1>
        <p>System administration and maintenance tools</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div className="card tool-card">
          <div className="tool-icon" style={{ background: '#dbeafe' }}>
            <FiDatabase size={32} style={{ color: '#3b82f6' }} />
          </div>
          <h3>Database Manager</h3>
          <p>View and manage database tables and records</p>
          <button className="btn btn-primary">Open Tool</button>
        </div>

        <div className="card tool-card">
          <div className="tool-icon" style={{ background: '#dcfce7' }}>
            <FiRefreshCw size={32} style={{ color: '#10b981' }} />
          </div>
          <h3>Cache Manager</h3>
          <p>Clear system cache and optimize performance</p>
          <button className="btn btn-primary">Clear Cache</button>
        </div>

        <div className="card tool-card">
          <div className="tool-icon" style={{ background: '#fef3c7' }}>
            <FiTerminal size={32} style={{ color: '#f59e0b' }} />
          </div>
          <h3>System Console</h3>
          <p>Execute system commands and scripts</p>
          <button className="btn btn-primary">Open Console</button>
        </div>

        <div className="card tool-card">
          <div className="tool-icon" style={{ background: '#fce7f3' }}>
            <FiActivity size={32} style={{ color: '#ec4899' }} />
          </div>
          <h3>System Monitor</h3>
          <p>Monitor system performance and resources</p>
          <button className="btn btn-primary">View Stats</button>
        </div>

        <div className="card tool-card">
          <div className="tool-icon" style={{ background: '#e0e7ff' }}>
            <FiServer size={32} style={{ color: '#6366f1' }} />
          </div>
          <h3>Server Status</h3>
          <p>Check server health and uptime</p>
          <button className="btn btn-primary">Check Status</button>
        </div>
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; }
        .page-header h1 { display: flex; align-items: center; font-size: 24px; margin-bottom: 8px; }
        .page-header p { color: #666; }
        .tool-card { padding: 24px; text-align: center; }
        .tool-icon { width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .tool-card h3 { margin: 0 0 8px; }
        .tool-card p { color: #666; font-size: 14px; margin-bottom: 16px; }
      `}</style>
    </div>
  );
};

export default AdminTool;
