import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllRich88Games, launchRich88Game } from '../services/rich88TransferService'
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
import rich88Logo from '../images/rich88logo.jpg'

export default function Rich88() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Rich88 ships string categories (`Slot Game`, `Table Game`, `Arcade Game`,
  // `Bingo Game`). Tighten them to short chip labels.
  const { bar, filteredGames } = useCategoryAndSort(games, {
    labels: {
      'Slot Game': 'Slots',
      'Table Game': 'Table',
      'Arcade Game': 'Arcade',
      'Bingo Game': 'Bingo',
    },
  })

  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      try {
        const result = await getAllRich88Games()
        if (result && result.length > 0) setGames(result)
      } catch (e) {
        console.error('[Rich88] Error:', e)
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
          if (result.success && result.balance !== undefined) updateBalance?.(result.balance)
        } catch (error) {
          console.error('Failed to sync balance:', error)
        }
      }
    }
    if (!embeddedGame && user?.accountId) syncBalance()
    const handleGameMessage = (event) => {
      const data = event.data
      if (data?.type === 'BALANCE_UPDATE' && data.balance !== undefined) updateBalance?.(data.balance)
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
    if (user?.accountId) {
      try {
        const result = await walletService.getBalance(user.accountId)
        if (result.success && result.balance !== undefined) updateBalance?.(result.balance)
      } catch (error) { console.error('Balance sync error:', error) }
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
    setLaunchingGame(game.id)
    showToast(`Launching ${game.name}...`, 'info')

    const maxRetries = 10
    let attempt = 0
    let success = false
    while (attempt < maxRetries && !success) {
      attempt++
      try {
        const result = await launchRich88Game(game, user?.accountId)
        if (result.success && result.gameUrl) {
          setEmbeddedGame({ url: result.gameUrl, name: game.name })
          showToast(`${game.name} launched!`, 'success')
          success = true
        } else {
          if (result.code === 10001) {
            showToast(result.error || 'Game code not supported', 'error')
            break
          }
          if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000))
        }
      } catch (error) {
        console.error(`[Rich88 launch] Attempt ${attempt} error:`, error)
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000))
      }
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
          <span>Telegram: @Team33 | Rich88 Games</span>
        </div>
      </div>

      <div className="slot-content">
        <div className="provider-header">
          <img src={rich88Logo} alt="Rich88" className="provider-logo" />
        </div>

        <ProviderTabs active="rich88" />

        <div className="games-count">{filteredGames.length} Rich88 games available</div>

        {!loading && games.length > 0 && bar}

        {loading ? (
          <div className="loading-wrapper"><LoadingSpinner /></div>
        ) : (
          <div className="slot-games-layout">
            {filteredGames.length > 0 ? (
              <div className="game-category-section rich88-section">
                <h2 className="category-title">
                  <span className="category-icon">💎</span>
                  Rich88 Games
                  <span className="category-count">({filteredGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {filteredGames.map(renderGameCard)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No Rich88 games available</p>
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
