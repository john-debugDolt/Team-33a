import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/TranslationContext'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import loginBanner from '../images/login and signup banner.png'
import './Login.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [formData, setFormData] = useState({
    phone: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)


  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Direct login - no OTP required
    const result = await login({
      phone: formData.phone.trim(),
      username: formData.phone.trim(),
      password: formData.password
    })

    if (result.success) {
      const user = result.data.user
      const displayName = user.firstName || user.fullName || user.username || user.email
      showToast(`Welcome back, ${displayName}!`, 'success')
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    } else {
      showToast(result.message || result.error || 'Login failed', 'error')
    }
    setLoading(false)
  }

  return (
    <div className="login-page-golden">
      {/* Back Button */}
      <Link to="/" className="back-btn-golden">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span>Back</span>
      </Link>


      {/* Two Column Layout */}
      <div className="login-layout">
        {/* Banner Section - Left Side */}
        <div className="login-banner">
          <img src={loginBanner} alt="Welcome Banner" />
        </div>

        {/* Form Section - Right Side */}
        <div className="login-form-section">
          <div className="login-container-golden">
            <h1 className="login-title-golden">Login</h1>

            <form onSubmit={handleSubmit} className="login-form-golden">
          {/* Phone/Username Field */}
          <div className="form-group-golden">
            <label className="form-label-golden">Mobile No / Username</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="e.g. 61480050689"
              className="form-input-golden"
              required
              autoComplete="username"
            />
          </div>

          {/* Password Field */}
          <div className="form-group-golden">
            <label className="form-label-golden">Password</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="6 - 20 characters"
                className="form-input-golden"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-golden"
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

          {/* Login Button */}
          <button type="submit" className="login-btn-golden" disabled={loading}>
            {loading ? <ButtonSpinner /> : 'LOGIN'}
          </button>
        </form>

            {/* Register Section */}
            <div className="register-section-golden">
              <p className="register-text-golden">Do Not Have An Account Yet?</p>
              <Link to="/signup" className="register-btn-golden">REGISTER</Link>
            </div>

            {/* Forgot Password */}
            <Link to="/forgot-password" className="forgot-link-golden">
              Forgot Password
            </Link>
          </div>
        </div>
      </div>

      {/* Side Action Buttons (Desktop Only) */}
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
