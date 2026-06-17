import { useState, useEffect } from 'react'
import { useTranslation } from '../context/TranslationContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import bonusService from '../services/bonusService'
import { getActiveCheckinBonus, claimCheckinBonus } from '../services/checkinBonusService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import './Promotions.css'

// Import banner images
import banner1 from '../images/New banner.png'
import banner2 from '../images/New banner 2.png'
import banner3 from '../images/New banner 3.png'
import treasureGif from '../images/buried-treasure.gif'

// Backend-driven daily check-in stripe.
//
// Reads /api/checkin-bonus?accountId=… to learn the campaign shape (days,
// dailyAmount, displayName) and this player's progress (daysClaimed,
// nextDayIndex, claimedToday). Claim hits POST /api/checkin-bonus/claim
// which credits the player's bonus_wallet server-side.
//
// 404 from the GET means no active campaign — the stripe stays hidden.
function CheckinStripe({ accountId, isAuthenticated, onClaimSuccess, onUnauthClaim, showToast }) {
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)

  const refresh = async () => {
    const result = await getActiveCheckinBonus(accountId)
    setLoading(false)
    if (result.status === 'ok') setCampaign(result.data)
    else setCampaign(null)
  }

  useEffect(() => {
    refresh()
    // We re-fetch when the active account changes so the per-player progress
    // updates if the user logs in/out without leaving the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])

  // No active campaign or still loading the first time — render nothing.
  if (loading || !campaign) return null

  const days = campaign.days || 0
  const dailyAmount = Number(campaign.dailyAmount) || 0
  const daysClaimed = campaign.daysClaimed ?? 0
  const nextDayIndex = campaign.nextDayIndex // null when campaign complete
  const claimedToday = !!campaign.claimedToday
  const isComplete = nextDayIndex == null

  const handleClaim = async () => {
    if (!isAuthenticated || !accountId) {
      onUnauthClaim?.()
      return
    }
    if (claiming || claimedToday || isComplete) return
    setClaiming(true)
    const result = await claimCheckinBonus(accountId)
    setClaiming(false)

    if (result.status === 'ok') {
      const credited = Number(result.data?.amount) || dailyAmount
      showToast?.(`Day ${result.data?.dayIndex} reward: $${credited.toFixed(2)} credited to your bonus wallet`, 'success')
      onClaimSuccess?.()
      refresh()
    } else if (result.status === 'already' || result.status === 'complete') {
      showToast?.(result.message, 'warning')
      refresh()
    } else if (result.status === 'none') {
      showToast?.(result.message || 'Daily check-in is not currently available.', 'warning')
      setCampaign(null)
    } else {
      showToast?.(result.message || "Couldn't claim — please try again.", 'error')
    }
  }

  return (
    <div className="checkin-stripe">
      <div className="checkin-header">
        <h3 className="checkin-title">
          <span className="checkin-icon">🎁</span>
          {campaign.displayName || `${days}-Day Check-in Bonus`}
        </h3>
        <span className="checkin-sub">
          {campaign.description || `Claim $${dailyAmount.toFixed(2)} every day for ${days} days`}
        </span>
      </div>
      <div className="checkin-cards">
        {Array.from({ length: days }).map((_, idx) => {
          const day = idx + 1
          const isPast = day <= daysClaimed
          const isToday = !isComplete && day === nextDayIndex
          const isFuture = !isPast && !isToday
          const isClaimable = isToday && !claimedToday && !claiming
          let ctaLabel
          if (isPast) ctaLabel = 'Claimed'
          else if (isToday) ctaLabel = claiming ? 'Claiming…' : (claimedToday ? 'Done today' : 'Claim')
          else ctaLabel = 'Locked'
          return (
            <button
              key={day}
              type="button"
              className={`checkin-card ${isToday ? 'today' : ''} ${isPast ? 'claimed' : ''} ${isFuture ? 'future' : ''} ${isClaimable ? 'claimable' : ''}`}
              onClick={isClaimable ? handleClaim : undefined}
              disabled={!isClaimable}
              aria-label={`Day ${day} reward`}
            >
              <div className="checkin-card-media">
                <img src={treasureGif} alt={`Day ${day} reward`} decoding="async" />
                {isPast && <span className="checkin-check">✓</span>}
              </div>
              <div className="checkin-card-body">
                <span className="checkin-day-label">Day {day}</span>
                <span className="checkin-amount">${dailyAmount.toFixed(0)}</span>
                <span className="checkin-cta">{ctaLabel}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

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

  // Every tile click opens the detail popup — the popup itself handles
  // "Claim Now" (free) and "Copy Code" (deposit-required) paths.
  const handleBonusClick = (bonus) => {
    setSelectedBonus(bonus)
  }

  const handleClaimFromPopup = async () => {
    if (!selectedBonus) return
    if (!isAuthenticated || !user?.accountId) {
      showToast('Please log in to claim this bonus', 'error')
      return
    }
    const isFree = !selectedBonus.minDeposit
    if (isFree) {
      await claimFreeBonus(selectedBonus)
      setSelectedBonus(null)
    } else {
      await handleCopyCode()
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

          <CheckinStripe
            accountId={user?.accountId}
            isAuthenticated={isAuthenticated}
            showToast={showToast}
            onUnauthClaim={() => showToast('Please log in to claim your daily bonus', 'warning')}
            onClaimSuccess={() => {
              // Refresh wallet popups / bonus-wallet listeners by nudging the
              // localStorage mirror that bonusWalletService writes to.
              try {
                window.dispatchEvent(new StorageEvent('storage', { key: 'team33_bonus_balance' }))
              } catch { /* ignore */ }
            }}
          />

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
            <div className="bonus-tiles">
              {bonuses.map((bonus) => {
                const formatted = formatBonus(bonus)
                const available = bonusService.isBonusAvailable(bonus)
                const title = bonus.displayName || bonus.bonusCode || 'BONUS'
                return (
                  <button
                    key={bonus.id}
                    type="button"
                    className={`bonus-tile ${available ? '' : 'tile-disabled'}`}
                    onClick={() => handleBonusClick(bonus)}
                    aria-label={`${title} — ${formatted.valueDisplay}`}
                  >
                    <span className="bonus-tile-title">{title}</span>
                    <span className="bonus-tile-amount">{formatted.valueDisplay}</span>
                    {formatted.isLimited && (
                      <span className="bonus-tile-badge">{formatted.availabilityDisplay}</span>
                    )}
                  </button>
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

      {/* Bonus Detail Popup */}
      {selectedBonus && (
        <BonusDetailPopup
          bonus={selectedBonus}
          formatted={formatBonus(selectedBonus)}
          available={bonusService.isBonusAvailable(selectedBonus)}
          claiming={claimingBonus === selectedBonus.id}
          onClose={handleCloseModal}
          onClaim={handleClaimFromPopup}
        />
      )}
    </div>
  )
}

// Bonus detail popup — mirrors the structure of the legacy template the
// player team supplied. Every row that depends on a backend-supplied
// string is hidden when the field is missing, so older bonus records
// still render cleanly while we backfill data.
function BonusDetailPopup({ bonus, formatted, available, claiming, onClose, onClaim }) {
  const title = (bonus.displayName || bonus.bonusCode || 'BONUS').toUpperCase()
  const isFree = !bonus.minDeposit
  const requirementsLabel = isFree ? 'NO' : `MIN $${bonus.minDeposit}`
  const claimLimitLabel = bonus.claimFrequencyText
    || (bonus.maxClaims ? `${bonus.maxClaims} TOTAL` : null)
  const winoverLabel = bonus.winoverTargetText
    || (bonus.turnoverMultiplier > 0 ? `${bonus.turnoverMultiplier}x TURNOVER` : null)
  const maxWithdrawalLabel = bonus.maxWithdrawalText
    || (bonus.maxWithdrawal ? `$${bonus.maxWithdrawal}` : null)
  const validForLabel = bonus.validForText || null
  const notAllowedLabel = bonus.notAllowedText || null
  const telegramUrl = bonus.telegramUrl || null
  const rules = [bonus.belowRedepositText, bonus.aboveWithdrawText, bonus.infoIncorrectText].filter(Boolean)
  const generalTos = bonus.generalTermsText
    || 'Terms & Conditions apply. If any illegal betting, suspicious behavior, bonus abuse, side betting, or saving free games to play later is detected, your deposit, including any winnings and bonuses, may be frozen. The system may also reset your account balance to zero. Team33 reserves the right to void any withdrawal eligibility, suspend account privileges, and take any necessary actions including reversal of bonuses and winnings.'

  return (
    <div className="bonus-popup-overlay" onClick={onClose}>
      <div className="bonus-popup" onClick={(e) => e.stopPropagation()}>
        <button className="bonus-popup-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <div className="bonus-popup-title">⭐ {title}</div>

        <p className="bonus-popup-section-label"><b>Requirements:</b></p>

        {telegramUrl && (
          <a className="bonus-popup-telegram" href={telegramUrl} target="_blank" rel="noopener noreferrer">
            Join Telegram Game Tips
          </a>
        )}

        <table className="bonus-popup-table">
          <tbody>
            <tr>
              <td className="bp-key">{title}</td>
              <td className="bp-val">{formatted.valueDisplay}</td>
            </tr>
            <tr>
              <td className="bp-key">REQUIREMENTS</td>
              <td className="bp-val">{requirementsLabel}</td>
            </tr>
            {claimLimitLabel && (
              <tr>
                <td className="bp-key">CLAIM LIMIT</td>
                <td className="bp-val">{claimLimitLabel}</td>
              </tr>
            )}
            {winoverLabel && (
              <tr>
                <td className="bp-key">WINOVER</td>
                <td className="bp-val">{winoverLabel}</td>
              </tr>
            )}
            {maxWithdrawalLabel && (
              <tr>
                <td className="bp-key">MAX WITHDRAWAL</td>
                <td className="bp-val">{maxWithdrawalLabel}</td>
              </tr>
            )}
            {validForLabel && (
              <tr>
                <td className="bp-key">VALID FOR</td>
                <td className="bp-val">{validForLabel}</td>
              </tr>
            )}
            {notAllowedLabel && (
              <tr>
                <td className="bp-key">NOT ALLOWED</td>
                <td className="bp-val bp-warn">{notAllowedLabel}</td>
              </tr>
            )}
          </tbody>
        </table>

        {rules.length > 0 && (
          <table className="bonus-popup-rules">
            <tbody>
              {rules.map((r, i) => (
                <tr key={i}><td>{r}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="bonus-popup-tos">
          <span className="bp-tos-label">General</span>
          <span className="bp-tos-alert" aria-hidden="true">⚠️</span>
          <span>{generalTos}</span>
        </p>

        <div className="bonus-popup-btns">
          <button className="bp-btn bp-btn-danger" onClick={onClose}>Close</button>
          {available && (
            <button
              className="bp-btn bp-btn-claim"
              onClick={onClaim}
              disabled={claiming}
            >
              {claiming ? 'Claiming…' : (isFree ? 'Claim Now' : 'Get Code')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
