import { useState, useEffect } from 'react';
import { FiSearch, FiUsers, FiDollarSign, FiUserPlus, FiInbox } from 'react-icons/fi';

const REFERRER_KEY = 'team33_referrers';

const Referrer = () => {
  const [referrers, setReferrers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REFERRER_KEY);
      if (stored) setReferrers(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading referrers:', e);
    }
  }, []);

  const filteredReferrers = referrers.filter(ref => {
    const matchSearch = ref.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'All' || ref.status === statusFilter;
    const matchLevel = levelFilter === 'All' || ref.level === levelFilter;
    return matchSearch && matchStatus && matchLevel;
  });

  const stats = [
    { icon: <FiUsers />, label: 'Total Referrers', value: referrers.length.toString(), color: 'blue' },
    { icon: <FiUserPlus />, label: 'Total Referrals', value: referrers.reduce((sum, r) => sum + (r.referrals || 0), 0).toLocaleString(), color: 'green' },
    { icon: <FiDollarSign />, label: 'Total Commission Paid', value: '$0', color: 'gold' },
  ];

  return (
    <div className="referrer-page">
      <div className="page-header">
        <h1 className="page-title">Referrer Management</h1>
        <button className="btn btn-primary">
          <FiUserPlus /> Add Referrer
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
            <div className="stat-info">
              <h4>{stat.label}</h4>
              <p>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="filters-row">
          <div className="search-box">
            <FiSearch className="search-icon" />
            <input type="text" placeholder="Search referrer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Status:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Level:</label>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
              <option>All</option>
              <option>Diamond</option>
              <option>Gold</option>
              <option>Silver</option>
              <option>Bronze</option>
            </select>
          </div>
        </div>
      </div>

      {/* Referrers Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Level</th>
              <th>Referrals</th>
              <th>Total Deposit</th>
              <th>Commission Earned</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReferrers.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No referrers found. Referrer data will appear when backend API is connected.</p>
                </td>
              </tr>
            ) : (
              filteredReferrers.map((ref) => (
                <tr key={ref.id}>
                  <td>{ref.id}</td>
                  <td style={{ fontWeight: 600 }}>{ref.username}</td>
                  <td>
                    <span className={`badge ${
                      ref.level === 'Diamond' ? 'badge-info' :
                      ref.level === 'Gold' ? 'badge-warning' :
                      ref.level === 'Silver' ? 'badge-secondary' : 'badge-success'
                    }`} style={ref.level === 'Silver' ? { background: '#e5e7eb', color: '#374151' } : {}}>
                      {ref.level}
                    </span>
                  </td>
                  <td>{ref.referrals}</td>
                  <td>${ref.totalDeposit?.toLocaleString() || 0}</td>
                  <td style={{ fontWeight: 600, color: '#16a34a' }}>${ref.commission?.toLocaleString() || 0}</td>
                  <td>
                    <span className={`badge ${ref.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                      {ref.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Referrer;
