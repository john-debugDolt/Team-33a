import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAllAdvantPlayGames,
  launchAdvantPlayGame,
  exitAdvantPlayGame,
} from '../services/advantPlayService'
import {
  recordLaunch,
  clearLaunch,
  clearLaunchIfMatches,
  sweepAllReturns,
  getPreLaunchBalance,
  getLaunchTimestamp,
  ProviderKey,
} from '../services/launchTracker'
import { walletService } from '../services/walletService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import GameDetailModal from '../components/GameDetailModal/GameDetailModal'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import GamePortal from '../components/GamePortal'
import './Slot.css'
import ProviderTabs from '../components/ProviderTabs/ProviderTabs'
import GameCard from '../components/GameCard/GameCard'
import { useCategoryAndSort } from '../components/CategorySortBar/CategorySortBar'

export default function AdvantPlay() {
  const navigate = useNavigate()
  const {
    isAuthenticated,
    user,
    updateBalance,
    notifyTransactionUpdate,
    freezeBalance,
    isLaunchBlocked,
  } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // AdvantPlay rawCategory is a CSV string of GameCategory[] (e.g. 'slot').
  const { bar, filteredGames } = useCategoryAndSort(games, {
    labels: { slot: 'Slots', mini: 'Mini', table: 'Table', fishing: 'Fishing', live: 'Live', card: 'Card', arcade: 'Arcade' },
  })

  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      try {
        const result = await getAllAdvantPlayGames()
        console.log('[AdvantPlay] Loaded:', result?.length || 0)
        if (result && result.length > 0) {
          setGames(result)
        }
      } catch (e) {
        console.error('[AdvantPlay] Error:', e)
      }
      setLoading(false)
    }
    loadGames()
  }, [])

  // Balance sync
  useEffect(() => {
    const syncBalance = async () => {
      if (user?.accountId) {
        try {
          const result = await walletService.getBalance(user.accountId)
          if (result.success && result.balance !== undefined) {
            updateBalance?.(result.balance)
          }
        } catch (error) {
          console.error('Failed to sync balance:', error)
        }
      }
    }

    if (!embeddedGame && user?.accountId) {
      syncBalance()
    }

    const handleGameMessage = (event) => {
      const data = event.data
      if (data?.type === 'BALANCE_UPDATE' && data.balance !== undefined) {
        updateBalance?.(data.balance)
      }
      if (data?.type === 'GAME_EXIT') {
        syncBalance()
        setEmbeddedGame(null)
        notifyTransactionUpdate?.()
      }
    }

    window.addEventListener('message', handleGameMessage)
    return () => window.removeEventListener('message', handleGameMessage)
  }, [embeddedGame, user?.accountId, updateBalance, notifyTransactionUpdate])

  // AdvantPlay /exit can return 5121 ("in flight, will reconcile") on a
  // transport hiccup — same as VPower/LiveCasino. Retry up to 3 times with
  // a soft backoff. After three failures the backend reconciler (≤5 min)
  // and the 20-min auto-withdraw timer are the safety net.
  const tryExitWithRetries = async (accountId, attempts = 3) => {
    let last = { success: false, error: 'No attempts made' }
    for (let i = 0; i < attempts; i++) {
      try {
        last = await exitAdvantPlayGame(accountId)
        if (last?.success) return last
        // 5121 means the backend is reconciling — sleeping won't help
        // here, surface it to the caller and let the page render the
        // soft "processing in background" toast.
        if (last?.reconciling) return last
      } catch (err) {
        last = { success: false, error: err?.message }
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 800 + i * 400))
      }
    }
    return last
  }

  const closeGame = () => {
    const accountId = user?.accountId
    const preBalance = getPreLaunchBalance(ProviderKey.ADVANTPLAY)
    const launchedAt = getLaunchTimestamp(ProviderKey.ADVANTPLAY)
    // Hold the displayed balance at the pre-launch value for 4s so the
    // player doesn't see a transient 0 between AdvantPlay's withdraw and
    // the wallet refresh.
    if (preBalance != null) freezeBalance?.(preBalance, 4000)

    // Tear the iframe down immediately — the /exit + retries + balance
    // refresh run in the background so a slow upstream (or a 5121
    // reconciler signal) never freezes the UI.
    setEmbeddedGame(null)
    setShowExitConfirm(false)

    if (!accountId) {
      notifyTransactionUpdate?.()
      return
    }

    ;(async () => {
      try {
        const result = await tryExitWithRetries(accountId, 3)
        if (result?.success) {
          clearLaunchIfMatches(ProviderKey.ADVANTPLAY, launchedAt)
        } else if (result?.reconciling) {
          showToast(
            'Cash-out is being processed in the background — balance will update shortly.',
            'warning',
          )
        } else if (result?.error) {
          console.warn('[AdvantPlay] exit failed after retries:', result.error)
        }
        // Refresh the main-wallet balance after exit; the freeze above
        // silences the immediate write so the display stays stable for 4s.
        try {
          const r = await walletService.getBalance(accountId)
          if (r.success && r.balance !== undefined) updateBalance?.(r.balance)
        } catch (err) {
          console.error('[AdvantPlay] balance sync error:', err)
        }
      } catch (err) {
        console.error('[AdvantPlay] closeGame background error:', err)
      } finally {
        notifyTransactionUpdate?.()
      }
    })()
  }

  const handlePlayNow = async (game, e) => {
    if (e) e.stopPropagation()

    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      navigate('/login')
      return
    }

    if (launchingGame === game.id) return
    if (isLaunchBlocked?.()) {
      showToast('Recovering your balance — please try again in a moment.', 'warning')
      return
    }

    setLaunchingGame(game.id)
    showToast(`Launching ${game.name}...`, 'info')

    // Freeze the displayed balance for 5s so the player doesn't see the
    // full-wallet deposit debit before the iframe finishes loading. /launch
    // sweeps the full main-wallet balance — we ignore options.amount on
    // purpose per doc §3.1.
    const preBalance = Number(user?.balance) || 0
    freezeBalance?.(preBalance, 5000)

    // Sweep any stranded prior sessions in parallel — fire-and-forget so a
    // slow exit upstream doesn't block this launch.
    sweepAllReturns(updateBalance).catch(() => {})
    recordLaunch(ProviderKey.ADVANTPLAY, user?.accountId, { preLaunchBalance: preBalance })

    try {
      const result = await launchAdvantPlayGame(game, user?.accountId, {
        langCode: 'en-US',
      })

      if (result.success && result.gameUrl) {
        setEmbeddedGame({ url: result.gameUrl, name: game.name })
        showToast(`${game.name} launched!`, 'success')
      } else {
        // Money may be sitting on AdvantPlay's side when the token minted
        // but the URL gen failed — leave the LIFO record in place so the
        // next sweep can reclaim it. For everything else, drop the record.
        if (!result.depositOpTransferId) clearLaunch(ProviderKey.ADVANTPLAY)

        // Doc §6 error-code mapping (player-facing copy).
        const code = result.errorCode
        if (code === 5321) {
          showToast('Insufficient balance. Top up to play.', 'error')
        } else if (code === 5121) {
          showToast('Launch already in progress — try again in a moment.', 'warning')
        } else if (code === 5050) {
          showToast('AdvantPlay is in maintenance — try again shortly.', 'error')
        } else if (code === 5213) {
          showToast('Your AdvantPlay account is locked — contact support.', 'error')
        } else if (code === 5214) {
          showToast('Your AdvantPlay account has been suspended — contact support.', 'error')
        } else if (code === 5201) {
          showToast('AdvantPlay access restricted from this region.', 'error')
        } else if (code === 5212) {
          // Account does not exist — backend auto-creates on next launch.
          showToast('AdvantPlay account is being prepared — try again.', 'warning')
        } else {
          showToast(result.error || 'AdvantPlay temporarily unavailable.', 'error')
        }
      }
    } catch (error) {
      console.error('[AdvantPlay launch] error:', error)
      showToast('Failed to launch game', 'error')
    } finally {
      setLaunchingGame(null)
    }
  }

  const renderGameCard = (game, index) => (
    <GameCard
      key={game.id || game.gameId || index}
      game={game}
      isLaunching={launchingGame === game.id}
      onLaunch={handlePlayNow}
      onLongPress={(g) => setSelectedGame(g)}
    />
  )

  return (
    <div className="slot-page">
      {/* Marquee */}
      <div className="marquee">
        <span className="marquee-icon">📢</span>
        <div className="marquee-text">
          <span>Telegram: @Team33 | AdvantPlay Games</span>
        </div>
      </div>

      <div className="slot-content">
        {/* Provider Logo Header */}
        <div className="provider-header">
          <img
            src="https://xt30sf.b-cdn.net/media/eb0212cc08386317e6000.gif"
            alt="AdvantPlay"
            className="provider-logo"
          />
        </div>

        {/* Provider Tabs */}
        <ProviderTabs active="advantplay" />

        {/* Games Count */}
        <div className="games-count">
          {filteredGames.length} AdvantPlay games available
        </div>

        {!loading && games.length > 0 && bar}

        {/* Loading State */}
        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="slot-games-layout">
            {filteredGames.length > 0 ? (
              <div className="game-category-section advantplay-section">
                <h2 className="category-title">
                  <span className="category-icon">🎯</span>
                  AdvantPlay Games
                  <span className="category-count">({filteredGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {filteredGames.map(renderGameCard)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No AdvantPlay games available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Game Detail Modal */}
      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onPlayGame={(gameData) => setEmbeddedGame(gameData)}
        />
      )}

      {/* Embedded Game Player */}
      {embeddedGame && (
        <GamePortal>
          <div className="game-player-overlay">
            <div className="game-player-container">
              {/* Small X button in top right corner */}
              <button
                className="game-player-exit"
                onClick={() => setShowExitConfirm(true)}
                title="Exit game"
              />

              {/* Fullscreen game iframe */}
              <div className="game-player-frame">
                <iframe
                  src={embeddedGame.url}
                  title={embeddedGame.name}
                  allowFullScreen
                  allow="autoplay; fullscreen; clipboard-write"
                />
              </div>

              {showExitConfirm && (
                <div className="exit-confirm-overlay">
                  <div className="exit-confirm-dialog">
                    <div className="exit-confirm-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                      </svg>
                    </div>
                    <h3>Exit Game?</h3>
                    <p>Are you sure you want to exit {embeddedGame.name}?</p>
                    <div className="exit-confirm-buttons">
                      <button className="exit-btn-yes" onClick={closeGame}>Yes, Exit</button>
                      <button className="exit-btn-no" onClick={() => setShowExitConfirm(false)}>No, Continue</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </GamePortal>
      )}
    </div>
  )
}
