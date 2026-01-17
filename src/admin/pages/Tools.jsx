import { FiTool, FiDownload, FiUpload, FiFileText, FiCopy, FiLink } from 'react-icons/fi';

const Tools = () => {
  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiTool style={{ marginRight: '10px' }} /> Tools</h1>
        <p>Utility tools for content and data management</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div className="card tool-card">
          <FiDownload size={36} style={{ color: '#3b82f6', marginBottom: '12px' }} />
          <h3>Export Data</h3>
          <p>Export user data, transactions, and reports to CSV/Excel</p>
          <button className="btn btn-primary btn-sm">Export</button>
        </div>

        <div className="card tool-card">
          <FiUpload size={36} style={{ color: '#10b981', marginBottom: '12px' }} />
          <h3>Import Data</h3>
          <p>Bulk import users, games, or other data from files</p>
          <button className="btn btn-primary btn-sm">Import</button>
        </div>

        <div className="card tool-card">
          <FiFileText size={36} style={{ color: '#f59e0b', marginBottom: '12px' }} />
          <h3>Generate Reports</h3>
          <p>Create detailed reports for analytics and auditing</p>
          <button className="btn btn-primary btn-sm">Generate</button>
        </div>

        <div className="card tool-card">
          <FiCopy size={36} style={{ color: '#8b5cf6', marginBottom: '12px' }} />
          <h3>Backup Data</h3>
          <p>Create and manage database backups</p>
          <button className="btn btn-primary btn-sm">Backup Now</button>
        </div>

        <div className="card tool-card">
          <FiLink size={36} style={{ color: '#ec4899', marginBottom: '12px' }} />
          <h3>URL Shortener</h3>
          <p>Create short links for promotions and marketing</p>
          <button className="btn btn-primary btn-sm">Create Link</button>
        </div>
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; }
        .page-header h1 { display: flex; align-items: center; font-size: 24px; margin-bottom: 8px; }
        .page-header p { color: #666; }
        .tool-card { padding: 24px; text-align: center; }
        .tool-card h3 { margin: 0 0 8px; }
        .tool-card p { color: #666; font-size: 13px; margin-bottom: 16px; }
      `}</style>
    </div>
  );
};

export default Tools;
