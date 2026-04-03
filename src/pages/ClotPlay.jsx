import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameService } from '../services/gameService'
import { walletService } from '../services/walletService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import GameDetailModal from '../components/GameDetailModal/GameDetailModal'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import GameImage from '../components/GameImage'
import GamePortal from '../components/GamePortal'
import './Slot.css'

export default function ClotPlay() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      try {
        const result = await gameService.getGames({ page: 1, limit: 500, gameType: 'all' })
        if (result.success && result.data?.games) {
          console.log('[ClotPlay] Loaded:', result.data.games.length)
          setGames(result.data.games)
        }
      } catch (e) {
        console.error('[ClotPlay] Error:', e)
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

    const maxRetries = 15
    let attempt = 0
    let success = false

    while (attempt < maxRetries && !success) {
      attempt++
      try {
        const result = await gameService.requestGameUrl(game.id, user?.id)
        if (result.success && result.gameUrl) {
          setEmbeddedGame({ url: result.gameUrl, name: game.name })
          showToast(`${game.name} launched!`, 'success')
          success = true
        } else {
          console.log(`[Game Launch] Attempt ${attempt} failed, retrying...`)
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
    <div
      key={game.id || game.gameId || index}
      className="slot-game-card"
      onClick={() => setSelectedGame(game)}
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

  return (
    <div className="slot-page">
      {/* Marquee */}
      <div className="marquee">
        <span className="marquee-icon">📢</span>
        <div className="marquee-text">
          <span>Telegram: @Team33 | ClotPlay Games</span>
        </div>
      </div>

      <div className="slot-content">
        {/* Provider Logo Header */}
        <div className="provider-header">
          <img
            src="https://scontent.fmel11-1.fna.fbcdn.net/v/t39.30808-6/488247950_556208077493821_605589263697651606_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=rFbxz2u02nYQ7kNvwHFD1cc&_nc_oc=Ado413tSIFepcnwcfcU8n8ndTt4pGKp0d4MmHuxLMKEAq2DEeopu1U6Vgn6WzTugeHA&_nc_zt=23&_nc_ht=scontent.fmel11-1.fna&_nc_gid=EDnohr6MTEuYtB8jwBNLkw&_nc_ss=7a389&oh=00_Af3T5bhLOwzkV_DlEZaLXzdgi6koIOEhPELHfc9paNi14Q&oe=69D4E906"
            alt="ClotPlay"
            className="provider-logo clotplay-logo"
          />
        </div>

        {/* Provider Tabs */}
        <div className="provider-tabs">
          <button className="provider-tab" onClick={() => navigate('/')}>🎮 All</button>
          <button className="provider-tab" onClick={() => navigate('/advantplay')}>🎯 AdvantPlay</button>
          <button className="provider-tab" onClick={() => navigate('/uuslot')}>🎰 UUSlot</button>
          <button className="provider-tab" onClick={() => navigate('/evo888h5')}>🌟 EVO888H5</button>
          <button className="provider-tab active">🎲 ClotPlay</button>
        </div>

        {/* Games Count */}
        <div className="games-count">
          {games.length} ClotPlay games available
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="slot-games-layout">
            {games.length > 0 ? (
              <div className="game-category-section clotplay-section">
                <h2 className="category-title">
                  <span className="category-icon">🎲</span>
                  ClotPlay Games
                  <span className="category-count">({games.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {games.map(renderGameCard)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No ClotPlay games available</p>
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
