import { useState } from 'react';
import { FiMessageCircle, FiSend, FiBell, FiMail, FiUsers, FiEdit } from 'react-icons/fi';

const Messaging = () => {
  const [messageType, setMessageType] = useState('broadcast');
  const [message, setMessage] = useState('');

  const templates = [
    { id: 1, name: 'Welcome Message', preview: 'Welcome to our platform! We\'re excited to have you...' },
    { id: 2, name: 'Deposit Confirmed', preview: 'Your deposit of ${amount} has been confirmed...' },
    { id: 3, name: 'Withdrawal Approved', preview: 'Your withdrawal request has been approved...' },
    { id: 4, name: 'Promotion Alert', preview: 'Don\'t miss out! Get ${bonus}% bonus on your next deposit...' },
  ];

  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiMessageCircle style={{ marginRight: '10px' }} /> Messaging Center</h1>
        <p>Send notifications and messages to users</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3><FiSend /> Send Message</h3>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label>Message Type</label>
              <div className="btn-group">
                <button
                  className={`btn ${messageType === 'broadcast' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMessageType('broadcast')}
                >
                  <FiUsers /> Broadcast to All
                </button>
                <button
                  className={`btn ${messageType === 'individual' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMessageType('individual')}
                >
                  <FiMail /> Individual User
                </button>
              </div>
            </div>

            {messageType === 'individual' && (
              <div className="form-group">
                <label>Recipient</label>
                <input type="text" className="form-input" placeholder="Enter username or email" />
              </div>
            )}

            <div className="form-group">
              <label>Subject</label>
              <input type="text" className="form-input" placeholder="Message subject" />
            </div>

            <div className="form-group">
              <label>Message</label>
              <textarea
                className="form-input"
                rows="5"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Send via</label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked /> In-App Notification
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" /> Email
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" /> SMS
                </label>
              </div>
            </div>

            <button className="btn btn-primary">
              <FiSend /> Send Message
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3><FiBell /> Message Templates</h3>
          </div>
          <div className="card-body">
            {templates.map(template => (
              <div key={template.id} className="template-item">
                <div>
                  <strong>{template.name}</strong>
                  <p>{template.preview}</p>
                </div>
                <button className="btn btn-secondary btn-sm"><FiEdit /></button>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '12px' }}>
              + Add Template
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; }
        .page-header h1 { display: flex; align-items: center; font-size: 24px; margin-bottom: 8px; }
        .page-header p { color: #666; }
        .card-header { padding: 16px 20px; border-bottom: 1px solid #eee; }
        .card-header h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; }
        .card-body { padding: 20px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
        .form-input { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; }
        textarea.form-input { resize: vertical; }
        .btn-group { display: flex; gap: 8px; }
        .checkbox-label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
        .template-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
        .template-item:last-of-type { border-bottom: none; }
        .template-item p { font-size: 12px; color: #666; margin: 4px 0 0; }
      `}</style>
    </div>
  );
};

export default Messaging;
