import { useState } from 'react';
import { FiUserX, FiPlus, FiTrash2, FiSearch } from 'react-icons/fi';

const Blacklist = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const blacklistedUsers = [
    { id: 1, username: 'baduser123', reason: 'Fraud attempt', ip: '10.0.0.45', date: '2024-01-15', type: 'user' },
    { id: 2, username: 'spammer99', reason: 'Spam/Abuse', ip: '192.168.5.22', date: '2024-01-14', type: 'user' },
    { id: 3, username: '10.20.30.40', reason: 'Multiple fraud attempts', ip: '10.20.30.40', date: '2024-01-10', type: 'ip' },
    { id: 4, username: 'cheater2024', reason: 'Game manipulation', ip: '172.16.0.100', date: '2024-01-08', type: 'user' },
  ];

  const filtered = blacklistedUsers.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.ip.includes(searchTerm)
  );

  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiUserX style={{ marginRight: '10px' }} /> Blacklist Management</h1>
        <p>Manage blocked users and IP addresses</p>
      </div>

      <div className="filter-section">
        <div className="form-row">
          <span className="form-label">Search</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search by username, IP, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-danger" style={{ marginLeft: 'auto' }}>
          <FiPlus /> Add to Blacklist
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Username / IP</th>
                <th>Reason</th>
                <th>IP Address</th>
                <th>Date Added</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(item => (
                <tr key={item.id}>
                  <td>
                    <span className={`badge ${item.type === 'user' ? 'badge-warning' : 'badge-danger'}`}>
                      {item.type.toUpperCase()}
                    </span>
                  </td>
                  <td><strong>{item.username}</strong></td>
                  <td>{item.reason}</td>
                  <td><code>{item.ip}</code></td>
                  <td>{item.date}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" title="Remove from blacklist">
                      <FiTrash2 /> Remove
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <FiSearch className="empty-state-icon" />
                    <p>No blacklisted entries found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; }
        .page-header h1 { display: flex; align-items: center; font-size: 24px; margin-bottom: 8px; }
        .page-header p { color: #666; }
        .filter-section { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 16px; }
        code { background: #f1f1f1; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
      `}</style>
    </div>
  );
};

export default Blacklist;
