import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { walletService } from '../services/walletService';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import Pagination from '../components/Pagination/Pagination';
import './History.css';

const transactionTypes = [
  { id: 'all', name: 'All' },
  { id: 'deposit', name: 'Deposits' },
  { id: 'withdraw', name: 'Withdrawals' },
  { id: 'bonus', name: 'Bonuses' },
  { id: 'bet', name: 'Bets' },
  { id: 'win', name: 'Wins' },
];

const statusTypes = [
  { id: 'all', name: 'All Status' },
  { id: 'completed', name: 'Completed' },
  { id: 'pending', name: 'Pending' },
  { id: 'failed', name: 'Failed' },
];

export default function History() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const fetchTransactions = async () => {
    setLoading(true);
    const result = await walletService.getTransactions({
      page: pagination.page,
      limit: 10,
      type: filters.type,
      status: filters.status,
    });

    if (result.success) {
      setTransactions(result.data.transactions);
      setPagination(prev => ({
        ...prev,
        totalPages: result.data.pagination.totalPages,
        total: result.data.pagination.total,
      }));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, [pagination.page, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getTypeIcon = (type) => {
    const icons = {
      deposit: '↓',
      withdraw: '↑',
      bonus: '🎁',
      bet: '🎰',
      win: '💰',
      transfer: '↔️',
    };
    return icons[type] || '•';
  };

  const getStatusClass = (status) => {
    return `status-${status}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="history-page">
      {/* Hero Section */}
      <div className="history-hero">
        <h1>Transaction History</h1>
        <p>View all your transactions and activity</p>
      </div>

      {/* Filters */}
      <div className="history-filters">
        <div className="filter-group">
          <label>Type</label>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
          >
            {transactionTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            {statusTypes.map(status => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-summary">
          <span>{pagination.total} transactions found</span>
        </div>
      </div>

      {/* Transactions List */}
      <div className="transactions-container">
        {loading ? (
          <div className="loading-container">
            <LoadingSpinner text="Loading transactions..." />
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <h3>No transactions found</h3>
            <p>Your transaction history will appear here</p>
          </div>
        ) : (
          <>
            <div className="transactions-list">
              {transactions.map(tx => (
                <div key={tx.id} className="transaction-item">
                  <div className="transaction-icon">
                    <span className={`type-icon type-${tx.type}`}>
                      {getTypeIcon(tx.type)}
                    </span>
                  </div>
                  <div className="transaction-info">
                    <span className="transaction-desc">{tx.description}</span>
                    <span className="transaction-date">{formatDate(tx.createdAt)}</span>
                  </div>
                  <div className="transaction-amount-wrap">
                    <span className={`transaction-amount ${['deposit', 'bonus', 'win'].includes(tx.type) ? 'positive' : 'negative'}`}>
                      {['deposit', 'bonus', 'win'].includes(tx.type) ? '+' : '-'}${tx.amount.toFixed(2)}
                    </span>
                    <span className={`transaction-status ${getStatusClass(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
