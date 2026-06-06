import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/TranslationContext'
import { accountService } from '../services/accountService'
import { sweepAllReturns } from '../services/launchTracker'
import FloatingChat from './FloatingChat/FloatingChat'
import logo from '../images/team33newlogo.png'
import loginBtnImg from '../images/login new.png'
import signupBtnImg from '../images/signup new.png'
import iconHome from '../images/icon-home.svg'
import iconSports from '../images/icon-sports.svg'
import iconHistory from '../images/icon-history.svg'
import iconPromo from '../images/icon-promo.svg'
import iconLivechat from '../images/icon-livechat.svg'
import iconSettings from '../images/icon-settings.svg'
import iconWallet from '../images/icon-wallet.svg'
import iconRefer from '../images/icon-refer.svg'

// Bank logos
import bankLogo1 from '../logo/bank1.png'
import bankLogo2 from '../logo/bank2.png'
import bankLogo3 from '../logo/bank3.png'
import bankLogo4 from '../logo/bank4.png'
import bankLogo5 from '../logo/bank5.png'

// License and certification
import licenseLogo from '../license/license.png'
import certLogo from '../cert/cert.png'

const navItemsConfig = [
  { key: 'home', path: '/', icon: iconHome },
  { key: 'sports', path: '/sports', icon: iconSports },
  { key: 'wallet', path: '/wallet', icon: iconWallet },
  { key: 'refer', path: '/refer', icon: iconRefer },
  { key: 'history', path: '/history', icon: iconHistory },
  { key: 'promo', path: '/promotions', icon: iconPromo },
  { key: 'livechat', path: '/livechat', icon: iconLivechat },
  { key: 'settings', path: '/settings', icon: iconSettings },
]

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, updateBalance } = useAuth()
  const { showToast } = useToast()
  const { currentLanguage, languages, t, changeLanguage } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  // Fresh account details fetched on popup open — has phoneNumber etc.
  const [walletAccount, setWalletAccount] = useState(null)

  // Sweep any stranded transfer-wallet sessions whenever the user is back
  // on team33: app mount, tab regains focus, route change, or another tab
  // signals a new session. Backend's 20-min timer is the final fallback.
  useEffect(() => {
    if (!isAuthenticated) return
    sweepAllReturns(updateBalance)
    const onVis = () => {
      if (!document.hidden) sweepAllReturns(updateBalance)
    }
    const onFocus = () => sweepAllReturns(updateBalance)
    // Cross-tab: when another tab adds/changes the launch record,
    // this tab triggers a sweep too.
    const onStorage = (e) => {
      if (e.key === 'team33_active_launches_v1') sweepAllReturns(updateBalance)
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
    }
  }, [isAuthenticated, updateBalance])

  // Also sweep on every route change — handles multi-tab navigation
  // where visibilitychange doesn't fire (both tabs already visible).
  useEffect(() => {
    if (!isAuthenticated) return
    sweepAllReturns(updateBalance)
  }, [location.pathname, isAuthenticated, updateBalance])

  // Fetch the full account record when the wallet popup opens so we have
  // server-truth phoneNumber, bank details (when backend adds them), etc.
  useEffect(() => {
    if (!walletOpen || !user?.accountId) return
    let cancelled = false
    accountService.getAccount(user.accountId).then((res) => {
      if (!cancelled && res?.success && res.account) {
        setWalletAccount(res.account)
      }
    }).catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [walletOpen, user?.accountId])

  // Scroll to top on route change (instant, no animation)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Welcome popup disabled - removed $500 bonus modal on startup
  // useEffect(() => {
  //   const hasSeenWelcome = localStorage.getItem('team33_welcome_seen')
  //   if (!hasSeenWelcome) {
  //     const timer = setTimeout(() => {
  //       setShowWelcomePopup(true)
  //     }, 1500)
  //     return () => clearTimeout(timer)
  //   }
  // }, [])

  const closeWelcomePopup = () => {
    setShowWelcomePopup(false)
    localStorage.setItem('team33_welcome_seen', 'true')
  }

  const toggleMenu = () => setMenuOpen(!menuOpen)
  const closeMenu = () => setMenuOpen(false)

  const handleLogout = async () => {
    await logout()
    showToast(t('logoutSuccess'), 'success')
    closeMenu()
    navigate('/')
  }

  return (
    <div className="app">
      {/* Top Promo Banner */}
      <div className="promo-banner">
        <span>{t('welcomeToTeam33')} {t('getBonus')} <strong>$500</strong> {t('bonusOnDeposit')}</span>
        <Link to="/promotions" className="promo-banner-btn">{t('claimNow')}</Link>
      </div>

      {/* Main Header */}
      <header className="header">
        <div className="header-content">
          {/* Left cluster: Hamburger + Logo */}
          <div className="header-left">
            <button className={`hamburger-btn ${menuOpen ? 'open' : ''}`} onClick={toggleMenu}>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
            <Link to="/" className="logo">
              <img src={logo} alt="Team33" className="logo-img" />
            </Link>
          </div>

          {/* Right: Wallet button (shows balance) */}
          {isAuthenticated ? (
            <button
              className="header-wallet-btn"
              onClick={() => setWalletOpen(true)}
              aria-label="Wallet"
            >
              <svg className="wallet-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
              </svg>
              <span className="wallet-btn-amount">${(Number(user?.balance) || 0).toFixed(2)}</span>
            </button>
          ) : (
            <Link to="/login" className="header-wallet-btn header-wallet-btn-guest">
              <svg className="wallet-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
              </svg>
              <span className="wallet-btn-amount">Login</span>
            </Link>
          )}
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="main-nav">
        <div className="nav-content">
          <div className="nav-items">
            {navItemsConfig.map((item) => (
              <Link
                key={item.key}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                to={item.path}
              >
                <img src={item.icon} alt="" className="nav-icon" />
                <span>{t(item.key)}</span>
              </Link>
            ))}
          </div>
          <button className="nav-more" onClick={toggleMenu}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="19" cy="12" r="1"/>
              <circle cx="5" cy="12" r="1"/>
            </svg>
            {t('more')}
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
                {(user?.firstName || user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
                <span className="vip-badge-small">VIP</span>
              </div>
              <div className="sidebar-user-details">
                <div className="sidebar-user-name-row">
                  <span className="sidebar-user-name">{user?.firstName || user?.fullName || user?.username}</span>
                  <span className="vip-level">Bronze</span>
                </div>
                <span className="sidebar-user-balance">${user?.balance?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
            <button className="sidebar-logout-btn" onClick={handleLogout}>
              {t('logout')}
            </button>
          </div>
        ) : (
          <div className="sidebar-auth">
            <Link to="/login" className="sidebar-auth-img" onClick={closeMenu}>
              <img src={loginBtnImg} alt={t('login')} />
            </Link>
            <Link to="/signup" className="sidebar-auth-img" onClick={closeMenu}>
              <img src={signupBtnImg} alt={t('register')} />
            </Link>
          </div>
        )}

        <div className="sidebar-divider"></div>

        <nav className="sidebar-nav">
          {/* Language Selector */}
          <div className="sidebar-language-section">
            <div
              className="sidebar-nav-item sidebar-lang-toggle"
              onClick={() => setShowLangDropdown(!showLangDropdown)}
            >
              <svg className="sidebar-nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 0 1 6.412 9m6.088 9h7M12 19l3-5 3 5m-5.5-1.5h5"/>
              </svg>
              <span>{t('translate')}</span>
              <span className="lang-current">
                {languages.find(l => l.code === currentLanguage)?.flag}
              </span>
              <svg
                className={`lang-arrow ${showLangDropdown ? 'open' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
            {showLangDropdown && (
              <div className="lang-dropdown">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    className={`lang-option ${currentLanguage === lang.code ? 'active' : ''}`}
                    onClick={() => {
                      changeLanguage(lang.code)
                      setShowLangDropdown(false)
                    }}
                  >
                    <span className="lang-flag">{lang.flag}</span>
                    <span className="lang-name">{lang.name}</span>
                    {currentLanguage === lang.code && (
                      <svg className="lang-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Download App */}
          <Link
            className={`sidebar-nav-item ${location.pathname === '/app' ? 'active' : ''}`}
            to="/app"
            onClick={closeMenu}
          >
            <svg className="sidebar-nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12"/>
              <path d="M7 10l5 5 5-5"/>
              <path d="M5 21h14"/>
            </svg>
            <span>Download App</span>
          </Link>

          {/* Settings */}
          <Link
            className={`sidebar-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
            to="/settings"
            onClick={closeMenu}
          >
            <img src={iconSettings} alt="" className="sidebar-nav-icon" />
            <span>{t('settings')}</span>
          </Link>

          {/* Follow Us */}
          <div className="sidebar-follow-section">
            <div className="sidebar-nav-item sidebar-follow-header">
              <svg className="sidebar-nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>{t('followUs')}</span>
            </div>
            <div className="sidebar-social-links">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="social-link">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
            </div>
          </div>
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
        {navItemsConfig.slice(0, 5).map((item) => (
          <Link
            key={item.key}
            className={`bottom-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            to={item.path}
          >
            <img src={item.icon} alt="" className="bottom-nav-icon" />
            <span>{t(item.key)}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>{t('information')}</h4>
            <a href="#">{t('aboutUs')}</a>
            <a href="#">{t('depositTutorial')}</a>
            <Link to="/terms">{t('termsConditions')}</Link>
            <a href="#">{t('privacyPolicy')}</a>
            <a href="#">{t('responsibleGaming')}</a>
          </div>
          <div className="footer-section">
            <h4>{t('helpCenter')}</h4>
            <a href="#">{t('faq')}</a>
            <Link to="/livechat">{t('contactUs')}</Link>
          </div>
          <div className="footer-section">
            <h4>{t('gamingLicense')}</h4>
            <div className="license-badges">
              <img src={licenseLogo} alt={t('gamingLicense')} className="footer-badge-img" />
            </div>
          </div>
          <div className="footer-section">
            <h4>{t('certification')}</h4>
            <div className="cert-badges">
              <img src={certLogo} alt={t('certification')} className="footer-badge-img" />
            </div>
          </div>
        </div>

        {/* Payment Methods / Banks */}
        <div className="footer-banks">
          <h4>{t('paymentMethods')}</h4>
          <div className="bank-logos">
            <img src={bankLogo1} alt="Bank" className="bank-logo" />
            <img src={bankLogo2} alt="Bank" className="bank-logo" />
            <img src={bankLogo3} alt="Bank" className="bank-logo" />
            <img src={bankLogo4} alt="Bank" className="bank-logo" />
            <img src={bankLogo5} alt="Bank" className="bank-logo" />
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2025 Team33 {t('allRightsReserved')}.</p>
        </div>
      </footer>

      {/* Wallet Popup */}
      {walletOpen && isAuthenticated && (
        <div className="wallet-mask" onClick={() => setWalletOpen(false)}>
          <div className="wallet-popup" onClick={(e) => e.stopPropagation()}>
            <button className="wallet-popup-close" onClick={() => setWalletOpen(false)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="wallet-container">
              <div className="wallet-top-content">
                <div className="wallet-icon-user">
                  {(user?.firstName || user?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="wallet-user-detail">
                  <div className="wallet-user-name">
                    {`${walletAccount?.firstName || user?.firstName || ''} ${walletAccount?.lastName || user?.lastName || ''}`.trim() || user?.username || 'User'}
                  </div>
                  <div className="wallet-info-row">
                    <span className="wallet-info-label">Username</span>
                    <span className="wallet-info-sep">:</span>
                    <span className="wallet-info-value">{user?.username || user?.accountId || '—'}</span>
                  </div>
                  <div className="wallet-info-row">
                    <span className="wallet-info-label">Phone Number</span>
                    <span className="wallet-info-sep">:</span>
                    <span className="wallet-info-value">{walletAccount?.phoneNumber || user?.phoneNumber || user?.phone || '—'}</span>
                  </div>
                  <div className="wallet-info-row">
                    <span className="wallet-info-label">Bank Name</span>
                    <span className="wallet-info-sep">:</span>
                    <span className="wallet-info-value">{walletAccount?.bankName || user?.bankName || '—'}</span>
                  </div>
                  <div className="wallet-info-row">
                    <span className="wallet-info-label">Bank Account Number</span>
                    <span className="wallet-info-sep">:</span>
                    <span className="wallet-info-value">{walletAccount?.bankAccountNumber || user?.bankAccountNumber || user?.bankAccount || '—'}</span>
                  </div>
                  <div className="wallet-info-row">
                    <span className="wallet-info-label">Account Created</span>
                    <span className="wallet-info-sep">:</span>
                    <span className="wallet-info-value">
                      {walletAccount?.createdAt
                        ? new Date(walletAccount.createdAt).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="wallet-bot-content">
                <div className="wallet-balance-row">
                  <div className="wallet-balance-title">Balance<span>:</span></div>
                  <div className="wallet-balance-pill">
                    <span className="wallet-balance-amount">${(Number(user?.balance) || 0).toFixed(2)}</span>
                    <button
                      className="wallet-refresh-btn"
                      onClick={() => window.location.reload()}
                      aria-label="Refresh balance"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="wallet-actions">
                  <Link to="/wallet" className="wallet-action-btn" onClick={() => setWalletOpen(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Deposit</span>
                  </Link>
                  <Link to="/wallet" className="wallet-action-btn" onClick={() => setWalletOpen(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span>Withdraw</span>
                  </Link>
                  <Link to="/history" className="wallet-action-btn" onClick={() => setWalletOpen(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span>History</span>
                  </Link>
                </div>

                <button
                  type="button"
                  className="wallet-logout-btn"
                  onClick={() => { setWalletOpen(false); handleLogout(); }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Widget */}
      <FloatingChat />

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
            <h2 className="popup-title">{t('welcomeToTeam33')}</h2>
            <p className="popup-subtitle">
              {t('joinExperience')}
            </p>
            <div className="popup-highlight">
              <span className="popup-bonus">$500</span>
              <span className="popup-bonus-label">{t('welcomeBonus')}</span>
            </div>
            <Link to="/signup" className="popup-btn" onClick={closeWelcomePopup}>
              {t('claimYourBonus')}
            </Link>
            <button className="popup-skip" onClick={closeWelcomePopup}>
              {t('maybeLater')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
