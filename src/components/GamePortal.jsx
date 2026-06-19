import { createPortal } from 'react-dom'
import { useState } from 'react'
import './GamePortal.css'

/**
 * Portal wrapper used by every provider page to mount its iframe overlay
 * outside the page's React subtree (so route changes don't tear the
 * iframe down mid-spin).
 *
 * Before the iframe (children) is rendered, the player sees a friendly
 * one-time advisory. The children — including the actual iframe — only
 * mount once the player clicks "Got it", so the game URL isn't fetched
 * until the player has read the advice. Component remounts on every
 * launch so the advisory is fresh whether the player is in normal or
 * bonus mode, on any provider.
 */
export default function GamePortal({ children }) {
  const [acknowledged, setAcknowledged] = useState(false)
  return createPortal(
    acknowledged ? (
      children
    ) : (
      <div
        className="game-launch-advisory-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-launch-advisory-title"
      >
        <div className="game-launch-advisory-card">
          <div className="game-launch-advisory-icon" aria-hidden="true">💡</div>
          <h3 id="game-launch-advisory-title" className="game-launch-advisory-title">
            Heads up
          </h3>
          <p className="game-launch-advisory-msg">
            If you face any issue while playing — a stuck spin, blank screen,
            or anything that won't respond — just <strong>restart the game</strong> or
            <strong> reload the website</strong>. You won't lose your balance.
          </p>
          <button
            type="button"
            className="game-launch-advisory-btn"
            onClick={() => setAcknowledged(true)}
            autoFocus
          >
            Got it — play
          </button>
        </div>
      </div>
    ),
    document.body
  )
}
