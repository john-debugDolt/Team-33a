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

const checkInDays = [
  { day: 1, reward: 10 },
  { day: 2, reward: 20 },
  { day: 3, reward: 30 },
  { day: 4, reward: 50 },
  { day: 5, reward: 75 },
  { day: 6, reward: 100 },
  { day: 7, reward: 200 },
]

// Calculate time until next check-in (midnight)
const getTimeUntilMidnight = () => {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const diff = midnight - now
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return { hours, minutes, total: diff }
}

export default function Wallet() {
  const { user, isAuthenticated, updateBalance } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [checkInLoading, setCheckInLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [checkInStatus, setCheckInStatus] = useState({
    currentDay: 1,
    checkedDays: [],
    canCheckIn: true,
    currentStreak: 0,
    nextReward: 10,
  })
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilMidnight())

  // Load wallet data
  const loadWalletData = useCallback(async () => {
    if (!isAuthenticated) return

    // Load transactions
    const txResult = await walletService.getTransactions({ limit: 5 })
    if (txResult.success) {
      setTransactions(txResult.data.transactions || [])
    }

    // Load check-in status
    const checkInResult = await walletService.getCheckInStatus()
    if (checkInResult.success && checkInResult.data) {
      const data = checkInResult.data
      setCheckInStatus({
        currentDay: data.currentDay || 1,
        checkedDays: data.checkedDays || [],
        canCheckIn: data.canCheckIn ?? !data.isCheckedToday,
        currentStreak: data.currentStreak || 0,
        nextReward: data.nextReward || checkInDays[0].reward,
        lastCheckIn: data.lastCheckIn,
      })
    }
  }, [isAuthenticated])

  // Load wallet data on mount
  useEffect(() => {
    loadWalletData()
  }, [loadWalletData])

  // Update countdown timer every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const newTime = getTimeUntilMidnight()
      setTimeUntilReset(newTime)

      // If we've passed midnight, reload check-in status
      if (newTime.total <= 0) {
        loadWalletData()
      }
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [loadWalletData])

  const handleCheckIn = async () => {
    if (!checkInStatus.canCheckIn || checkInLoading) return

    setCheckInLoading(true)
    const result = await walletService.checkIn()

    if (result.success) {
      showToast(result.message || `Claimed $${result.data?.reward || checkInStatus.nextReward} bonus!`, 'success')

      // Update check-in status
      setCheckInStatus(prev => ({
        ...prev,
        checkedDays: result.data?.checkedDays || [...prev.checkedDays, prev.currentDay],
        currentDay: (prev.currentDay % 7) + 1,
        currentStreak: result.data?.currentStreak || prev.currentStreak + 1,
        canCheckIn: false,
        nextReward: checkInDays[result.data?.currentStreak || 0]?.reward || checkInDays[0].reward,
      }))

      // Update user balance in context
      if (updateBalance && result.data?.balance) {
        updateBalance(result.data.balance)
      }

      // Refresh transactions to show the bonus
      const txResult = await walletService.getTransactions({ limit: 5 })
      if (txResult.success) {
        setTransactions(txResult.data.transactions || [])
      }
    } else {
      showToast(result.message || 'Check-in failed', 'error')
    }

    setCheckInLoading(false)
  }

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
          <button className="quick-action-btn" onClick={() => setShowWithdrawModal(true)}>
            <div className="action-icon withdraw">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7-7 7 7"/>
              </svg>
            </div>
            <span>{t('withdraw')}</span>
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
      </div>

      {/* Main Content Grid */}
      <div className="wallet-grid">
        {/* Left Column */}
        <div className="wallet-column">
          {/* Daily Check-in Card */}
          <div className="modern-card checkin-card">
            <div className="card-header">
              <div className="card-title">
                <div className="title-icon checkin">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                  </svg>
                </div>
                <div>
                  <h3>{t('dailyRewards')}</h3>
                  <p className="card-subtitle">{t('claimBonus')}</p>
                </div>
              </div>
              <div className="streak-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L9.1 9.1 2 12l7.1 2.9L12 22l2.9-7.1L22 12l-7.1-2.9z"/>
                </svg>
                <span>{checkInStatus.checkedDays?.length || checkInStatus.currentStreak || 0} {t('days')}</span>
              </div>
            </div>

            <div className="checkin-grid">
              {checkInDays.map((dayInfo) => {
                const isChecked = checkInStatus.checkedDays?.includes(dayInfo.day) || false
                const isToday = dayInfo.day === checkInStatus.currentDay
                const isFuture = dayInfo.day > checkInStatus.currentDay
                const canClaim = isToday && checkInStatus.canCheckIn && !checkInLoading

                return (
                  <div
                    key={dayInfo.day}
                    className={`checkin-box ${isChecked ? 'checked' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''} ${canClaim ? 'claimable' : ''}`}
                    onClick={canClaim ? handleCheckIn : undefined}
                    role={canClaim ? 'button' : undefined}
                    tabIndex={canClaim ? 0 : undefined}
                    onKeyDown={canClaim ? (e) => e.key === 'Enter' && handleCheckIn() : undefined}
                  >
                    <div className="box-content">
                      {checkInLoading && isToday ? (
                        <div className="box-spinner">
                          <ButtonSpinner />
                        </div>
                      ) : isChecked ? (
                        <div className="checked-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      ) : (
                        <div className="gift-icon">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                          </svg>
                        </div>
                      )}
                      <span className="day-label">{t('dayReward', { day: dayInfo.day })}</span>
                      <span className="reward-amount">+${dayInfo.reward}</span>
                      {canClaim && <span className="tap-hint">{t('claimNow')}</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Countdown to next check-in */}
            {!checkInStatus.canCheckIn && (
              <div className="checkin-countdown">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{timeUntilReset.hours}{t('hours')} {timeUntilReset.minutes}{t('minutes')}</span>
              </div>
            )}
          </div>

          {/* Transaction History */}
          <div className="modern-card">
            <div className="card-header">
              <div className="card-title">
                <div className="title-icon history">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
                    <path d="M12 7v5l4 2"/>
                  </svg>
                </div>
                <div>
                  <h3>{t('recentTransactions')}</h3>
                  <p className="card-subtitle">{t('transactionHistory')}</p>
                </div>
              </div>
              <Link to="/history" className="see-all-btn">{t('viewAll')}</Link>
            </div>

            <div className="transactions-modern">
              {transactions.length === 0 ? (
                <div className="no-transactions">
                  <p>{t('noTransactions')}</p>
                </div>
              ) : (
                transactions.map((tx, index) => (
                  <div
                    key={tx.id}
                    className="tx-row"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className={`tx-icon-modern ${tx.type}`}>
                      {tx.type === 'deposit' || tx.type === 'bonus' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 19V5M5 12l7 7 7-7"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12l7-7 7 7"/>
                        </svg>
                      )}
                    </div>
                    <div className="tx-info">
                      <span className="tx-title">
                        {tx.type === 'deposit' ? t('deposit') : tx.type === 'withdraw' ? t('withdraw') : t('bonuses')}
                      </span>
                      <span className="tx-datetime">
                        {new Date(tx.createdAt).toLocaleDateString()} • {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="tx-right">
                      <span className={`tx-amount-modern ${tx.type === 'withdraw' ? 'withdraw' : 'deposit'}`}>
                        {tx.type === 'withdraw' ? '-' : '+'}${tx.amount.toFixed(2)}
                      </span>
                      <span className={`tx-status-badge ${tx.status}`}>
                        {tx.status === 'completed' ? t('completed') : tx.status === 'pending' ? t('pending') : t('failed')}
                      </span>
                    </div>
                  </div>
                ))
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
