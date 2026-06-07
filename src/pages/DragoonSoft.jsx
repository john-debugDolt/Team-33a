import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllDragoonSoftGames, exitDragoonSoftGame, launchDragoonSoftGame } from '../services/dragoonSoftService'
import { recordLaunch, clearLaunch, sweepAllReturns, ProviderKey } from '../services/launchTracker'
import { getAllClotPlayGames } from '../services/gameService'
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
import dragoonLogo from '../images/dragoonsoftlogo.jpg'

// AUD to transfer into DragonSoft on launch.
const DEFAULT_LAUNCH_AMOUNT = 100

export default function DragoonSoft() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const { bar, filteredGames } = useCategoryAndSort(games, {
    labels: { slots: 'Slots', fishing: 'Fishing', arcade: 'Arcade' },
  })

  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      try {
        const [dragoonGames, imageDonorGames] = await Promise.all([
          getAllDragoonSoftGames(dragoonLogo),
          getAllClotPlayGames().catch(() => []),
        ])

        const imagePool = (imageDonorGames || [])
          .map(g => g.image)
          .filter(src => src && src !== '/placeholder-game.png')

        let result = dragoonGames
        if (result && result.length > 0 && imagePool.length > 0) {
          result = result.map(g => {
            // Hash string gameId to a number for deterministic index
            const numKey = String(g.gameId).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
            const idx = numKey % imagePool.length
            const img = imagePool[idx]
            return { ...g, image: img, portraitImage: img, squareImage: img }
          })
        }

        console.log('[DragoonSoft] Loaded:', result?.length || 0, '| image pool:', imagePool.length)
        if (result && result.length > 0) setGames(result)
      } catch (e) {
        console.error('[DragoonSoft] Error:', e)
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

    if (!embeddedGame && user?.accountId) syncBalance()

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
        await exitDragoonSoftGame(user.accountId)
        clearLaunch(ProviderKey.DRAGOONSOFT)
      } catch (error) {
        console.error('[DragoonSoft] Exit error:', error)
      }
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
    if (game.active === false) {
      showToast('This game is currently disabled', 'warning')
      return
    }

    if (launchingGame === game.id) return

    setLaunchingGame(game.id)
    showToast(`Launching ${game.name}...`, 'info')

    await sweepAllReturns(updateBalance)
    recordLaunch(ProviderKey.DRAGOONSOFT, user?.accountId)

    const mainBalance = Number(user?.balance) || 0
    const amount = Math.min(DEFAULT_LAUNCH_AMOUNT, Math.floor(mainBalance))

    try {
      const result = await launchDragoonSoftGame(game, user?.accountId, {
        amount: amount > 0 ? amount : undefined,
      })
      if (result.success && result.gameUrl) {
        setEmbeddedGame({ url: result.gameUrl, name: game.name })
        showToast(`${game.name} launched!`, 'success')
      } else {
        clearLaunch(ProviderKey.DRAGOONSOFT)
        if (result.dsCode === 1010) {
          showToast('Insufficient balance. Top up to play.', 'error')
        } else if (result.dsCode === 1005 || result.dsCode === 10) {
          showToast('Account error — contact support', 'error')
        } else if (result.reconciling) {
          showToast(result.error, 'warning')
        } else {
          showToast(result.error || 'Dragoon Soft is temporarily unavailable.', 'error')
        }
      }
    } catch (error) {
      console.error('[DragoonSoft Launch] error:', error)
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
      <div className="marquee">
        <span className="marquee-icon">📢</span>
        <div className="marquee-text">
          <span>Telegram: @Team33 | Dragoon Soft (Transfer Wallet)</span>
        </div>
      </div>

      <div className="slot-content">
        <div className="provider-header">
          <img src={dragoonLogo} alt="Dragoon Soft" className="provider-logo" />
        </div>

        <ProviderTabs active="dragoon" />

        <div className="games-count">
          {filteredGames.length} Dragoon Soft games available
        </div>

        {!loading && games.length > 0 && bar}

        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="slot-games-layout">
            {filteredGames.length > 0 ? (
              <div className="game-category-section dragoon-section">
                <h2 className="category-title">
                  <span className="category-icon">🎯</span>
                  Dragoon Soft Games
                  <span className="category-count">({filteredGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {filteredGames.map(renderGameCard)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No Dragoon Soft games available right now.</p>
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
                    <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>Your balance will be transferred back to your main wallet.</p>
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
