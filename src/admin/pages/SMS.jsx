import { useState, useEffect } from 'react';
import { FiSend, FiUsers, FiMessageCircle, FiClock, FiInbox } from 'react-icons/fi';

const SMS_HISTORY_KEY = 'team33_sms_history';

const defaultTemplates = [
  { id: 1, name: 'Welcome Message', content: 'Welcome to Team33! Your account has been created successfully.' },
  { id: 2, name: 'Deposit Confirmation', content: 'Your deposit of {amount} has been received. Thank you!' },
  { id: 3, name: 'Withdrawal Confirmation', content: 'Your withdrawal of {amount} has been processed.' },
  { id: 4, name: 'Promotion Alert', content: 'New promotion available! {promo_details}' },
];

const SMS = () => {
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('all');
  const [smsHistory, setSmsHistory] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(SMS_HISTORY_KEY);
      if (storedHistory) setSmsHistory(JSON.parse(storedHistory));
    } catch (e) {
      console.error('Error loading SMS history:', e);
    }
  }, []);

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    if (templateId) {
      const template = defaultTemplates.find(t => t.id === parseInt(templateId));
      if (template) setMessage(template.content);
    }
  };

  const totalSent = smsHistory.reduce((sum, item) => sum + (item.sent || 0), 0);
  const totalDelivered = smsHistory.reduce((sum, item) => sum + (item.delivered || 0), 0);

  return (
    <div className="sms-page">
      <div className="page-header">
        <h1 className="page-title">SMS Management</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Send SMS */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <FiMessageCircle style={{ marginRight: '8px' }} />
              Send SMS
            </h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Recipients</label>
              <select
                className="form-select"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              >
                <option value="all">All Members</option>
                <option value="vip">VIP Members Only</option>
                <option value="active">Active Members</option>
                <option value="inactive">Inactive Members</option>
                <option value="new">New Members (Last 7 days)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Template (Optional)</label>
              <select
                className="form-select"
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                <option value="">-- Select Template --</option>
                {defaultTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea
                className="form-input"
                rows="5"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{ resize: 'vertical' }}
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>
                {message.length}/160 characters
              </small>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '15px' }} disabled>
              <FiSend /> Send SMS (Requires API)
            </button>
          </div>
        </div>

        {/* SMS Stats */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">SMS Statistics</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gap: '15px' }}>
              <div className="stat-card">
                <div className="stat-icon blue"><FiSend /></div>
                <div className="stat-info">
                  <h4>Total Sent</h4>
                  <p>{totalSent.toLocaleString()}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green"><FiMessageCircle /></div>
                <div className="stat-info">
                  <h4>Delivered</h4>
                  <p>{totalDelivered.toLocaleString()}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange"><FiClock /></div>
                <div className="stat-info">
                  <h4>Pending</h4>
                  <p>0</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon gold"><FiUsers /></div>
                <div className="stat-info">
                  <h4>Credits Remaining</h4>
                  <p>--</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SMS History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">SMS History</h3>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Recipients</th>
                <th>Message</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {smsHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No SMS history. SMS data will appear when backend API is connected.</p>
                  </td>
                </tr>
              ) : (
                smsHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>
                      <span className="badge badge-info">{item.recipient}</span>
                    </td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.message}
                    </td>
                    <td>{item.sent?.toLocaleString() || 0}</td>
                    <td style={{ color: '#16a34a' }}>{item.delivered?.toLocaleString() || 0}</td>
                    <td style={{ color: '#6b7280' }}>{item.date}</td>
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

export default SMS;
