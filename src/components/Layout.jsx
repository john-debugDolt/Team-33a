import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import logo from '../images/New logo.png'
import iconHome from '../images/icon-home.svg'
import iconHistory from '../images/icon-history.svg'
import iconPromo from '../images/icon-promo.svg'
import iconLivechat from '../images/icon-livechat.svg'
import iconSettings from '../images/icon-settings.svg'
import iconWallet from '../images/icon-wallet.svg'

// Bank logos
import bankLogo1 from '../logo/bank1.png'
import bankLogo2 from '../logo/bank2.png'
import bankLogo3 from '../logo/bank3.png'
import bankLogo4 from '../logo/bank4.png'
import bankLogo5 from '../logo/bank5.png'

// License and certification
import licenseLogo from '../license/license.png'
import certLogo from '../cert/cert.png'

const navItems = [
  { name: 'HOME', path: '/', icon: iconHome },
  { name: 'WALLET', path: '/wallet', icon: iconWallet },
  { name: 'HISTORY', path: '/history', icon: iconHistory },
  { name: 'PROMO', path: '/promotions', icon: iconPromo },
  { name: 'LIVECHAT', path: '/livechat', icon: iconLivechat },
  { name: 'SETTINGS', path: '/settings', icon: iconSettings },
]

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const { showToast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)

  // Show welcome popup on first visit
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('team33_welcome_seen')
    if (!hasSeenWelcome) {
      const timer = setTimeout(() => {
        setShowWelcomePopup(true)
      }, 1500) // Show after 1.5 seconds
      return () => clearTimeout(timer)
    }
  }, [])

  const closeWelcomePopup = () => {
    setShowWelcomePopup(false)
    localStorage.setItem('team33_welcome_seen', 'true')
  }

  const toggleMenu = () => setMenuOpen(!menuOpen)
  const closeMenu = () => setMenuOpen(false)

  const handleLogout = async () => {
    await logout()
    showToast('Logged out successfully', 'success')
    closeMenu()
    navigate('/')
  }

  return (
    <div className="app">
      {/* Top Promo Banner */}
      <div className="promo-banner">
        <span>Welcome to Team33! Get up to <strong>$500</strong> bonus on your first deposit</span>
        <Link to="/promotions" className="promo-banner-btn">Claim Now</Link>
      </div>

      {/* Main Header */}
      <header className="header">
        <div className="header-content">
          {/* Hamburger Menu */}
          <button className={`hamburger-btn ${menuOpen ? 'open' : ''}`} onClick={toggleMenu}>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>

          {/* Center - Typewriter Animated Brand Text */}
          <span className="header-brand-text">Team 33</span>

          {/* Logo - Right Side */}
          <Link to="/" className="logo">
            <img src={logo} alt="Team33" className="logo-img" />
          </Link>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="main-nav">
        <div className="nav-content">
          <div className="nav-items">
            {navItems.map((item) => (
              <Link
                key={item.name}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''} ${item.highlight ? 'highlight' : ''}`}
                to={item.path}
              >
                <img src={item.icon} alt="" className="nav-icon" />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
          <button className="nav-more" onClick={toggleMenu}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="19" cy="12" r="1"/>
              <circle cx="5" cy="12" r="1"/>
            </svg>
            MORE
          </button>
        </div>
      </nav>

      {/* Sidebar Menu */}
      <div className={`sidebar-menu ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src={logo} alt="Logo" className="sidebar-logo" />
          <button className="sidebar-close" onClick={closeMenu}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {isAuthenticated ? (
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              <div className="sidebar-user-avatar">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="sidebar-user-details">
                <span className="sidebar-user-name">{user?.username}</span>
                <span className="sidebar-user-balance">${user?.balance?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
            <button className="sidebar-logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        ) : (
          <div className="sidebar-auth">
            <Link to="/login" className="sidebar-auth-link login" onClick={closeMenu}>
              Login
            </Link>
            <Link to="/signup" className="sidebar-auth-link signup" onClick={closeMenu}>
              Sign Up
            </Link>
          </div>
        )}

        <div className="sidebar-divider"></div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.name}
              className={`sidebar-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              to={item.path}
              onClick={closeMenu}
            >
              <img src={item.icon} alt="" className="sidebar-nav-icon" />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>&copy; 2025 Team33</p>
        </div>
      </div>

      {/* Overlay */}
      {menuOpen && <div className="menu-overlay" onClick={closeMenu}></div>}

      {/* Page Content */}
      <main>{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.name}
            className={`bottom-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            to={item.path}
          >
            <img src={item.icon} alt="" className="bottom-nav-icon" />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Information</h4>
            <a href="#">About Us</a>
            <a href="#">Deposit Tutorial</a>
            <Link to="/terms">Terms & Conditions</Link>
            <a href="#">Privacy Policy</a>
            <a href="#">Responsible Gaming</a>
          </div>
          <div className="footer-section">
            <h4>Help Center</h4>
            <a href="#">FAQ</a>
            <Link to="/livechat">Contact Us</Link>
          </div>
          <div className="footer-section">
            <h4>Gaming License</h4>
            <div className="license-badges">
              <img src={licenseLogo} alt="Gaming License" className="footer-badge-img" />
            </div>
          </div>
          <div className="footer-section">
            <h4>Certification</h4>
            <div className="cert-badges">
              <img src={certLogo} alt="Certification" className="footer-badge-img" />
            </div>
          </div>
        </div>

        {/* Payment Methods / Banks */}
        <div className="footer-banks">
          <h4>Payment Methods</h4>
          <div className="bank-logos">
            <img src={bankLogo1} alt="Bank" className="bank-logo" />
            <img src={bankLogo2} alt="Bank" className="bank-logo" />
            <img src={bankLogo3} alt="Bank" className="bank-logo" />
            <img src={bankLogo4} alt="Bank" className="bank-logo" />
            <img src={bankLogo5} alt="Bank" className="bank-logo" />
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2025 team33 All Rights Reserved.</p>
        </div>
      </footer>

      {/* Welcome Popup */}
      {showWelcomePopup && (
        <div className="welcome-popup-overlay" onClick={closeWelcomePopup}>
          <div className="welcome-popup" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={closeWelcomePopup}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="popup-icon">🎰</div>
            <h2 className="popup-title">Welcome to Team 33!</h2>
            <p className="popup-subtitle">
              Join the ultimate gaming experience with exclusive bonuses and rewards
            </p>
            <div className="popup-highlight">
              <span className="popup-bonus">$500</span>
              <span className="popup-bonus-label">Welcome Bonus</span>
            </div>
            <Link to="/signup" className="popup-btn" onClick={closeWelcomePopup}>
              Claim Your Bonus
            </Link>
            <button className="popup-skip" onClick={closeWelcomePopup}>
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
