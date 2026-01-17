import { useState, useEffect } from 'react';
import { FiSearch, FiRefreshCw, FiPlay, FiPause, FiInbox } from 'react-icons/fi';

const PROVIDERS_KEY = 'team33_game_providers';

const GameKiosk = () => {
  const [providers, setProviders] = useState([]);
  const [recentPlays, setRecentPlays] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROVIDERS_KEY);
      if (stored) setProviders(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading providers:', e);
    }
  }, []);

  const filteredPlays = recentPlays.filter(play =>
    play.user?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="game-kiosk-page">
      <div className="page-header">
        <h1 className="page-title">Game Kiosk</h1>
        <button className="btn btn-primary" disabled>
          <FiRefreshCw /> Sync Providers (Requires API)
        </button>
      </div>

      {/* Provider Grid */}
      {providers.length === 0 ? (
        <div className="card" style={{ marginBottom: '20px', padding: '40px', textAlign: 'center' }}>
          <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5, color: '#6b7280' }} />
          <p style={{ margin: 0, color: '#6b7280' }}>No game providers configured. Provider data will appear when backend API is connected.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          {providers.map((provider) => (
            <div key={provider.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', marginBottom: '5px' }}>{provider.name}</h3>
                  <span className={`badge ${provider.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                    {provider.status}
                  </span>
                </div>
                <button style={{
                  background: provider.status === 'Active' ? '#dcfce7' : '#fee2e2',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px',
                  color: provider.status === 'Active' ? '#16a34a' : '#dc2626',
                  cursor: 'pointer'
                }}>
                  {provider.status === 'Active' ? <FiPlay /> : <FiPause />}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Games</p>
                  <p style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{provider.games || 0}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Balance</p>
                  <p style={{ fontSize: '18px', fontWeight: 600, color: '#16a34a', margin: 0 }}>${provider.balance || 0}</p>
                </div>
              </div>
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Last sync: {provider.lastSync || 'Never'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Plays */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Game Activity</h3>
          <div className="search-box" style={{ width: '250px' }}>
            <FiSearch className="search-icon" />
            <input type="text" placeholder="Search player..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Game</th>
                <th>Provider</th>
                <th>Bet</th>
                <th>Win</th>
                <th>Result</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlays.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No recent game activity. Game data will appear when backend API is connected.</p>
                  </td>
                </tr>
              ) : (
                filteredPlays.map((play, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: 600 }}>{play.user}</td>
                    <td>{play.game}</td>
                    <td>{play.provider}</td>
                    <td>${play.bet || 0}</td>
                    <td style={{ fontWeight: 600, color: play.win > 0 ? '#16a34a' : '#dc2626' }}>${play.win || 0}</td>
                    <td>
                      <span className={`badge ${play.win > 0 ? 'badge-success' : 'badge-danger'}`}>
                        {play.win > 0 ? 'Win' : 'Loss'}
                      </span>
                    </td>
                    <td style={{ color: '#6b7280' }}>{play.time}</td>
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

export default GameKiosk;
