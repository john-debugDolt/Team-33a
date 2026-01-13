import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { walletService } from '../../services/walletService'
import { ButtonSpinner } from '../LoadingSpinner/LoadingSpinner'
import '../DepositModal/DepositModal.css'

const withdrawMethods = [
  { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', time: '1-3 business days' },
  { id: 'payid', name: 'PayID', icon: '⚡', time: 'Instant' },
]

const quickAmounts = [50, 100, 200, 500]

export default function WithdrawModal({ isOpen, onClose }) {
  const { user, updateBalance } = useAuth()
  const { showToast } = useToast()

  const [amount, setAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('bank_transfer')
  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    bsb: '',
    accountNumber: '',
  })
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('amount') // 'amount', 'processing', 'success'

  if (!isOpen) return null

  const balance = user?.balance || 0

  const handleQuickAmount = (value) => {
    if (value <= balance) {
      setAmount(value.toString())
    }
  }

  const handleWithdrawAll = () => {
    setAmount(balance.toString())
  }

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount)

    if (!withdrawAmount || withdrawAmount < 20) {
      showToast('Minimum withdrawal is $20', 'error')
      return
    }

    if (withdrawAmount > balance) {
      showToast('Insufficient balance', 'error')
      return
    }

    if (withdrawMethod === 'bank_transfer') {
      if (!bankDetails.accountName || !bankDetails.bsb || !bankDetails.accountNumber) {
        showToast('Please fill in all bank details', 'error')
        return
      }
    }

    setLoading(true)
    setStep('processing')

    const selectedMethod = withdrawMethods.find(m => m.id === withdrawMethod)
    const result = await walletService.withdraw(withdrawAmount, selectedMethod?.name || 'Bank Transfer')

    if (result.success) {
      setStep('success')
      updateBalance(result.newBalance)
      showToast(`Withdrawal of $${withdrawAmount.toFixed(2)} initiated!`, 'success')
    } else {
      setStep('amount')
      showToast(result.error || 'Withdrawal failed', 'error')
    }

    setLoading(false)
  }

  const handleClose = () => {
    setAmount('')
    setStep('amount')
    setBankDetails({ accountName: '', bsb: '', accountNumber: '' })
    onClose()
  }

  return (
    <div className="withdraw-modal-overlay" onClick={handleClose}>
      <div className="withdraw-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={handleClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        {step === 'success' ? (
          <div className="withdraw-success">
            <div className="success-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2>Withdrawal Initiated!</h2>
            <p className="success-amount">-${parseFloat(amount).toFixed(2)}</p>
            <p className="success-balance">
              {withdrawMethod === 'payid' ? 'Funds will arrive instantly' : 'Funds will arrive in 1-3 business days'}
            </p>
            <button className="withdraw-done-btn" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : step === 'processing' ? (
          <div className="withdraw-processing">
            <div className="processing-spinner">
              <ButtonSpinner />
            </div>
            <h2>Processing Withdrawal</h2>
            <p>Please wait while we process your withdrawal...</p>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <div className="modal-icon withdraw">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7-7 7 7"/>
                </svg>
              </div>
              <h2>Withdraw Funds</h2>
              <p>Transfer money to your bank</p>
            </div>

            <div className="current-balance">
              <span>Available Balance</span>
              <span className="balance-value">${balance.toFixed(2)}</span>
            </div>

            {balance < 20 && (
              <div className="balance-warning">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                <span>Minimum withdrawal is $20. Your balance is too low.</span>
              </div>
            )}

            <div className="amount-section">
              <label>Withdrawal Amount</label>
              <div className="amount-input-wrap">
                <span className="currency">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="20"
                  max={balance}
                />
              </div>
              <div className="quick-amounts">
                {quickAmounts.filter(v => v <= balance).map(val => (
                  <button
                    key={val}
                    className={`quick-amount-btn ${amount === val.toString() ? 'active' : ''}`}
                    onClick={() => handleQuickAmount(val)}
                  >
                    ${val}
                  </button>
                ))}
                <button
                  className={`quick-amount-btn ${amount === balance.toString() ? 'active' : ''}`}
                  onClick={handleWithdrawAll}
                >
                  All
                </button>
              </div>
            </div>

            <div className="payment-section">
              <label>Withdrawal Method</label>
              <div className="payment-methods">
                {withdrawMethods.map(method => (
                  <button
                    key={method.id}
                    className={`payment-method-btn ${withdrawMethod === method.id ? 'active' : ''}`}
                    onClick={() => setWithdrawMethod(method.id)}
                  >
                    <span className="method-icon">{method.icon}</span>
                    <span className="method-name">{method.name}</span>
                    <span className="method-fee">{method.time}</span>
                  </button>
                ))}
              </div>
            </div>

            {withdrawMethod === 'bank_transfer' && (
              <div className="bank-section">
                <label>Bank Details</label>
                <input
                  type="text"
                  className="bank-input"
                  placeholder="Account Name"
                  value={bankDetails.accountName}
                  onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })}
                />
                <input
                  type="text"
                  className="bank-input"
                  placeholder="BSB (e.g., 123-456)"
                  value={bankDetails.bsb}
                  onChange={(e) => setBankDetails({ ...bankDetails, bsb: e.target.value })}
                  maxLength={7}
                />
                <input
                  type="text"
                  className="bank-input"
                  placeholder="Account Number"
                  value={bankDetails.accountNumber}
                  onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                />
              </div>
            )}

            <div className="withdraw-summary">
              <div className="summary-row">
                <span>Withdrawal Amount</span>
                <span>${parseFloat(amount || 0).toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Processing Fee</span>
                <span className="free">FREE</span>
              </div>
              <div className="summary-row total">
                <span>You'll Receive</span>
                <span>${parseFloat(amount || 0).toFixed(2)}</span>
              </div>
            </div>

            <button
              className="withdraw-submit-btn"
              onClick={handleWithdraw}
              disabled={loading || !amount || parseFloat(amount) < 20 || parseFloat(amount) > balance}
            >
              {loading ? <ButtonSpinner /> : `Withdraw $${parseFloat(amount || 0).toFixed(2)}`}
            </button>

            <p className="withdraw-note">
              Minimum withdrawal $20. Processing time varies by method.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
