import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { otpService } from '../services/otpService'
import { accountService } from '../services/accountService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import signupBanner from '../images/login and signup banner.png'
import './Signup.css'

export default function Signup() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const { showToast } = useToast()

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // OTP State
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

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const sendOtp = async () => {
    if (!formData.phone || formData.phone.length < 8) {
      showToast('Please enter a valid phone number', 'error')
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
      setOtpError(result.error || 'Failed to send code')
      showToast(result.error || 'Failed to send code', 'error')
    }
  }

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
      showToast('Phone verified!', 'success')
    } else {
      setOtpError(result.error || 'Invalid code')
    }
    setOtpVerifying(false)
  }

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
      showToast(result.error || 'Failed to resend', 'error')
    }
  }

  const completeRegistration = async () => {
    try {
      const formattedPhone = otpService.formatPhoneNumber(formData.phone)
      const nameParts = formData.fullName.trim().split(' ')
      const firstName = nameParts[0] || 'User'
      const lastName = nameParts.slice(1).join(' ') || firstName

      const result = await accountService.createAccount({
        firstName,
        lastName,
        phoneNumber: formattedPhone,
        password: formData.password,
      })

      if (!result || !result.success) {
        const errorMessage = result?.error || 'Registration failed. Please try again.'
        showToast(errorMessage, 'error')
        setLoading(false)
        return
      }

      const accountId = result.accountId || result.account?.accountId

      if (!accountId) {
        showToast('Account created but ID missing. Please try logging in.', 'warning')
        setLoading(false)
        navigate('/login')
        return
      }

      let balance = 0
      try {
        const balanceResult = await accountService.getBalance(accountId)
        balance = balanceResult?.balance ?? 0
      } catch (e) {
        console.warn('Balance fetch error:', e)
      }

      const userData = {
        accountId,
        firstName,
        lastName,
        fullName: formData.fullName,
        phone: formattedPhone,
        balance,
      }

      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('accountId', accountId)

      await login({ _userData: userData })

      showToast('Account created successfully!', 'success')
      navigate('/', { replace: true })

    } catch (error) {
      console.error('Registration error:', error)
      showToast('An unexpected error occurred. Please try again.', 'error')
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.fullName || formData.fullName.trim().length < 2) {
      showToast('Please enter your full name', 'error')
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
      showToast('Please verify your phone number', 'error')
      return
    }

    setLoading(true)
    await completeRegistration()
  }

  return (
    <div className="signup-page-golden">
      <Link to="/" className="back-btn-golden">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span>Back</span>
      </Link>

      <div className="signup-layout">
        <div className="signup-banner">
          <img src={signupBanner} alt="Welcome Banner" />
        </div>

        <div className="signup-form-section">
          <form onSubmit={handleSubmit} className="signup-form-golden">
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

            <div className="form-row-inline">
              <label className="form-label-inline">Mobile No</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. 0412345678"
                className="form-input-inline"
                required
                autoComplete="tel"
              />
            </div>

            <div className="form-row-inline">
              <label className="form-label-inline">Password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="6 - 20 characters"
                  className="form-input-inline"
                  required
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={20}
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

            <div className="otp-section-inline">
              <p className="otp-instruction">Press GET CODE to receive verification SMS.</p>

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
                    {otpSending || otpVerifying ? (
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

              {otpVerified && (
                <div className="otp-status success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Phone verified
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

            <button
              type="submit"
              className="register-btn-golden"
              disabled={loading || !otpVerified}
            >
              {loading ? <ButtonSpinner /> : 'REGISTER'}
            </button>
          </form>

          <div className="login-link-section">
            <p>Already have an account?</p>
            <Link to="/login" className="login-link-golden">LOGIN HERE</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
