import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { walletService } from '../../services/walletService'
import { ButtonSpinner } from '../LoadingSpinner/LoadingSpinner'
import './DepositModal.css'

const paymentMethods = [
  { id: 'credit_card', name: 'Credit/Debit Card', icon: '💳', fee: '0%' },
  { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', fee: '0%' },
  { id: 'payid', name: 'PayID', icon: '⚡', fee: '0%' },
  { id: 'crypto', name: 'Cryptocurrency', icon: '₿', fee: '0%' },
]

const quickAmounts = [50, 100, 200, 500, 1000]

export default function DepositModal({ isOpen, onClose }) {
  const { user, updateBalance } = useAuth()
  const { showToast } = useToast()

  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('credit_card')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('amount') // 'amount', 'processing', 'success'

  if (!isOpen) return null

  const handleQuickAmount = (value) => {
    setAmount(value.toString())
  }

  const handleDeposit = async () => {
    const depositAmount = parseFloat(amount)

    if (!depositAmount || depositAmount < 10) {
      showToast('Minimum deposit is $10', 'error')
      return
    }

    if (depositAmount > 10000) {
      showToast('Maximum deposit is $10,000', 'error')
      return
    }

    setLoading(true)
    setStep('processing')

    const selectedMethod = paymentMethods.find(m => m.id === paymentMethod)
    const result = await walletService.deposit(depositAmount, selectedMethod?.name || 'Credit Card')

    if (result.success) {
      setStep('success')
      updateBalance(result.newBalance)
      showToast(`Successfully deposited $${depositAmount.toFixed(2)}!`, 'success')
    } else {
      setStep('amount')
      showToast(result.error || 'Deposit failed', 'error')
    }

    setLoading(false)
  }

  const handleClose = () => {
    setAmount('')
    setStep('amount')
    onClose()
  }

  return (
    <div className="deposit-modal-overlay" onClick={handleClose}>
      <div className="deposit-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={handleClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        {step === 'success' ? (
          <div className="deposit-success">
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2>Deposit Successful!</h2>
            <p className="success-amount">+${parseFloat(amount).toFixed(2)}</p>
            <p className="success-balance">New Balance: ${user?.balance?.toFixed(2) || '0.00'}</p>
            <button className="deposit-done-btn" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : step === 'processing' ? (
          <div className="deposit-processing">
            <div className="processing-spinner">
              <ButtonSpinner />
            </div>
            <h2>Processing Deposit</h2>
            <p>Please wait while we process your deposit...</p>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <div className="modal-icon deposit">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19V5M5 12l7 7 7-7"/>
                </svg>
              </div>
              <h2>Deposit Funds</h2>
              <p>Add money to your wallet</p>
            </div>

            <div className="current-balance">
              <span>Current Balance</span>
              <span className="balance-value">${user?.balance?.toFixed(2) || '0.00'}</span>
            </div>

            <div className="amount-section">
              <label>Deposit Amount</label>
              <div className="amount-input-wrap">
                <span className="currency">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="10"
                  max="10000"
                />
              </div>
              <div className="quick-amounts">
                {quickAmounts.map(val => (
                  <button
                    key={val}
                    className={`quick-amount-btn ${amount === val.toString() ? 'active' : ''}`}
                    onClick={() => handleQuickAmount(val)}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            <div className="payment-section">
              <label>Payment Method</label>
              <div className="payment-methods">
                {paymentMethods.map(method => (
                  <button
                    key={method.id}
                    className={`payment-method-btn ${paymentMethod === method.id ? 'active' : ''}`}
                    onClick={() => setPaymentMethod(method.id)}
                  >
                    <span className="method-icon">{method.icon}</span>
                    <span className="method-name">{method.name}</span>
                    <span className="method-fee">{method.fee} fee</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="deposit-summary">
              <div className="summary-row">
                <span>Deposit Amount</span>
                <span>${parseFloat(amount || 0).toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Processing Fee</span>
                <span className="free">FREE</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>${parseFloat(amount || 0).toFixed(2)}</span>
              </div>
            </div>

            <button
              className="deposit-submit-btn"
              onClick={handleDeposit}
              disabled={loading || !amount || parseFloat(amount) < 10}
            >
              {loading ? <ButtonSpinner /> : `Deposit $${parseFloat(amount || 0).toFixed(2)}`}
            </button>

            <p className="deposit-note">
              Deposits are instant. Minimum $10, Maximum $10,000.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
