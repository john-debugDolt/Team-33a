import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { walletService } from '../../services/walletService'
import { bankService } from '../../services/bankService'
import bonusService from '../../services/bonusService'
import { ButtonSpinner } from '../LoadingSpinner/LoadingSpinner'
import './DepositModal.css'

const quickAmounts = [50, 100, 200, 500, 1000]

export default function DepositModal({ isOpen, onClose }) {
  const { user, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [bankLoading, setBankLoading] = useState(false)
  const [step, setStep] = useState('amount') // 'amount', 'bank-details', 'processing', 'success'
  const [bankDetails, setBankDetails] = useState(null)
  const [depositId, setDepositId] = useState(null)
  const [copied, setCopied] = useState('')

  // Promo code state
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedBonus, setAppliedBonus] = useState(null)
  const [showPromoInput, setShowPromoInput] = useState(false)

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setAmount('')
      setStep('amount')
      setBankDetails(null)
      setDepositId(null)
      setCopied('')
      setPromoCode('')
      setAppliedBonus(null)
      setShowPromoInput(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleQuickAmount = (value) => {
    setAmount(value.toString())
  }

  const handleCopy = async (text, field) => {
    const success = await bankService.copyToClipboard(text)
    if (success) {
      setCopied(field)
      showToast('Copied to clipboard!', 'success')
      setTimeout(() => setCopied(''), 2000)
    }
  }

  const handleProceedToBank = async () => {
    const depositAmount = parseFloat(amount)

    if (!depositAmount || depositAmount < 10) {
      showToast('Minimum deposit is $10', 'error')
      return
    }

    if (depositAmount > 10000) {
      showToast('Maximum deposit is $10,000', 'error')
      return
    }

    // Re-validate promo code minimum deposit if applied
    if (appliedBonus && appliedBonus.minDeposit && depositAmount < appliedBonus.minDeposit) {
      showToast(`Minimum deposit of $${appliedBonus.minDeposit} required for this bonus`, 'error')
      return
    }

    // Initiate deposit to get depositId and assigned bank from API
    setBankLoading(true)
    const result = await walletService.initiateDeposit(
      user?.accountId,
      depositAmount,
      appliedBonus?.bonusCode || null
    )
    setBankLoading(false)

    if (result.success) {
      // Set deposit ID and bank details from API response
      setDepositId(result.depositId)
      setBankDetails({
        bankName: result.bankName,
        accountName: result.accountName,
        bsb: result.bsb,
        accountNumber: result.accountNumber,
        payId: result.payId,
      })
      setStep('bank-details')
    } else {
      showToast(result.error || 'Unable to initiate deposit. Please try again.', 'error')
    }
  }

  const handleConfirmTransfer = async () => {
    setLoading(true)
    setStep('processing')

    try {
      // Deposit already initiated in handleProceedToBank, now verify it
      if (depositId) {
        try {
          await walletService.verifyDeposit(depositId)
        } catch (e) {
          // Verify is optional - deposit is already PENDING
          console.log('Verify step skipped:', e)
        }
      }

      setStep('success')
      showToast('Deposit request submitted! Awaiting admin approval.', 'success')
      notifyTransactionUpdate() // Refresh transaction history
    } catch (error) {
      console.error('Deposit error:', error)
      setStep('bank-details')
      showToast('Something went wrong. Please try again.', 'error')
    }

    setLoading(false)
  }

  const handleClose = () => {
    setAmount('')
    setStep('amount')
    setBankDetails(null)
    setCopied('')
    onClose()
  }

  const handleBack = () => {
    setStep('amount')
    setBankDetails(null)
  }

  // Apply promo code
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      showToast('Please enter a promo code', 'error')
      return
    }

    setPromoLoading(true)
    try {
      const bonus = await bonusService.getBonusByCode(promoCode.trim().toUpperCase())

      if (!bonus) {
        showToast('Invalid promo code', 'error')
        setPromoLoading(false)
        return
      }

      // Check if bonus is available
      if (!bonusService.isBonusAvailable(bonus)) {
        showToast('This promo code is no longer available', 'error')
        setPromoLoading(false)
        return
      }

      // Check minimum deposit requirement
      const depositAmount = parseFloat(amount) || 0
      if (bonus.minDeposit && depositAmount < bonus.minDeposit) {
        showToast(`Minimum deposit of $${bonus.minDeposit} required for this bonus`, 'error')
        setPromoLoading(false)
        return
      }

      setAppliedBonus(bonus)
      showToast('Promo code applied!', 'success')
    } catch (err) {
      showToast('Failed to validate promo code', 'error')
    }
    setPromoLoading(false)
  }

  // Remove applied promo
  const handleRemovePromo = () => {
    setAppliedBonus(null)
    setPromoCode('')
    setShowPromoInput(false)
  }

  // Calculate bonus amount
  const calculateBonusAmount = () => {
    if (!appliedBonus || !amount) return 0
    const depositAmount = parseFloat(amount)

    if (appliedBonus.bonusType === 'PERCENTAGE') {
      const bonusAmt = (depositAmount * appliedBonus.bonusValue) / 100
      // Cap at maxBonusAmount if set
      if (appliedBonus.maxBonusAmount && bonusAmt > appliedBonus.maxBonusAmount) {
        return appliedBonus.maxBonusAmount
      }
      return bonusAmt
    } else if (appliedBonus.bonusType === 'FIXED') {
      return appliedBonus.bonusValue
    }
    return 0
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
            <div className="success-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h2>Deposit Request Submitted!</h2>
            <p className="success-amount" style={{ color: '#f59e0b' }}>+${parseFloat(amount).toFixed(2)}</p>
            <p className="success-balance">Awaiting Admin Approval</p>
            <p className="success-note">
              Your deposit will be credited once our team verifies your transfer.
            </p>
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
        ) : step === 'bank-details' ? (
          <>
            <button className="modal-back-btn" onClick={handleBack}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back
            </button>

            <div className="modal-header">
              <div className="modal-icon bank">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
                </svg>
              </div>
              <h2>Transfer Details</h2>
              <p>Transfer <strong>${parseFloat(amount).toFixed(2)}</strong> to the bank account below</p>
            </div>

            {/* Deposit Reference ID - IMPORTANT */}
            <div className="deposit-reference-card">
              <div className="reference-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <span>Your Deposit Reference</span>
              </div>
              <div className="reference-id-row">
                <span className="reference-id">{depositId || 'Loading...'}</span>
                <button
                  className={`copy-btn ${copied === 'depositId' ? 'copied' : ''}`}
                  onClick={() => handleCopy(depositId, 'depositId')}
                >
                  {copied === 'depositId' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>
              <p className="reference-warning">
                ⚠️ <strong>IMPORTANT:</strong> Use this reference in your bank transfer description/reference field
              </p>
            </div>

            <div className="bank-details-card">
              <div className="bank-name-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 21h18M3 10h18M5 6l7-3 7 3"/>
                </svg>
                <span>{bankDetails?.bankName || 'Bank'}</span>
              </div>

              <div className="bank-detail-row">
                <div className="detail-label">Account Name</div>
                <div className="detail-value-row">
                  <span className="detail-value">{bankDetails?.accountName || '-'}</span>
                  <button
                    className={`copy-btn ${copied === 'accountName' ? 'copied' : ''}`}
                    onClick={() => handleCopy(bankDetails?.accountName, 'accountName')}
                  >
                    {copied === 'accountName' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {bankDetails?.bsb && (
                <div className="bank-detail-row">
                  <div className="detail-label">BSB</div>
                  <div className="detail-value-row">
                    <span className="detail-value">{bankService.formatBSB(bankDetails.bsb)}</span>
                    <button
                      className={`copy-btn ${copied === 'bsb' ? 'copied' : ''}`}
                      onClick={() => handleCopy(bankDetails.bsb.replace('-', ''), 'bsb')}
                    >
                      {copied === 'bsb' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {bankDetails?.accountNumber && (
                <div className="bank-detail-row">
                  <div className="detail-label">Account Number</div>
                  <div className="detail-value-row">
                    <span className="detail-value">{bankDetails.accountNumber}</span>
                    <button
                      className={`copy-btn ${copied === 'accountNumber' ? 'copied' : ''}`}
                      onClick={() => handleCopy(bankDetails.accountNumber, 'accountNumber')}
                    >
                      {copied === 'accountNumber' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {bankDetails?.payId && (
                <div className="bank-detail-row payid">
                  <div className="detail-label">
                    <span className="payid-badge">PayID</span>
                  </div>
                  <div className="detail-value-row">
                    <span className="detail-value">{bankDetails.payId}</span>
                    <button
                      className={`copy-btn ${copied === 'payId' ? 'copied' : ''}`}
                      onClick={() => handleCopy(bankDetails.payId, 'payId')}
                    >
                      {copied === 'payId' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="transfer-amount-display">
                <span>Amount to Transfer</span>
                <span className="amount">${parseFloat(amount).toFixed(2)}</span>
              </div>
            </div>

            <div className="transfer-instructions">
              <div className="instruction-item">
                <span className="instruction-number">1</span>
                <span>Transfer exactly <strong>${parseFloat(amount).toFixed(2)}</strong> to the account above</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-number">2</span>
                <span>Click "I've Made the Transfer" below</span>
              </div>
              <div className="instruction-item">
                <span className="instruction-number">3</span>
                <span>Your deposit will be credited after verification</span>
              </div>
            </div>

            <button
              className="deposit-submit-btn"
              onClick={handleConfirmTransfer}
              disabled={loading}
            >
              {loading ? <ButtonSpinner /> : "I've Made the Transfer"}
            </button>

            <p className="deposit-note">
              Deposits are usually processed within 5-10 minutes during business hours.
            </p>
          </>
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

            {/* Promo Code Section */}
            <div className="promo-section">
              {appliedBonus ? (
                <div className="promo-applied">
                  <div className="promo-applied-info">
                    <div className="promo-badge">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"/>
                      </svg>
                      <span>{appliedBonus.bonusCode}</span>
                    </div>
                    <span className="promo-value">
                      {appliedBonus.bonusType === 'PERCENTAGE'
                        ? `+${appliedBonus.bonusValue}% Bonus`
                        : `+$${appliedBonus.bonusValue} Bonus`}
                    </span>
                  </div>
                  <button className="promo-remove-btn" onClick={handleRemovePromo}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ) : showPromoInput ? (
                <div className="promo-input-row">
                  <input
                    type="text"
                    className="promo-input"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                  />
                  <button
                    className="promo-apply-btn"
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoCode.trim()}
                  >
                    {promoLoading ? <ButtonSpinner /> : 'Apply'}
                  </button>
                  <button
                    className="promo-cancel-btn"
                    onClick={() => { setShowPromoInput(false); setPromoCode(''); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <button className="promo-add-btn" onClick={() => setShowPromoInput(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"/>
                  </svg>
                  <span>Have a promo code?</span>
                </button>
              )}
            </div>

            <div className="deposit-summary">
              <div className="summary-row">
                <span>Deposit Amount</span>
                <span>${parseFloat(amount || 0).toFixed(2)}</span>
              </div>
              {appliedBonus && (
                <div className="summary-row bonus">
                  <span>
                    Bonus ({appliedBonus.bonusType === 'PERCENTAGE'
                      ? `${appliedBonus.bonusValue}%`
                      : `$${appliedBonus.bonusValue}`})
                  </span>
                  <span className="bonus-value">+${calculateBonusAmount().toFixed(2)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Processing Fee</span>
                <span className="free">FREE</span>
              </div>
              <div className="summary-row total">
                <span>Total Credit</span>
                <span>${(parseFloat(amount || 0) + calculateBonusAmount()).toFixed(2)}</span>
              </div>
              {appliedBonus && appliedBonus.turnoverMultiplier > 0 && (
                <div className="summary-row wagering">
                  <span>Wagering Requirement</span>
                  <span>{appliedBonus.turnoverMultiplier}x bonus</span>
                </div>
              )}
            </div>

            <button
              className="deposit-submit-btn"
              onClick={handleProceedToBank}
              disabled={bankLoading || !amount || parseFloat(amount) < 10}
            >
              {bankLoading ? <ButtonSpinner /> : 'Continue'}
            </button>

            <p className="deposit-note">
              Minimum $10, Maximum $10,000. No processing fees.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
