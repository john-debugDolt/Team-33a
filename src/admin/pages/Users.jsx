import { useState, useEffect } from 'react';
import { FiSearch, FiMessageSquare, FiCreditCard, FiRefreshCw } from 'react-icons/fi';

const API_KEY = 'team33-admin-secret-key-2024';

const Users = () => {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    status: 'ALL'
  });

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch users from API
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/accounts', {
        headers: {
          'X-API-Key': API_KEY
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Transform API data to our format
        const transformedUsers = data.map(user => ({
          accountId: user.accountId,
          date: user.createdAt ? new Date(user.createdAt).toLocaleString() : '-',
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.accountId,
          firstName: user.firstName,
          lastName: user.lastName,
          mobile: user.phoneNumber || '-',
          bankAccount: user.bankAccount || '-',
          bank: user.bank || '-',
          status: user.status || 'ACTIVE',
          balance: user.balance || 0,
          depositCount: user.depositCount || 0,
          depositTotal: user.depositTotal || '0.00',
          withdrawCount: user.withdrawCount || 0,
          withdrawTotal: user.withdrawTotal || '0.00',
        }));

        setUsers(transformedUsers);
        setFilteredUsers(transformedUsers);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'Failed to fetch users');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Search/filter users
  const handleSearch = () => {
    let filtered = [...users];

    if (formData.name) {
      const search = formData.name.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(search) ||
        user.accountId.toLowerCase().includes(search)
      );
    }

    if (formData.mobile) {
      const search = formData.mobile.toLowerCase();
      filtered = filtered.filter(user =>
        user.mobile.toLowerCase().includes(search)
      );
    }

    if (formData.status && formData.status !== 'ALL') {
      filtered = filtered.filter(user =>
        user.status.toUpperCase() === formData.status.toUpperCase()
      );
    }

    setFilteredUsers(filtered);
  };

  // Reset filters
  const handleReset = () => {
    setFormData({ name: '', mobile: '', status: 'ALL' });
    setFilteredUsers(users);
  };

  return (
    <div className="content-inner">
      {/* Search Form */}
      <div className="filter-section">
        <div className="form-row">
          <span className="form-label">Name / Account ID</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name or ID..."
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div className="form-row">
          <span className="form-label">Mobile No</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search by mobile..."
            value={formData.mobile}
            onChange={(e) => setFormData({...formData, mobile: e.target.value})}
          />
        </div>
        <div className="form-row">
          <span className="form-label">Status</span>
          <select
            className="form-select"
            value={formData.status}
            onChange={(e) => setFormData({...formData, status: e.target.value})}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </div>

        <div className="action-bar" style={{ marginTop: '15px', marginBottom: 0 }}>
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
          <button className="btn btn-secondary" onClick={fetchUsers} style={{ marginLeft: '10px' }}>
            <FiRefreshCw style={{ marginRight: '4px' }} /> Refresh
          </button>
          <button className="btn-search-full" onClick={handleSearch} style={{ flex: 1, marginLeft: '10px' }}>
            <FiSearch style={{ marginRight: '6px' }} /> SEARCH
          </button>
        </div>
      </div>

      {/* Record Info */}
      <div className="action-bar">
        <div className="record-info">
          {loading ? 'Loading...' : `Showing ${filteredUsers.length} of ${users.length} users`}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="card" style={{ padding: '20px', background: '#fee', color: '#c00', marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
          <button
            onClick={fetchUsers}
            style={{ marginLeft: '20px', padding: '5px 15px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>Loading users...</div>
        </div>
      )}

      {/* Users Table */}
      {!loading && !error && (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table users-table">
              <thead>
                <tr>
                  <th>Register Date</th>
                  <th>Account ID</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <tr key={user.accountId || index}>
                      <td className="text-muted">{user.date}</td>
                      <td>
                        <code style={{ fontSize: '11px', background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>
                          {user.accountId?.substring(0, 15)}...
                        </code>
                      </td>
                      <td>
                        <strong>{user.name}</strong>
                      </td>
                      <td>{user.mobile}</td>
                      <td>
                        <span className={`badge ${user.status === 'ACTIVE' ? 'badge-success' : user.status === 'SUSPENDED' ? 'badge-danger' : 'badge-warning'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>
                        <strong className="text-success">${(user.balance || 0).toFixed(2)}</strong>
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" title="Message" style={{ marginRight: '4px' }}>
                          <FiMessageSquare />
                        </button>
                        <button className="btn btn-secondary btn-sm" title="Transactions">
                          <FiCreditCard />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
