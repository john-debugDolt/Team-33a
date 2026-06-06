import { useEffect, useMemo, useRef } from 'react'
import './TopHotStripe.css'

/**
 * Horizontal "Top Hot" stripe — auto-scrolls + supports user scroll.
 * Pulls real-image games from sourceGames (e.g. ClotPlay + UUSlot), picks
 * N random ones, and renders cards with a red HOT tag.
 */
export default function TopHotStripe({ sourceGames = [], onPlay, count = 12 }) {
  const scrollRef = useRef(null)
  const pausedRef = useRef(false)
  const resumeTimerRef = useRef(null)

  // Filter to games with real thumbnails, pick `count` random, memoise.
  const hotGames = useMemo(() => {
    const withImages = sourceGames.filter(g =>
      g?.image &&
      typeof g.image === 'string' &&
      g.image.startsWith('http') &&
      !g.image.includes('placeholder')
    )
    // Shuffle (Fisher-Yates) then slice
    const arr = withImages.slice()
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, count)
  }, [sourceGames, count])

  // Duplicated cards for seamless loop
  const displayCards = hotGames.length > 0 ? [...hotGames, ...hotGames] : []

  // JS-driven auto-scroll with user-interaction pause
  useEffect(() => {
    if (displayCards.length === 0) return
    const el = scrollRef.current
    if (!el) return

    const SPEED_PX = 1
    const TICK_MS = 35

    const tick = () => {
      if (!pausedRef.current) {
        el.scrollLeft += SPEED_PX
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
    const onWheel = () => { pause(); scheduleResume() }

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
  }, [displayCards.length])

  if (hotGames.length === 0) return null

  return (
    <section className="top-hot-section">
      <h3 className="top-hot-title">
        <span className="top-hot-icon">🔥</span>
        Top Hot
      </h3>
      <div ref={scrollRef} className="top-hot-scroll">
        <div className="top-hot-track">
          {displayCards.map((game, i) => (
            <button
              key={`${game.id || game.gameId}-${i}`}
              className="top-hot-card"
              onClick={(e) => onPlay?.(game, e)}
              aria-label={game.name}
            >
              <img src={game.image} alt={game.name} className="top-hot-image" />
              <span className="top-hot-tag">HOT</span>
              <div className="top-hot-overlay">
                <span className="top-hot-name">{game.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
