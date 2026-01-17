import { useState, useEffect } from 'react';
import { FiSave, FiImage, FiType, FiLayout, FiToggleRight, FiToggleLeft, FiCheck, FiInbox } from 'react-icons/fi';

const DISPLAY_KEY = 'team33_display_settings';

const defaultSettings = {
  banners: [],
  popups: [],
  announcement: {
    text: 'Welcome to Team33! New members get 100% bonus on first deposit. Play responsibly.',
    speed: 'normal',
    color: '#d4af37',
    enabled: true
  }
};

const Display = () => {
  const [banners, setBanners] = useState([]);
  const [popups, setPopups] = useState([]);
  const [announcement, setAnnouncement] = useState(defaultSettings.announcement);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISPLAY_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.banners) setBanners(data.banners);
        if (data.popups) setPopups(data.popups);
        if (data.announcement) setAnnouncement({ ...defaultSettings.announcement, ...data.announcement });
      }
    } catch (e) {
      console.error('Error loading display settings:', e);
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(DISPLAY_KEY, JSON.stringify({ banners, popups, announcement }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Failed to save settings');
    }
  };

  const toggleBanner = (id) => {
    setBanners(banners.map(b => b.id === id ? { ...b, status: !b.status } : b));
  };

  const togglePopup = (id) => {
    setPopups(popups.map(p => p.id === id ? { ...p, status: !p.status } : p));
  };

  const deleteBanner = (id) => {
    if (!confirm('Delete this banner?')) return;
    setBanners(banners.filter(b => b.id !== id));
  };

  const deletePopup = (id) => {
    if (!confirm('Delete this popup?')) return;
    setPopups(popups.filter(p => p.id !== id));
  };

  return (
    <div className="display-page">
      <div className="page-header">
        <h1 className="page-title">Display Settings</h1>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><FiCheck /> Saved!</> : <><FiSave /> Save Changes</>}
        </button>
      </div>

      {/* Banner Management */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <FiImage style={{ marginRight: '10px' }} />
            Banner Management
          </h3>
          <button className="btn btn-secondary" style={{ padding: '8px 16px' }} disabled>
            + Add Banner (Requires API)
          </button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Title</th>
                <th>Position</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {banners.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No banners configured. Banner data will appear when backend API is connected.</p>
                  </td>
                </tr>
              ) : (
                banners.map((banner) => (
                  <tr key={banner.id}>
                    <td>
                      <input
                        type="number"
                        value={banner.order}
                        onChange={(e) => setBanners(banners.map(b => b.id === banner.id ? { ...b, order: Number(e.target.value) } : b))}
                        style={{ width: '50px', padding: '5px', border: '1px solid #e5e7eb', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>{banner.title}</td>
                    <td>
                      <span className="badge badge-info">{banner.position}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleBanner(banner.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: banner.status ? '#16a34a' : '#dc2626',
                          fontSize: '24px'
                        }}
                      >
                        {banner.status ? <FiToggleRight /> : <FiToggleLeft />}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => deleteBanner(banner.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popup Management */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <FiLayout style={{ marginRight: '10px' }} />
            Popup Management
          </h3>
          <button className="btn btn-secondary" style={{ padding: '8px 16px' }} disabled>
            + Add Popup (Requires API)
          </button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {popups.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No popups configured. Popup data will appear when backend API is connected.</p>
                  </td>
                </tr>
              ) : (
                popups.map((popup) => (
                  <tr key={popup.id}>
                    <td style={{ fontWeight: 600 }}>{popup.title}</td>
                    <td>
                      <span className="badge badge-warning">{popup.trigger}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => togglePopup(popup.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: popup.status ? '#16a34a' : '#dc2626',
                          fontSize: '24px'
                        }}
                      >
                        {popup.status ? <FiToggleRight /> : <FiToggleLeft />}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => deletePopup(popup.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Announcement Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <FiType style={{ marginRight: '10px' }} />
            Marquee Announcement
          </h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Announcement Text</label>
            <textarea
              className="form-input"
              rows="3"
              placeholder="Enter scrolling announcement text..."
              value={announcement.text}
              onChange={(e) => setAnnouncement({ ...announcement, text: e.target.value })}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '15px' }}>
            <div className="form-group">
              <label className="form-label">Scroll Speed</label>
              <select
                className="form-select"
                value={announcement.speed}
                onChange={(e) => setAnnouncement({ ...announcement, speed: e.target.value })}
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Text Color</label>
              <input
                type="color"
                value={announcement.color}
                onChange={(e) => setAnnouncement({ ...announcement, color: e.target.value })}
                style={{ width: '100%', height: '40px', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Display</label>
              <select
                className="form-select"
                value={announcement.enabled ? 'on' : 'off'}
                onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.value === 'on' })}
              >
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Display;
