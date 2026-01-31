import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { keycloakService } from '../services/keycloakService'
import { accountService } from '../services/accountService'
import { walletService } from '../services/walletService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import loginBanner from '../images/login and signup banner.png'
import './Login.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()
  const { showToast } = useToast()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  const formatPhoneForKeycloak = (phoneNumber) => {
    let cleaned = phoneNumber.replace(/[\s-]/g, '')
    if (cleaned.startsWith('0')) {
      cleaned = '+61' + cleaned.substring(1)
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+61' + cleaned
    }
    return cleaned
  }

  const handleLogin = async (e) => {
    e.preventDefault()

    if (!phone.trim()) {
      showToast('Please enter your phone number', 'error')
      return
    }

    if (!password.trim()) {
      showToast('Please enter your password', 'error')
      return
    }

    setLoading(true)

    const formattedPhone = formatPhoneForKeycloak(phone.trim())

    // Step 1: Authenticate with Keycloak
    const authResult = await keycloakService.login(formattedPhone, password)

    if (!authResult.success) {
      showToast(authResult.error || 'Invalid phone number or password', 'error')
      setLoading(false)
      return
    }

    // Step 2: Fetch account details by phone
    const accountResult = await accountService.getAccountByPhone(formattedPhone)

    if (!accountResult.success) {
      showToast('Account not found. Please register first.', 'error')
      setLoading(false)
      return
    }

    const account = accountResult.account

    // Step 3: Fetch balance
    const balanceResult = await walletService.getBalance(account.accountId)

    // Step 4: Build user data and login
    const userData = {
      accountId: account.accountId,
      firstName: account.firstName,
      lastName: account.lastName,
      fullName: `${account.firstName} ${account.lastName}`,
      phone: account.phoneNumber,
      balance: balanceResult.success ? balanceResult.balance : 0,
      status: account.status,
    }

    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('accountId', account.accountId)

    const loginResult = await login({ _userData: userData })

    if (loginResult.success) {
      showToast(`Welcome back, ${userData.firstName}!`, 'success')
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    } else {
      showToast('Login failed. Please try again.', 'error')
    }

    setLoading(false)
  }

  return (
    <div className="login-page-golden">
      <Link to="/" className="back-btn-golden">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span>Back</span>
      </Link>

      <div className="login-layout">
        <div className="login-banner">
          <img src={loginBanner} alt="Welcome Banner" />
        </div>

        <div className="login-form-section">
          <div className="login-container-golden">
            <h1 className="login-title-golden">Login</h1>

            <form onSubmit={handleLogin} className="login-form-golden">
              <div className="form-group-golden">
                <label className="form-label-golden">Mobile Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0412345678"
                  className="form-input-golden"
                  required
                  autoComplete="tel"
                />
              </div>

              <div className="form-group-golden">
                <label className="form-label-golden">Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="form-input-golden"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-btn-golden" disabled={loading}>
                {loading ? <ButtonSpinner /> : 'LOGIN'}
              </button>
            </form>

            <div className="register-section-golden">
              <p className="register-text-golden">Do Not Have An Account Yet?</p>
              <Link to="/signup" className="register-btn-golden">REGISTER</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="side-actions">
        <a href="https://facebook.com/Team33" target="_blank" rel="noopener noreferrer" className="side-action-btn follow">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z"/>
          </svg>
          <span>FOLLOW US</span>
        </a>
        <a href="mailto:support@team33.com" className="side-action-btn complain">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <span>COMPLAIN US</span>
        </a>
      </div>
    </div>
  )
}
