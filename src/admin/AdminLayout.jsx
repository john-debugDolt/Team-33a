import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import './Admin.css';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [language, setLanguage] = useState('English');
  const navigate = useNavigate();

  const menuItems = [
    { icon: '🎁', label: 'REBATE', path: '/admin/rebate' },
    { icon: '👥', label: 'REFERRER', path: '/admin/referrer' },
    { icon: '💰', label: 'COMMISSION', path: '/admin/commission' },
    { icon: '✉️', label: 'SMS', path: '/admin/sms' },
    { icon: '🏦', label: 'MANAGE BANK', path: '/admin/bank' },
    { icon: '👔', label: 'MANAGE STAFF', path: '/admin/staff' },
    { icon: '📢', label: 'PROMOTION', path: '/admin/promotion' },
    { icon: '🎮', label: 'GAME KIOSK', path: '/admin/game-kiosk' },
    { icon: '⚙️', label: 'GAME SETTING', path: '/admin/game-setting' },
    { icon: '🔧', label: 'SETTING', path: '/admin/setting' },
    { icon: '🖥️', label: 'DISPLAY', path: '/admin/display' },
    { icon: '🎨', label: 'THEME', path: '/admin/theme' },
  ];

  const topNavItems = [
    { icon: '💬', label: 'Chat', path: '/admin/chat' },
    { icon: '🔄', label: 'Transfer', path: '/admin/transfer' },
    { icon: '📊', label: 'Dashboard', path: '/admin/dashboard' },
    { icon: '👤', label: 'Users', path: '/admin/users' },
    { icon: '📈', label: 'Reports', path: '/admin/reports' },
  ];

  return (
    <div className="admin-layout">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <span className="admin-logo">ADMIN</span>
        </div>

        <nav className="admin-top-nav">
          {topNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
            </NavLink>
          ))}
        </nav>

        <button
          className="admin-menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>
      </header>

      {/* Sub Header */}
      <div className="admin-subheader">
        <div className="admin-subheader-left">
          <a href="#" className="pin-link">PIN4</a>
          <a href="#" className="pin-link">PIN5</a>
        </div>
        <div className="admin-subheader-right">
          <button
            className={`sound-toggle ${soundOn ? 'on' : 'off'}`}
            onClick={() => setSoundOn(!soundOn)}
          >
            Sound {soundOn ? 'On' : 'Off'}
          </button>
          <select
            className="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="English">English</option>
            <option value="Chinese">中文</option>
            <option value="Malay">Malay</option>
          </select>
          <span className="timezone-info">
            System: +08:00 Device: +11:00
          </span>
        </div>
      </div>

      <div className="admin-body">
        {/* Main Content */}
        <main className="admin-content">
          <Outlet />
        </main>

        {/* Right Sidebar */}
        <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="admin-sidebar-nav">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
};

export default AdminLayout;
