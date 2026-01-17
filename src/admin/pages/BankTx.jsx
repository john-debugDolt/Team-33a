import { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiFile, FiAlertTriangle, FiPlus, FiRefreshCw, FiX, FiDownload } from 'react-icons/fi';

const API_KEY = 'team33-admin-secret-key-2024';

const BankTx = () => {
  // Default to 'all' to show all transactions initially
  const [selectedDate, setSelectedDate] = useState('all');
  const [selectedBank, setSelectedBank] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    description: '',
    inAmount: '',
    outAmount: '',
    remarks: ''
  });

  // Load banks from localStorage first, then fetch from API
  useEffect(() => {
    const fetchBanks = async () => {
      setLoading(true);

      // Try to load from localStorage first (cache)
      const cachedBanks = localStorage.getItem('admin_banks');
      if (cachedBanks) {
        try {
          const parsed = JSON.parse(cachedBanks);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('Loaded banks from cache:', parsed);
            setBanks(parsed);
          }
        } catch (e) {
          console.error('Failed to parse cached banks:', e);
        }
      }

      // Then fetch fresh data from API
      try {
        const response = await fetch('/api/banks');
        const data = await response.json();

        // API can return array directly OR { success: true, banks: [...] }
        let banksArray = [];
        if (Array.isArray(data)) {
          banksArray = data;
        } else if (data.banks && Array.isArray(data.banks)) {
          banksArray = data.banks;
        } else if (data.success && data.data) {
          banksArray = Array.isArray(data.data) ? data.data : [];
        }

        // Filter to only active banks
        const activeBanks = banksArray.filter(bank => bank.status === 'ACTIVE' || !bank.status);

        if (activeBanks.length > 0) {
          // Transform API data to match component format
          // API returns: { id, bankName, accountName, bsb, accountNumber, status, totalTransactedAmount }
          const formattedBanks = activeBanks.map(bank => ({
            id: bank.id || bank.bankCode || bank.bankId,
            name: `${bank.bankName || bank.name} (${bank.accountName || 'Account'})`,
            bsb: bank.bsb || '',
            accountNumber: bank.accountNumber || '',
            accountName: bank.accountName || '',
            payId: bank.payId || '',
            balance: bank.totalTransactedAmount ? bank.totalTransactedAmount.toFixed(2) : '0.00'
          }));
          console.log('Loaded banks from API:', formattedBanks);

          // Save to localStorage for caching
          localStorage.setItem('admin_banks', JSON.stringify(formattedBanks));

          setBanks(formattedBanks);
        } else {
          console.log('No active banks found in API response:', data);
          // Don't clear banks if we have cached data
          if (!cachedBanks) {
            setBanks([]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch banks from API:', error);
        // Keep using cached data if available, otherwise empty
        if (!cachedBanks) {
          setBanks([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBanks();
  }, []);

  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch transactions when bank or date changes
  useEffect(() => {
    const fetchTransactions = async () => {

      setTxLoading(true);
      const cacheKey = `admin_tx_${selectedBank || 'all'}_${selectedDate || 'all'}`;

      // Try to load from localStorage first
      const cachedTx = localStorage.getItem(cacheKey);
      if (cachedTx) {
        try {
          const parsed = JSON.parse(cachedTx);
          if (Array.isArray(parsed)) {
            setTransactions(parsed);
          }
        } catch (e) {
          console.error('Failed to parse cached transactions:', e);
        }
      }

      try {
        // Fetch pending and completed deposits in PARALLEL for speed
        console.log('[BankTx] Fetching deposits for bank:', selectedBank);

        const [pendingResponse, completedResponse] = await Promise.all([
          fetch(`/api/admin/deposits/pending`, { headers: { 'X-API-Key': API_KEY } }),
          fetch(`/api/admin/deposits/status/COMPLETED`, { headers: { 'X-API-Key': API_KEY } })
        ]);

        const [pendingRes, completedRes] = await Promise.all([
          pendingResponse.ok ? pendingResponse.json() : [],
          completedResponse.ok ? completedResponse.json() : []
        ]);

        let allDeposits = [...pendingRes, ...completedRes];
        console.log('[BankTx] All deposits before filter:', allDeposits.length);

        // Filter by selected bank
        // Note: API returns 'assignedBank' not 'bankId'
        if (selectedBank && selectedBank !== 'all' && selectedBank !== 'unassigned') {
          allDeposits = allDeposits.filter(d => {
            const depositBank = d.assignedBank || d.bankId;
            // Only show deposits assigned to this specific bank
            return depositBank === selectedBank || depositBank === String(selectedBank);
          });
        } else if (selectedBank === 'unassigned') {
          // Show only unassigned deposits
          allDeposits = allDeposits.filter(d => !d.assignedBank && !d.bankId);
        }
        // If selectedBank is 'all' or empty, show all deposits

        // Filter by selected date (if not 'all')
        if (selectedDate && selectedDate !== 'all') {
          allDeposits = allDeposits.filter(d => {
            if (!d.createdAt) return true; // Include deposits without date
            const depDate = new Date(d.createdAt).toISOString().split('T')[0];
            return depDate === selectedDate;
          });
        }

        console.log('[BankTx] After all filters:', allDeposits.length, 'deposits');

        if (allDeposits.length > 0) {
          // Fetch account names for all unique account IDs
          const uniqueAccountIds = [...new Set(allDeposits.map(d => d.accountId).filter(Boolean))];
          const accountNames = {};

          // Fetch account details in parallel (max 10 at a time to avoid overload)
          await Promise.all(
            uniqueAccountIds.slice(0, 20).map(async (accountId) => {
              try {
                const res = await fetch(`/api/accounts/${accountId}`);
                if (res.ok) {
                  const acc = await res.json();
                  accountNames[accountId] = `${acc.firstName || ''} ${acc.lastName || ''}`.trim() || accountId;
                }
              } catch (e) {
                console.log('Failed to fetch account:', accountId);
              }
            })
          );
          console.log('[BankTx] Account names:', accountNames);

          const formattedTx = allDeposits.map((dep, index) => ({
            no: index + 1,
            type: 'deposit',
            accountName: accountNames[dep.accountId] || dep.accountId || 'Unknown',
            description: `${dep.status === 'COMPLETED' || dep.status === 'APPROVED' ? 'Deposit' : 'Pending'} - ${accountNames[dep.accountId] || dep.accountId || 'Unknown'}`,
            inAmount: dep.amount ? parseFloat(dep.amount).toFixed(2) : '',
            outAmount: '',
            time: dep.createdAt ? new Date(dep.createdAt).toLocaleTimeString() : '',
            id: dep.depositId || dep.id,
            match: dep.status === 'COMPLETED' || dep.status === 'APPROVED' ? 'Y' : 'N',
            fee: '0.00',
            remarks: dep.adminNotes || dep.notes || '',
            bankId: dep.bankId
          }));

          // Save to localStorage
          localStorage.setItem(cacheKey, JSON.stringify(formattedTx));
          setTransactions(formattedTx);
        } else {
          setTransactions([]);
          // Clear old cache for this key
          localStorage.removeItem(cacheKey);
        }
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
        // Keep cached data if available
        if (!cachedTx) {
          setTransactions([]);
        }
      } finally {
        setTxLoading(false);
      }
    };

    fetchTransactions();
  }, [selectedBank, selectedDate, refreshKey]);

  const selectedBankData = banks.find(b => b.id === selectedBank);

  // Filter transactions based on search, type, and status
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.description?.toLowerCase().includes(query) ||
        tx.id?.toLowerCase().includes(query) ||
        tx.remarks?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => {
        if (typeFilter === 'deposit') return tx.inAmount && parseFloat(tx.inAmount) > 0;
        if (typeFilter === 'withdrawal') return tx.outAmount && parseFloat(tx.outAmount) > 0;
        return true;
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tx => {
        if (statusFilter === 'matched') return tx.match === 'Y';
        if (statusFilter === 'unmatched') return tx.match === 'N';
        return true;
      });
    }

    // Unmatched only toggle
    if (showUnmatchedOnly) {
      filtered = filtered.filter(tx => tx.match === 'N');
    }

    return filtered;
  }, [transactions, searchQuery, typeFilter, statusFilter, showUnmatchedOnly]);

  // Calculate totals from filtered transactions
  const totalIn = filteredTransactions.reduce((sum, tx) => sum + (parseFloat(tx.inAmount) || 0), 0);
  const totalOut = filteredTransactions.reduce((sum, tx) => sum + (parseFloat(tx.outAmount) || 0), 0);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      alert('No transactions to export');
      return;
    }

    const headers = ['No', 'Customer', 'Type', 'In', 'Out', 'Time', 'ID', 'Status', 'Remarks'];
    const rows = filteredTransactions.map((tx, index) => [
      index + 1,
      tx.accountName || 'Unknown',
      tx.inAmount ? 'Deposit' : 'Withdrawal',
      tx.inAmount || '',
      tx.outAmount || '',
      tx.time,
      tx.id,
      tx.match === 'Y' ? 'Matched' : 'Pending',
      tx.remarks
    ]);

    // Add totals row
    rows.push(['', '', 'TOTAL', totalIn.toFixed(2), totalOut.toFixed(2), '', '', '', '']);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bank_tx_${selectedBankData?.name || 'all'}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add manual entry
  const handleAddEntry = () => {
    if (!newEntry.description) {
      alert('Description is required');
      return;
    }
    if (!newEntry.inAmount && !newEntry.outAmount) {
      alert('Please enter either In or Out amount');
      return;
    }

    const entry = {
      no: transactions.length + 1,
      type: newEntry.inAmount ? 'deposit' : 'withdrawal',
      description: newEntry.description,
      inAmount: newEntry.inAmount || '',
      outAmount: newEntry.outAmount || '',
      time: new Date().toLocaleTimeString(),
      id: `MANUAL-${Date.now()}`,
      match: 'N',
      fee: '0.00',
      remarks: newEntry.remarks || 'Manual entry',
      bankId: selectedBank
    };

    setTransactions(prev => [...prev, entry]);
    setShowAddModal(false);
    setNewEntry({ description: '', inAmount: '', outAmount: '', remarks: '' });
  };

  return (
    <div className="content-inner">
      {/* Top Controls */}
      <div className="filter-section">
        <div className="action-bar" style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="form-input"
              value={selectedDate === 'all' ? '' : selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || 'all')}
              style={{ width: 'auto' }}
            />
            <button
              className={`btn btn-sm ${selectedDate === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedDate(selectedDate === 'all' ? new Date().toISOString().split('T')[0] : 'all')}
            >
              {selectedDate === 'all' ? 'All Dates' : 'All Dates'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={exportToCSV}
              title="Export to CSV"
            >
              <FiDownload /> Export
            </button>
            <button
              className={`btn btn-sm ${showUnmatchedOnly ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => setShowUnmatchedOnly(!showUnmatchedOnly)}
              title="Show unmatched/pending only"
            >
              <FiAlertTriangle /> {showUnmatchedOnly ? 'Pending Only' : 'Show Pending'}
            </button>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="matched">Matched</option>
              <option value="unmatched">Unmatched</option>
            </select>
          </div>
          <div style={{ flex: 1, marginLeft: '10px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search Description / ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Bank Tabs */}
        <div className="bank-tabs">
          {loading ? (
            <div style={{ padding: '10px', color: '#666' }}>Loading banks...</div>
          ) : banks.length === 0 ? (
            <div style={{ padding: '10px', color: '#f59e0b' }}>
              No banks found. Check if Banks API is working.
              <button
                onClick={() => window.location.reload()}
                style={{ marginLeft: '10px', padding: '4px 8px', cursor: 'pointer' }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <button
                className={`bank-tab ${selectedBank === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedBank('all')}
              >
                All Banks
              </button>
              <button
                className={`bank-tab ${selectedBank === 'unassigned' ? 'active' : ''}`}
                onClick={() => setSelectedBank('unassigned')}
                style={{ background: selectedBank === 'unassigned' ? '#f59e0b' : undefined }}
              >
                Unassigned
              </button>
              {banks.map((bank) => (
                <button
                  key={bank.id}
                  className={`bank-tab ${selectedBank === bank.id ? 'active' : ''}`}
                  onClick={() => setSelectedBank(bank.id)}
                >
                  {bank.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Selected Bank Info */}
      {selectedBankData && (
        <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h4 style={{ margin: 0, marginBottom: '8px' }}>{selectedBankData.name}</h4>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px' }}>
                <div>
                  <span style={{ color: '#666' }}>BSB: </span>
                  <strong style={{ color: '#10b981', userSelect: 'all' }}>{selectedBankData.bsb || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: '#666' }}>Account: </span>
                  <strong style={{ color: '#10b981', userSelect: 'all' }}>{selectedBankData.accountNumber || 'N/A'}</strong>
                </div>
                {selectedBankData.payId && (
                  <div>
                    <span style={{ color: '#666' }}>PayID: </span>
                    <strong style={{ color: '#10b981', userSelect: 'all' }}>{selectedBankData.payId}</strong>
                  </div>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Transacted</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>${selectedBankData.balance}</div>
            </div>
          </div>
        </div>
      )}

      {/* Balance Summary */}
      <div className="quick-stats" style={{ marginBottom: '20px' }}>
        <div className="quick-stat">
          <span className="quick-stat-label">TRANSACTIONS</span>
          <span className="quick-stat-value">{filteredTransactions.length}</span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-label">TOTAL IN</span>
          <span className="quick-stat-value text-success">+{totalIn.toFixed(2)}</span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-label">TOTAL OUT</span>
          <span className="quick-stat-value text-danger">-{totalOut.toFixed(2)}</span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-label">NET</span>
          <span className="quick-stat-value">{(totalIn - totalOut).toFixed(2)}</span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Bank Transactions - {selectedBankData?.name || 'All Banks'}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                // Clear cache and refetch
                const cacheKey = `admin_tx_${selectedBank || 'all'}_${selectedDate || 'all'}`;
                localStorage.removeItem(cacheKey);
                setRefreshKey(prev => prev + 1);
              }}
            >
              <FiRefreshCw /> Refresh
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddModal(true)}
            >
              <FiPlus /> Add Entry
            </button>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Customer</th>
                <th>Type</th>
                <th>In</th>
                <th>Out</th>
                <th>Time</th>
                <th>ID</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {txLoading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    Loading transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    {transactions.length > 0 ? 'No transactions match your filters' : 'No transactions found'}
                  </td>
                </tr>
              ) : (
                <>
                  {filteredTransactions.map((tx, index) => (
                    <tr key={tx.id || index}>
                      <td>{index + 1}</td>
                      <td><strong>{tx.accountName || 'Unknown'}</strong></td>
                      <td>
                        {tx.inAmount ? (
                          <span className="badge badge-success">Deposit</span>
                        ) : (
                          <span className="badge badge-danger">Withdrawal</span>
                        )}
                      </td>
                      <td className="text-success" style={{ fontWeight: '600' }}>{tx.inAmount ? `$${tx.inAmount}` : '-'}</td>
                      <td className="text-danger" style={{ fontWeight: '600' }}>{tx.outAmount ? `$${tx.outAmount}` : '-'}</td>
                      <td className="text-muted">{tx.time}</td>
                      <td><span className="badge badge-info" style={{ fontSize: '10px' }}>{tx.id}</span></td>
                      <td>
                        {tx.match === 'Y' ? (
                          <span className="badge badge-success">Matched</span>
                        ) : (
                          <span className="badge badge-warning">Pending</span>
                        )}
                      </td>
                      <td className="text-muted">{tx.remarks}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f9fafb', fontWeight: '600' }}>
                    <td colSpan="3"><strong>TOTAL</strong></td>
                    <td className="text-success">${totalIn.toFixed(2)}</td>
                    <td className="text-danger">${totalOut.toFixed(2)}</td>
                    <td colSpan="4"></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="modal-overlay" style={{
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
          <div className="modal-content" style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '450px',
            margin: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Add Manual Entry</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <FiX size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Description *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Deposit - John Doe"
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#10b981' }}>In Amount</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    value={newEntry.inAmount}
                    onChange={(e) => setNewEntry({ ...newEntry, inAmount: e.target.value, outAmount: '' })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#ef4444' }}>Out Amount</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    value={newEntry.outAmount}
                    onChange={(e) => setNewEntry({ ...newEntry, outAmount: e.target.value, inAmount: '' })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Remarks</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional notes..."
                  value={newEntry.remarks}
                  onChange={(e) => setNewEntry({ ...newEntry, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleAddEntry}
                >
                  Add Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankTx;
