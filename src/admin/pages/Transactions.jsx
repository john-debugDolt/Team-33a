import { useState, useEffect } from 'react';
import { FiSearch, FiInbox, FiCheck, FiX, FiClock, FiRefreshCw, FiEye } from 'react-icons/fi';
import { transactionService } from '../services/transactionService';
import { formatDateTime } from '../utils/dateUtils';

const Transactions = () => {
  const [formData, setFormData] = useState({
    id: '',
    customer: '',
    type: 'ALL',
    dateStart: '',
    dateEnd: '',
    amountMin: '',
    amountMax: '',
    status: 'PENDING'
  });

  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalAmount: 0,
    pendingAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch transactions
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const result = await transactionService.getAllTransactions(formData);
      if (result.success) {
        setTransactions(result.transactions);
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchTransactions();
  };

  // Handle approve
  const handleApprove = async (transaction) => {
    if (!confirm(`Approve ${transaction.type} of $${transaction.amount.toLocaleString()} for ${transaction.username}?`)) {
      return;
    }

    setProcessing(transaction.id);
    try {
      // Pass transaction info to avoid extra API call
      const result = await transactionService.approveTransaction(transaction.id, '', {
        accountId: transaction.accountId,
        amount: transaction.amount,
        originalId: transaction.originalId // For withdrawals with prefixed IDs
      });
      if (result.success) {
        fetchTransactions();
        alert('Transaction approved successfully!');
      } else {
        alert('Failed to approve: ' + result.error);
      }
    } catch (error) {
      alert('Error approving transaction');
    } finally {
      setProcessing(null);
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!selectedTransaction) return;

    setProcessing(selectedTransaction.id);
    try {
      const result = await transactionService.rejectTransaction(selectedTransaction.id, rejectReason, selectedTransaction.originalId);
      if (result.success) {
        setShowModal(false);
        setSelectedTransaction(null);
        setRejectReason('');
        fetchTransactions();
        alert('Transaction rejected');
      } else {
        alert('Failed to reject: ' + result.error);
      }
    } catch (error) {
      alert('Error rejecting transaction');
    } finally {
      setProcessing(null);
    }
  };

  // Open reject modal
  const openRejectModal = (transaction) => {
    setSelectedTransaction(transaction);
    setRejectReason('');
    setShowModal(true);
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
      case 'COMPLETED':
        return <span className="badge badge-success"><FiCheck style={{ marginRight: '4px' }} />Approved</span>;
      case 'REJECTED':
        return <span className="badge badge-danger"><FiX style={{ marginRight: '4px' }} />Rejected</span>;
      case 'PENDING':
      default:
        return <span className="badge badge-warning"><FiClock style={{ marginRight: '4px' }} />Pending</span>;
    }
  };

  // Format date - use utility function
  const formatDate = (dateString) => formatDateTime(dateString);

  return (
    <div className="content-inner">
      {/* Search Form */}
      <div className="filter-section">
        <form onSubmit={handleSearch}>
          <div className="form-row">
            <span className="form-label">ID</span>
            <input
              type="text"
              className="form-input"
              placeholder="Search by Transaction ID"
              value={formData.id}
              onChange={(e) => setFormData({...formData, id: e.target.value})}
            />
          </div>
          <div className="form-row">
            <span className="form-label">Customer</span>
            <input
              type="text"
              className="form-input"
              placeholder="Search by Customer ID / Phone"
              value={formData.customer}
              onChange={(e) => setFormData({...formData, customer: e.target.value})}
            />
          </div>
          <div className="form-row">
            <span className="form-label">Type</span>
            <select
              className="form-select"
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              <option value="ALL">All Types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAWAL">Withdrawal</option>
            </select>
          </div>
          <div className="form-row">
            <span className="form-label">Date</span>
            <div className="form-input-group">
              <input
                type="date"
                className="form-input"
                value={formData.dateStart}
                onChange={(e) => setFormData({...formData, dateStart: e.target.value})}
              />
              <input
                type="date"
                className="form-input"
                value={formData.dateEnd}
                onChange={(e) => setFormData({...formData, dateEnd: e.target.value})}
              />
            </div>
          </div>
          <div className="form-row">
            <span className="form-label">Amount</span>
            <div className="form-input-group">
              <input
                type="text"
                className="form-input"
                placeholder="Min amount"
                value={formData.amountMin}
                onChange={(e) => setFormData({...formData, amountMin: e.target.value})}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Max amount"
                value={formData.amountMax}
                onChange={(e) => setFormData({...formData, amountMax: e.target.value})}
              />
            </div>
          </div>
          <div className="form-row">
            <span className="form-label">Status</span>
            <select
              className="form-select"
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All Status</option>
            </select>
          </div>

          <button type="submit" className="btn-search-full" disabled={loading}>
            {loading ? (
              <><FiRefreshCw style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }} /> Loading...</>
            ) : (
              <><FiSearch style={{ marginRight: '6px' }} /> SEARCH</>
            )}
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="action-bar">
        <div className="quick-stats">
          <div className="quick-stat">
            <span className="quick-stat-label">Total:</span>
            <span className="quick-stat-value">{stats.total}</span>
          </div>
          <div className="quick-stat">
            <span className="quick-stat-label">Pending:</span>
            <span className="quick-stat-value text-warning">{stats.pendingCount}</span>
          </div>
          <div className="quick-stat">
            <span className="quick-stat-label">Approved:</span>
            <span className="quick-stat-value text-success">{stats.approvedCount}</span>
          </div>
          <div className="quick-stat">
            <span className="quick-stat-label">Pending Amount:</span>
            <span className="quick-stat-value text-warning">${stats.pendingAmount?.toLocaleString() || 0}</span>
          </div>
        </div>
        <button onClick={fetchTransactions} className="btn btn-secondary btn-sm">
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Bank</th>
                <th>Date/Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <FiRefreshCw className="empty-state-icon" style={{ animation: 'spin 1s linear infinite' }} />
                    <p className="empty-state-text">Loading transactions...</p>
                  </td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td><strong style={{ fontSize: '11px' }}>{tx.id}</strong></td>
                    <td>
                      <div>
                        <strong>{tx.username || tx.accountId}</strong>
                        {tx.phone && <div style={{ fontSize: '11px', color: '#666' }}>{tx.phone}</div>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${tx.type === 'DEPOSIT' ? 'badge-success' : 'badge-warning'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td><strong>${tx.amount?.toLocaleString() || 0}</strong></td>
                    <td>
                      {tx.type === 'WITHDRAWAL' ? (
                        <div>
                          {tx.bank && tx.bank !== 'N/A' && (
                            <span className="badge badge-info">{tx.bank}</span>
                          )}
                          {tx.payId && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              PayID: {tx.payId}
                            </div>
                          )}
                          {tx.bsb && tx.bankAccount && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              {tx.bsb} / {tx.bankAccount}
                            </div>
                          )}
                          {!tx.bank && !tx.payId && !tx.bsb && (
                            <span style={{ color: '#999' }}>-</span>
                          )}
                        </div>
                      ) : tx.bank && tx.bank !== 'N/A' ? (
                        <span className="badge badge-info">{tx.bank}</span>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </td>
                    <td className="text-muted" style={{ fontSize: '12px' }}>{formatDate(tx.createdAt)}</td>
                    <td>{getStatusBadge(tx.status)}</td>
                    <td>
                      {tx.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleApprove(tx)}
                            disabled={processing === tx.id}
                            title="Approve"
                          >
                            {processing === tx.id ? <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <FiCheck />}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => openRejectModal(tx)}
                            disabled={processing === tx.id}
                            title="Reject"
                          >
                            <FiX />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedTransaction(tx);
                            setShowModal(true);
                          }}
                          title="View Details"
                        >
                          <FiEye /> View
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <FiInbox className="empty-state-icon" />
                    <p className="empty-state-text">No transactions found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Reject/View */}
      {showModal && selectedTransaction && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              {selectedTransaction.status === 'PENDING' ? 'Reject Transaction' : 'Transaction Details'}
            </h3>

            <div style={{ marginBottom: '15px' }}>
              <p><strong>Transaction ID:</strong> {selectedTransaction.id}</p>
              <p><strong>Customer:</strong> {selectedTransaction.username || selectedTransaction.accountId}</p>
              {selectedTransaction.phone && <p><strong>Phone:</strong> {selectedTransaction.phone}</p>}
              <p><strong>Type:</strong> {selectedTransaction.type}</p>
              <p><strong>Amount:</strong> ${selectedTransaction.amount?.toLocaleString()}</p>

              {/* Bank details for withdrawals */}
              {selectedTransaction.type === 'WITHDRAWAL' && (
                <>
                  <p><strong>Bank:</strong> {selectedTransaction.bank || 'N/A'}</p>
                  {selectedTransaction.accountHolderName && (
                    <p><strong>Account Holder:</strong> {selectedTransaction.accountHolderName}</p>
                  )}
                  {selectedTransaction.bsb && (
                    <p><strong>BSB:</strong> {selectedTransaction.bsb}</p>
                  )}
                  {selectedTransaction.bankAccount && (
                    <p><strong>Account Number:</strong> {selectedTransaction.bankAccount}</p>
                  )}
                  {selectedTransaction.payId && (
                    <p><strong>PayID:</strong> {selectedTransaction.payId}</p>
                  )}
                </>
              )}

              {selectedTransaction.type !== 'WITHDRAWAL' && (
                <p><strong>Bank:</strong> {selectedTransaction.bank || 'N/A'}</p>
              )}

              <p><strong>Payment Method:</strong> {selectedTransaction.paymentMethod || 'N/A'}</p>
              <p><strong>Status:</strong> {getStatusBadge(selectedTransaction.status)}</p>
              <p><strong>Date:</strong> {formatDate(selectedTransaction.createdAt)}</p>
              {selectedTransaction.processedAt && (
                <p><strong>Processed:</strong> {formatDate(selectedTransaction.processedAt)}</p>
              )}
              {selectedTransaction.rejectionReason && (
                <p><strong>Rejection Reason:</strong> {selectedTransaction.rejectionReason}</p>
              )}
              {selectedTransaction.adminNotes && (
                <p><strong>Admin Notes:</strong> {selectedTransaction.adminNotes}</p>
              )}
            </div>

            {selectedTransaction.status === 'PENDING' && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Rejection Reason:
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowModal(false);
                  setSelectedTransaction(null);
                  setRejectReason('');
                }}
              >
                Close
              </button>
              {selectedTransaction.status === 'PENDING' && (
                <button
                  className="btn btn-danger"
                  onClick={handleReject}
                  disabled={processing === selectedTransaction.id}
                >
                  {processing === selectedTransaction.id ? 'Rejecting...' : 'Reject Transaction'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Transactions;
