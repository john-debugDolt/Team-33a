import { useState } from 'react';
import { FiGlobe, FiPlus, FiCheck, FiX, FiSettings, FiRefreshCw } from 'react-icons/fi';

const Domain = () => {
  const [domains] = useState([
    { id: 1, domain: 'main-site.com', type: 'Primary', ssl: true, status: 'Active', dns: 'Cloudflare' },
    { id: 2, domain: 'play.main-site.com', type: 'Subdomain', ssl: true, status: 'Active', dns: 'Cloudflare' },
    { id: 3, domain: 'backup-site.net', type: 'Mirror', ssl: true, status: 'Active', dns: 'AWS Route53' },
    { id: 4, domain: 'new-domain.com', type: 'Mirror', ssl: false, status: 'Pending', dns: 'Manual' },
  ]);

  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiGlobe style={{ marginRight: '10px' }} /> Domain Management</h1>
        <p>Manage your website domains and DNS settings</p>
      </div>

      <div className="action-bar">
        <button className="btn btn-primary">
          <FiPlus /> Add New Domain
        </button>
        <button className="btn btn-secondary">
          <FiRefreshCw /> Refresh DNS
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Type</th>
                <th>SSL</th>
                <th>Status</th>
                <th>DNS Provider</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.map(domain => (
                <tr key={domain.id}>
                  <td>
                    <strong>{domain.domain}</strong>
                    {domain.type === 'Primary' && (
                      <span className="badge badge-info" style={{ marginLeft: '8px', fontSize: '10px' }}>PRIMARY</span>
                    )}
                  </td>
                  <td>{domain.type}</td>
                  <td>
                    {domain.ssl ? (
                      <span style={{ color: '#10b981' }}><FiCheck /> Secure</span>
                    ) : (
                      <span style={{ color: '#ef4444' }}><FiX /> Not Secure</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${domain.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                      {domain.status}
                    </span>
                  </td>
                  <td>{domain.dns}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button className="btn btn-secondary btn-sm"><FiSettings /></button>
                      {domain.type !== 'Primary' && (
                        <button className="btn btn-danger btn-sm"><FiX /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <h3>DNS Records</h3>
        </div>
        <div className="card-body">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Value</th>
                <th>TTL</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>A</td><td>@</td><td>104.21.45.123</td><td>300</td></tr>
              <tr><td>CNAME</td><td>www</td><td>main-site.com</td><td>300</td></tr>
              <tr><td>MX</td><td>@</td><td>mail.main-site.com</td><td>3600</td></tr>
              <tr><td>TXT</td><td>@</td><td>v=spf1 include:_spf.google.com ~all</td><td>3600</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; }
        .page-header h1 { display: flex; align-items: center; font-size: 24px; margin-bottom: 8px; }
        .page-header p { color: #666; }
        .action-bar { display: flex; gap: 10px; margin-bottom: 16px; }
        .card-header { padding: 16px 20px; border-bottom: 1px solid #eee; }
        .card-header h3 { margin: 0; font-size: 16px; }
        .card-body { padding: 20px; }
      `}</style>
    </div>
  );
};

export default Domain;
