import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import { otpService } from '../services/otpService';
import { accountService } from '../services/accountService';
import logo from '../images/team33newlogo.png';

// Three-step recovery flow:
//   1. Enter phone -> send OTP
//   2. Enter OTP   -> verify
//   3. Enter new password -> reset via /api/accounts/{id}/password
export default function ForgotPassword() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [accountId, setAccountId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: phone -> send OTP. Also look up the accountId now so we can
  // surface "no account" early instead of after the user types the OTP.
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      showToast('Please enter your mobile number', 'error');
      return;
    }
    setLoading(true);

    const account = await accountService.getAccountByPhone(phone.trim());
    if (!account.success) {
      showToast('No account found for that number', 'error');
      setLoading(false);
      return;
    }
    setAccountId(account.account.accountId);

    const sent = await otpService.sendOTP(phone.trim());
    if (sent.success) {
      showToast('OTP sent to your mobile', 'success');
      setStep(2);
    } else {
      showToast(sent.error || 'Failed to send OTP', 'error');
    }
    setLoading(false);
  };

  // Step 2: verify OTP. Server confirms phoneVerified before we let the user
  // move on to setting a new password.
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.length < 4) {
      showToast('Please enter the OTP code', 'error');
      return;
    }
    setLoading(true);

    const result = await otpService.verifyOTP(phone.trim(), otp.trim());
    if (result.success && result.verified) {
      showToast('OTP verified', 'success');
      setStep(3);
    } else {
      showToast(result.error || 'Invalid OTP', 'error');
    }
    setLoading(false);
  };

  // Step 3: set the new password via the existing password endpoint.
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setLoading(true);

    const result = await accountService.resetPasswordAfterOtp(accountId, newPassword);
    if (result.success) {
      showToast('Password reset successfully. Please log in.', 'success');
      navigate('/login');
    } else {
      showToast(result.error || 'Failed to reset password', 'error');
    }
    setLoading(false);
  };

  const handleResendOtp = async () => {
    setLoading(true);
    const result = await otpService.resendOTP(phone.trim());
    if (result.success) {
      showToast('OTP resent', 'success');
    } else {
      showToast(result.error || 'Failed to resend OTP', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Link to="/login" className="auth-back">← Back</Link>

        <div className="auth-logo">
          <img src={logo} alt="Team33" />
        </div>

        {step === 1 && (
          <>
            <h1 className="auth-title">Forgot Password?</h1>
            <p className="auth-subtitle">Enter your mobile number — we'll send you an OTP to verify your identity.</p>
            <form className="auth-form" onSubmit={handleSendOtp}>
              <div className="auth-input-group">
                <label>Mobile Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0412345678"
                  autoComplete="tel"
                  required
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <ButtonSpinner /> : 'Send OTP'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="auth-title">Verify OTP</h1>
            <p className="auth-subtitle">Enter the code we sent to <strong>{phone}</strong></p>
            <form className="auth-form" onSubmit={handleVerifyOtp}>
              <div className="auth-input-group">
                <label>OTP Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <ButtonSpinner /> : 'Verify'}
              </button>
            </form>
            <div className="auth-footer">
              <button type="button" className="auth-link-btn" onClick={handleResendOtp} disabled={loading}>
                Resend OTP
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="auth-title">New Password</h1>
            <p className="auth-subtitle">Choose a new password for your account.</p>
            <form className="auth-form" onSubmit={handleResetPassword}>
              <div className="auth-input-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="auth-input-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <ButtonSpinner /> : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        .auth-link-btn {
          background: none;
          border: none;
          color: var(--accent-gold);
          font-size: 14px;
          cursor: pointer;
          padding: 8px;
        }
        .auth-link-btn:hover { text-decoration: underline; }
        .auth-link-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
