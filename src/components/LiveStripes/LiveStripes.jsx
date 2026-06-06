import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './LiveStripes.css'

// Sexy Baccarat cards — all launch the SEXYBCRT platform via LiveCasino
import sexy1 from '../../images/sexybaccarat1.jpg'
import sexy2 from '../../images/seybaccarat2.jpg'   // (original filename has a typo)
import sexy3 from '../../images/sexybaccarat3.jpg'
import sexy4 from '../../images/sexybaccarat4.jpg'
import sexy5 from '../../images/sexybaccarat5.jpg'
import sexy6 from '../../images/sexybaccarat6.jpg'

// AllBet roulette cards — launch the ALLBET hub via LiveCasino
import rouletteAllbet1 from '../../images/live roulette allbet.jpg'
import rouletteAllbet2 from '../../images/live roulette allbet 2.jpg'
import rouletteAllbet3 from '../../images/live roulette allbet 3.jpg'

// Live Sports
import sv388Logo from '../../images/sv388logo.jpg'
import m8betLogo from '../../images/m8betlogo.jpg'

const BACCARAT_CARDS = [
  { id: 'sexy-1', image: sexy1, label: 'Sexy Baccarat' },
  { id: 'sexy-2', image: sexy2, label: 'Sexy Baccarat' },
  { id: 'sexy-3', image: sexy3, label: 'Sexy Baccarat' },
  { id: 'sexy-4', image: sexy4, label: 'Sexy Baccarat' },
  { id: 'sexy-5', image: sexy5, label: 'Sexy Baccarat' },
  { id: 'sexy-6', image: sexy6, label: 'Sexy Baccarat' },
]

const ROULETTE_CARDS = [
  { id: 'roulette-1', image: rouletteAllbet1, label: 'AllBet Roulette' },
  { id: 'roulette-2', image: rouletteAllbet2, label: 'AllBet Roulette' },
  { id: 'roulette-3', image: rouletteAllbet3, label: 'AllBet Roulette' },
]

const SPORTS_CARDS = [
  // SV388 logo is contained-then-enlarged; no background colour fill.
  { id: 'sv388', image: sv388Logo, label: 'SV388', variant: 'sv388' },
  // M8BET sits on the rooking sportsbook background so it looks "sporty".
  { id: 'm8bet', image: m8betLogo, label: 'M8BET', variant: 'm8bet' },
]

function LiveCard({ card, onClick }) {
  return (
    <button
      className={`live-card ${card.variant ? `variant-${card.variant}` : ''}`}
      onClick={onClick}
      aria-label={card.label}
    >
      <img src={card.image} alt={card.label} className="live-card-image" />
      <span className="live-card-tag">LIVE</span>
      <div className="live-card-overlay">
        <span className="live-card-label">{card.label}</span>
      </div>
    </button>
  )
}

function LiveStripe({ title, icon, cards, onCardClick, autoScroll, className = '' }) {
  // Track duplicated → seamless loop when auto-scrolling
  const displayCards = autoScroll ? [...cards, ...cards] : cards
  const scrollRef = useRef(null)
  const pausedRef = useRef(false)
  const resumeTimerRef = useRef(null)

  // JS-driven auto-scroll: pauses on user interaction, resumes after 2s idle.
  // Lets the native scrollbar handle user scrolling alongside.
  useEffect(() => {
    if (!autoScroll) return
    const el = scrollRef.current
    if (!el) return

    const SPEED_PX = 1
    const TICK_MS = 35

    const tick = () => {
      if (!pausedRef.current) {
        el.scrollLeft += SPEED_PX
        // Seamless loop: reset when first copy is scrolled past
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft -= el.scrollWidth / 2
        }
      }
    }
    const interval = setInterval(tick, TICK_MS)

    const pause = () => {
      pausedRef.current = true
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    }
    const scheduleResume = () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = setTimeout(() => {
        pausedRef.current = false
      }, 2000)
    }

    const onPointerDown = () => pause()
    const onPointerUp = () => scheduleResume()
    const onWheel = () => {
      pause()
      scheduleResume()
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('pointerleave', onPointerUp)
    el.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      clearInterval(interval)
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('pointerleave', onPointerUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [autoScroll])

  return (
    <div className={`live-stripe ${className}`}>
      <h3 className="live-stripe-title">
        <span className="live-stripe-icon">{icon}</span>
        {title}
      </h3>
      <div
        ref={scrollRef}
        className={`live-stripe-scroll ${autoScroll ? 'auto-scroll' : ''}`}
      >
        <div className="live-stripe-track">
          {displayCards.map((card, i) => (
            <LiveCard
              key={`${card.id}-${i}`}
              card={card}
              onClick={() => onCardClick(card)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LiveStripes() {
  const navigate = useNavigate()

  const handleBaccaratClick = () => {
    // SEXYBCRT lives in LiveCasino; auto-launch via location state.
    navigate('/live-casino', { state: { autoLaunch: 'SEXYBCRT' } })
  }

  const handleRouletteClick = () => {
    // AllBet hub in LiveCasino.
    navigate('/live-casino', { state: { autoLaunch: 'ALLBET' } })
  }

  const handleSportsClick = (card) => {
    if (card.id === 'sv388') {
      navigate('/sports', { state: { autoLaunch: 'SV388' } })
    } else if (card.id === 'm8bet') {
      navigate('/sports', { state: { autoLaunch: 'M8BET' } })
    }
  }

  return (
    <section className="live-stripes-section">
      <LiveStripe
        title="Live Baccarat"
        icon="🃏"
        cards={BACCARAT_CARDS}
        onCardClick={handleBaccaratClick}
        autoScroll
      />
      <div className="live-stripes-row">
        <LiveStripe
          title="Live Roulette"
          icon="🎡"
          cards={ROULETTE_CARDS}
          onCardClick={handleRouletteClick}
          autoScroll
        />
        <LiveStripe
          title="Live Sports"
          icon="⚽"
          cards={SPORTS_CARDS}
          onCardClick={handleSportsClick}
          autoScroll
        />
      </div>
    </section>
  )
}
