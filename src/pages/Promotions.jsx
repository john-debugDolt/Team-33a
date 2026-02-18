import { useState, useEffect } from 'react'
import { useTranslation } from '../context/TranslationContext'
import bonusService from '../services/bonusService'
import './Promotions.css'

export default function Promotions() {
  const { t } = useTranslation()
  const [bonuses, setBonuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBonus, setSelectedBonus] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)

  // Fetch active bonuses on mount
  useEffect(() => {
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

    fetchBonuses()
  }, [])

  // Copy bonus code to clipboard
  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
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
          {loading ? (
            <div className="promo-loading">
              <div className="spinner"></div>
            </div>
          ) : error ? (
            <div className="promo-error">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
              <button
                className="retry-btn"
                onClick={() => window.location.reload()}
              >
                {t('tryAgain') || 'Try Again'}
              </button>
            </div>
          ) : bonuses.length === 0 ? (
            <div className="promo-empty">
              <span className="empty-icon">🎁</span>
              <h3>{t('comingSoon') || 'Coming Soon'}</h3>
              <p>{t('checkBackLater') || 'Check back later for exciting promotions!'}</p>
            </div>
          ) : (
            <div className="promo-grid">
              {bonuses.map((bonus) => {
                const formatted = formatBonus(bonus)
                return (
                  <div
                    key={bonus.id}
                    className="promo-card"
                    onClick={() => setSelectedBonus(bonus)}
                  >
                    {/* Card Image/Background */}
                    <div className="promo-card-image">
                      <div style={{
                        width: '100%',
                        height: '100%',
                        background: formatted.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: '64px' }}>{formatted.icon}</span>
                      </div>
                      <div className="promo-badge">{formatted.typeLabel}</div>
                      <div className="promo-card-overlay">
                        <button className="claim-btn">View Details</button>
                      </div>
                    </div>

                    {/* Card Info */}
                    <div className="promo-card-info">
                      <h3>{formatted.title}</h3>

                      {/* Value Display */}
                      <div className="promo-value">
                        <span className="value-main">{formatted.valueDisplay}</span>
                        {formatted.maxBonus && (
                          <span className="value-max">{formatted.maxBonusDisplay}</span>
                        )}
                      </div>

                      {/* Requirements */}
                      <div className="promo-requirements">
                        <div className="req-item">
                          <span className="req-icon">💵</span>
                          <span>{formatted.minDepositDisplay}</span>
                        </div>
                        <div className="req-item">
                          <span className="req-icon">🔄</span>
                          <span>{formatted.turnoverDisplay}</span>
                        </div>
                      </div>

                      {/* Code or Auto-applied */}
                      {formatted.requiresCode ? (
                        <div className="promo-code-section">
                          <code className="promo-code">{bonus.bonusCode}</code>
                          <button
                            className={`copy-btn ${copiedCode === bonus.bonusCode ? 'copied' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyCode(bonus.bonusCode)
                            }}
                          >
                            {copiedCode === bonus.bonusCode ? '✓' : 'Copy'}
                          </button>
                        </div>
                      ) : (
                        <div className="promo-auto-badge">
                          <span>✨</span> Auto-applied
                        </div>
                      )}

                      {/* Limited availability */}
                      {formatted.isLimited && (
                        <div className="promo-limited">
                          <span className="limited-icon">⏰</span>
                          <span>{formatted.availabilityDisplay}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedBonus && (
        <div className="promo-modal-overlay" onClick={() => setSelectedBonus(null)}>
          <div className="promo-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedBonus(null)}>
              ✕
            </button>

            {(() => {
              const formatted = formatBonus(selectedBonus)
              return (
                <>
                  <div className="modal-header" style={{ background: formatted.gradient }}>
                    <span className="modal-icon">{formatted.icon}</span>
                    <h2>{formatted.title}</h2>
                    <div className="modal-value">{formatted.valueDisplay}</div>
                  </div>

                  <div className="modal-body">
                    {selectedBonus.description && (
                      <p className="modal-description">{selectedBonus.description}</p>
                    )}

                    <div className="modal-details">
                      <div className="detail-row">
                        <span className="detail-label">Bonus Type</span>
                        <span className="detail-value">{formatted.typeLabel}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Minimum Deposit</span>
                        <span className="detail-value">${selectedBonus.minDeposit || 0}</span>
                      </div>
                      {selectedBonus.maxBonusAmount && (
                        <div className="detail-row">
                          <span className="detail-label">Maximum Bonus</span>
                          <span className="detail-value">${selectedBonus.maxBonusAmount}</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="detail-label">Wagering Requirement</span>
                        <span className="detail-value">
                          {selectedBonus.turnoverMultiplier > 0
                            ? `${selectedBonus.turnoverMultiplier}x`
                            : 'None'}
                        </span>
                      </div>
                      {selectedBonus.maxClaims && (
                        <div className="detail-row">
                          <span className="detail-label">Claims Remaining</span>
                          <span className="detail-value">{selectedBonus.remainingClaims || 0}</span>
                        </div>
                      )}
                    </div>

                    {formatted.requiresCode ? (
                      <div className="modal-code-section">
                        <p>Use this code when making a deposit:</p>
                        <div className="modal-code-wrap">
                          <code>{selectedBonus.bonusCode}</code>
                          <button
                            className={`copy-btn ${copiedCode === selectedBonus.bonusCode ? 'copied' : ''}`}
                            onClick={() => handleCopyCode(selectedBonus.bonusCode)}
                          >
                            {copiedCode === selectedBonus.bonusCode ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="modal-auto-section">
                        <span className="auto-icon">✨</span>
                        <p>This bonus is automatically applied when you make an eligible deposit!</p>
                      </div>
                    )}

                    <a href="/wallet" className="modal-cta-btn">
                      Deposit Now
                    </a>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

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
