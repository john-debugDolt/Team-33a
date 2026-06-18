import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '../context/TranslationContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import bonusService from '../services/bonusService'
import { getRolloverProgress } from '../services/bonusWalletService'
import { getActiveCheckinBonus, claimCheckinBonus } from '../services/checkinBonusService'
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner'
import './Promotions.css'

// Import banner images
import banner1 from '../images/New banner.png'
import banner2 from '../images/New banner 2.png'
import banner3 from '../images/New banner 3.png'
import treasureGif from '../images/buried-treasure.gif'
// Generic team33 game banners — fallback tile background when a bonus
// doesn't match any of the dedicated art below.
import tileBg1 from '../images/promo-tile-bg-1.jpg'
import tileBg2 from '../images/promo-tile-bg-2.jpg'
import tileBg3 from '../images/promo-tile-bg-3.jpg'
const TILE_BACKGROUNDS = [tileBg1, tileBg2, tileBg3]

// Per-bonus key art — the JPEGs are sips-shrunk from the original
// multi-megabyte PNGs (kept .gitignored). Match below is done by bonus
// title / amount, with a fallback to the cycled generic banners.
import bonusDaily5 from '../images/bonus-daily-5.jpg'
import bonusWelcome50 from '../images/bonus-welcome-50.jpg'
import bonusWelcome28 from '../images/bonus-welcome-28.jpg'
import bonusWeeklyRebate5 from '../images/bonus-weeklyrebate-5.jpg'
import bonusWeeklyRebate10 from '../images/bonus-weeklyrebate-10.jpg'
import bonusWeekly20 from '../images/bonus-weekly-20.jpg'
import bonusWeekly50 from '../images/bonus-weekly-50.jpg'
import bonusWeekly80 from '../images/bonus-weekly-80.jpg'

// Pick the dedicated art for this bonus or fall back to the generic
// banner pool. We look for cadence keywords (weekly rebate / daily /
// welcome) and the integer amount in the bonus value.
const pickBonusArt = (bonus, fallback) => {
  if (!bonus) return fallback
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
  return fallback
}

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
    // Backend returns 404 when accountId is omitted (verified 2026-06-18),
    // which collapsed the stripe for logged-out players. Skip the call in
    // that case so the loading flag clears and the stripe stays hidden
    // without a noisy 404 in the console.
    if (!accountId) {
      setCampaign(null)
      setLoading(false)
      return
    }
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
  const [rollover, setRollover] = useState(null)
  const [myClaims, setMyClaims] = useState([])

  // Fetch active bonuses on mount
  useEffect(() => {
    fetchBonuses()
  }, [])

  // Per-account data: rollover snapshot + claim history. Re-fetches when the
  // active account changes (log-in / log-out without leaving the page).
  useEffect(() => {
    let cancelled = false
    const accountId = user?.accountId
    if (!accountId) {
      setRollover(null)
      setMyClaims([])
      return
    }
    Promise.all([
      getRolloverProgress(accountId),
      bonusService.getMyClaims(accountId),
    ]).then(([rolloverData, claims]) => {
      if (cancelled) return
      setRollover(rolloverData)
      setMyClaims(claims)
    }).catch(() => { /* services already swallow errors */ })
    return () => { cancelled = true }
  }, [user?.accountId])

  const fetchBonuses = async () => {
    setLoading(true)
    setError(null)
    try {
      const activeBonuses = await bonusService.getAvailableBonuses()
      setBonuses(activeBonuses)
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
    const [r, c] = await Promise.all([
      getRolloverProgress(accountId),
      bonusService.getMyClaims(accountId),
    ])
    setRollover(r)
    setMyClaims(c)
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
            showToast={showToast}
            onUnauthClaim={() => showToast('Please log in to claim your daily bonus', 'warning')}
            onClaimSuccess={() => {
              // Refresh wallet popups / bonus-wallet listeners by nudging the
              // localStorage mirror that bonusWalletService writes to.
              try {
                window.dispatchEvent(new StorageEvent('storage', { key: 'team33_bonus_balance' }))
              } catch { /* ignore */ }
              // Pull the rollover snapshot + claim history again — daily
              // check-in credits show up in bonus_wallet.balance straight
              // away.
              refreshRolloverAndClaims()
            }}
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

// Rollover progress card — Design-C math from
// GET /api/bonus-wallet/{id}/rollover. Hidden when both balance and
// originalBonusCredited are 0 ("no active bonus" per doc §3.7).
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
        {bonuses.map((bonus, idx) => {
          const formatted = formatBonus(bonus)
          const available = bonusService.isBonusAvailable(bonus)
          const cardTitle = bonus.displayName || bonus.bonusCode || 'BONUS'
          // Prefer dedicated art for the bonus; fall back to the
          // cycled team33 banner pool when there isn't a match.
          const tileBg = pickBonusArt(bonus, TILE_BACKGROUNDS[idx % TILE_BACKGROUNDS.length])
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

// Bonus detail popup — all rows derived from the live /api/bonuses/available
// payload (per the 2026-06-18 customer-frontend doc §3.1). The full T&C
// text already lives in bonus.description with unicode arrows + newlines
// and is rendered verbatim below the structured rows.
function BonusDetailPopup({ bonus, formatted, available, claiming, onClose, onClaim }) {
  const title = (bonus.displayName || bonus.bonusCode || 'BONUS').toUpperCase()
  const minDeposit = dec(bonus.minDeposit)
  const isFree = minDeposit === 0
  const bonusValueNum = dec(bonus.bonusValue)
  const turnoverMultNum = dec(bonus.turnoverMultiplier)
  const maxBonusNum = dec(bonus.maxBonusAmount)
  const weeklyDepNum = dec(bonus.weeklyDepositRequired)

  const requirementsLabel = isFree ? 'NO' : `MIN $${minDeposit}`

  // Map claimPeriod (NONE | DAILY | WEEKLY) to a player-friendly phrase.
  const claimLimitLabel = (() => {
    switch ((bonus.claimPeriod || '').toUpperCase()) {
      case 'DAILY': return 'ONCE PER DAY'
      case 'WEEKLY': return 'ONCE PER WEEK'
      case 'NONE': return 'ONCE PER LIFETIME'
      default: return null
    }
  })()

  // Winover target: bonusValue × multiplier for FIXED bonuses (e.g. $5 × 20 = $100
  // wagering). For PERCENTAGE bonuses the dollar amount depends on the player's
  // deposit, so we show the multiplier instead.
  const winoverLabel = turnoverMultNum > 0
    ? (bonus.bonusType === 'PERCENTAGE'
        ? `${turnoverMultNum}× TURNOVER`
        : `BET $${(bonusValueNum * turnoverMultNum).toFixed(0)} TOTAL`)
    : null

  const maxBonusLabel = maxBonusNum > 0 ? `$${maxBonusNum}` : null
  const weeklyDepositLabel = weeklyDepNum > 0 ? `$${weeklyDepNum}` : null

  const validForLabel = null     // not in API today
  const notAllowedLabel = null   // not in API today
  const telegramUrl = null       // not in API today
  const rules = []
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
            {maxBonusLabel && (
              <tr>
                <td className="bp-key">MAX BONUS</td>
                <td className="bp-val">{maxBonusLabel}</td>
              </tr>
            )}
            {weeklyDepositLabel && (
              <tr>
                <td className="bp-key">WEEKLY DEPOSIT</td>
                <td className="bp-val">{weeklyDepositLabel}</td>
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
