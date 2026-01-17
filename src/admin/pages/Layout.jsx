import { FiEdit, FiLayout, FiMonitor, FiSmartphone } from 'react-icons/fi';

const Layout = () => {
  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiEdit style={{ marginRight: '10px' }} /> Layout Manager</h1>
        <p>Customize the website layout and design</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3><FiLayout /> Layout Settings</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div className="setting-card">
              <FiMonitor size={40} style={{ color: '#3b82f6', marginBottom: '10px' }} />
              <h4>Desktop Layout</h4>
              <p>Configure desktop view settings</p>
              <button className="btn btn-primary btn-sm">Configure</button>
            </div>
            <div className="setting-card">
              <FiSmartphone size={40} style={{ color: '#10b981', marginBottom: '10px' }} />
              <h4>Mobile Layout</h4>
              <p>Configure mobile view settings</p>
              <button className="btn btn-primary btn-sm">Configure</button>
            </div>
            <div className="setting-card">
              <FiLayout size={40} style={{ color: '#f59e0b', marginBottom: '10px' }} />
              <h4>Homepage Layout</h4>
              <p>Arrange homepage sections</p>
              <button className="btn btn-primary btn-sm">Configure</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .page-header {
          margin-bottom: 24px;
        }
        .page-header h1 {
          display: flex;
          align-items: center;
          font-size: 24px;
          margin-bottom: 8px;
        }
        .page-header p {
          color: #666;
        }
        .card-header {
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
        }
        .card-header h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 16px;
        }
        .card-body {
          padding: 20px;
        }
        .setting-card {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 24px;
          text-align: center;
        }
        .setting-card h4 {
          margin: 10px 0 5px;
        }
        .setting-card p {
          color: #666;
          font-size: 13px;
          margin-bottom: 15px;
        }
      `}</style>
    </div>
  );
};

export default Layout;
