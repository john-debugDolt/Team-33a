import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { walletService } from '../services/walletService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'

const checkInDays = [
  { day: 1, reward: 10, label: 'Day 1' },
  { day: 2, reward: 20, label: 'Day 2' },
  { day: 3, reward: 30, label: 'Day 3' },
  { day: 4, reward: 50, label: 'Day 4' },
  { day: 5, reward: 75, label: 'Day 5' },
  { day: 6, reward: 100, label: 'Day 6' },
  { day: 7, reward: 200, label: 'Day 7' },
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

// Format card number with spaces
const formatCardNumber = (value) => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
  const matches = v.match(/\d{4,16}/g)
  const match = (matches && matches[0]) || ''
  const parts = []
  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4))
  }
  return parts.length ? parts.join(' ') : v
}

// Format expiry date
const formatExpiry = (value) => {
  const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
  if (v.length >= 2) {
    return v.substring(0, 2) + '/' + v.substring(2, 4)
  }
  return v
}

export default function Wallet() {
  const { user, updateBalance } = useAuth()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [recipientUsername, setRecipientUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [checkInStatus, setCheckInStatus] = useState({
    currentDay: 1,
    checkedDays: [],
    canCheckIn: true,
    currentStreak: 0,
    nextReward: 10,
  })
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilMidnight())

  // Payment method states
  const [paymentMethod, setPaymentMethod] = useState('credit_card')
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
  })
  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    routingNumber: '',
  })

  const quickAmounts = [100, 500, 1000, 5000]

  // Load wallet data
  const loadWalletData = useCallback(async () => {
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
  }, [])

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

  // Validate credit card details
  const validateCardDetails = () => {
    const { cardNumber, cardName, expiry, cvv } = cardDetails
    const cleanCardNumber = cardNumber.replace(/\s/g, '')

    if (!cleanCardNumber || cleanCardNumber.length < 15) {
      showToast('Please enter a valid card number', 'error')
      return false
    }
    if (!cardName.trim()) {
      showToast('Please enter the cardholder name', 'error')
      return false
    }
    if (!expiry || expiry.length < 5) {
      showToast('Please enter a valid expiry date (MM/YY)', 'error')
      return false
    }
    // Validate expiry date
    const [month, year] = expiry.split('/')
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear() % 100
    const currentMonth = currentDate.getMonth() + 1
    if (parseInt(month) < 1 || parseInt(month) > 12) {
      showToast('Invalid expiry month', 'error')
      return false
    }
    if (parseInt(year) < currentYear || (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
      showToast('Card has expired', 'error')
      return false
    }
    if (!cvv || cvv.length < 3) {
      showToast('Please enter a valid CVV', 'error')
      return false
    }
    return true
  }

  // Validate bank details
  const validateBankDetails = () => {
    const { accountName, accountNumber, bankName, routingNumber } = bankDetails

    if (!accountName.trim()) {
      showToast('Please enter account holder name', 'error')
      return false
    }
    if (!accountNumber || accountNumber.length < 8) {
      showToast('Please enter a valid account number', 'error')
      return false
    }
    if (!bankName.trim()) {
      showToast('Please enter bank name', 'error')
      return false
    }
    if (!routingNumber || routingNumber.length < 9) {
      showToast('Please enter a valid routing number (9 digits)', 'error')
      return false
    }
    return true
  }

  // Reset forms
  const resetForms = () => {
    setAmount('')
    setRecipientUsername('')
    setCardDetails({ cardNumber: '', cardName: '', expiry: '', cvv: '' })
    setBankDetails({ accountName: '', accountNumber: '', bankName: '', routingNumber: '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      showToast('Please enter a valid amount', 'error')
      return
    }

    // Validation based on tab
    if (activeTab === 'deposit') {
      if (numAmount < 10) {
        showToast('Minimum deposit is $10', 'error')
        return
      }
      if (numAmount > 10000) {
        showToast('Maximum deposit is $10,000', 'error')
        return
      }
      // Validate payment method
      if (paymentMethod === 'credit_card' && !validateCardDetails()) {
        return
      }
      if (paymentMethod === 'bank_transfer' && !validateBankDetails()) {
        return
      }
    }

    if (activeTab === 'withdraw') {
      if (numAmount < 20) {
        showToast('Minimum withdrawal is $20', 'error')
        return
      }
      if (numAmount > (user?.balance || 0)) {
        showToast('Insufficient balance', 'error')
        return
      }
      if (!validateBankDetails()) {
        return
      }
    }

    if (activeTab === 'transfer') {
      if (numAmount < 1) {
        showToast('Minimum transfer is $1', 'error')
        return
      }
      if (numAmount > (user?.balance || 0)) {
        showToast('Insufficient balance', 'error')
        return
      }
      if (!recipientUsername.trim()) {
        showToast('Please enter recipient username', 'error')
        return
      }
      if (recipientUsername.toLowerCase() === user?.username?.toLowerCase()) {
        showToast('Cannot transfer to yourself', 'error')
        return
      }
    }

    setLoading(true)

    let result
    const methodName = paymentMethod === 'credit_card' ? 'Credit Card' : 'Bank Transfer'

    try {
      if (activeTab === 'deposit') {
        result = await walletService.deposit(numAmount, methodName)
      } else if (activeTab === 'withdraw') {
        result = await walletService.withdraw(numAmount, 'Bank Transfer')
      } else if (activeTab === 'transfer') {
        result = await walletService.transfer(numAmount, recipientUsername)
      }

      if (result.success) {
        showToast(result.message || `${activeTab} successful!`, 'success')
        resetForms()
        // Update user balance
        if (updateBalance && result.data?.balance) {
          updateBalance(result.data.balance)
        }
        // Refresh transactions
        loadWalletData()
      } else {
        showToast(result.message || `${activeTab} failed`, 'error')
      }
    } catch (error) {
      showToast('An error occurred. Please try again.', 'error')
    }

    setLoading(false)
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
            <span className="balance-label">Total Balance</span>
            <div className="balance-amount-large">
              <span className="currency-sign">$</span>
              <span className="balance-value">{balance.toLocaleString()}</span>
              <span className="balance-cents">.00</span>
            </div>
            <div className="balance-change positive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
              <span>Check in daily for bonuses!</span>
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
                <span className="stat-label">Available</span>
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
                <span className="stat-label">Pending</span>
                <span className="stat-value">${pendingBalance.toLocaleString()}.00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={() => setActiveTab('deposit')}>
            <div className="action-icon deposit">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7 7 7-7"/>
              </svg>
            </div>
            <span>Deposit</span>
          </button>
          <button className="quick-action-btn" onClick={() => setActiveTab('withdraw')}>
            <div className="action-icon withdraw">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7-7 7 7"/>
              </svg>
            </div>
            <span>Withdraw</span>
          </button>
          <button className="quick-action-btn" onClick={() => setActiveTab('transfer')}>
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
            <span>History</span>
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
                  <h3>Daily Rewards</h3>
                  <p className="card-subtitle">Claim your daily bonus</p>
                </div>
              </div>
              <div className="streak-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L9.1 9.1 2 12l7.1 2.9L12 22l2.9-7.1L22 12l-7.1-2.9z"/>
                </svg>
                <span>{checkInStatus.checkedDays?.length || checkInStatus.currentStreak || 0} Day Streak</span>
              </div>
            </div>

            <div className="checkin-grid">
              {checkInDays.map((dayInfo) => {
                const isChecked = checkInStatus.checkedDays?.includes(dayInfo.day) || false
                const isToday = dayInfo.day === checkInStatus.currentDay
                const isFuture = dayInfo.day > checkInStatus.currentDay
                const isPast = dayInfo.day < checkInStatus.currentDay && !isChecked

                return (
                  <div
                    key={dayInfo.day}
                    className={`checkin-box ${isChecked ? 'checked' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}`}
                  >
                    <div className="box-content">
                      {isChecked ? (
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
                      <span className="day-label">{dayInfo.label}</span>
                      <span className="reward-amount">+${dayInfo.reward}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              className={`claim-btn ${!checkInStatus.canCheckIn ? 'claimed' : ''}`}
              onClick={handleCheckIn}
              disabled={!checkInStatus.canCheckIn || checkInLoading}
            >
              {checkInLoading ? (
                <ButtonSpinner />
              ) : !checkInStatus.canCheckIn ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Claimed Today!
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"/>
                  </svg>
                  Claim ${checkInStatus.nextReward || checkInDays[checkInStatus.currentDay - 1]?.reward || 10} Bonus
                </>
              )}
            </button>

            {/* Countdown to next check-in */}
            {!checkInStatus.canCheckIn && (
              <div className="checkin-countdown">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Next check-in available in {timeUntilReset.hours}h {timeUntilReset.minutes}m</span>
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
                  <h3>Recent Activity</h3>
                  <p className="card-subtitle">Your latest transactions</p>
                </div>
              </div>
              <Link to="/history" className="see-all-btn">See All</Link>
            </div>

            <div className="transactions-modern">
              {transactions.length === 0 ? (
                <div className="no-transactions">
                  <p>No transactions yet</p>
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
                        {tx.type === 'deposit' ? 'Deposit' : tx.type === 'withdraw' ? 'Withdrawal' : 'Bonus'}
                      </span>
                      <span className="tx-datetime">
                        {new Date(tx.createdAt).toLocaleDateString()} • {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="tx-right">
                      <span className={`tx-amount-modern ${tx.type === 'withdraw' ? 'withdraw' : 'deposit'}`}>
                        {tx.type === 'withdraw' ? '-' : '+'}${tx.amount.toFixed(2)}
                      </span>
                      <span className={`tx-status-badge ${tx.status}`}>{tx.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="wallet-column">
          {/* Deposit/Withdraw/Transfer Form */}
          <div className="modern-card action-card">
            <div className="action-tabs">
              <button
                className={`action-tab ${activeTab === 'deposit' ? 'active' : ''}`}
                onClick={() => setActiveTab('deposit')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5M5 12l7 7 7-7"/>
                </svg>
                Deposit
              </button>
              <button
                className={`action-tab ${activeTab === 'withdraw' ? 'active' : ''}`}
                onClick={() => setActiveTab('withdraw')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7-7 7 7"/>
                </svg>
                Withdraw
              </button>
              <button
                className={`action-tab ${activeTab === 'transfer' ? 'active' : ''}`}
                onClick={() => setActiveTab('transfer')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                Transfer
              </button>
            </div>

            <form onSubmit={handleSubmit} className="action-form">
              {/* Amount Input */}
              <div className="input-group">
                <label>Amount</label>
                <div className="amount-input-modern">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="preset-amounts">
                {quickAmounts.map((qa) => (
                  <button
                    key={qa}
                    type="button"
                    className={`preset-btn ${amount === String(qa) ? 'active' : ''}`}
                    onClick={() => setAmount(String(qa))}
                  >
                    ${qa}
                  </button>
                ))}
              </div>

              {/* Transfer - Recipient Username */}
              {activeTab === 'transfer' && (
                <div className="input-group">
                  <label>Recipient Username</label>
                  <div className="text-input-modern">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <input
                      type="text"
                      value={recipientUsername}
                      onChange={(e) => setRecipientUsername(e.target.value)}
                      placeholder="Enter username"
                    />
                  </div>
                </div>
              )}

              {/* Deposit - Payment Method Selection */}
              {activeTab === 'deposit' && (
                <div className="payment-method-section">
                  <label>Payment Method</label>
                  <div className="payment-method-toggle">
                    <button
                      type="button"
                      className={`method-btn ${paymentMethod === 'credit_card' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('credit_card')}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                      </svg>
                      Credit Card
                    </button>
                    <button
                      type="button"
                      className={`method-btn ${paymentMethod === 'bank_transfer' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('bank_transfer')}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                      Bank Transfer
                    </button>
                  </div>
                </div>
              )}

              {/* Credit Card Form */}
              {activeTab === 'deposit' && paymentMethod === 'credit_card' && (
                <div className="payment-form credit-card-form">
                  <div className="input-group">
                    <label>Card Number</label>
                    <div className="text-input-modern card-input">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                      </svg>
                      <input
                        type="text"
                        value={cardDetails.cardNumber}
                        onChange={(e) => setCardDetails(prev => ({
                          ...prev,
                          cardNumber: formatCardNumber(e.target.value)
                        }))}
                        placeholder="1234 5678 9012 3456"
                        maxLength="19"
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Cardholder Name</label>
                    <div className="text-input-modern">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        value={cardDetails.cardName}
                        onChange={(e) => setCardDetails(prev => ({
                          ...prev,
                          cardName: e.target.value.toUpperCase()
                        }))}
                        placeholder="JOHN DOE"
                      />
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-group">
                      <label>Expiry Date</label>
                      <div className="text-input-modern">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <input
                          type="text"
                          value={cardDetails.expiry}
                          onChange={(e) => setCardDetails(prev => ({
                            ...prev,
                            expiry: formatExpiry(e.target.value)
                          }))}
                          placeholder="MM/YY"
                          maxLength="5"
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>CVV</label>
                      <div className="text-input-modern">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <input
                          type="password"
                          value={cardDetails.cvv}
                          onChange={(e) => setCardDetails(prev => ({
                            ...prev,
                            cvv: e.target.value.replace(/\D/g, '').slice(0, 4)
                          }))}
                          placeholder="•••"
                          maxLength="4"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Transfer Form - For Deposit */}
              {activeTab === 'deposit' && paymentMethod === 'bank_transfer' && (
                <div className="payment-form bank-form">
                  <div className="input-group">
                    <label>Account Holder Name</label>
                    <div className="text-input-modern">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        value={bankDetails.accountName}
                        onChange={(e) => setBankDetails(prev => ({
                          ...prev,
                          accountName: e.target.value
                        }))}
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Bank Name</label>
                    <div className="text-input-modern">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
                      </svg>
                      <input
                        type="text"
                        value={bankDetails.bankName}
                        onChange={(e) => setBankDetails(prev => ({
                          ...prev,
                          bankName: e.target.value
                        }))}
                        placeholder="Bank of America"
                      />
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-group">
                      <label>Account Number</label>
                      <div className="text-input-modern">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        </svg>
                        <input
                          type="text"
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails(prev => ({
                            ...prev,
                            accountNumber: e.target.value.replace(/\D/g, '')
                          }))}
                          placeholder="12345678"
                          maxLength="17"
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Routing Number</label>
                      <div className="text-input-modern">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        </svg>
                        <input
                          type="text"
                          value={bankDetails.routingNumber}
                          onChange={(e) => setBankDetails(prev => ({
                            ...prev,
                            routingNumber: e.target.value.replace(/\D/g, '').slice(0, 9)
                          }))}
                          placeholder="123456789"
                          maxLength="9"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Transfer Form - For Withdrawal */}
              {activeTab === 'withdraw' && (
                <div className="payment-form bank-form">
                  <div className="section-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11"/>
                    </svg>
                    <span>Bank Account Details</span>
                  </div>

                  <div className="input-group">
                    <label>Account Holder Name</label>
                    <div className="text-input-modern">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        value={bankDetails.accountName}
                        onChange={(e) => setBankDetails(prev => ({
                          ...prev,
                          accountName: e.target.value
                        }))}
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Bank Name</label>
                    <div className="text-input-modern">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
                      </svg>
                      <input
                        type="text"
                        value={bankDetails.bankName}
                        onChange={(e) => setBankDetails(prev => ({
                          ...prev,
                          bankName: e.target.value
                        }))}
                        placeholder="Bank of America"
                      />
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-group">
                      <label>Account Number</label>
                      <div className="text-input-modern">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        </svg>
                        <input
                          type="text"
                          value={bankDetails.accountNumber}
                          onChange={(e) => setBankDetails(prev => ({
                            ...prev,
                            accountNumber: e.target.value.replace(/\D/g, '')
                          }))}
                          placeholder="12345678"
                          maxLength="17"
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Routing Number</label>
                      <div className="text-input-modern">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        </svg>
                        <input
                          type="text"
                          value={bankDetails.routingNumber}
                          onChange={(e) => setBankDetails(prev => ({
                            ...prev,
                            routingNumber: e.target.value.replace(/\D/g, '').slice(0, 9)
                          }))}
                          placeholder="123456789"
                          maxLength="9"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" className={`submit-btn ${activeTab}`} disabled={loading}>
                {loading ? (
                  <ButtonSpinner />
                ) : (
                  activeTab === 'deposit' ? 'Deposit Funds' :
                  activeTab === 'withdraw' ? 'Withdraw Funds' :
                  'Send Transfer'
                )}
              </button>

              <div className="form-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                </svg>
                <span>
                  {activeTab === 'deposit'
                    ? 'Min: $10 • Max: $10,000 • Instant processing'
                    : activeTab === 'withdraw'
                    ? 'Min: $20 • 1-3 business days'
                    : 'Min: $1 • Instant to recipient'}
                </span>
              </div>
            </form>
          </div>

          {/* Payment Methods */}
          <div className="modern-card">
            <div className="card-header">
              <div className="card-title">
                <div className="title-icon payment">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                </div>
                <div>
                  <h3>Payment Methods</h3>
                  <p className="card-subtitle">Choose how to pay</p>
                </div>
              </div>
            </div>

            <div className="payment-grid">
              <div className="payment-option active">
                <div className="payment-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                </div>
                <span className="payment-name">Credit Card</span>
                <div className="payment-check">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </div>
              <div className="payment-option">
                <div className="payment-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <span className="payment-name">Bank Transfer</span>
              </div>
              <div className="payment-option">
                <div className="payment-icon crypto">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M14.5 9h-5l-.5 3h5l-.5 3h-5"/>
                  </svg>
                </div>
                <span className="payment-name">Crypto</span>
              </div>
              <div className="payment-option">
                <div className="payment-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M2 10h3M19 10h3M2 14h3M19 14h3"/>
                  </svg>
                </div>
                <span className="payment-name">E-Wallet</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
