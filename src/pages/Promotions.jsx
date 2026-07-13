import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '../context/TranslationContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import bonusService from '../services/bonusService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import './Promotions.css'

import treasureGif from '../images/buried-treasure.gif'

// Per-bonus key art — the JPEGs are sips-shrunk from the original
// multi-megabyte PNGs (kept .gitignored). Match below is done by bonus
// title / amount.
import bonusDaily5 from '../images/bonus-daily-5.jpg'
import bonusWelcome50 from '../images/bonus-welcome-50.jpg'
import bonusWelcome28 from '../images/bonus-welcome-28.jpg'
import bonusWeeklyRebate5 from '../images/bonus-weeklyrebate-5.jpg'
import bonusWeeklyRebate10 from '../images/bonus-weeklyrebate-10.jpg'
import bonusWeekly20 from '../images/bonus-weekly-20.jpg'
import bonusWeekly50 from '../images/bonus-weekly-50.jpg'
import bonusWeekly80 from '../images/bonus-weekly-80.jpg'

// Returns dedicated key art for a bonus, or null when none of our local
// imports match. Callers use the null return to filter unsupported
// bonuses out of the catalog entirely — we do not show generic-banner
// fallbacks.
const pickBonusArt = (bonus) => {
  if (!bonus) return null
  const hay = `${bonus.displayName || ''} ${bonus.bonusCode || ''}`.toLowerCase()
  const value = Math.round(Number(bonus.bonusValue) || 0)
  const has = (s) => hay.includes(s)
  if (has('daily') && value === 5) return bonusDaily5
  if (has('welcome') && value === 50) return bonusWelcome50
  if (has('welcome') && value === 28) return bonusWelcome28
  if (has('rebate') && value === 5) return bonusWeeklyRebate5
  if (has('rebate') && value === 10) return bonusWeeklyRebate10
  // Weekly Rebate $80 — no dedicated rebate art; the weekly-bonus 80
  // frame is the closest stylistic match.
  if (has('rebate') && value === 80) return bonusWeekly80
  if (has('weekly') && value === 20) return bonusWeekly20
  if (has('weekly') && value === 50) return bonusWeekly50
  if (has('weekly') && value === 80) return bonusWeekly80
  // Catch-alls by value alone — covers bonuses whose title doesn't carry
  // a cadence keyword (e.g. "New Register Free" $28 reuses the welcome
  // 28 art).
  if (value === 28) return bonusWelcome28
  if (value === 20) return bonusWeekly20
  if (value === 50) return bonusWeekly50
  if (value === 80) return bonusWeekly80
  return null
}

// Daily check-in stripe backed by the regular /api/bonuses catalogue.
//
// The original /api/checkin-bonus endpoints were replaced with per-day
// bonus rows (DAILY_STREAK_DAY1..7, IDs 74-80) in the standard bonuses
// table. Each row carries streakDay + streakGroup and is claimed via
// POST /api/bonuses/claim like any other bonus — there is no automatic
// day-progression on the server, so we compute "which day is next" from
// the player's /my-claims history.
//
// Streak break detection lives server-side. For UI purposes we treat
// the number of non-EXPIRED streak claims as the current day count.
function CheckinStripe({ accountId, isAuthenticated, myClaims, onUnauthClaim, showToast }) {
  const [streakBonuses, setStreakBonuses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const all = await bonusService.getAvailableBonuses()
      if (cancelled) return
      const streak = all
        .filter((b) => b.streakGroup === 'DAILY_SLOT_STREAK' && b.streakDay)
        .sort((a, b) => a.streakDay - b.streakDay)
      setStreakBonuses(streak)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Hide the stripe entirely until we know whether streak bonuses exist.
  if (loading || streakBonuses.length === 0) return null

  const days = streakBonuses.length
  const streakIds = new Set(streakBonuses.map((b) => b.id))
  const activeStreakClaims = (myClaims || []).filter(
    (c) => streakIds.has(c.bonusId) && String(c.status || '').toUpperCase() !== 'EXPIRED'
  )
  // Cap at the campaign length so the "next day" pointer doesn't fall
  // off the end after a follow-on cycle credits more than 7 claims.
  const daysClaimed = Math.min(activeStreakClaims.length, days)
  const nextDay = daysClaimed >= days ? null : daysClaimed + 1
  const isComplete = nextDay == null

  // "Claimed today" — any streak claim whose creditedAt (UTC day) matches
  // today. Prevents double-claim button flicker between poll windows.
  const todayKey = new Date().toISOString().slice(0, 10)
  const claimedToday = activeStreakClaims.some(
    (c) => String(c.creditedAt || c.createdAt || '').slice(0, 10) === todayKey
  )

  const handleClaim = async () => {
    if (!isAuthenticated || !accountId) {
      onUnauthClaim?.()
      return
    }
    if (claimedToday || isComplete) return
    const target = streakBonuses[nextDay - 1]
    if (!target?.bonusCode) return
    // These bonuses require a deposit — give the player the code to enter
    // at the deposit screen rather than calling /claim directly.
    try {
      await navigator.clipboard.writeText(target.bonusCode)
    } catch {
      const el = document.createElement('textarea')
      el.value = target.bonusCode
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    showToast?.(
      `Code copied: ${target.bonusCode} — enter it when making your deposit to activate Day ${nextDay}`,
      'success'
    )
  }

  const nextTarget = !isComplete ? streakBonuses[nextDay - 1] : null
  const minDeposit = Number(nextTarget?.minDeposit) || 0
  const subline = isComplete
    ? "You've completed all 7 days — well done!"
    : minDeposit > 0
      ? `Deposit $${minDeposit.toFixed(0)}+ to unlock your Day ${nextDay} bonus`
      : `Claim your Day ${nextDay} bonus`

  return (
    <div className="checkin-stripe">
      <div className="checkin-header">
        <h3 className="checkin-title">
          <span className="checkin-icon">🎁</span>
          {days}-Day Daily Check-In Bonus
        </h3>
        <span className="checkin-sub">{subline}</span>
      </div>
      <div className="checkin-cards">
        {streakBonuses.map((b, idx) => {
          const day = idx + 1
          const isPast = day <= daysClaimed
          const isToday = !isComplete && day === nextDay
          const isFuture = !isPast && !isToday
          const isClaimable = isToday && !claimedToday
          const pct = Math.round(Number(b.bonusValue) || 0)
          let ctaLabel
          if (isPast) ctaLabel = 'Claimed'
          else if (isToday) ctaLabel = claimedToday ? 'Done today' : 'Get Code'
          else ctaLabel = 'Locked'
          return (
            <button
              key={b.id}
              type="button"
              className={`checkin-card ${isToday ? 'today' : ''} ${isPast ? 'claimed' : ''} ${isFuture ? 'future' : ''} ${isClaimable ? 'claimable' : ''}`}
              onClick={isClaimable ? handleClaim : undefined}
              disabled={!isClaimable}
              aria-label={`Day ${day} ${pct}% bonus`}
            >
              <div className="checkin-card-media">
                <img src={treasureGif} alt={`Day ${day} reward`} decoding="async" />
                {isPast && <span className="checkin-check">✓</span>}
              </div>
              <div className="checkin-card-body">
                <span className="checkin-day-label">Day {day}</span>
                <span className="checkin-amount">{pct}%</span>
                <span className="checkin-cta">{ctaLabel}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Promotions() {
  const { t } = useTranslation()
  const { user, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [bonuses, setBonuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBonus, setSelectedBonus] = useState(null) // For promo code modal
  const [claimingBonus, setClaimingBonus] = useState(null) // For free bonus claiming
  const [rollover, setRollover] = useState(null)
  const [myClaims, setMyClaims] = useState([])

  // Fetch active bonuses on mount
  useEffect(() => {
    fetchBonuses()
  }, [])

  // Per-account data: claim history drives BOTH the claim list and the
  // rollover snapshot. The dedicated /api/bonus-wallet/{id}/rollover
  // endpoint is currently unreliable, so we aggregate the per-claim
  // turnoverRequired / rolloverCompleted figures returned by /my-claims.
  useEffect(() => {
    let cancelled = false
    const accountId = user?.accountId
    if (!accountId) {
      setRollover(null)
      setMyClaims([])
      return
    }
    bonusService.getMyClaims(accountId).then((claims) => {
      if (cancelled) return
      setMyClaims(claims)
      setRollover(bonusService.deriveRolloverFromClaims(claims))
    }).catch(() => { /* service already swallows errors */ })
    return () => { cancelled = true }
  }, [user?.accountId])

  const fetchBonuses = async () => {
    setLoading(true)
    setError(null)
    try {
      const activeBonuses = await bonusService.getAvailableBonuses()
      // Drop any bonus we don't have dedicated key art for — generic
      // fallback banners looked off-brand, so we just hide them.
      const withArt = activeBonuses.filter((b) => pickBonusArt(b) !== null)
      setBonuses(withArt)
    } catch (err) {
      console.error('Error fetching bonuses:', err)
      setError('Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }

  const refreshRolloverAndClaims = async () => {
    const accountId = user?.accountId
    if (!accountId) return
    const c = await bonusService.getMyClaims(accountId)
    setMyClaims(c)
    setRollover(bonusService.deriveRolloverFromClaims(c))
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
        // Pull fresh catalog (availability may have changed) and the per-
        // account rollover snapshot + claim history that drive the new
        // RolloverCard + MyClaimsList sections.
        await Promise.all([fetchBonuses(), refreshRolloverAndClaims()])
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
            myClaims={myClaims}
            showToast={showToast}
            onUnauthClaim={() => showToast('Please log in to claim your daily bonus', 'warning')}
          />

          <RolloverCard rollover={rollover} />

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
            (() => {
              // Bucket the active bonuses into Daily / Weekly / Special.
              // We search displayName + bonusCode + description (case-
              // insensitive) for cadence keywords; anything that doesn't
              // match Daily or Weekly falls into Special so nothing is
              // dropped on the floor.
              const hay = (b) => `${b.displayName || ''} ${b.bonusCode || ''} ${b.description || ''}`.toLowerCase()
              const isDaily = (b) => /(daily|day\b|24\s*hour)/i.test(hay(b))
              const isWeekly = (b) => /(weekly|week\b|7\s*day)/i.test(hay(b))
              const daily = bonuses.filter(isDaily)
              const weekly = bonuses.filter((b) => !isDaily(b) && isWeekly(b))
              const usedIds = new Set([...daily, ...weekly].map((b) => b.id))
              const special = bonuses.filter((b) => !usedIds.has(b.id))
              return (
                <>
                  <BonusSection title="Daily Bonus" icon="🌅" bonuses={daily} onClick={handleBonusClick} formatBonus={formatBonus} claimingBonus={claimingBonus} />
                  <BonusSection title="Weekly Bonus" icon="📅" bonuses={weekly} onClick={handleBonusClick} formatBonus={formatBonus} claimingBonus={claimingBonus} />
                  <BonusSection title="Special Bonus" icon="✨" bonuses={special} onClick={handleBonusClick} formatBonus={formatBonus} claimingBonus={claimingBonus} />
                </>
              )
            })()
          )}

          <MyClaimsList claims={myClaims} bonuses={bonuses} />
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

// Decimal-string-safe to-Number. The bonus/rollover API serves DECIMAL(19,4)
// as strings — Number() is fine for *display* but we never use this for math.
const dec = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmtMoney = (v) => {
  const n = dec(v)
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtDate = (s) => {
  if (!s) return ''
  try {
    const d = new Date(s)
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '' }
}

// Rollover progress card — fed by bonusService.deriveRolloverFromClaims,
// which aggregates per-claim turnoverRequired / rolloverCompleted from
// /api/bonuses/my-claims. Hidden when there are no active CREDITED
// claims (derive returns null in that case).
function RolloverCard({ rollover }) {
  if (!rollover) return null
  const balance = dec(rollover.balance)
  const original = dec(rollover.originalBonusCredited)
  const denom = dec(rollover.rolloverDenominator)
  // Hide on empty round.
  if (balance === 0 && original === 0) return null

  const completed = dec(rollover.rolloverCompleted)
  // Cap visual progress at 100% even though the server permits >1.
  const pct = Math.max(0, Math.min(100, completed * 100))

  const isAdminTopUp = original === 0 && balance > 0
  const subline = isAdminTopUp
    ? 'Manual credit — no rollover round attached'
    : `Bet ${fmtMoney(denom)} total to unlock conversion`

  return (
    <div className="rollover-card">
      <div className="rollover-card-head">
        <div>
          <h3 className="rollover-card-title">
            <span className="rollover-card-icon" aria-hidden="true">🎯</span>
            Bonus Rollover
          </h3>
          <p className="rollover-card-sub">{subline}</p>
        </div>
        <div className="rollover-card-pct" aria-label={`Rollover ${pct.toFixed(1)} percent complete`}>
          {pct.toFixed(0)}%
        </div>
      </div>
      <div className="rollover-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct.toFixed(0)}>
        <div className="rollover-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="rollover-card-stats">
        <div className="rollover-stat">
          <span className="rollover-stat-label">Bonus pool</span>
          <span className="rollover-stat-value">{fmtMoney(balance)}</span>
        </div>
        <div className="rollover-stat">
          <span className="rollover-stat-label">Original credit</span>
          <span className="rollover-stat-value">{fmtMoney(original)}</span>
        </div>
        <div className="rollover-stat">
          <span className="rollover-stat-label">Wagering target</span>
          <span className="rollover-stat-value">{fmtMoney(denom)}</span>
        </div>
      </div>
    </div>
  )
}

// Claim history — GET /api/bonuses/my-claims/{accountId}. We cross-reference
// the active catalog to show a display name when available; older claims
// for retired bonuses fall back to "Bonus #ID".
function MyClaimsList({ claims, bonuses }) {
  const [expanded, setExpanded] = useState(false)
  const nameLookup = useMemo(() => {
    const map = new Map()
    for (const b of bonuses || []) map.set(b.id, b.displayName || b.bonusCode)
    return map
  }, [bonuses])
  if (!claims || claims.length === 0) return null

  const visible = expanded ? claims : claims.slice(0, 5)

  return (
    <div className="my-claims-section">
      <h3 className="my-claims-title">
        <span className="my-claims-icon" aria-hidden="true">🧾</span>
        My Claims
        <span className="my-claims-count">{claims.length}</span>
      </h3>
      <ul className="my-claims-list">
        {visible.map((c) => {
          const name = nameLookup.get(c.bonusId) || `Bonus #${c.bonusId}`
          const status = (c.status || 'PENDING').toUpperCase()
          return (
            <li key={c.id} className="my-claim-row">
              <div className="my-claim-main">
                <span className="my-claim-name">{name}</span>
                <span className="my-claim-date">{fmtDate(c.creditedAt || c.createdAt)}</span>
              </div>
              <div className="my-claim-meta">
                <span className="my-claim-amount">{fmtMoney(c.bonusAmount)}</span>
                <span className={`my-claim-status status-${status.toLowerCase()}`}>{status}</span>
              </div>
            </li>
          )
        })}
      </ul>
      {claims.length > 5 && (
        <button
          type="button"
          className="my-claims-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show fewer' : `Show all ${claims.length}`}
        </button>
      )}
    </div>
  )
}

// One labelled section (Daily / Weekly / Special) of the bonus grid.
// Renders nothing when its bucket is empty so the page stays tight.
function BonusSection({ title, icon, bonuses, onClick, formatBonus, claimingBonus }) {
  if (!bonuses || bonuses.length === 0) return null
  return (
    <div className="bonus-section">
      <h3 className="bonus-section-title">
        <span className="bonus-section-icon" aria-hidden="true">{icon}</span>
        {title}
        <span className="bonus-section-count">{bonuses.length}</span>
      </h3>
      <div className="bonus-tiles">
        {bonuses.map((bonus) => {
          const formatted = formatBonus(bonus)
          const available = bonusService.isBonusAvailable(bonus)
          const cardTitle = bonus.displayName || bonus.bonusCode || 'BONUS'
          // Non-null — bonuses without dedicated art are filtered out
          // in fetchBonuses before they reach this loop.
          const tileBg = pickBonusArt(bonus)
          const isClaiming = claimingBonus === bonus.id
          return (
            <button
              key={bonus.id}
              type="button"
              className={`bonus-tile ${available ? '' : 'tile-disabled'} ${isClaiming ? 'tile-claiming' : ''}`}
              onClick={() => onClick(bonus)}
              aria-label={`${cardTitle} — ${formatted.valueDisplay}`}
              style={{ '--tile-bg': `url(${tileBg})` }}
            >
              <span className="bonus-tile-bg" aria-hidden="true"></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Bonus detail popup — the structured row table was dropped because the
// derived values (winover, claim limit, weekly deposit) weren't always
// accurate against the live catalog. The authoritative T&C ships in
// bonus.description as a curated multi-line string with unicode arrows
// (➤ ⚠ ✓ ✘) and newlines; we render it verbatim and point the player
// at it.
function BonusDetailPopup({ bonus, formatted, available, claiming, onClose, onClaim }) {
  const title = (bonus.displayName || bonus.bonusCode || 'BONUS').toUpperCase()
  const isFree = !dec(bonus.minDeposit)
  const telegramUrl = null       // not in API today
  const generalTos = (bonus.description || '').trim()

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

        <p className="bonus-popup-readbelow">
          Please read the full terms &amp; conditions below for accurate
          requirements, claim limits, winover, and withdrawal rules.
        </p>

        {generalTos && (
          <pre className="bonus-popup-tos">{generalTos}</pre>
        )}

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
