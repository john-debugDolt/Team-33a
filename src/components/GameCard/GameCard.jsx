import { useRef } from 'react'
import GameImage from '../GameImage'

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10

export default function GameCard({ game, isLaunching, onLaunch, onLongPress }) {
  const timerRef = useRef(null)
  const longPressedRef = useRef(false)
  const touchStartRef = useRef(null)

  const startPress = (e) => {
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
    if (longPressedRef.current) {
      longPressedRef.current = false
      return
    }
    if (isLaunching) return
    onLaunch?.(game, e)
  }

  return (
    <div
      className={`slot-game-card ${isLaunching ? 'launching' : ''}`}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchMove={handleTouchMove}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="game-image-wrapper">
        <GameImage src={game.image} alt={game.name} className="game-image" />
        {isLaunching && (
          <div className="game-launching-overlay">
            <div className="play-spinner" />
          </div>
        )}
      </div>
      <div className="game-name">{game.name}</div>
    </div>
  )
}
