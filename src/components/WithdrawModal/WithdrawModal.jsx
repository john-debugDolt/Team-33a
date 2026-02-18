import { useState, useEffect } from 'react'
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
  const [checkingEligibility, setCheckingEligibility] = useState(true)
  const [step, setStep] = useState('amount') // 'amount', 'processing', 'success'
  const [withdrawalResult, setWithdrawalResult] = useState(null)

  // Eligibility state
  const [eligibility, setEligibility] = useState({
    canWithdraw: true,
    reason: null,
    turnoverRemaining: 0,
    minimumWithdrawal: 20,
  })
  const [balanceDetails, setBalanceDetails] = useState({
    cashBalance: 0,
    bonusBalance: 0,
    withdrawableBalance: 0,
  })

  // Check eligibility when modal opens
  useEffect(() => {
    if (isOpen && user?.accountId) {
      checkEligibility()
    }
  }, [isOpen, user?.accountId])

  const checkEligibility = async () => {
    setCheckingEligibility(true)
    try {
      const [eligibilityResult, balanceResult] = await Promise.all([
        walletService.checkWithdrawalEligibility(user.accountId),
        walletService.getDetailedBalance(user.accountId),
      ])

      if (eligibilityResult.success) {
        setEligibility({
          canWithdraw: eligibilityResult.canWithdraw,
          reason: eligibilityResult.reason,
          turnoverRemaining: eligibilityResult.turnoverRemaining,
          minimumWithdrawal: eligibilityResult.minimumWithdrawal || 20,
        })
      }

      if (balanceResult.success) {
        setBalanceDetails({
          cashBalance: balanceResult.cashBalance,
          bonusBalance: balanceResult.bonusBalance,
          withdrawableBalance: balanceResult.withdrawableBalance,
        })
      }
    } catch (error) {
      console.error('Error checking eligibility:', error)
    }
    setCheckingEligibility(false)
  }

  if (!isOpen) return null

  const balance = user?.balance || 0
  const withdrawableBalance = balanceDetails.withdrawableBalance || balance
  const minWithdrawal = eligibility.minimumWithdrawal || 20

  const handleQuickAmount = (value) => {
    if (value <= withdrawableBalance) {
      setAmount(value.toString())
    }
  }

  const handleWithdrawAll = () => {
    setAmount(withdrawableBalance.toString())
  }

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount)

    // Validate amount
    if (!withdrawAmount || withdrawAmount < minWithdrawal) {
      showToast(`Minimum withdrawal is $${minWithdrawal}`, 'error')
      return
    }

    if (withdrawAmount > withdrawableBalance) {
      showToast('Insufficient withdrawable balance', 'error')
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

    // Submit withdrawal request
    const result = await walletService.requestWithdrawal({
      accountId: user.accountId,
      amount: withdrawAmount,
      method: 'BANK_TRANSFER',
      bankDetails: {
        bankName: bankDetails.bankName || 'Bank Transfer',
        accountHolderName: bankDetails.accountHolderName,
        accountNumber: bankDetails.accountNumber || undefined,
        bsb: bankDetails.bsb?.replace('-', '') || undefined,
        payId: bankDetails.payId || undefined,
      },
    })

    if (result.success) {
      setWithdrawalResult(result)
      setStep('success')
      showToast(result.message || 'Withdrawal request submitted!', 'success')
      notifyTransactionUpdate() // Refresh transaction history
    } else {
      setStep('amount')
      showToast(result.error || 'Withdrawal request failed', 'error')

      // If turnover not met, refresh eligibility
      if (result.errorCode === 'TURNOVER_NOT_MET') {
        checkEligibility()
      }
    }

    setLoading(false)
  }

  const handleClose = () => {
    setAmount('')
    setStep('amount')
    setBankDetails({ bankName: '', accountHolderName: '', bsb: '', accountNumber: '', payId: '' })
    setUsePayId(false)
    setWithdrawalResult(null)
    onClose()
  }

  // Turnover blocker screen
  if (!checkingEligibility && !eligibility.canWithdraw && step === 'amount') {
    return (
      <div className="withdraw-modal-overlay" onClick={handleClose}>
        <div className="withdraw-modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close-btn" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>

          <div className="withdraw-turnover-blocker">
            <div className="blocker-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2>Withdrawal Locked</h2>
            <p className="blocker-reason">{eligibility.reason || 'Turnover requirement not met'}</p>

            <div className="turnover-info-card">
              <div className="turnover-row">
                <span>Wagering Required</span>
                <span className="turnover-value">${eligibility.turnoverRemaining?.toFixed(2) || '0.00'}</span>
              </div>
              <p className="turnover-help">
                Place bets to fulfill your wagering requirement and unlock withdrawals.
              </p>
            </div>

            <div className="blocker-actions">
              <button className="btn-play-now" onClick={() => { handleClose(); window.location.href = '/slots'; }}>
                Play Now
              </button>
              <button className="btn-close" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="withdraw-modal-overlay" onClick={handleClose}>
      <div className="withdraw-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={handleClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        {checkingEligibility ? (
          <div className="withdraw-processing">
            <div className="processing-spinner">
              <ButtonSpinner />
            </div>
            <h2>Checking Eligibility</h2>
            <p>Please wait...</p>
          </div>
        ) : step === 'success' ? (
          <div className="withdraw-success">
            <div className="success-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h2>Withdrawal Request Submitted!</h2>
            <p className="success-amount" style={{ color: '#f59e0b' }}>-${parseFloat(amount).toFixed(2)}</p>
            <p className="success-balance">Status: {withdrawalResult?.status || 'PENDING_APPROVAL'}</p>

            {withdrawalResult?.withdrawalId && (
              <p className="success-id">
                ID: {withdrawalResult.withdrawalId}
              </p>
            )}

            <p className="success-note">
              {withdrawalResult?.estimatedProcessingTime || 'Your withdrawal will be processed within 1-3 business days once approved.'}
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
              <div className="balance-row">
                <span>Total Balance</span>
                <span className="balance-value">${balance.toFixed(2)}</span>
              </div>
              {balanceDetails.bonusBalance > 0 && (
                <div className="balance-row sub">
                  <span>Bonus Balance</span>
                  <span className="balance-sub">${balanceDetails.bonusBalance.toFixed(2)}</span>
                </div>
              )}
              <div className="balance-row highlight">
                <span>Withdrawable</span>
                <span className="balance-withdrawable">${withdrawableBalance.toFixed(2)}</span>
              </div>
            </div>

            {withdrawableBalance < minWithdrawal && (
              <div className="balance-warning">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                <span>Minimum withdrawal is ${minWithdrawal}. Your withdrawable balance is too low.</span>
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
                  min={minWithdrawal}
                  max={withdrawableBalance}
                />
              </div>
              <div className="quick-amounts">
                {quickAmounts.filter(v => v <= withdrawableBalance).map(val => (
                  <button
                    key={val}
                    className={`quick-amount-btn ${amount === val.toString() ? 'active' : ''}`}
                    onClick={() => handleQuickAmount(val)}
                  >
                    ${val}
                  </button>
                ))}
                <button
                  className={`quick-amount-btn ${amount === withdrawableBalance.toString() ? 'active' : ''}`}
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

              <div className="payment-method-toggle">
                <button
                  type="button"
                  className={`toggle-btn ${!usePayId ? 'active' : ''}`}
                  onClick={() => setUsePayId(false)}
                >
                  BSB + Account
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${usePayId ? 'active' : ''}`}
                  onClick={() => setUsePayId(true)}
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
              disabled={loading || !amount || parseFloat(amount) < minWithdrawal || parseFloat(amount) > withdrawableBalance}
            >
              {loading ? <ButtonSpinner /> : `Withdraw $${parseFloat(amount || 0).toFixed(2)}`}
            </button>

            <p className="withdraw-note">
              Min ${minWithdrawal}, Max $10,000. Processing time: 1-3 business days.
            </p>
          </>
        )}
      </div>

      <style>{`
        .withdraw-turnover-blocker {
          text-align: center;
          padding: 20px;
        }
        .blocker-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: rgba(239, 68, 68, 0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
        }
        .withdraw-turnover-blocker h2 {
          color: #ef4444;
          margin-bottom: 8px;
        }
        .blocker-reason {
          color: rgba(255,255,255,0.7);
          margin-bottom: 20px;
        }
        .turnover-info-card {
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .turnover-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .turnover-row span:first-child {
          color: rgba(255,255,255,0.7);
        }
        .turnover-value {
          color: #fbbf24;
          font-size: 20px;
          font-weight: 700;
        }
        .turnover-help {
          color: rgba(255,255,255,0.5);
          font-size: 12px;
          margin: 0;
        }
        .blocker-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .btn-play-now {
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
          border: none;
          padding: 12px 32px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-play-now:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        }
        .btn-close {
          background: rgba(255,255,255,0.1);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.2);
          padding: 12px 32px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-close:hover {
          background: rgba(255,255,255,0.15);
        }
        .balance-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .balance-row.sub {
          font-size: 13px;
          opacity: 0.7;
        }
        .balance-row.highlight {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .balance-sub {
          color: #fbbf24;
        }
        .balance-withdrawable {
          color: #10b981;
          font-weight: 700;
        }
        .success-id {
          color: rgba(255,255,255,0.5);
          font-size: 12px;
          margin: 8px 0;
        }
        .payment-method-toggle {
          display: flex;
          gap: 10px;
          margin: 10px 0;
        }
        .toggle-btn {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
        }
        .toggle-btn.active {
          background: linear-gradient(135deg, #10b981, #059669);
          border-color: #10b981;
          color: #fff;
        }
        .toggle-btn:hover:not(.active) {
          background: rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  )
}
