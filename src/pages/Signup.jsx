import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { otpService } from '../services/otpService'
import { accountService } from '../services/accountService'
import { walletService } from '../services/walletService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import signupBanner from '../images/login and signup banner.png'
import './Signup.css'

export default function Signup() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const { showToast } = useToast()

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    dateOfBirth: '',
    referralCode: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Inline OTP State (not modal)
  const [otpCode, setOtpCode] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpError, setOtpError] = useState('')


  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Send OTP
  const sendOtp = async () => {
    if (!formData.phone || formData.phone.length < 8) {
      showToast('Please enter a valid phone number first', 'error')
      return
    }

    setOtpSending(true)
    setOtpError('')
    const result = await otpService.sendOTP(formData.phone)
    setOtpSending(false)

    if (result.success) {
      setOtpSent(true)
      setCountdown(60)
      showToast('Verification code sent!', 'success')
    } else {
      setOtpError(result.error || 'Failed to send verification code')
      showToast(result.error || 'Failed to send verification code', 'error')
    }
  }

  // Verify OTP
  const verifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setOtpError('Please enter the 6-digit code')
      return
    }

    setOtpVerifying(true)
    setOtpError('')
    const result = await otpService.verifyOTP(formData.phone, otpCode)

    if (result.success && result.verified) {
      setOtpVerified(true)
      showToast('Phone verified successfully!', 'success')
    } else {
      setOtpError(result.error || 'Invalid verification code')
    }
    setOtpVerifying(false)
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0) return

    setOtpSending(true)
    setOtpError('')
    const result = await otpService.resendOTP(formData.phone)
    setOtpSending(false)

    if (result.success) {
      setCountdown(60)
      setOtpCode('')
      showToast('New code sent!', 'success')
    } else {
      showToast(result.error || 'Failed to resend code', 'error')
    }
  }

  // Complete registration
  const completeRegistration = async () => {
    try {
      const formattedPhone = otpService.formatPhoneNumber(formData.phone)
      const nameParts = formData.fullName.trim().split(' ')
      const firstName = nameParts[0] || 'User'
      // Use first name as last name if only one name provided (API requires both)
      const lastName = nameParts.slice(1).join(' ') || firstName

      // 1. Create account via external API
      const registerResult = await accountService.register({
        email: formData.email,
        password: formData.password,
        firstName: firstName,
        lastName: lastName,
        phoneNumber: formattedPhone,
        dateOfBirth: formData.dateOfBirth,
      })

      if (!registerResult.success) {
        showToast(registerResult.error || 'Registration failed', 'error')
        setLoading(false)
        return
      }

      const { accountId, userId } = registerResult

      // 2. Create wallet for the account (non-blocking - continue even if it fails)
      let walletId = null
      try {
        const walletResult = await walletService.createWallet(accountId)
        if (walletResult.success) {
          walletId = walletResult.walletId
        } else {
          console.warn('Wallet creation failed:', walletResult.error)
        }
      } catch (walletError) {
        console.warn('Wallet service error:', walletError)
      }
      // Generate local walletId if API failed
      if (!walletId) {
        walletId = `WLT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      }

      // 3. Get wallet balance (non-blocking)
      let balance = 0
      try {
        const balanceResult = await walletService.getBalance(accountId)
        balance = balanceResult.success ? balanceResult.balance : 0
      } catch (balanceError) {
        console.warn('Balance fetch error:', balanceError)
      }

      // 4. Store user data and login
      const userData = {
        accountId,
        userId,
        walletId,
        firstName: firstName,
        lastName: lastName,
        fullName: formData.fullName,
        phone: formattedPhone,
        balance,
        status: registerResult.account?.status || 'ACTIVE',
      }

      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('accountId', accountId)
      localStorage.setItem('userId', userId)
      localStorage.setItem('walletId', walletId)

      await login({
        username: formattedPhone,
        password: formData.password,
        _userData: userData,
      })

      showToast('Account created successfully!', 'success')
      navigate('/', { replace: true })

    } catch (error) {
      console.error('Registration error:', error)
      showToast('Registration failed. Please try again.', 'error')
      setLoading(false)
    }
  }

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!formData.fullName || formData.fullName.trim().length < 2) {
      showToast('Please enter your full name', 'error')
      return
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    if (!formData.dateOfBirth) {
      showToast('Please enter your date of birth', 'error')
      return
    }

    // Check if user is 18+
    const birthDate = new Date(formData.dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    if (age < 18) {
      showToast('You must be 18 years or older to register', 'error')
      return
    }

    if (!formData.phone || formData.phone.length < 8) {
      showToast('Please enter a valid phone number', 'error')
      return
    }

    if (!formData.password || formData.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    if (!otpVerified) {
      showToast('Please verify your phone number first', 'error')
      return
    }

    setLoading(true)
    await completeRegistration()
  }

  return (
    <div className="signup-page-golden">
      {/* Back Button */}
      <Link to="/" className="back-btn-golden">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span>Back</span>
      </Link>


      <div className="signup-layout">
        {/* Banner Section */}
        <div className="signup-banner">
          <img src={signupBanner} alt="Welcome Banner" />
        </div>

        {/* Form Section */}
        <div className="signup-form-section">
          <form onSubmit={handleSubmit} className="signup-form-golden">
            {/* Full Name */}
            <div className="form-row-inline">
              <label className="form-label-inline">Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="form-input-inline"
                required
                autoComplete="name"
              />
            </div>
            <p className="form-hint-golden">*Must Be The Same As Your Bank Account Name.</p>

            {/* Email */}
            <div className="form-row-inline">
              <label className="form-label-inline">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email address"
                className="form-input-inline"
                required
                autoComplete="email"
              />
            </div>

            {/* Date of Birth */}
            <div className="form-row-inline">
              <label className="form-label-inline">Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className="form-input-inline"
                required
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              />
            </div>
            <p className="form-hint-golden">*You must be 18 years or older to register.</p>

            {/* Mobile No */}
            <div className="form-row-inline">
              <label className="form-label-inline">Mobile No</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. 61480050689"
                className="form-input-inline"
                required
                autoComplete="tel"
              />
            </div>

            {/* Password */}
            <div className="form-row-inline">
              <label className="form-label-inline">Password</label>
              <div className="password-wrap-inline">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="6 - 20 characters"
                  className="form-input-inline"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-inline"
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

            {/* Referrer Code */}
            <div className="form-row-inline">
              <label className="form-label-inline">Referrer Code</label>
              <input
                type="text"
                name="referralCode"
                value={formData.referralCode}
                onChange={handleChange}
                placeholder="Optional"
                className="form-input-inline"
                autoComplete="off"
              />
            </div>

            {/* OTP Section - Inline */}
            <div className="otp-section-inline">
              <p className="otp-instruction">Press GET CODE Button To Receive Verification Code Via SMS.</p>

              <div className="otp-row">
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                    setOtpError('')
                  }}
                  placeholder="Enter 6-digit code"
                  className="otp-input-inline"
                  maxLength={6}
                  disabled={otpVerified}
                />
                {!otpVerified && (
                  <button
                    type="button"
                    className="get-code-btn"
                    onClick={otpSent && otpCode.length === 6 ? verifyOtp : sendOtp}
                    disabled={otpSending || otpVerifying || (otpSent && countdown > 0 && otpCode.length < 6)}
                  >
                    {otpSending ? (
                      <ButtonSpinner />
                    ) : otpVerifying ? (
                      <ButtonSpinner />
                    ) : otpSent && otpCode.length === 6 ? (
                      'VERIFY'
                    ) : otpSent && countdown > 0 ? (
                      `${countdown}s`
                    ) : (
                      'GET CODE'
                    )}
                  </button>
                )}
              </div>

              {/* OTP Status */}
              {otpVerified && (
                <div className="otp-status success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Phone number verified
                </div>
              )}

              {otpError && (
                <div className="otp-status error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {otpError}
                </div>
              )}

              {/* Resend option */}
              {otpSent && !otpVerified && countdown === 0 && (
                <button
                  type="button"
                  className="otp-resend-btn"
                  onClick={handleResendOtp}
                  disabled={otpSending}
                >
                  Resend Code
                </button>
              )}

              {otpSent && !otpVerified && countdown > 0 && (
                <p className="otp-timer">
                  Code expires in <span>{countdown}s</span>
                </p>
              )}
            </div>

            {/* Register Button */}
            <button
              type="submit"
              className="register-btn-golden"
              disabled={loading || !otpVerified}
            >
              {loading ? <ButtonSpinner /> : 'REGISTER'}
            </button>
          </form>

          {/* Login Link */}
          <div className="login-link-section">
            <p>Already have an account?</p>
            <Link to="/login" className="login-link-golden">LOGIN HERE</Link>
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
