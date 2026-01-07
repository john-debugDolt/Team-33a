import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';
import { useToast } from '../context/ToastContext';
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import logo from '../images/New logo.png';

export default function ForgotPassword() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setLoading(true);

    const result = await authService.forgotPassword(email);

    if (result.success) {
      setSubmitted(true);
      showToast('Password reset instructions sent!', 'success');
    } else {
      showToast(result.message || 'Something went wrong', 'error');
    }

    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Link to="/" className="auth-back">
          ← Back
        </Link>

        <div className="auth-logo">
          <img src={logo} alt="Team33" />
        </div>

        {submitted ? (
          <div className="auth-success">
            <div className="success-icon">✓</div>
            <h2>Check Your Email</h2>
            <p>
              We've sent password reset instructions to <strong>{email}</strong>.
              Please check your inbox and follow the link to reset your password.
            </p>
            <div className="success-actions">
              <Link to="/login" className="auth-submit-btn">
                Back to Login
              </Link>
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => setSubmitted(false)}
              >
                Try a different email
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Forgot Password?</h1>
            <p className="auth-subtitle">
              Enter your email address and we'll send you instructions to reset your password.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <ButtonSpinner /> : 'Send Reset Link'}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Remember your password?{' '}
                <Link to="/login">Sign In</Link>
              </p>
            </div>
          </>
        )}
      </div>

      <style>{`
        .auth-success {
          text-align: center;
          padding: 20px 0;
        }

        .success-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }

        .auth-success h2 {
          font-size: 24px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 12px;
        }

        .auth-success p {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .auth-success strong {
          color: var(--text-primary);
        }

        .success-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .auth-link-btn {
          background: none;
          border: none;
          color: var(--accent-gold);
          font-size: 14px;
          cursor: pointer;
          padding: 8px;
        }

        .auth-link-btn:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
