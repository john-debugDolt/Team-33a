import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/TranslationContext';
import { walletService } from '../services/walletService';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import Pagination from '../components/Pagination/Pagination';
import AuthPrompt from '../components/AuthPrompt/AuthPrompt';
import './History.css';

export default function History() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const transactionTypes = [
    { id: 'all', name: t('all') },
    { id: 'deposit', name: t('deposits') },
    { id: 'withdraw', name: t('withdrawals') },
    { id: 'bonus', name: t('bonuses') },
    { id: 'bet', name: t('bets') },
    { id: 'win', name: t('bonuses') },
  ];

  const statusTypes = [
    { id: 'all', name: t('all') },
    { id: 'completed', name: t('completed') },
    { id: 'pending', name: t('pending') },
    { id: 'failed', name: t('failed') },
  ];

  // All hooks must be called before any conditional returns
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
    if (!isAuthenticated) return;
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
  }, [pagination.page, filters, isAuthenticated]);

  // Show auth prompt if not logged in (after all hooks)
  if (!isAuthenticated) {
    return (
      <AuthPrompt
        title={t('transactionHistory')}
        message={t('pleaseLoginToContinue')}
        icon="history"
      />
    )
  }

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
        <h1>{t('transactionHistory')}</h1>
        <p>View all your deposits, withdrawals, and bonuses</p>
      </div>

      {/* Filters */}
      <div className="history-filters">
        <div className="filter-group">
          <label>{t('transactionType')}</label>
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
          <label>{t('status')}</label>
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
            <LoadingSpinner text={t('loading')} />
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <h3>{t('noHistory')}</h3>
            <p>{t('startPlaying')}</p>
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
                      {tx.status === 'completed' ? t('completed') : tx.status === 'pending' ? t('pending') : t('failed')}
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
