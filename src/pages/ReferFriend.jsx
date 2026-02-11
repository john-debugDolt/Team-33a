import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/TranslationContext'
import AuthPrompt from '../components/AuthPrompt/AuthPrompt'
import './ReferFriend.css'

const API_BASE = 'https://accounts.team33.mx'

// Default commission rates (can be overridden by admin settings)
const DEFAULT_COMMISSION_CONFIG = {
  depositCommissionRate: 0.10, // 10%
  depositCommissionMaxCount: 5,
  playCommissionRate: 0.05, // 5%
  playCommissionUntil: null, // forever
}

export default function ReferFriend() {
  const { user, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  // Commission rates (loaded from localStorage if admin has set them)
  const [commissionConfig, setCommissionConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('commission_config')
      return saved ? JSON.parse(saved) : DEFAULT_COMMISSION_CONFIG
    } catch {
      return DEFAULT_COMMISSION_CONFIG
    }
  })

  // Fetch referral code on mount
  useEffect(() => {
    const fetchReferralCode = async () => {
      if (!isAuthenticated || !user?.accountId) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_BASE}/api/accounts/${user.accountId}/referral-code`)

        if (response.ok) {
          const data = await response.json()
          setReferralCode(data.referralCode || data.code || data)
          setError(null)
        } else {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || 'Failed to load referral code')
        }
      } catch (err) {
        console.error('[ReferFriend] Error fetching referral code:', err)
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchReferralCode()
  }, [isAuthenticated, user?.accountId])

  // Copy referral code to clipboard
  const handleCopy = async () => {
    if (!referralCode) return

    try {
      await navigator.clipboard.writeText(referralCode)
      setCopied(true)
      showToast('Referral code copied!', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      showToast('Failed to copy', 'error')
    }
  }

  // Copy referral link to clipboard
  const handleCopyLink = async () => {
    if (!referralCode) return

    const referralLink = `${window.location.origin}/signup?ref=${referralCode}`
    try {
      await navigator.clipboard.writeText(referralLink)
      showToast('Referral link copied!', 'success')
    } catch (err) {
      showToast('Failed to copy link', 'error')
    }
  }

  // Show auth prompt if not logged in
  if (!isAuthenticated) {
    return (
      <AuthPrompt
        title={t('referFriend') || 'Refer a Friend'}
        message={t('pleaseLoginToContinue')}
        icon="gift"
      />
    )
  }

  return (
    <div className="refer-friend-page">
      {/* Hero Section */}
      <div className="refer-hero">
        <div className="refer-hero-bg"></div>
        <div className="refer-hero-content">
          <div className="refer-icon-large">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h1 className="refer-title">Refer a Friend</h1>
          <p className="refer-subtitle">
            Share your unique code with friends and earn rewards when they join!
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="refer-content">
        {/* Referral Code Card */}
        <div className="refer-card main-card">
          <div className="card-header">
            <div className="card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2>Your Referral Code</h2>
          </div>

          {loading ? (
            <div className="refer-loading">
              <div className="loading-spinner"></div>
              <span>Loading your code...</span>
            </div>
          ) : error ? (
            <div className="refer-error">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          ) : (
            <>
              <div className="referral-code-display">
                <span className="code-value">{referralCode}</span>
                <button
                  className={`copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  aria-label="Copy referral code"
                >
                  {copied ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div className="referral-actions">
                <button className="action-btn primary" onClick={handleCopyLink}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  <span>Copy Referral Link</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* How It Works */}
        <div className="refer-card info-card">
          <h3>How It Works</h3>
          <div className="steps-list">
            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Share Your Code</h4>
                <p>Send your unique referral code to friends and family</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Friend Signs Up</h4>
                <p>They create an account using your referral code</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-content">
                <h4>Earn Rewards</h4>
                <p>Get bonus rewards when your friends make deposits and play!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Card */}
        <div className="refer-card benefits-card">
          <h3>Your Benefits</h3>
          <div className="benefits-list">
            <div className="benefit-item highlight">
              <div className="benefit-icon deposit">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div className="benefit-text">
                <strong>{(commissionConfig.depositCommissionRate * 100).toFixed(0)}% Deposit Commission</strong>
                <span>Earn {(commissionConfig.depositCommissionRate * 100).toFixed(0)}% on your friend's first {commissionConfig.depositCommissionMaxCount} deposits</span>
              </div>
            </div>
            <div className="benefit-item highlight">
              <div className="benefit-icon play">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
                  <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
                  <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/>
                </svg>
              </div>
              <div className="benefit-text">
                <strong>{(commissionConfig.playCommissionRate * 100).toFixed(0)}% Play Commission</strong>
                <span>Earn {(commissionConfig.playCommissionRate * 100).toFixed(0)}% on all bets placed by your referrals{commissionConfig.playCommissionUntil ? ` until ${new Date(commissionConfig.playCommissionUntil).toLocaleDateString()}` : ' forever'}</span>
              </div>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div className="benefit-text">
                <strong>Automatic Payouts</strong>
                <span>Commissions credited directly to your wallet</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
