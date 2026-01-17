export default function PlaceholderPage({ title, icon }) {
  return (
    <div className="admin-page">
      <h1 className="admin-page-title">{title}</h1>
      <div className="placeholder-content">
        <div className="placeholder-icon">{icon}</div>
        <h2>{title}</h2>
        <p>This module requires backend API integration to function.</p>
        <div className="placeholder-features">
          <div className="feature-item">
            <span className="feature-check">✓</span>
            <span>Full CRUD operations</span>
          </div>
          <div className="feature-item">
            <span className="feature-check">✓</span>
            <span>Search and filter</span>
          </div>
          <div className="feature-item">
            <span className="feature-check">✓</span>
            <span>Export to CSV/Excel</span>
          </div>
          <div className="feature-item">
            <span className="feature-check">✓</span>
            <span>Real-time updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}
