import { useRef } from 'react'
import GameImage from '../GameImage'
import useAccountType, { isBonusSupported } from '../../hooks/useAccountType'
import { useToast } from '../../context/ToastContext'

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10

export default function GameCard({ game, isLaunching, onLaunch, onLongPress }) {
  const timerRef = useRef(null)
  const longPressedRef = useRef(false)
  const touchStartRef = useRef(null)
  const accountType = useAccountType()
  const { showToast } = useToast()
  // Lock the card when player is on bonus AND this game's provider doesn't
  // support bonus-operator play. Only the 5 multi-operator providers stay
  // playable: MegaH5, MetaGaming, SCR888H5, Rich88, EVO888H5.
  const locked = accountType === 'bonus' && !isBonusSupported(game?.provider)

  const startPress = (e) => {
    if (locked) return
    longPressedRef.current = false
    if (e.touches?.[0]) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true
      onLongPress?.(game)
    }, LONG_PRESS_MS)
  }

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleTouchMove = (e) => {
    if (!touchStartRef.current || !timerRef.current) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    const dy = e.touches[0].clientY - touchStartRef.current.y
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_CANCEL_PX) cancelPress()
  }

  const handleClick = (e) => {
    if (locked) {
      e?.stopPropagation?.()
      showToast?.('Finish your bonus play first — this game is locked.', 'warning')
      return
    }
    if (longPressedRef.current) {
      longPressedRef.current = false
      return
    }
    if (isLaunching) return
    onLaunch?.(game, e)
  }

  return (
    <div
      className={`slot-game-card ${isLaunching ? 'launching' : ''} ${locked ? 'locked' : ''}`}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchMove={handleTouchMove}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      aria-disabled={locked || undefined}
      title={locked ? `${game?.provider || 'This provider'} is locked during bonus play` : undefined}
    >
      <div className="game-image-wrapper">
        <GameImage src={game.image} alt={game.name} className="game-image" />
        {isLaunching && (
          <div className="game-launching-overlay">
            <div className="play-spinner" />
          </div>
        )}
        {locked && (
          <div className="game-locked-overlay">
            <div className="game-locked-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="game-locked-text">Bonus play active</div>
          </div>
        )}
      </div>
      <div className="game-name">{game.name}</div>
    </div>
  )
}
