import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { walletService } from '../../services/walletService'
import { ButtonSpinner } from '../LoadingSpinner/LoadingSpinner'
import '../DepositModal/DepositModal.css'

const quickAmounts = [50, 100, 200, 500]

export default function WithdrawModal({ isOpen, onClose }) {
  const { user, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [amount, setAmount] = useState('')
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountHolderName: '',
    bsb: '',
    accountNumber: '',
    payId: '',
  })
  const [usePayId, setUsePayId] = useState(false)
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

    if (!withdrawAmount || withdrawAmount < 10) {
      showToast('Minimum withdrawal is $10', 'error')
      return
    }

    if (withdrawAmount > balance) {
      showToast('Insufficient balance', 'error')
      return
    }

    // Validate bank details - either BSB + Account Number OR PayID required
    const hasBankAccount = bankDetails.bsb && bankDetails.accountNumber
    const hasPayId = bankDetails.payId

    if (!hasBankAccount && !hasPayId) {
      showToast('Please provide bank details (BSB + Account Number) or PayID', 'error')
      return
    }

    if (!bankDetails.accountHolderName) {
      showToast('Please enter the account holder name', 'error')
      return
    }

    setLoading(true)
    setStep('processing')

    // Create pending withdrawal request for admin approval
    const result = await walletService.requestWithdrawal(withdrawAmount, 'Bank Transfer', {
      bankName: bankDetails.bankName || 'Bank Transfer',
      accountHolderName: bankDetails.accountHolderName,
      accountNumber: bankDetails.accountNumber || undefined,
      bsb: bankDetails.bsb?.replace('-', '') || undefined,
      payId: bankDetails.payId || undefined
    })

    if (result.success) {
      setStep('success')
      showToast(result.message || 'Withdrawal request submitted! Awaiting admin approval.', 'success')
      notifyTransactionUpdate() // Refresh transaction history
    } else {
      setStep('amount')
      showToast(result.error || 'Withdrawal request failed', 'error')
    }

    setLoading(false)
  }

  const handleClose = () => {
    setAmount('')
    setStep('amount')
    setBankDetails({ bankName: '', accountHolderName: '', bsb: '', accountNumber: '', payId: '' })
    setUsePayId(false)
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h2>Withdrawal Request Submitted!</h2>
            <p className="success-amount" style={{ color: '#f59e0b' }}>-${parseFloat(amount).toFixed(2)}</p>
            <p className="success-balance">Awaiting Admin Approval</p>
            <p className="success-note">
              Your withdrawal will be processed once approved by our team.
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

            {balance < 10 && (
              <div className="balance-warning">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                <span>Minimum withdrawal is $10. Your balance is too low.</span>
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
                  min="10"
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

            <div className="bank-section">
              <label>Bank Details</label>
              <input
                type="text"
                className="bank-input"
                placeholder="Account Holder Name *"
                value={bankDetails.accountHolderName}
                onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
              />
              <input
                type="text"
                className="bank-input"
                placeholder="Bank Name (e.g., Commonwealth Bank)"
                value={bankDetails.bankName}
                onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
              />

              <div className="payment-method-toggle" style={{ display: 'flex', gap: '10px', margin: '10px 0' }}>
                <button
                  type="button"
                  className={`toggle-btn ${!usePayId ? 'active' : ''}`}
                  onClick={() => setUsePayId(false)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: !usePayId ? '#10b981' : '#fff',
                    color: !usePayId ? '#fff' : '#666',
                    cursor: 'pointer'
                  }}
                >
                  BSB + Account
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${usePayId ? 'active' : ''}`}
                  onClick={() => setUsePayId(true)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: usePayId ? '#10b981' : '#fff',
                    color: usePayId ? '#fff' : '#666',
                    cursor: 'pointer'
                  }}
                >
                  PayID
                </button>
              </div>

              {!usePayId ? (
                <>
                  <input
                    type="text"
                    className="bank-input"
                    placeholder="BSB (6 digits, e.g., 062000) *"
                    value={bankDetails.bsb}
                    onChange={(e) => setBankDetails({ ...bankDetails, bsb: e.target.value.replace(/[^0-9-]/g, '') })}
                    maxLength={7}
                  />
                  <input
                    type="text"
                    className="bank-input"
                    placeholder="Account Number (6-10 digits) *"
                    value={bankDetails.accountNumber}
                    onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value.replace(/[^0-9]/g, '') })}
                    maxLength={10}
                  />
                </>
              ) : (
                <input
                  type="text"
                  className="bank-input"
                  placeholder="PayID (email or phone) *"
                  value={bankDetails.payId}
                  onChange={(e) => setBankDetails({ ...bankDetails, payId: e.target.value })}
                />
              )}
            </div>

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
              disabled={loading || !amount || parseFloat(amount) < 10 || parseFloat(amount) > balance}
            >
              {loading ? <ButtonSpinner /> : `Withdraw $${parseFloat(amount || 0).toFixed(2)}`}
            </button>

            <p className="withdraw-note">
              Min $10, Max $50,000. Withdrawals require admin approval.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
