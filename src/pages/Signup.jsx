import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/TranslationContext'
import { otpService } from '../services/otpService'
import { accountService } from '../services/accountService'
import { walletService } from '../services/walletService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import logo from '../images/New logo.png'
import './Signup.css'

export default function Signup() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [otpSent, setOtpSent] = useState(false)
  const otpInputRefs = useRef([])

  // Password strength
  const [passwordStrength, setPasswordStrength] = useState({ valid: false, errors: [] })

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

  // Validate password on change
  useEffect(() => {
    if (formData.password) {
      setPasswordStrength(accountService.validatePassword(formData.password))
    }
  }, [formData.password])

  // Auto-focus first OTP input when modal opens
  useEffect(() => {
    if (showOtpModal && otpSent) {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    }
  }, [showOtpModal, otpSent])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otpCode]
    newOtp[index] = value
    setOtpCode(newOtp)

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }

    // Auto verify when all digits entered
    if (value && index === 5 && newOtp.every(d => d !== '')) {
      handleVerifyOtp(newOtp.join(''))
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('')
      setOtpCode(newOtp)
      otpInputRefs.current[5]?.focus()
      handleVerifyOtp(pastedData)
    }
  }

  // Send OTP
  const sendOtp = async () => {
    setOtpSending(true)
    const result = await otpService.sendOTP(formData.phone)
    setOtpSending(false)

    if (result.success) {
      setOtpSent(true)
      setCountdown(result.expiresInSeconds || 300)
      showToast(`Verification code sent to ${result.maskedPhone}`, 'success')
    } else {
      showToast(result.error || 'Failed to send verification code', 'error')
    }
  }

  // Verify OTP and complete registration
  const handleVerifyOtp = async (code) => {
    if (!code || code.length !== 6) {
      showToast('Please enter the 6-digit code', 'error')
      return
    }

    setOtpVerifying(true)
    const result = await otpService.verifyOTP(formData.phone, code)

    if (result.success && result.verified) {
      showToast('Phone verified! Creating your account...', 'success')
      await completeRegistration()
    } else {
      setOtpVerifying(false)
      showToast(result.error || `Invalid code. ${result.remainingAttempts} attempts remaining.`, 'error')
      setOtpCode(['', '', '', '', '', ''])
      otpInputRefs.current[0]?.focus()
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0) return

    setOtpSending(true)
    const result = await otpService.resendOTP(formData.phone)
    setOtpSending(false)

    if (result.success) {
      setCountdown(result.expiresInSeconds || 300)
      setOtpCode(['', '', '', '', '', ''])
      showToast('New code sent!', 'success')
    } else {
      showToast(result.error || 'Failed to resend code', 'error')
    }
  }

  // Complete registration after OTP verification
  const completeRegistration = async () => {
    try {
      const formattedPhone = otpService.formatPhoneNumber(formData.phone)

      // 1. Create account via external API
      const registerResult = await accountService.register({
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formattedPhone,
      })

      if (!registerResult.success) {
        showToast(registerResult.error || 'Registration failed', 'error')
        setOtpVerifying(false)
        setShowOtpModal(false)
        return
      }

      const { accountId } = registerResult

      // 2. Create wallet for the account
      const walletResult = await walletService.createWallet(accountId)
      if (!walletResult.success) {
        console.warn('Wallet creation failed:', walletResult.error)
      }

      // 3. Get wallet balance
      const balanceResult = await walletService.getBalance(accountId)
      const balance = balanceResult.success ? balanceResult.balance : 0

      // 4. Store user data and login
      const userData = {
        accountId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`,
        phone: formattedPhone,
        balance,
        status: registerResult.account?.status || 'ACTIVE',
      }

      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('accountId', accountId)

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
      setOtpVerifying(false)
    }
  }

  // Form submission - validate and show OTP modal
  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (!formData.firstName || formData.firstName.length < 2) {
      showToast('Please enter your first name', 'error')
      return
    }

    if (!formData.lastName || formData.lastName.length < 2) {
      showToast('Please enter your last name', 'error')
      return
    }

    if (!formData.phone || formData.phone.length < 8) {
      showToast('Please enter a valid phone number', 'error')
      return
    }

    // Validate password
    if (!passwordStrength.valid) {
      showToast(passwordStrength.errors[0], 'error')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    // All validation passed - show OTP modal and send code
    setLoading(true)
    setShowOtpModal(true)
    await sendOtp()
    setLoading(false)
  }

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const closeOtpModal = () => {
    setShowOtpModal(false)
    setOtpCode(['', '', '', '', '', ''])
    setOtpSent(false)
    setCountdown(0)
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
        <div className="auth-form-card signup-card">
          <div className="auth-header">
            <img src={logo} alt="Team33" className="auth-logo" />
            <h1>Create Account</h1>
            <p>Join Team33 and start winning</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form-new">
            {/* Name Row */}
            <div className="form-row-double">
              <div className="form-row">
                <label className="form-label">First Name</label>
                <div className="form-input-wrap">
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="First name"
                    required
                    autoComplete="given-name"
                  />
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">Last Name</label>
                <div className="form-input-wrap">
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last name"
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
            </div>
            <span className="form-hint">Must match your bank account name</span>

            {/* Phone */}
            <div className="form-row">
              <label className="form-label">Mobile Number</label>
              <div className="form-input-wrap">
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+61 412 345 678"
                  required
                  autoComplete="tel"
                />
              </div>
              <span className="form-hint">We'll send a verification code to this number</span>
            </div>

            {/* Password */}
            <div className="form-row">
              <label className="form-label">Password</label>
              <div className="form-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a strong password"
                  required
                  autoComplete="new-password"
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
              {formData.password && (
                <div className={`password-strength ${passwordStrength.valid ? 'valid' : 'invalid'}`}>
                  {passwordStrength.valid ? (
                    <span className="strength-valid">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Password meets requirements
                    </span>
                  ) : (
                    <span className="strength-invalid">{passwordStrength.errors[0]}</span>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-row">
              <label className="form-label">Confirm Password</label>
              <div className="form-input-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
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
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <span className="form-error">Passwords do not match</span>
              )}
            </div>

            {/* Referral Code */}
            <div className="form-row">
              <label className="form-label">Referral Code</label>
              <div className="form-input-wrap">
                <input
                  type="text"
                  name="referralCode"
                  value={formData.referralCode}
                  onChange={handleChange}
                  placeholder="Optional"
                  autoComplete="off"
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || !passwordStrength.valid}
            >
              {loading ? <ButtonSpinner /> : 'Create Account'}
            </button>
          </form>

          <div className="auth-alt-section">
            <p>Already have an account?</p>
            <Link to="/login" className="auth-alt-btn">Sign In</Link>
          </div>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="otp-modal-overlay" onClick={(e) => e.target === e.currentTarget && !otpVerifying && closeOtpModal()}>
          <div className="otp-modal">
            <button
              className="otp-modal-close"
              onClick={closeOtpModal}
              disabled={otpVerifying}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>

            <div className="otp-modal-header">
              <div className="otp-modal-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <h2>Verify Your Phone</h2>
              <p>Enter the 6-digit code sent to<br/><strong>{formData.phone}</strong></p>
            </div>

            {otpSending && !otpSent ? (
              <div className="otp-sending">
                <ButtonSpinner />
                <span>Sending verification code...</span>
              </div>
            ) : otpVerifying ? (
              <div className="otp-verifying-state">
                <ButtonSpinner />
                <span>Verifying & creating account...</span>
              </div>
            ) : (
              <>
                <div className="otp-modal-inputs" onPaste={handleOtpPaste}>
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => otpInputRefs.current[index] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className={`otp-modal-input ${digit ? 'filled' : ''}`}
                      disabled={otpVerifying}
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                {countdown > 0 && (
                  <p className="otp-timer-text">
                    Code expires in <span>{formatCountdown(countdown)}</span>
                  </p>
                )}

                <div className="otp-modal-actions">
                  <button
                    type="button"
                    className="otp-resend-link"
                    onClick={handleResendOtp}
                    disabled={countdown > 0 || otpSending}
                  >
                    {otpSending ? 'Sending...' : countdown > 0 ? `Resend in ${formatCountdown(countdown)}` : "Didn't receive code? Resend"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
