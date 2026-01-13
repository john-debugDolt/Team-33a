import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/TranslationContext'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import { otpService } from '../services/otpService'
import { accountService } from '../services/accountService'
import logo from '../images/New logo.png'
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

  // OTP state
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [pendingLoginData, setPendingLoginData] = useState(null)
  const otpInputRefs = useRef([])

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendTimer])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newOtp = [...otp]
      digits.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit
      })
      setOtp(newOtp)
      const nextIndex = Math.min(index + digits.length, 5)
      otpInputRefs.current[nextIndex]?.focus()
    } else {
      const newOtp = [...otp]
      newOtp[index] = value.replace(/\D/g, '')
      setOtp(newOtp)
      if (value && index < 5) {
        otpInputRefs.current[index + 1]?.focus()
      }
    }
    setOtpError('')
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const loginIdentifier = formData.phone.trim()

    // Check if it's a phone number (for OTP) or username (skip OTP for demo)
    const isPhoneNumber = loginIdentifier.startsWith('+') || /^\d/.test(loginIdentifier)

    // For non-phone logins (demo account), skip OTP
    if (!isPhoneNumber) {
      const result = await login({
        phone: formData.phone,
        username: formData.phone,
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
      return
    }

    // For phone login, verify credentials first
    const formattedPhone = otpService.formatPhoneNumber(loginIdentifier)
    const accountResult = await accountService.loginWithPhone(formattedPhone, formData.password)

    if (!accountResult.success) {
      showToast(accountResult.error || 'Invalid phone or password', 'error')
      setLoading(false)
      return
    }

    // Credentials valid - send OTP
    const otpResult = await otpService.sendOTP(formattedPhone)

    if (!otpResult.success) {
      showToast(otpResult.error || 'Failed to send verification code', 'error')
      setLoading(false)
      return
    }

    // Store pending login data and show OTP modal
    setPendingLoginData({
      phone: formattedPhone,
      account: accountResult.account
    })
    setShowOtpModal(true)
    setResendTimer(60)
    setLoading(false)
    showToast('Verification code sent to your phone', 'success')
  }

  const verifyOtpAndLogin = async () => {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      setOtpError('Please enter the 6-digit code')
      return
    }

    setOtpVerifying(true)
    setOtpError('')

    const verifyResult = await otpService.verifyOTP(pendingLoginData.phone, otpCode)

    if (!verifyResult.success || !verifyResult.verified) {
      setOtpError(verifyResult.error || 'Invalid verification code')
      setOtpVerifying(false)
      return
    }

    // OTP verified - complete login
    const result = await login({
      phone: pendingLoginData.phone,
      username: pendingLoginData.phone,
      password: formData.password
    })

    if (result.success) {
      const user = result.data.user
      const displayName = user.firstName || user.fullName || user.username || user.email
      showToast(`Welcome back, ${displayName}!`, 'success')
      setShowOtpModal(false)
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    } else {
      setOtpError(result.error || 'Login failed')
    }

    setOtpVerifying(false)
  }

  const resendOtp = async () => {
    if (resendTimer > 0) return

    const result = await otpService.resendOTP(pendingLoginData.phone)
    if (result.success) {
      showToast('New verification code sent', 'success')
      setResendTimer(60)
      setOtp(['', '', '', '', '', ''])
    } else {
      showToast(result.error || 'Failed to resend code', 'error')
    }
  }

  const closeOtpModal = () => {
    setShowOtpModal(false)
    setOtp(['', '', '', '', '', ''])
    setOtpError('')
    setPendingLoginData(null)
  }

  return (
    <div className="auth-page-new">
      <Link to="/" className="auth-back-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span>Back</span>
      </Link>

      <div className="auth-container">
        <div className="auth-form-card">
          <div className="auth-header">
            <img src={logo} alt="Team33" className="auth-logo" />
            <h1>Welcome Back</h1>
            <p>Sign in to continue playing</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form-new">
            <div className="form-row">
              <label className="form-label">Phone Number or Username</label>
              <div className="form-input-wrap">
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Enter phone or username"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">Password</label>
              <div className="form-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
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

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <ButtonSpinner /> : 'Sign In'}
            </button>
          </form>

          <div className="auth-alt-section">
            <p>Don't have an account?</p>
            <Link to="/signup" className="auth-alt-btn">Create Account</Link>
          </div>

          <Link to="/forgot-password" className="forgot-password-link">
            Forgot Password?
          </Link>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="otp-modal-overlay" onClick={(e) => e.target === e.currentTarget && !otpVerifying && closeOtpModal()}>
          <div className="otp-modal">
            <button className="otp-modal-close" onClick={closeOtpModal} disabled={otpVerifying}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>

            <div className="otp-modal-header">
              <div className="otp-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <h2>Verify Your Phone</h2>
              <p>Enter the 6-digit code sent to<br/><strong>{pendingLoginData?.phone}</strong></p>
            </div>

            <div className="otp-inputs">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => otpInputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={otpError ? 'otp-error' : ''}
                  disabled={otpVerifying}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {otpError && <p className="otp-error-message">{otpError}</p>}

            <button
              className="otp-verify-btn"
              onClick={verifyOtpAndLogin}
              disabled={otpVerifying || otp.join('').length !== 6}
            >
              {otpVerifying ? <ButtonSpinner /> : 'Verify & Sign In'}
            </button>

            <div className="otp-resend">
              {resendTimer > 0 ? (
                <p>Resend code in <strong>{resendTimer}s</strong></p>
              ) : (
                <button onClick={resendOtp} disabled={otpVerifying}>
                  Resend Code
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
