import { useState, useEffect } from 'react'
import { useTranslation } from '../context/TranslationContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import bonusService from '../services/bonusService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import './Promotions.css'

// Import banner images
import banner1 from '../images/New banner.png'
import banner2 from '../images/New banner 2.png'
import banner3 from '../images/New banner 3.png'

// Cycle through banners for variety
const bannerImages = [banner1, banner2, banner3]

export default function Promotions() {
  const { t } = useTranslation()
  const { user, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [bonuses, setBonuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBonus, setSelectedBonus] = useState(null) // For promo code modal
  const [claimingBonus, setClaimingBonus] = useState(null) // For free bonus claiming

  // Fetch active bonuses on mount
  useEffect(() => {
    fetchBonuses()
  }, [])

  const fetchBonuses = async () => {
    setLoading(true)
    setError(null)
    try {
      const activeBonuses = await bonusService.getActiveBonuses()
      setBonuses(activeBonuses)
    } catch (err) {
      console.error('Error fetching bonuses:', err)
      setError('Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }

  // Handle bonus click - claim free bonus or show promo code modal
  const handleBonusClick = async (bonus) => {
    // Check if user is logged in
    if (!isAuthenticated || !user?.accountId) {
      showToast('Please log in to claim this bonus', 'error')
      return
    }

    // For free bonuses (minDeposit = 0), claim directly via API
    if (bonus.minDeposit === 0 || !bonus.minDeposit) {
      await claimFreeBonus(bonus)
    } else {
      // For deposit-required bonuses, show promo code modal
      setSelectedBonus(bonus)
    }
  }

  // Claim free bonus (minDeposit = 0) via API
  const claimFreeBonus = async (bonus) => {
    setClaimingBonus(bonus.id)

    try {
      const result = await bonusService.claimFreeBonus(user.accountId, bonus.id, bonus.bonusCode)

      if (result.success) {
        showToast(
          `Bonus claimed! $${result.bonusAmount?.toFixed(2) || bonus.bonusValue} credited to your wallet!`,
          'success'
        )
        // Refresh bonuses to update availability
        await fetchBonuses()
      } else {
        showToast(result.error || 'Failed to claim bonus', 'error')
      }
    } catch (err) {
      console.error('Claim bonus error:', err)
      showToast(err.message || 'Failed to claim bonus', 'error')
    } finally {
      setClaimingBonus(null)
    }
  }

  // Copy promo code to clipboard
  const handleCopyCode = async () => {
    if (selectedBonus?.bonusCode) {
      try {
        await navigator.clipboard.writeText(selectedBonus.bonusCode)
        showToast('Promo code copied!', 'success')
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = selectedBonus.bonusCode
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        showToast('Promo code copied!', 'success')
      }
    }
  }

  // Close modal
  const handleCloseModal = () => {
    setSelectedBonus(null)
  }

  // Format the bonus for display
  const formatBonus = (bonus) => bonusService.formatBonusForDisplay(bonus)

  return (
    <div className="promotions-page">
      {/* Hero Section */}
      <div className="promo-hero">
        <div className="promo-hero-bg"></div>

        <div className="promo-content">
          {/* Header */}
          <div className="promo-header">
            <div className="promo-title-section">
              <div className="title-icon promo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                </svg>
              </div>
              <div>
                <h2>{t('promotions') || 'Promotions'}</h2>
                <p className="promo-subtitle">{t('claimBonus') || 'Claim your bonuses'}</p>
              </div>
            </div>
            <button className="refresh-btn" onClick={fetchBonuses} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? 'spinning' : ''}>
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="promo-loading">
              <ButtonSpinner />
              <span>{t('loading') || 'Loading promotions...'}</span>
            </div>
          ) : error ? (
            <div className="promo-error">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
              <button className="retry-btn" onClick={fetchBonuses}>
                {t('tryAgain') || 'Try Again'}
              </button>
            </div>
          ) : bonuses.length === 0 ? (
            <div className="promo-empty">
              <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                </svg>
              </div>
              <h3>{t('comingSoon') || 'Coming Soon'}</h3>
              <p>{t('checkBackLater') || 'Check back later for exciting promotions!'}</p>
            </div>
          ) : (
            <div className="bonus-banners">
              {bonuses.map((bonus, index) => {
                const formatted = formatBonus(bonus)
                const canClaim = bonusService.isBonusAvailable(bonus)
                const isClaiming = claimingBonus === bonus.id
                const isFreeBonus = bonus.minDeposit === 0 || !bonus.minDeposit
                const bannerBg = bannerImages[index % bannerImages.length]

                return (
                  <div
                    key={bonus.id}
                    className={`bonus-banner ${canClaim ? 'claimable' : ''} ${isClaiming ? 'claiming' : ''}`}
                    onClick={canClaim && !isClaiming ? () => handleBonusClick(bonus) : undefined}
                    role={canClaim ? 'button' : undefined}
                    tabIndex={canClaim ? 0 : undefined}
                  >
                    {/* Background Image */}
                    <div className="banner-bg" style={{ backgroundImage: `url(${bannerBg})` }}></div>
                    <div className="banner-overlay"></div>

                    {/* Banner Content */}
                    <div className="banner-content">
                      {/* Left: Main Info */}
                      <div className="banner-main">
                        <div className="banner-value">
                          <span className="value-amount">{formatted.valueDisplay}</span>
                          <span className="value-label">
                            {bonus.bonusType === 'PERCENTAGE' ? 'MATCH BONUS' : 'BONUS'}
                          </span>
                        </div>
                        <h3 className="banner-title">{formatted.title}</h3>
                        {bonus.description && (
                          <p className="banner-desc">{bonus.description}</p>
                        )}
                      </div>

                      {/* Right: Requirements & CTA */}
                      <div className="banner-right">
                        {/* Requirements Tags */}
                        <div className="banner-tags">
                          {bonus.minDeposit > 0 && (
                            <span className="banner-tag deposit">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                              </svg>
                              Min ${bonus.minDeposit}
                            </span>
                          )}
                          {bonus.turnoverMultiplier > 0 && (
                            <span className="banner-tag turnover">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6"/>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                              </svg>
                              {bonus.turnoverMultiplier}x
                            </span>
                          )}
                          {isFreeBonus && (
                            <span className="banner-tag free">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"/>
                              </svg>
                              FREE
                            </span>
                          )}
                        </div>

                        {/* CTA Button */}
                        {canClaim && (
                          <button className={`banner-cta ${isClaiming ? 'loading' : ''}`}>
                            {isClaiming ? (
                              <ButtonSpinner />
                            ) : (
                              <>
                                <span>{isFreeBonus ? 'Claim Now' : 'Get Code'}</span>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                              </>
                            )}
                          </button>
                        )}

                        {/* Limited Badge */}
                        {formatted.isLimited && (
                          <span className="banner-limited">{formatted.availabilityDisplay}</span>
                        )}
                      </div>
                    </div>

                    {/* Shine Effect */}
                    <div className="banner-shine"></div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Marquee */}
      <div className="marquee">
        <span className="marquee-icon">📢</span>
        <div className="marquee-text">
          <span>Telegram: @Team33 | {t('contactUs') || 'Contact us for exclusive VIP bonuses!'}</span>
        </div>
      </div>

      {/* Promo Code Modal */}
      {selectedBonus && (
        <div className="promo-modal-overlay" onClick={handleCloseModal}>
          <div className="promo-modal" onClick={(e) => e.stopPropagation()}>
            <button className="promo-modal-close" onClick={handleCloseModal}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>

            <div className="promo-modal-icon">🎁</div>
            <h3 className="promo-modal-title">{selectedBonus.displayName || selectedBonus.name}</h3>

            <div className="promo-modal-value">
              {formatBonus(selectedBonus).valueDisplay}
            </div>

            {selectedBonus.description && (
              <p className="promo-modal-desc">{selectedBonus.description}</p>
            )}

            {/* Promo Code Display */}
            <div className="promo-code-section">
              <label>{t('promoCode') || 'Your Promo Code'}</label>
              <div className="promo-code-box">
                <span className="promo-code-text">{selectedBonus.bonusCode}</span>
                <button className="copy-btn" onClick={handleCopyCode}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  {t('copy') || 'Copy'}
                </button>
              </div>
            </div>

            {/* Requirements */}
            <div className="promo-modal-reqs">
              {selectedBonus.minDeposit > 0 && (
                <div className="req-item">
                  <span className="req-label">{t('minDeposit') || 'Min Deposit'}</span>
                  <span className="req-value">${selectedBonus.minDeposit}</span>
                </div>
              )}
              {selectedBonus.turnoverMultiplier > 0 && (
                <div className="req-item">
                  <span className="req-label">{t('turnover') || 'Turnover'}</span>
                  <span className="req-value">{selectedBonus.turnoverMultiplier}x</span>
                </div>
              )}
            </div>

            {/* Minimum Deposit Highlight */}
            {selectedBonus.minDeposit > 0 && (
              <div className="promo-modal-min-deposit">
                <span className="min-deposit-label">{t('minimumDepositRequired') || 'Minimum Deposit Required'}</span>
                <span className="min-deposit-value">${selectedBonus.minDeposit}</span>
              </div>
            )}

            {/* Instructions */}
            <div className="promo-modal-instructions">
              <p>
                {selectedBonus.minDeposit > 0
                  ? t('useCodeDuringDeposit') || 'Use this code when making a deposit to claim your bonus!'
                  : t('useCodeToRedeem') || 'Copy this code and use it to redeem your bonus!'}
              </p>
            </div>

            <button className="promo-modal-cta" onClick={handleCopyCode}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {t('copyCode') || 'Copy Code'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
