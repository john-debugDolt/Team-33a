import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/TranslationContext'
import { walletService } from '../services/walletService'
import { getRolloverProgress, getAccountType, clearBonus } from '../services/bonusWalletService'
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
  // Bonus-mode rollover snapshot — populated when getAccountType === 'bonus'.
  // The "Available" stat is sourced from rollover.balance in that case so
  // the player sees their bonus pool size, not the (locked) main wallet.
  const [rollover, setRollover] = useState(null)
  const [accountType, setAccountType] = useState('normal')
  // Drives the "Clear Wallet" quick-action (forfeits the bonus pool,
  // unlocks the main wallet) — mirrors the popup in Layout.jsx.
  const [clearingBonus, setClearingBonus] = useState(false)
  // Shown when a bonus-mode player taps Deposit. They must clear the
  // bonus pool first (the main wallet is server-locked while
  // bonus_wallet > 0).
  const [showBonusBlockModal, setShowBonusBlockModal] = useState(false)


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

    // Load commission earnings
    if (user?.accountId) {
      setCommissionLoading(true)
      try {
        const [commResult, pendingResult] = await Promise.all([
          walletService.getCommissionEarnings(user.accountId),
          walletService.getPendingCommissionTotal(user.accountId),
        ])

        if (commResult.success && commResult.earnings) {
          setCommissionEarnings(commResult.earnings)
        }
        if (pendingResult.success) {
          setPendingCommissionTotal(pendingResult.pendingTotal || 0)
        }
      } catch (err) {
        console.error('[Wallet] Data fetch error:', err)
      }
      setCommissionLoading(false)
    }
  }, [isAuthenticated, user?.accountId, updateBalance])

  // Load wallet data on mount
  useEffect(() => {
    loadWalletData()
  }, [loadWalletData])

  // Re-read the rollover snapshot — used after clearBonus so the
  // Available/Balance figures and the "is on bonus" branch refresh
  // without a full page reload.
  const refreshBonusState = useCallback(async () => {
    if (!user?.accountId) return
    const type = await getAccountType(user.accountId, { force: true })
    setAccountType(type)
    if (type === 'bonus') {
      const r = await getRolloverProgress(user.accountId)
      setRollover(r)
    } else {
      setRollover(null)
    }
  }, [user?.accountId])

  const handleClearBonusWallet = useCallback(async () => {
    if (!user?.accountId || clearingBonus) return
    if (!window.confirm('Clear your bonus balance? This will forfeit your bonus credit and unlock your main wallet for deposit / withdraw.')) {
      return
    }
    setClearingBonus(true)
    try {
      const result = await clearBonus(user.accountId, { description: 'user hit clear-balance (wallet page)' })
      if (result?.success) {
        showToast(t('clearBalanceSuccess') || 'Bonus balance cleared.', 'success')
        try {
          const w = await walletService.getBalance(user.accountId)
          if (w?.success && w.balance !== undefined) updateBalance(w.balance)
        } catch { /* ignore */ }
        await refreshBonusState()
      } else if (result?.status === 404 || result?.status === 405) {
        showToast('Clear balance is not yet available.', 'warning')
      } else {
        showToast(result?.error || 'Failed to clear balance.', 'error')
      }
    } catch (err) {
      showToast(err?.message || 'Failed to clear balance.', 'error')
    } finally {
      setClearingBonus(false)
    }
  }, [user?.accountId, clearingBonus, showToast, t, updateBalance, refreshBonusState])

  const handleDepositClick = useCallback(() => {
    if (accountType === 'bonus') {
      setShowBonusBlockModal(true)
      return
    }
    setShowDepositModal(true)
  }, [accountType])

  // Bonus-mode snapshot: when the player is on bonus (bonus_wallet > 0)
  // we surface the bonus pool balance in the "Available" stat instead of
  // the main wallet (which is server-locked while on bonus).
  useEffect(() => {
    let cancelled = false
    const accountId = user?.accountId
    if (!isAuthenticated || !accountId) {
      setRollover(null)
      setAccountType('normal')
      return
    }
    ;(async () => {
      const type = await getAccountType(accountId)
      if (cancelled) return
      setAccountType(type)
      if (type === 'bonus') {
        const r = await getRolloverProgress(accountId)
        if (!cancelled) setRollover(r)
      } else {
        setRollover(null)
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, user?.accountId])


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
  // Withdrawable amount: when the player is on bonus mode we show the
  // bonus pool balance from /api/bonus-wallet/{id}/rollover. Outside
  // bonus mode the previous availableBalance (or main wallet) stands.
  const isBonus = accountType === 'bonus'
  const availableBalance = isBonus && rollover
    ? Number(rollover.balance) || 0
    : (user?.availableBalance || balance)
  const pendingBalance = user?.pendingBalance || 0

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
          <button className="quick-action-btn" onClick={handleDepositClick}>
            <div className="action-icon deposit">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7 7 7-7"/>
              </svg>
            </div>
            <span>{t('deposit')}</span>
          </button>
          <button className="quick-action-btn" onClick={() => setShowWithdrawModal(true)}>
            <div className="action-icon withdraw">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7-7 7 7"/>
              </svg>
            </div>
            <span>{t('withdraw')}</span>
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={handleClearBonusWallet}
            disabled={clearingBonus}
            aria-label="Clear bonus wallet (forfeit bonus, unlock main wallet)"
          >
            <div className="action-icon clear-wallet">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <span>{clearingBonus ? 'Clearing…' : 'Clear Wallet'}</span>
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

      {/* Bonus-active deposit gate: the main wallet is server-locked
          while bonus_wallet > 0, so a deposit can't land on it. The
          player has to forfeit (clear) the bonus pool first. */}
      {showBonusBlockModal && (
        <div
          className="bonus-block-overlay"
          onClick={() => setShowBonusBlockModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bonus-block-title"
        >
          <div className="bonus-block-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="bonus-block-close"
              onClick={() => setShowBonusBlockModal(false)}
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <div className="bonus-block-icon" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 id="bonus-block-title" className="bonus-block-title">Bonus is active</h3>
            <p className="bonus-block-message">
              You can't deposit while a bonus is sitting on your wallet. Clear the bonus to forfeit it and unlock your main wallet for deposit.
            </p>
            <div className="bonus-block-actions">
              <button
                type="button"
                className="bonus-block-btn bonus-block-btn-secondary"
                onClick={() => setShowBonusBlockModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bonus-block-btn bonus-block-btn-primary"
                disabled={clearingBonus}
                onClick={async () => {
                  setShowBonusBlockModal(false)
                  await handleClearBonusWallet()
                }}
              >
                {clearingBonus ? 'Clearing…' : 'Clear Bonus Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
