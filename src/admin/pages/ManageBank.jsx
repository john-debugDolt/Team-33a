import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';

const API_KEY = 'team33-admin-secret-key-2024';

const ManageBank = () => {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [formData, setFormData] = useState({
    bankName: '',
    accountName: '',
    bsb: '',
    accountNumber: '',
    payId: '',
    status: 'ACTIVE'
  });

  // Fetch banks from API
  const fetchBanks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/banks', {
        headers: { 'X-API-Key': API_KEY }
      });

      if (response.ok) {
        const data = await response.json();
        setBanks(Array.isArray(data) ? data : []);
      } else {
        setError(`Failed to fetch banks: ${response.status}`);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  // Toggle bank status
  const toggleStatus = async (bank) => {
    const newStatus = bank.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const response = await fetch(`/api/banks/${bank.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setBanks(banks.map(b => b.id === bank.id ? { ...b, status: newStatus } : b));
      } else {
        alert('Failed to update bank status');
      }
    } catch (err) {
      alert('Network error updating bank');
    }
  };

  // Add new bank
  const handleAddBank = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowAddModal(false);
        resetForm();
        fetchBanks();
      } else {
        const error = await response.json();
        alert(`Failed to add bank: ${error.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Network error adding bank');
    }
  };

  // Update bank
  const handleUpdateBank = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/banks/${editingBank.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setEditingBank(null);
        resetForm();
        fetchBanks();
      } else {
        const error = await response.json();
        alert(`Failed to update bank: ${error.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Network error updating bank');
    }
  };

  // Delete bank
  const handleDeleteBank = async (bank) => {
    if (!confirm(`Are you sure you want to delete ${bank.bankName}?`)) return;
    try {
      const response = await fetch(`/api/banks/${bank.id}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': API_KEY }
      });

      if (response.ok) {
        setBanks(banks.filter(b => b.id !== bank.id));
      } else {
        alert('Failed to delete bank');
      }
    } catch (err) {
      alert('Network error deleting bank');
    }
  };

  // Open edit modal
  const openEditModal = (bank) => {
    setEditingBank(bank);
    setFormData({
      bankName: bank.bankName || '',
      accountName: bank.accountName || '',
      bsb: bank.bsb || '',
      accountNumber: bank.accountNumber || '',
      payId: bank.payId || '',
      status: bank.status || 'ACTIVE'
    });
  };

  // Reset form
  const resetForm = () => {
    setFormData({ bankName: '', accountName: '', bsb: '', accountNumber: '', payId: '', status: 'ACTIVE' });
  };

  // Calculate stats
  const activeCount = banks.filter(b => b.status === 'ACTIVE').length;
  const totalTransacted = banks.reduce((sum, b) => sum + (b.totalTransactedAmount || 0), 0);

  return (
    <div className="manage-bank-page">
      <div className="page-header">
        <h1 className="page-title">Manage Bank Accounts</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchBanks} disabled={loading}>
            <FiRefreshCw className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
            <FiPlus /> Add Bank Account
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: '15px', background: '#fef2f2', color: '#dc2626', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiAlertCircle size={20} /><span>{error}</span>
          <button onClick={fetchBanks} style={{ marginLeft: 'auto' }} className="btn btn-sm btn-secondary">Retry</button>
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon green">$</div>
          <div className="stat-info"><h4>Total Transacted</h4><p>${totalTransacted.toLocaleString()}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">#</div>
          <div className="stat-info"><h4>Active Accounts</h4><p>{activeCount}</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">#</div>
          <div className="stat-info"><h4>Total Accounts</h4><p>{banks.length}</p></div>
        </div>
      </div>

      {loading && banks.length === 0 && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <FiRefreshCw size={32} className="spin" style={{ marginBottom: '10px', color: '#666' }} />
          <p>Loading bank accounts...</p>
        </div>
      )}

      {!loading && (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Bank Name</th>
                  <th>Account Name</th>
                  <th>BSB</th>
                  <th>Account Number</th>
                  <th>PayID</th>
                  <th>Total Transacted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {banks.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No bank accounts found</td></tr>
                ) : (
                  banks.map((bank) => (
                    <tr key={bank.id}>
                      <td>{bank.id}</td>
                      <td style={{ fontWeight: 600 }}>{bank.bankName}</td>
                      <td>{bank.accountName}</td>
                      <td style={{ fontFamily: 'monospace' }}>{bank.bsb || '-'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{bank.accountNumber}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{bank.payId || '-'}</td>
                      <td style={{ fontWeight: 600 }}>${(bank.totalTransactedAmount || 0).toLocaleString()}</td>
                      <td>
                        <button onClick={() => toggleStatus(bank)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: bank.status === 'ACTIVE' ? '#16a34a' : '#dc2626', fontSize: '24px' }}>
                          {bank.status === 'ACTIVE' ? <FiToggleRight /> : <FiToggleLeft />}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEditModal(bank)}><FiEdit2 /></button>
                          <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDeleteBank(bank)}><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header"><h3 className="card-title">Bank Account Guidelines</h3></div>
        <div className="card-body">
          <ul style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
            <li>Bank accounts are used to receive customer deposits</li>
            <li>BSB is required for Australian bank transfers</li>
            <li>PayID can be email or phone number for instant transfers</li>
            <li>Inactive accounts will not be shown to customers for deposits</li>
          </ul>
        </div>
      </div>

      {(showAddModal || editingBank) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', width: '90%', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>{editingBank ? 'Edit Bank Account' : 'Add Bank Account'}</h3>
            <form onSubmit={editingBank ? handleUpdateBank : handleAddBank}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Bank Name *</label>
                <input type="text" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="e.g. Commonwealth Bank" />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Account Name *</label>
                <input type="text" value={formData.accountName} onChange={(e) => setFormData({ ...formData, accountName: e.target.value })} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="e.g. Team33 Holdings" />
              </div>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>BSB</label>
                  <input type="text" value={formData.bsb} onChange={(e) => setFormData({ ...formData, bsb: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="e.g. 062-000" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Account Number *</label>
                  <input type="text" value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="e.g. 12345678" />
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>PayID (optional)</label>
                <input type="text" value={formData.payId} onChange={(e) => setFormData({ ...formData, payId: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} placeholder="e.g. payments@team33.com" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setEditingBank(null); resetForm(); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingBank ? 'Update Bank' : 'Add Bank'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default ManageBank;
