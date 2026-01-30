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
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone') // 'phone' | 'otp'
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSendOTP = async (e) => {
    e.preventDefault()

    if (!phone.trim()) {
      showToast('Please enter your phone number', 'error')
      return
    }

    setLoading(true)

    const result = await otpService.sendOTP(phone.trim())

    if (result.success) {
      setStep('otp')
      setCountdown(result.expiresInSeconds || 300)
      showToast('OTP sent to your phone', 'success')
    } else {
      showToast(result.error || 'Failed to send OTP', 'error')
    }

    setLoading(false)
  }

  const handleVerifyAndLogin = async (e) => {
    e.preventDefault()

    if (!otp.trim() || otp.length < 4) {
      showToast('Please enter a valid OTP', 'error')
      return
    }

    setLoading(true)

    // Step 1: Verify OTP
    const verifyResult = await otpService.verifyOTP(phone.trim(), otp.trim())

    if (!verifyResult.success || !verifyResult.verified) {
      showToast(verifyResult.error || 'Invalid OTP. Please try again.', 'error')
      setLoading(false)
      return
    }

    // Step 2: Fetch account by phone
    const accountResult = await accountService.getAccountByPhone(phone.trim())

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

    // Store user data
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('accountId', account.accountId)

    // Login with user data
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

  const handleResendOTP = async () => {
    if (countdown > 0) return

    setLoading(true)
    const result = await otpService.resendOTP(phone.trim())

    if (result.success) {
      setCountdown(result.expiresInSeconds || 300)
      showToast('OTP resent successfully', 'success')
    } else {
      showToast(result.error || 'Failed to resend OTP', 'error')
    }

    setLoading(false)
  }

  const handleBackToPhone = () => {
    setStep('phone')
    setOtp('')
    setCountdown(0)
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

            {step === 'phone' ? (
              <form onSubmit={handleSendOTP} className="login-form-golden">
                {/* Phone Field */}
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
                  <p className="form-hint">Enter your registered mobile number</p>
                </div>

                {/* Send OTP Button */}
                <button type="submit" className="login-btn-golden" disabled={loading}>
                  {loading ? <ButtonSpinner /> : 'SEND OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndLogin} className="login-form-golden">
                {/* Phone Display */}
                <div className="form-group-golden">
                  <label className="form-label-golden">Mobile Number</label>
                  <div className="phone-display">
                    <span>{phone}</span>
                    <button type="button" className="change-phone-btn" onClick={handleBackToPhone}>
                      Change
                    </button>
                  </div>
                </div>

                {/* OTP Field */}
                <div className="form-group-golden">
                  <label className="form-label-golden">Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    className="form-input-golden otp-input"
                    required
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                  <div className="otp-actions">
                    {countdown > 0 ? (
                      <span className="countdown-text">
                        Resend OTP in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                      </span>
                    ) : (
                      <button type="button" className="resend-btn" onClick={handleResendOTP} disabled={loading}>
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>

                {/* Verify & Login Button */}
                <button type="submit" className="login-btn-golden" disabled={loading}>
                  {loading ? <ButtonSpinner /> : 'VERIFY & LOGIN'}
                </button>
              </form>
            )}

            {/* Register Section */}
            <div className="register-section-golden">
              <p className="register-text-golden">Do Not Have An Account Yet?</p>
              <Link to="/signup" className="register-btn-golden">REGISTER</Link>
            </div>
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
