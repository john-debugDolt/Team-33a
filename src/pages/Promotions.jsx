import { useState, useEffect } from 'react'
import { useTranslation } from '../context/TranslationContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import bonusService from '../services/bonusService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import './Promotions.css'

export default function Promotions() {
  const { t } = useTranslation()
  const { user, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [bonuses, setBonuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [claimingBonus, setClaimingBonus] = useState(null)

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

  // Claim bonus directly
  const handleClaimBonus = async (bonus) => {
    // Check if user is logged in
    if (!isAuthenticated || !user?.accountId) {
      showToast('Please log in to claim this bonus', 'error')
      return
    }

    setClaimingBonus(bonus.id)

    try {
      const result = await bonusService.claimBonus(bonus.id, user.accountId)

      if (result.success) {
        showToast(result.message || 'Bonus claimed successfully!', 'success')
        // Refresh bonuses
        await fetchBonuses()
      } else {
        showToast(result.message || 'Failed to claim bonus', 'error')
      }
    } catch (err) {
      showToast(err.message || 'Failed to claim bonus', 'error')
    } finally {
      setClaimingBonus(null)
    }
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
            <div className="bonus-grid">
              {bonuses.map((bonus) => {
                const formatted = formatBonus(bonus)
                const isClaiming = claimingBonus === bonus.id
                const canClaim = bonusService.isBonusAvailable(bonus)

                return (
                  <div
                    key={bonus.id}
                    className={`bonus-box ${canClaim ? 'claimable' : ''} ${isClaiming ? 'claiming' : ''}`}
                    onClick={canClaim && !isClaiming ? () => handleClaimBonus(bonus) : undefined}
                    role={canClaim ? 'button' : undefined}
                    tabIndex={canClaim ? 0 : undefined}
                  >
                    <div className="box-content">
                      {/* Icon */}
                      {isClaiming ? (
                        <div className="box-spinner">
                          <ButtonSpinner />
                        </div>
                      ) : (
                        <div className="gift-icon" style={{ color: formatted.highlight ? '#f59e0b' : 'var(--primary-light)' }}>
                          <span style={{ fontSize: '32px' }}>{formatted.icon}</span>
                        </div>
                      )}

                      {/* Bonus Name */}
                      <span className="bonus-name">{formatted.title}</span>

                      {/* Bonus Value */}
                      <span className="bonus-amount">{formatted.valueDisplay}</span>

                      {/* Description */}
                      {bonus.description && (
                        <span className="bonus-desc">{bonus.description}</span>
                      )}

                      {/* Requirements */}
                      <div className="bonus-reqs">
                        {bonus.minDeposit > 0 && (
                          <span className="req-tag">Min: ${bonus.minDeposit}</span>
                        )}
                        {bonus.turnoverMultiplier > 0 && (
                          <span className="req-tag">{bonus.turnoverMultiplier}x</span>
                        )}
                      </div>

                      {/* Claim hint */}
                      {canClaim && !isClaiming && (
                        <span className="tap-hint">{t('claimNow') || 'Tap to Claim'}</span>
                      )}

                      {/* Limited availability */}
                      {formatted.isLimited && (
                        <span className="limited-tag">{formatted.availabilityDisplay}</span>
                      )}
                    </div>
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
    </div>
  )
}
