import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/TranslationContext'
import { walletService } from '../services/walletService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import AuthPrompt from '../components/AuthPrompt/AuthPrompt'
import DepositModal from '../components/DepositModal/DepositModal'
import WithdrawModal from '../components/WithdrawModal/WithdrawModal'


export default function Wallet() {
  const { user, isAuthenticated, updateBalance } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [commissionEarnings, setCommissionEarnings] = useState([])
  const [pendingCommissionTotal, setPendingCommissionTotal] = useState(0)
  const [commissionLoading, setCommissionLoading] = useState(false)

  // Turnover and withdrawal eligibility state
  const [turnoverStatus, setTurnoverStatus] = useState({
    totalTurnoverRequired: 0,
    turnoverCompleted: 0,
    turnoverRemaining: 0,
    canWithdraw: true,
    requirements: [],
  })
  const [withdrawalEligibility, setWithdrawalEligibility] = useState({
    canWithdraw: true,
    reason: null,
    turnoverRemaining: 0,
    minimumWithdrawal: 20,
  })
  const [turnoverLoading, setTurnoverLoading] = useState(false)

  // Load wallet data
  const loadWalletData = useCallback(async () => {
    if (!isAuthenticated) return

    // Sync balance from API/localStorage
    if (user?.accountId) {
      const balanceResult = await walletService.getBalance(user.accountId)
      if (balanceResult.success && balanceResult.balance !== undefined) {
        updateBalance(balanceResult.balance)
      }
    }

    // Load commission earnings and turnover status
    if (user?.accountId) {
      setCommissionLoading(true)
      setTurnoverLoading(true)
      try {
        const [commResult, pendingResult, turnoverResult, eligibilityResult] = await Promise.all([
          walletService.getCommissionEarnings(user.accountId),
          walletService.getPendingCommissionTotal(user.accountId),
          walletService.getTurnoverStatus(user.accountId),
          walletService.checkWithdrawalEligibility(user.accountId)
        ])
        console.log('[Wallet] Account:', user.accountId, 'Commission result:', commResult, 'Pending:', pendingResult)
        console.log('[Wallet] Turnover:', turnoverResult, 'Eligibility:', eligibilityResult)

        if (commResult.success && commResult.earnings) {
          setCommissionEarnings(commResult.earnings)
        }
        if (pendingResult.success) {
          setPendingCommissionTotal(pendingResult.pendingTotal || 0)
        }
        if (turnoverResult.success) {
          setTurnoverStatus({
            totalTurnoverRequired: turnoverResult.totalTurnoverRequired,
            turnoverCompleted: turnoverResult.turnoverCompleted,
            turnoverRemaining: turnoverResult.turnoverRemaining,
            canWithdraw: turnoverResult.canWithdraw,
            requirements: turnoverResult.requirements,
          })
        }
        if (eligibilityResult.success) {
          setWithdrawalEligibility({
            canWithdraw: eligibilityResult.canWithdraw,
            reason: eligibilityResult.reason,
            turnoverRemaining: eligibilityResult.turnoverRemaining,
            minimumWithdrawal: eligibilityResult.minimumWithdrawal,
          })
        }
      } catch (err) {
        console.error('[Wallet] Data fetch error:', err)
      }
      setCommissionLoading(false)
      setTurnoverLoading(false)
    } else {
      console.log('[Wallet] No accountId, skipping data fetch')
    }
  }, [isAuthenticated, user?.accountId, updateBalance])

  // Load wallet data on mount
  useEffect(() => {
    loadWalletData()
  }, [loadWalletData])


  // Show auth prompt if not logged in
  if (!isAuthenticated) {
    return (
      <AuthPrompt
        title={t('wallet')}
        message={t('pleaseLoginToContinue')}
        icon="wallet"
      />
    )
  }

  const balance = user?.balance || 0
  const availableBalance = user?.availableBalance || balance
  const pendingBalance = user?.pendingBalance || 0

  // Calculate turnover progress percentage
  const turnoverProgress = walletService.calculateTurnoverProgress(
    turnoverStatus.turnoverCompleted,
    turnoverStatus.totalTurnoverRequired
  )
  const hasTurnoverRequirement = turnoverStatus.totalTurnoverRequired > 0

  return (
    <div className="wallet-page-modern">
      {/* Hero Balance Section */}
      <div className="wallet-hero">
        <div className="wallet-hero-bg"></div>
        <div className="wallet-hero-content">
          <div className="balance-info">
            <span className="wallet-username">{user?.firstName || user?.fullName || user?.username || t('guest')}</span>
            <span className="balance-label">{t('balance')}</span>
            <div className="balance-amount-large">
              <span className="currency-sign">$</span>
              <span className="balance-value">{balance.toLocaleString()}</span>
              <span className="balance-cents">.00</span>
            </div>
            <div className="balance-change positive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
              <span>{t('dailyRewards')}!</span>
            </div>
          </div>

          <div className="balance-stats">
            <div className="stat-item">
              <div className="stat-icon available">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">{t('availableBalance')}</span>
                <span className="stat-value">${availableBalance.toLocaleString()}.00</span>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon pending">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="stat-details">
                <span className="stat-label">{t('pendingBalance')}</span>
                <span className="stat-value">${pendingBalance.toLocaleString()}.00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={() => setShowDepositModal(true)}>
            <div className="action-icon deposit">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7 7 7-7"/>
              </svg>
            </div>
            <span>{t('deposit')}</span>
          </button>
          <button
            className={`quick-action-btn ${!withdrawalEligibility.canWithdraw ? 'disabled' : ''}`}
            onClick={() => {
              if (!withdrawalEligibility.canWithdraw) {
                showToast(withdrawalEligibility.reason || 'Withdrawal not available', 'warning')
                return
              }
              setShowWithdrawModal(true)
            }}
          >
            <div className="action-icon withdraw">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7-7 7 7"/>
              </svg>
            </div>
            <span>{t('withdraw')}</span>
            {!withdrawalEligibility.canWithdraw && (
              <div className="action-lock-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1C8.676 1 6 3.676 6 7v2H4v14h16V9h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4z"/>
                </svg>
              </div>
            )}
          </button>
          <button className="quick-action-btn" onClick={() => showToast('Transfer feature coming soon!', 'info')}>
            <div className="action-icon transfer">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </div>
            <span>Transfer</span>
          </button>
          <Link to="/history" className="quick-action-btn">
            <div className="action-icon history">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <span>{t('history')}</span>
          </Link>
        </div>

        {/* Withdrawal Info Cards */}
        <div className="wallet-info-cards">
          {/* Minimum Withdrawal Card */}
          <div className="wallet-info-card minimum-card">
            <div className="info-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div className="info-card-content">
              <span className="info-card-label">{t('minimumWithdrawal') || 'Min. Withdrawal'}</span>
              <span className="info-card-value">${withdrawalEligibility.minimumWithdrawal?.toFixed(2) || '20.00'}</span>
            </div>
          </div>

          {/* Turnover Status Card */}
          {turnoverLoading ? (
            <div className="wallet-info-card turnover-card loading">
              <ButtonSpinner />
              <span className="info-card-label">{t('loadingTurnover') || 'Loading...'}</span>
            </div>
          ) : hasTurnoverRequirement ? (
            <div className={`wallet-info-card turnover-card ${turnoverStatus.canWithdraw ? 'complete' : 'pending'}`}>
              <div className="info-card-icon">
                {turnoverStatus.canWithdraw ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                )}
              </div>
              <div className="info-card-content">
                <span className="info-card-label">{t('turnoverRequirement') || 'Wagering Requirement'}</span>
                {turnoverStatus.canWithdraw ? (
                  <span className="info-card-value complete">{t('turnoverComplete') || 'Complete!'}</span>
                ) : (
                  <div className="turnover-progress-container">
                    <div className="turnover-progress-bar">
                      <div
                        className="turnover-progress-fill"
                        style={{ width: `${turnoverProgress}%` }}
                      />
                    </div>
                    <div className="turnover-progress-text">
                      <span className="progress-amount">${turnoverStatus.turnoverCompleted?.toFixed(2)}</span>
                      <span className="progress-separator">/</span>
                      <span className="progress-total">${turnoverStatus.totalTurnoverRequired?.toFixed(2)}</span>
                      <span className="progress-percent">({turnoverProgress.toFixed(0)}%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="wallet-info-card turnover-card none">
              <div className="info-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div className="info-card-content">
                <span className="info-card-label">{t('turnoverRequirement') || 'Wagering Requirement'}</span>
                <span className="info-card-value complete">{t('noRequirements') || 'No requirements'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Turnover Warning Banner (if withdrawal locked) */}
        {!withdrawalEligibility.canWithdraw && withdrawalEligibility.turnoverRemaining > 0 && (
          <div className="turnover-warning-banner">
            <div className="warning-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1C8.676 1 6 3.676 6 7v2H4v14h16V9h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4z"/>
              </svg>
            </div>
            <div className="warning-content">
              <span className="warning-title">{t('withdrawalLocked') || 'Withdrawal Locked'}</span>
              <span className="warning-text">
                {t('wagerMoreToUnlock', { amount: `$${withdrawalEligibility.turnoverRemaining?.toFixed(2)}` }) ||
                  `Wager $${withdrawalEligibility.turnoverRemaining?.toFixed(2)} more to unlock withdrawals`}
              </span>
            </div>
            <Link to="/slots" className="warning-action-btn">
              {t('playNow') || 'Play Now'}
            </Link>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="wallet-grid">
        {/* Left Column */}
        <div className="wallet-column">
          {/* Promotions Banner */}
          <Link to="/promotions" className="promo-banner-card">
            <div className="promo-banner-bg"></div>
            <div className="promo-banner-content">
              <div className="promo-banner-icon">
                <span>🎁</span>
              </div>
              <div className="promo-banner-text">
                <h3>{t('exclusiveBonuses') || 'Exclusive Bonuses'}</h3>
                <p>{t('claimYourRewards') || 'Claim amazing rewards & promo codes!'}</p>
              </div>
              <div className="promo-banner-arrow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
            <div className="promo-banner-shine"></div>
          </Link>


          {/* Commission Earnings Card */}
          <div className="modern-card commission-card">
            <div className="card-header">
              <div className="card-title">
                <div className="title-icon commission">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <div>
                  <h3>{t('commissionEarnings') || 'Commission Earnings'}</h3>
                  <p className="card-subtitle">{t('referralRewards') || 'Referral Rewards'}</p>
                </div>
              </div>
              <Link to="/refer" className="see-all-btn">{t('referFriend') || 'Refer Friend'}</Link>
            </div>

            {/* Commission Summary */}
            <div className="commission-summary">
              <div className="commission-stat pending-stat">
                <div className="stat-icon-small pending">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-label-small">{t('pending') || 'Pending'}</span>
                  <span className="stat-value-small pending">${pendingCommissionTotal.toFixed(2)}</span>
                </div>
              </div>
              <div className="commission-stat total-stat">
                <div className="stat-icon-small total">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-label-small">{t('totalEarned') || 'Total Earned'}</span>
                  <span className="stat-value-small total">
                    ${commissionEarnings.reduce((sum, c) => sum + parseFloat(c.commissionAmount || c.amount || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Commission Earnings List */}
            <div className="commission-list">
              {commissionLoading ? (
                <div className="commission-loading">
                  <ButtonSpinner />
                  <span>{t('loading') || 'Loading...'}</span>
                </div>
              ) : commissionEarnings.length === 0 ? (
                <div className="no-commissions">
                  <div className="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <p>{t('noCommissions') || 'No commission earnings yet'}</p>
                  <span className="empty-hint">{t('referFriendsToEarn') || 'Refer friends to start earning!'}</span>
                </div>
              ) : (
                commissionEarnings.slice(0, 5).map((comm, index) => {
                  const commType = (comm.commissionType || comm.type || 'DEPOSIT').toUpperCase()
                  const commStatus = (comm.status || 'PENDING').toLowerCase()
                  const commAmount = parseFloat(comm.commissionAmount || comm.amount || 0)

                  return (
                    <div
                      key={comm.id || index}
                      className="commission-row"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className={`commission-type-icon ${commType.toLowerCase()}`}>
                        {commType === 'DEPOSIT' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 19V5M5 12l7 7 7-7"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M16 12l-4-4-4 4M12 16V8"/>
                          </svg>
                        )}
                      </div>
                      <div className="commission-info">
                        <span className="commission-title">
                          {commType === 'DEPOSIT' ? (t('depositCommission') || 'Deposit Commission') : (t('playCommission') || 'Play Commission')}
                        </span>
                        <span className="commission-date">
                          {new Date(comm.createdAt).toLocaleDateString()} • {((comm.commissionRate || 0) * 100).toFixed(0)}% of ${parseFloat(comm.sourceAmount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="commission-right">
                        <span className="commission-amount">+${commAmount.toFixed(2)}</span>
                        <span className={`commission-status ${commStatus}`}>
                          {commStatus === 'credited' ? (t('credited') || 'Credited') : (t('pending') || 'Pending')}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => {
          setShowDepositModal(false)
          loadWalletData() // Refresh transactions after deposit
        }}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => {
          setShowWithdrawModal(false)
          loadWalletData() // Refresh transactions after withdrawal
        }}
      />
    </div>
  )
}
