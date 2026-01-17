import { useState, useEffect } from 'react';
import { FiSearch, FiMessageSquare, FiCreditCard, FiRefreshCw, FiX, FiUser, FiPhone, FiCalendar, FiDollarSign } from 'react-icons/fi';
import { formatDateTime } from '../utils/dateUtils';

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

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTransactions, setUserTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Fetch users from API with caching
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    // Show cached data immediately for faster UX
    const cached = localStorage.getItem('admin_users_cache');
    if (cached) {
      try {
        const cachedUsers = JSON.parse(cached);
        if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
          setUsers(cachedUsers);
          setFilteredUsers(cachedUsers);
        }
      } catch (e) { /* ignore parse errors */ }
    }

    try {
      const response = await fetch('/api/admin/accounts', {
        headers: {
          'X-API-Key': API_KEY
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Handle both array and object responses
        const usersArray = Array.isArray(data) ? data : (data.accounts || data.users || data.data || []);

        // Transform API data to our format and fetch real wallet balances
        const transformedUsers = await Promise.all(usersArray.map(async (user) => {
          // Fetch real wallet balance for this user
          let realBalance = user.balance || 0;
          try {
            const walletRes = await fetch(`/api/wallets/account/${user.accountId}`, {
              headers: { 'X-API-Key': API_KEY }
            });
            if (walletRes.ok) {
              const walletData = await walletRes.json();
              // Handle both single wallet and array of wallets
              if (Array.isArray(walletData) && walletData.length > 0) {
                realBalance = walletData[0].balance || 0;
              } else if (walletData.balance !== undefined) {
                realBalance = walletData.balance;
              }
            }
          } catch (e) {
            // Use default balance if wallet fetch fails
            console.log('Could not fetch wallet for', user.accountId);
          }

          return {
            accountId: user.accountId,
            createdAt: user.createdAt, // Keep raw date for sorting
            date: formatDateTime(user.createdAt),
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.accountId,
            firstName: user.firstName,
            lastName: user.lastName,
            mobile: user.phoneNumber || '-',
            email: user.email || '-',
            bankAccount: user.bankAccount || '-',
            bank: user.bank || '-',
            status: user.status || 'ACTIVE',
            balance: realBalance,
            depositCount: user.depositCount || 0,
            depositTotal: user.depositTotal || '0.00',
            withdrawCount: user.withdrawCount || 0,
            withdrawTotal: user.withdrawTotal || '0.00',
          };
        }));

        // Sort by registration date (newest first)
        transformedUsers.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA; // Descending order (newest first)
        });

        setUsers(transformedUsers);
        setFilteredUsers(transformedUsers);
        // Cache for faster subsequent loads
        localStorage.setItem('admin_users_cache', JSON.stringify(transformedUsers));
      } else {
        const errorText = await response.text();
        console.error('Admin accounts error:', response.status, errorText);
        try {
          const errorData = JSON.parse(errorText);
          setError(`Error ${response.status}: ${errorData.message || errorData.error || 'Failed to fetch users'}`);
        } catch {
          setError(`Error ${response.status}: ${errorText || 'Failed to fetch users'}`);
        }
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(`Network error: ${err.message}. Please try again.`);
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

  // View user details
  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  // View user transactions
  const handleViewTransactions = async (user) => {
    setSelectedUser(user);
    setShowTransactionsModal(true);
    setLoadingTransactions(true);
    setUserTransactions([]);

    try {
      // Fetch deposits and withdrawals for this user
      const [depositsRes, withdrawalsRes] = await Promise.all([
        fetch(`/api/deposits/account/${user.accountId}`, {
          headers: { 'X-API-Key': API_KEY }
        }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`/api/withdrawals/account/${user.accountId}`, {
          headers: { 'X-API-Key': API_KEY }
        }).then(r => r.ok ? r.json() : []).catch(() => [])
      ]);

      const deposits = (Array.isArray(depositsRes) ? depositsRes : []).map(d => ({
        id: d.depositId || d.id,
        type: 'DEPOSIT',
        amount: d.amount,
        status: d.status,
        date: d.createdAt
      }));

      const withdrawals = (Array.isArray(withdrawalsRes) ? withdrawalsRes : []).map(w => ({
        id: w.withdrawId || w.withdrawalId || w.id,
        type: 'WITHDRAWAL',
        amount: w.amount,
        status: w.status,
        date: w.createdAt
      }));

      // Combine and sort by date (newest first)
      const allTransactions = [...deposits, ...withdrawals].sort((a, b) => {
        return new Date(b.date || 0) - new Date(a.date || 0);
      });

      setUserTransactions(allTransactions);
    } catch (err) {
      console.error('Error fetching user transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Close modals
  const closeModals = () => {
    setShowUserModal(false);
    setShowTransactionsModal(false);
    setSelectedUser(null);
    setUserTransactions([]);
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
          {loading ? 'Loading...' : `Showing ${filteredUsers.length} of ${users.length} users (sorted by newest)`}
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
                        <button
                          className="btn btn-secondary btn-sm"
                          title="View User Details"
                          style={{ marginRight: '4px' }}
                          onClick={() => handleViewUser(user)}
                        >
                          <FiMessageSquare />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="View Transactions"
                          onClick={() => handleViewTransactions(user)}
                        >
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

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3><FiUser style={{ marginRight: '8px' }} /> User Details</h3>
              <button className="modal-close" onClick={closeModals}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="user-detail-grid">
                <div className="detail-row">
                  <span className="detail-label"><FiUser /> Name</span>
                  <span className="detail-value">{selectedUser.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label"><FiPhone /> Mobile</span>
                  <span className="detail-value">{selectedUser.mobile}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label"><FiCalendar /> Registered</span>
                  <span className="detail-value">{selectedUser.date}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Account ID</span>
                  <span className="detail-value" style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                    {selectedUser.accountId}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <span className={`badge ${selectedUser.status === 'ACTIVE' ? 'badge-success' : selectedUser.status === 'SUSPENDED' ? 'badge-danger' : 'badge-warning'}`}>
                    {selectedUser.status}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label"><FiDollarSign /> Balance</span>
                  <span className="detail-value text-success" style={{ fontWeight: '600', fontSize: '18px' }}>
                    ${(selectedUser.balance || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModals}>Close</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  closeModals();
                  handleViewTransactions(selectedUser);
                }}
              >
                <FiCreditCard style={{ marginRight: '6px' }} /> View Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Modal */}
      {showTransactionsModal && selectedUser && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3><FiCreditCard style={{ marginRight: '8px' }} /> Transactions - {selectedUser.name}</h3>
              <button className="modal-close" onClick={closeModals}><FiX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {loadingTransactions ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  Loading transactions...
                </div>
              ) : userTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  No transactions found for this user
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userTransactions.map((tx, index) => (
                      <tr key={tx.id || index}>
                        <td>{formatDateTime(tx.date)}</td>
                        <td>
                          <span className={`badge ${tx.type === 'DEPOSIT' ? 'badge-success' : 'badge-warning'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={tx.type === 'DEPOSIT' ? 'text-success' : 'text-danger'}>
                          {tx.type === 'DEPOSIT' ? '+' : '-'}${parseFloat(tx.amount || 0).toFixed(2)}
                        </td>
                        <td>
                          <span className={`badge ${tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? 'badge-success' : tx.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModals}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          background: #fff;
          border-radius: 12px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
          background: #f9fafb;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 16px;
          display: flex;
          align-items: center;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          padding: 4px;
        }
        .modal-close:hover {
          color: #000;
        }
        .modal-body {
          padding: 20px;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid #eee;
          background: #f9fafb;
        }
        .user-detail-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          color: #666;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .detail-value {
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default Users;
