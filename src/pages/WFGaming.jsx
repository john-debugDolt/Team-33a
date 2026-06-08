import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllWFGamingGames, kickWFGamingGame, launchWFGamingGame } from '../services/wfGamingService'
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

export default function WFGaming() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const { bar, filteredGames } = useCategoryAndSort(games, { labels: { '1': 'Slots' } })

  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      try {
        const result = await getAllWFGamingGames()
        console.log('[WFGaming] Loaded:', result?.length || 0)
        if (result && result.length > 0) {
          setGames(result)
        }
      } catch (e) {
        console.error('[WFGaming] Error:', e)
      }
      setLoading(false)
    }
    loadGames()
  }, [])

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

  const closeGame = async () => {
    // End the WF Gaming session under the same alias we launched with.
    // /kick is non-blocking for the UI — if WF Gaming is slow we still
    // close the iframe so the player isn't stuck looking at it.
    if (user?.accountId) {
      kickWFGamingGame(user.accountId).catch((err) =>
        console.warn('[WFGaming/kick] failed:', err?.message)
      )
      try {
        const result = await walletService.getBalance(user.accountId)
        if (result.success && result.balance !== undefined) {
          updateBalance?.(result.balance)
        }
      } catch (error) {
        console.error('Balance sync error:', error)
      }
    }
    setEmbeddedGame(null)
    setShowExitConfirm(false)
    notifyTransactionUpdate?.()
  }

  const handlePlayNow = async (game, e) => {
    if (e) e.stopPropagation()

    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      navigate('/login')
      return
    }

    if (launchingGame === game.id) return

    const accountId = user?.accountId
    if (!accountId) {
      showToast('Your account ID is missing — please re-login', 'error')
      console.error('[WFGaming] missing accountId on launch')
      return
    }

    setLaunchingGame(game.id)
    showToast(`Launching ${game.name}...`, 'info')
    console.log('[WFGaming] handlePlayNow accountId=', accountId, 'gameCode=', game.gameCode || game.gameId)

    const maxRetries = 15
    let attempt = 0
    let success = false

    while (attempt < maxRetries && !success) {
      attempt++
      try {
        // Call the WFGaming launcher directly. gameService.requestGameUrl
        // looks up the game in caches that are only populated when the user
        // lands via Home — visiting /wfgaming directly leaves the cache
        // empty so every retry hit "Game not found" before reaching the API.
        const result = await launchWFGamingGame(game.gameCode || game.gameId, accountId)
        if (result.success && result.gameUrl) {
          setEmbeddedGame({ url: result.gameUrl, name: game.name })
          showToast(`${game.name} launched!`, 'success')
          success = true
        } else {
          console.log(`[Game Launch] Attempt ${attempt} failed:`, result.error)
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      } catch (error) {
        console.error(`[Game Launch] Attempt ${attempt} error:`, error)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    if (!success) {
      console.error('[Game Launch] All retries failed')
    }

    setLaunchingGame(null)
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
      <div className="marquee">
        <span className="marquee-icon">📢</span>
        <div className="marquee-text">
          <span>Telegram: @Team33 | WFGaming Games</span>
        </div>
      </div>

      <div className="slot-content">
        <div className="provider-header">
          <img
            src="https://imgs.search.brave.com/Ip5Thj11mYAp02XCwDMhX_92_e1zD5kJHiZCAY3duWU/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5saW5rLm1lL2Nk/bi1jZ2kvaW1hZ2Uv/d2lkdGg9MTA5Mixo/ZWlnaHQ9MTA5Mixx/dWFsaXR5PTc1LGZv/cm1hdD13ZWJwL2lt/YWdlcy93ZWJwLWlt/YWdlcy91c2VyLXBy/b2ZpbGUvMTQ2NDIz/OS90bXAtMjQ2Ny0x/NzQ3ODgyNTI3NjA2/LndlYnA"
            alt="WFGaming"
            className="provider-logo"
          />
        </div>

        <ProviderTabs active="wfgaming" />

        <div className="games-count">
          {filteredGames.length} WFGaming games available
        </div>

        {!loading && games.length > 0 && bar}

        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="slot-games-layout">
            {filteredGames.length > 0 ? (
              <div className="game-category-section wfgaming-section">
                <h2 className="category-title">
                  <span className="category-icon">🎯</span>
                  WFGaming Games
                  <span className="category-count">({filteredGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {filteredGames.map(renderGameCard)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No WFGaming games available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onPlayGame={(gameData) => setEmbeddedGame(gameData)}
        />
      )}

      {embeddedGame && (
        <GamePortal>
          <div className="game-player-overlay">
            <div className="game-player-container">
              <button
                className="game-player-exit"
                onClick={() => setShowExitConfirm(true)}
                title="Exit game"
              />
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
