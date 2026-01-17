import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiToggleLeft, FiToggleRight, FiGift, FiInbox } from 'react-icons/fi';

const PROMOTIONS_KEY = 'team33_promotions';

const Promotion = () => {
  const [promotions, setPromotions] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROMOTIONS_KEY);
      if (stored) setPromotions(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading promotions:', e);
    }
  }, []);

  const savePromotions = (newPromotions) => {
    setPromotions(newPromotions);
    localStorage.setItem(PROMOTIONS_KEY, JSON.stringify(newPromotions));
  };

  const toggleStatus = (id) => {
    const updated = promotions.map(promo =>
      promo.id === id ? { ...promo, status: !promo.status } : promo
    );
    savePromotions(updated);
  };

  const deletePromotion = (id) => {
    if (!confirm('Delete this promotion?')) return;
    savePromotions(promotions.filter(p => p.id !== id));
  };

  const activeCount = promotions.filter(p => p.status).length;
  const totalClaims = promotions.reduce((sum, p) => sum + (p.claims || 0), 0);

  return (
    <div className="setting-page">
      <div className="page-header">
        <h1 className="page-title">Promotion Management</h1>
        <button className="btn btn-primary" disabled>
          <FiPlus /> Create Promotion (Requires API)
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon gold"><FiGift /></div>
          <div className="stat-info">
            <h4>Active Promotions</h4>
            <p>{activeCount}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">#</div>
          <div className="stat-info">
            <h4>Total Claims</h4>
            <p>{totalClaims.toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">$</div>
          <div className="stat-info">
            <h4>Bonus Given</h4>
            <p>$0</p>
          </div>
        </div>
      </div>

      {/* Promotions Table */}
      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Type</th>
                <th>Bonus</th>
                <th>Max Bonus</th>
                <th>Turnover</th>
                <th>Claims</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promotions.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No promotions configured. Promotion data will appear when backend API is connected.</p>
                  </td>
                </tr>
              ) : (
                promotions.map((promo) => (
                  <tr key={promo.id}>
                    <td>{promo.id}</td>
                    <td style={{ fontWeight: 600 }}>{promo.title}</td>
                    <td>
                      <span className={`badge ${
                        promo.type === 'First Deposit' ? 'badge-success' :
                        promo.type === 'Reload' ? 'badge-info' :
                        promo.type === 'Cashback' ? 'badge-warning' :
                        promo.type === 'VIP Only' ? 'badge-info' : 'badge-success'
                      }`}>
                        {promo.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#16a34a' }}>{promo.bonus}</td>
                    <td>{promo.maxBonus}</td>
                    <td>{promo.turnover}</td>
                    <td>{(promo.claims || 0).toLocaleString()}</td>
                    <td style={{ color: '#6b7280' }}>{promo.expires}</td>
                    <td>
                      <button
                        onClick={() => toggleStatus(promo.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: promo.status ? '#16a34a' : '#dc2626',
                          fontSize: '24px'
                        }}
                      >
                        {promo.status ? <FiToggleRight /> : <FiToggleLeft />}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                          <FiEye />
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                          <FiEdit2 />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => deletePromotion(promo.id)}>
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Promotion Types */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">Promotion Types Guide</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            {[
              { type: 'First Deposit', desc: 'One-time bonus for new members' },
              { type: 'Reload', desc: 'Bonus on subsequent deposits' },
              { type: 'Cashback', desc: 'Percentage return on losses' },
              { type: 'VIP Only', desc: 'Exclusive for VIP members' },
              { type: 'Referral', desc: 'Reward for referring new members' },
              { type: 'Free Spin', desc: 'Free spins on slot games' },
            ].map((item, index) => (
              <div key={index} style={{ padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', marginBottom: '5px' }}>{item.type}</h4>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Promotion;
