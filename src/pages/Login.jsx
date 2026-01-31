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
  const [step, setStep] = useState('phone')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

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

    const verifyResult = await otpService.verifyOTP(phone.trim(), otp.trim())
    if (!verifyResult.success || !verifyResult.verified) {
      showToast(verifyResult.error || 'Invalid OTP', 'error')
      setLoading(false)
      return
    }

    const accountResult = await accountService.getAccountByPhone(phone.trim())
    if (!accountResult.success) {
      showToast('Account not found. Please register first.', 'error')
      setLoading(false)
      return
    }

    const account = accountResult.account
    const balanceResult = await walletService.getBalance(account.accountId)

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
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } else {
      showToast('Login failed', 'error')
    }
    setLoading(false)
  }

  const handleResendOTP = async () => {
    if (countdown > 0) return
    setLoading(true)
    const result = await otpService.resendOTP(phone.trim())
    if (result.success) {
      setCountdown(result.expiresInSeconds || 300)
      showToast('OTP resent', 'success')
    } else {
      showToast(result.error || 'Failed to resend', 'error')
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

            {step === 'phone' ? (
              <form onSubmit={handleSendOTP} className="login-form-golden">
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
                <button type="submit" className="login-btn-golden" disabled={loading}>
                  {loading ? <ButtonSpinner /> : 'SEND OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndLogin} className="login-form-golden">
                <div className="form-group-golden">
                  <label className="form-label-golden">Mobile Number</label>
                  <div className="phone-display">
                    <span>{phone}</span>
                    <button type="button" className="change-phone-btn" onClick={() => { setStep('phone'); setOtp(''); }}>
                      Change
                    </button>
                  </div>
                </div>

                <div className="form-group-golden">
                  <label className="form-label-golden">Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    className="form-input-golden"
                    required
                    maxLength={6}
                  />
                  <div className="otp-actions">
                    {countdown > 0 ? (
                      <span className="countdown-text">Resend in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span>
                    ) : (
                      <button type="button" className="resend-btn" onClick={handleResendOTP} disabled={loading}>Resend OTP</button>
                    )}
                  </div>
                </div>

                <button type="submit" className="login-btn-golden" disabled={loading}>
                  {loading ? <ButtonSpinner /> : 'VERIFY & LOGIN'}
                </button>
              </form>
            )}

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
