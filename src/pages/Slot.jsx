import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameService } from '../services/gameService'
import { getAllAdvantPlayGames } from '../services/advantPlayService'
import { getAllUUSlotGames } from '../services/uuSlotService'
import { getAllEvo888h5Games } from '../services/evo888h5Service'
import { walletService } from '../services/walletService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import GameDetailModal from '../components/GameDetailModal/GameDetailModal'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import GameImage from '../components/GameImage'
import './Slot.css'

export default function Slot() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  // Separate state for each provider
  const [advantPlayGames, setAdvantPlayGames] = useState([])
  const [uuSlotGames, setUuSlotGames] = useState([])
  const [evo888h5Games, setEvo888h5Games] = useState([])
  const [clotPlayGames, setClotPlayGames] = useState([])

  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Fetch each provider separately
  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      console.log('[Slot] Loading games from all providers...')

      // Fetch AdvantPlay
      try {
        const games = await getAllAdvantPlayGames()
        console.log('[Slot] AdvantPlay loaded:', games?.length || 0)
        if (games && games.length > 0) {
          setAdvantPlayGames(games)
        }
      } catch (e) {
        console.error('[Slot] AdvantPlay error:', e)
      }

      // Fetch UUSlot
      try {
        const games = await getAllUUSlotGames()
        console.log('[Slot] UUSlot loaded:', games?.length || 0)
        if (games && games.length > 0) {
          setUuSlotGames(games)
        }
      } catch (e) {
        console.error('[Slot] UUSlot error:', e)
      }

      // Fetch EVO888H5
      try {
        const games = await getAllEvo888h5Games()
        console.log('[Slot] EVO888H5 loaded:', games?.length || 0)
        if (games && games.length > 0) {
          setEvo888h5Games(games)
        }
      } catch (e) {
        console.error('[Slot] EVO888H5 error:', e)
      }

      // Fetch ClotPlay
      try {
        const result = await gameService.getGames({ page: 1, limit: 500, gameType: 'all' })
        if (result.success && result.data?.games) {
          console.log('[Slot] ClotPlay loaded:', result.data.games.length)
          setClotPlayGames(result.data.games)
        }
      } catch (e) {
        console.error('[Slot] ClotPlay error:', e)
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

  const handleGameClick = (game) => {
    setSelectedGame(game)
  }

  const closeGame = async () => {
    if (user?.accountId) {
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

    setLaunchingGame(game.id)
    showToast(`Launching ${game.name}...`, 'info')

    try {
      const result = await gameService.requestGameUrl(game.id, user?.id)
      if (result.success && result.gameUrl) {
        setEmbeddedGame({ url: result.gameUrl, name: game.name })
        showToast(`${game.name} launched!`, 'success')
      } else {
        showToast(result.error || 'Failed to launch game', 'error')
      }
    } catch (error) {
      console.error('Game launch error:', error)
      showToast('Failed to launch game. Please try again.', 'error')
    } finally {
      setLaunchingGame(null)
    }
  }

  // Render a game card
  const renderGameCard = (game, index) => (
    <div
      key={game.id || game.gameId || index}
      className="slot-game-card"
      onClick={() => handleGameClick(game)}
    >
      <div className="game-image-wrapper">
        <GameImage src={game.image} alt={game.name} className="game-image" />
        <div className="game-overlay">
          <button
            className={`play-btn ${launchingGame === game.id ? 'loading' : ''}`}
            onClick={(e) => handlePlayNow(game, e)}
            disabled={launchingGame === game.id}
          >
            {launchingGame === game.id ? (
              <div className="play-spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="game-name">{game.name}</div>
    </div>
  )

  const totalGames = advantPlayGames.length + uuSlotGames.length + evo888h5Games.length + clotPlayGames.length

  return (
    <div className="slot-page">
      {/* Marquee */}
      <div className="marquee">
        <span className="marquee-icon">📢</span>
        <div className="marquee-text">
          <span>Telegram: @Team33 | Welcome to Team33 slots!</span>
        </div>
      </div>

      <div className="slot-content">
        {/* Games Count */}
        <div className="games-count">
          {totalGames} games available
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="slot-games-layout">
            {/* AdvantPlay Section */}
            {advantPlayGames.length > 0 && (
              <div className="game-category-section advantplay-section">
                <h2 className="category-title">
                  <span className="category-icon">🎯</span>
                  AdvantPlay Games
                  <span className="category-count">({advantPlayGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {advantPlayGames.map(renderGameCard)}
                </div>
              </div>
            )}

            {/* UUSlot Section */}
            {uuSlotGames.length > 0 && (
              <div className="game-category-section uuslot-section">
                <h2 className="category-title">
                  <span className="category-icon">🎰</span>
                  UUSlot Games
                  <span className="category-count">({uuSlotGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {uuSlotGames.map(renderGameCard)}
                </div>
              </div>
            )}

            {/* EVO888H5 Section */}
            {evo888h5Games.length > 0 && (
              <div className="game-category-section evo888h5-section">
                <h2 className="category-title">
                  <span className="category-icon">🌟</span>
                  EVO888H5 Games
                  <span className="category-count">({evo888h5Games.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {evo888h5Games.map(renderGameCard)}
                </div>
              </div>
            )}

            {/* ClotPlay Section */}
            {clotPlayGames.length > 0 && (
              <div className="game-category-section clotplay-section">
                <h2 className="category-title">
                  <span className="category-icon">🎲</span>
                  ClotPlay Games
                  <span className="category-count">({clotPlayGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {clotPlayGames.map(renderGameCard)}
                </div>
              </div>
            )}

            {/* No games message */}
            {totalGames === 0 && (
              <div className="empty-state">
                <p>Loading games...</p>
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
        <div className="game-player-overlay">
          <div className="game-player-container">
            <div className="game-player-header">
              <div className="game-player-left">
                <button
                  className="game-player-back"
                  onClick={() => setShowExitConfirm(true)}
                  title="Exit game"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                </button>
                <h3 className="game-player-title">{embeddedGame.name}</h3>
              </div>
              <div className="game-player-center">
                <div className="game-player-balance">
                  <span className="balance-label">Balance</span>
                  <span className="balance-amount">${(user?.balance || 0).toFixed(2)}</span>
                </div>
                <button
                  className="game-player-deposit"
                  onClick={async () => {
                    await closeGame()
                    navigate('/wallet')
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  <span>Deposit</span>
                </button>
              </div>
              <div className="game-player-actions">
                <button
                  className="game-player-exit"
                  onClick={() => setShowExitConfirm(true)}
                  title="Exit game"
                >
                  Exit
                </button>
                <button
                  className="game-player-fullscreen"
                  onClick={() => window.open(embeddedGame.url, '_blank')}
                  title="Open in new tab"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="game-player-frame">
              <iframe
                src={embeddedGame.url}
                title={embeddedGame.name}
                allowFullScreen
                allow="autoplay; fullscreen; clipboard-write"
              />
            </div>

            {/* Mobile Exit Button */}
            <button className="mobile-exit-btn" onClick={() => setShowExitConfirm(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              EXIT GAME
            </button>

            {/* Exit Confirmation */}
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
      )}
    </div>
  )
}
