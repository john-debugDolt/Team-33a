import { FiFileText, FiCheck, FiAlertCircle, FiTool, FiZap } from 'react-icons/fi';

const Changelog = () => {
  const releases = [
    {
      version: '2.5.0',
      date: 'January 15, 2024',
      type: 'major',
      changes: [
        { type: 'feature', text: 'Added withdrawal request support with bank details' },
        { type: 'feature', text: 'Multi-language support for admin panel' },
        { type: 'improvement', text: 'Improved transaction history with real-time updates' },
        { type: 'fix', text: 'Fixed balance sync issues after game sessions' },
      ]
    },
    {
      version: '2.4.2',
      date: 'January 10, 2024',
      type: 'patch',
      changes: [
        { type: 'fix', text: 'Fixed login OTP verification timeout' },
        { type: 'fix', text: 'Resolved deposit status not updating correctly' },
        { type: 'improvement', text: 'Enhanced mobile responsiveness' },
      ]
    },
    {
      version: '2.4.0',
      date: 'January 5, 2024',
      type: 'minor',
      changes: [
        { type: 'feature', text: 'Added live chat support system' },
        { type: 'feature', text: 'New game detail modal with features display' },
        { type: 'improvement', text: 'Optimized API calls for faster loading' },
        { type: 'fix', text: 'Fixed user registration phone validation' },
      ]
    },
    {
      version: '2.3.0',
      date: 'December 28, 2023',
      type: 'minor',
      changes: [
        { type: 'feature', text: 'Deposit request system with admin approval' },
        { type: 'feature', text: 'Transaction history page' },
        { type: 'improvement', text: 'Better error handling and user feedback' },
      ]
    },
  ];

  const getTypeIcon = (type) => {
    switch (type) {
      case 'feature': return <FiZap style={{ color: '#3b82f6' }} />;
      case 'improvement': return <FiTool style={{ color: '#10b981' }} />;
      case 'fix': return <FiAlertCircle style={{ color: '#f59e0b' }} />;
      default: return <FiCheck />;
    }
  };

  const getVersionBadge = (type) => {
    switch (type) {
      case 'major': return 'badge-danger';
      case 'minor': return 'badge-primary';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiFileText style={{ marginRight: '10px' }} /> Changelog</h1>
        <p>Version history and release notes</p>
      </div>

      <div className="changelog-list">
        {releases.map((release, index) => (
          <div key={index} className="release-card">
            <div className="release-header">
              <div>
                <span className={`badge ${getVersionBadge(release.type)}`}>v{release.version}</span>
                <span className="release-date">{release.date}</span>
              </div>
              <span className="release-type">{release.type.toUpperCase()}</span>
            </div>
            <ul className="changes-list">
              {release.changes.map((change, i) => (
                <li key={i}>
                  {getTypeIcon(change.type)}
                  <span className={`change-type type-${change.type}`}>{change.type}</span>
                  {change.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; }
        .page-header h1 { display: flex; align-items: center; font-size: 24px; margin-bottom: 8px; }
        .page-header p { color: #666; }
        .changelog-list { display: flex; flex-direction: column; gap: 20px; }
        .release-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .release-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
        .release-date { margin-left: 12px; color: #666; font-size: 14px; }
        .release-type { font-size: 11px; color: #999; font-weight: 500; }
        .changes-list { list-style: none; padding: 0; margin: 0; }
        .changes-list li { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
        .change-type { font-size: 11px; font-weight: 500; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; }
        .type-feature { background: #dbeafe; color: #3b82f6; }
        .type-improvement { background: #dcfce7; color: #10b981; }
        .type-fix { background: #fef3c7; color: #f59e0b; }
        .badge-primary { background: #3b82f6; color: white; }
        .badge-danger { background: #ef4444; color: white; }
      `}</style>
    </div>
  );
};

export default Changelog;
