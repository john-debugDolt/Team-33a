import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { otpService } from '../services/otpService'
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
  const [loading, setLoading] = useState(false)

  // OTP State
  const [otpCode, setOtpCode] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [otpSent, setOtpSent] = useState(false)
  const [otpError, setOtpError] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const formatPhoneForAPI = (phoneNumber) => {
    let cleaned = phoneNumber.replace(/[\s-]/g, '')
    if (cleaned.startsWith('0')) {
      cleaned = '+61' + cleaned.substring(1)
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+61' + cleaned
    }
    return cleaned
  }

  const sendOtp = async () => {
    if (!phone || phone.length < 8) {
      showToast('Please enter a valid phone number', 'error')
      return
    }

    setOtpSending(true)
    setOtpError('')
    const result = await otpService.sendOTP(phone)
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

  const handleResendOtp = async () => {
    if (countdown > 0) return

    setOtpSending(true)
    setOtpError('')
    const result = await otpService.resendOTP(phone)
    setOtpSending(false)

    if (result.success) {
      setCountdown(60)
      setOtpCode('')
      showToast('New code sent!', 'success')
    } else {
      showToast(result.error || 'Failed to resend', 'error')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()

    if (!phone.trim()) {
      showToast('Please enter your phone number', 'error')
      return
    }

    if (!otpSent) {
      // First step: send OTP
      await sendOtp()
      return
    }

    if (!otpCode || otpCode.length !== 6) {
      showToast('Please enter the 6-digit code', 'error')
      return
    }

    setOtpVerifying(true)
    setOtpError('')

    // Verify OTP
    const verifyResult = await otpService.verifyOTP(phone, otpCode)

    if (!verifyResult.success || !verifyResult.verified) {
      setOtpError(verifyResult.error || 'Invalid code')
      showToast(verifyResult.error || 'Invalid verification code', 'error')
      setOtpVerifying(false)
      return
    }

    setLoading(true)
    const formattedPhone = formatPhoneForAPI(phone.trim())

    // Fetch account by phone
    const accountResult = await accountService.getAccountByPhone(formattedPhone)

    if (!accountResult.success) {
      showToast('Account not found. Please register first.', 'error')
      setLoading(false)
      setOtpVerifying(false)
      return
    }

    const account = accountResult.account

    // Fetch balance
    const balanceResult = await walletService.getBalance(account.accountId)

    // Build user data and login
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
    setOtpVerifying(false)
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
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (otpSent) {
                      setOtpSent(false)
                      setOtpCode('')
                      setCountdown(0)
                    }
                  }}
                  placeholder="e.g. 0412345678"
                  className="form-input-golden"
                  required
                  autoComplete="tel"
                />
              </div>

              {otpSent && (
                <div className="form-group-golden">
                  <label className="form-label-golden">Verification Code</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      setOtpError('')
                    }}
                    placeholder="Enter 6-digit code"
                    className="form-input-golden"
                    maxLength={6}
                  />
                  {otpError && (
                    <p className="form-error-golden">{otpError}</p>
                  )}
                  {countdown > 0 ? (
                    <p className="form-hint-golden">Code expires in {countdown}s</p>
                  ) : (
                    <button
                      type="button"
                      className="resend-btn-golden"
                      onClick={handleResendOtp}
                      disabled={otpSending}
                    >
                      {otpSending ? 'Sending...' : 'Resend Code'}
                    </button>
                  )}
                </div>
              )}

              <button type="submit" className="login-btn-golden" disabled={loading || otpSending || otpVerifying}>
                {loading || otpVerifying ? (
                  <ButtonSpinner />
                ) : otpSent ? (
                  'VERIFY & LOGIN'
                ) : (
                  'GET CODE'
                )}
              </button>
            </form>

            <div className="register-section-golden">
              <p className="register-text-golden">Do Not Have An Account Yet?</p>
              <Link to="/signup" className="register-btn-golden">REGISTER</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
