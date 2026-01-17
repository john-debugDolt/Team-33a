import { useState } from 'react';
import { FiCode, FiPlus, FiCopy, FiEye, FiEyeOff, FiTrash2, FiRefreshCw } from 'react-icons/fi';

const ManageAPI = () => {
  const [showKey, setShowKey] = useState({});

  const apiKeys = [
    { id: 1, name: 'Production Key', key: 'pk_live_xxxxxxxxxxxxxxxxxxxxx', created: '2024-01-01', lastUsed: '2 minutes ago', status: 'Active' },
    { id: 2, name: 'Development Key', key: 'pk_test_xxxxxxxxxxxxxxxxxxxxx', created: '2024-01-05', lastUsed: '1 hour ago', status: 'Active' },
    { id: 3, name: 'Mobile App Key', key: 'pk_mob_xxxxxxxxxxxxxxxxxxxxx', created: '2024-01-10', lastUsed: '3 days ago', status: 'Active' },
  ];

  const webhooks = [
    { id: 1, url: 'https://example.com/webhook/deposits', events: ['deposit.created', 'deposit.completed'], status: 'Active' },
    { id: 2, url: 'https://example.com/webhook/users', events: ['user.created', 'user.updated'], status: 'Active' },
  ];

  const toggleShowKey = (id) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key) => {
    return key.substring(0, 10) + '••••••••••••••••';
  };

  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiCode style={{ marginRight: '10px' }} /> API Management</h1>
        <p>Manage API keys and webhooks</p>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>API Keys</h3>
          <button className="btn btn-primary btn-sm"><FiPlus /> Create New Key</button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>API Key</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map(key => (
                <tr key={key.id}>
                  <td><strong>{key.name}</strong></td>
                  <td>
                    <code style={{ fontSize: '12px' }}>
                      {showKey[key.id] ? key.key : maskKey(key.key)}
                    </code>
                  </td>
                  <td>{key.created}</td>
                  <td>{key.lastUsed}</td>
                  <td><span className="badge badge-success">{key.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => toggleShowKey(key.id)}>
                        {showKey[key.id] ? <FiEyeOff /> : <FiEye />}
                      </button>
                      <button className="btn btn-secondary btn-sm"><FiCopy /></button>
                      <button className="btn btn-secondary btn-sm"><FiRefreshCw /></button>
                      <button className="btn btn-danger btn-sm"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Webhooks</h3>
          <button className="btn btn-primary btn-sm"><FiPlus /> Add Webhook</button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Endpoint URL</th>
                <th>Events</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map(webhook => (
                <tr key={webhook.id}>
                  <td><code style={{ fontSize: '11px' }}>{webhook.url}</code></td>
                  <td>
                    {webhook.events.map((e, i) => (
                      <span key={i} className="badge badge-info" style={{ marginRight: '4px', fontSize: '10px' }}>{e}</span>
                    ))}
                  </td>
                  <td><span className="badge badge-success">{webhook.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button className="btn btn-secondary btn-sm">Test</button>
                      <button className="btn btn-danger btn-sm"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; }
        .page-header h1 { display: flex; align-items: center; font-size: 24px; margin-bottom: 8px; }
        .page-header p { color: #666; }
        .card-header { padding: 16px 20px; border-bottom: 1px solid #eee; }
        .card-header h3 { margin: 0; font-size: 16px; }
        code { background: #f1f1f1; padding: 2px 6px; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default ManageAPI;
