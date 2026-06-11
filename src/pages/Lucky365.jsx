import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllLucky365Games, exitLucky365Game, launchLucky365Game } from '../services/lucky365Service'
import { recordLaunch, clearLaunch, sweepAllReturns, getPreLaunchBalance, ProviderKey } from '../services/launchTracker'
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
import lucky365Logo from '../images/lucky365logo.jpg'

const DEFAULT_LAUNCH_AMOUNT = 100

export default function Lucky365() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate, freezeBalance, isLaunchBlocked } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const { bar, filteredGames } = useCategoryAndSort(games, {
    // rawCategory is the numeric `type` Lucky365 ships:
    //   10 = Slots (e.g. Jungle), 13 = Table (FanTan), 16 = Fishing (Ocean King)
    labels: { '10': 'Slots', '13': 'Table', '16': 'Fishing' },
  })

  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      try {
        const [luckyGames, imageDonorGames] = await Promise.all([
          getAllLucky365Games(lucky365Logo),
          getAllClotPlayGames().catch(() => []),
        ])

        const imagePool = (imageDonorGames || [])
          .map(g => g.image)
          .filter(src => src && src !== '/placeholder-game.png')

        let result = luckyGames
        // Lucky365 catalogue has no thumbnails — borrow ClotPlay images by
        // deterministic gameCode hash so the cards aren't all the same logo.
        if (result && result.length > 0 && imagePool.length > 0) {
          result = result.map((g) => {
            const hasRealThumb = g.image && g.image.startsWith('http')
            if (hasRealThumb) return g
            const numKey = String(g.gameId).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
            const img = imagePool[numKey % imagePool.length]
            return { ...g, image: img, portraitImage: img, squareImage: img }
          })
        }

        console.log('[Lucky365] Loaded:', result?.length || 0, '| image pool:', imagePool.length)
        if (result && result.length > 0) setGames(result)
      } catch (e) {
        console.error('[Lucky365] Error:', e)
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

  const closeGame = () => {
    const preBalance = getPreLaunchBalance(ProviderKey.LUCKY365)
    if (preBalance != null) freezeBalance?.(preBalance, 4000)
    setEmbeddedGame(null)
    setShowExitConfirm(false)
    ;(async () => {
      if (user?.accountId) {
        try {
          const result = await exitLucky365Game(user.accountId)
          clearLaunch(ProviderKey.LUCKY365)
          if (result.reconciling) {
            showToast('Cash-out is being processed — refresh in a moment.', 'warning')
          }
        } catch (error) {
          console.error('[Lucky365] Exit error:', error)
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
      notifyTransactionUpdate?.()
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

    const preBalance = Number(user?.balance) || 0
    freezeBalance?.(preBalance, 5000)

    sweepAllReturns(updateBalance).catch(() => {})
    recordLaunch(ProviderKey.LUCKY365, user?.accountId, { preLaunchBalance: preBalance })

    const mainBalance = Number(user?.balance) || 0
    const amount = Math.min(DEFAULT_LAUNCH_AMOUNT, Math.floor(mainBalance))

    try {
      const result = await launchLucky365Game(game, user?.accountId, {
        amount: amount > 0 ? amount : undefined,
      })
      if (result.success && result.gameUrl) {
        setEmbeddedGame({ url: result.gameUrl, name: game.name })
        showToast(`${game.name} launched!`, 'success')
      } else {
        clearLaunch(ProviderKey.LUCKY365)
        if (result.code === 'F6006') {
          showToast('Insufficient balance. Top up to play.', 'error')
        } else if (result.code === 'F7502') {
          showToast('Your Lucky365 account is blocked — contact support.', 'error')
        } else if (result.code === 'F7501') {
          showToast('Account error — contact support.', 'error')
        } else if (result.state === 'DEPOSIT_FAILED') {
          showToast(result.error || 'Deposit failed — try again.', 'error')
        } else {
          showToast(result.error || 'Lucky365 temporarily unavailable.', 'error')
        }
      }
    } catch (error) {
      console.error('[Lucky365 Launch] error:', error)
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
          <span>Telegram: @Team33 | Lucky365 (Transfer Wallet)</span>
        </div>
      </div>

      <div className="slot-content">
        <div className="provider-header">
          <img src={lucky365Logo} alt="Lucky365" className="provider-logo" />
        </div>

        <ProviderTabs active="lucky365" />

        <div className="games-count">
          {filteredGames.length} Lucky365 games available
        </div>

        {!loading && games.length > 0 && bar}

        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="slot-games-layout">
            {filteredGames.length > 0 ? (
              <div className="game-category-section lucky365-section">
                <h2 className="category-title">
                  <span className="category-icon">🎯</span>
                  Lucky365 Games
                  <span className="category-count">({filteredGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {filteredGames.map(renderGameCard)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No Lucky365 games available right now.</p>
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
