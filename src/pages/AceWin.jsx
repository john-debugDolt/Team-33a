import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllAceWinGames, exitAceWinGame, launchAceWinGame } from '../services/acewinTransferService'
import { getAllJDBGames } from '../services/jdbTransferService'
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
import acewinLogo from '../images/acewinlogo.jpg'

// Synthetic lobby tile used when the upstream catalogue is unavailable.
// gameId=1 is the AceWin lobby — players can still play.
const LOBBY_FALLBACK = {
  id: 'acewin-lobby',
  gameId: 1,
  slug: 'acewin-lobby',
  name: 'AceWin Lobby',
  provider: 'AceWin',
  image: acewinLogo,
  portraitImage: acewinLogo,
  squareImage: acewinLogo,
  category: 'lobby',
  isAceWin: true,
  providerType: 'transfer',
}

// MYR to transfer into AceWin on launch. Backend caps at 100k. We pick a
// modest default; could be wired to a deposit modal later.
const DEFAULT_LAUNCH_AMOUNT = 100

export default function AceWin() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const { bar, filteredGames } = useCategoryAndSort(games)

  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      try {
        // AceWin's catalogue ships no thumbnails. Borrow images from JDB
        // (which has hundreds of real game images) and assign them
        // deterministically by GameId so each AceWin game keeps the same
        // image across renders.
        const [acewinGames, jdbGames] = await Promise.all([
          getAllAceWinGames(acewinLogo),
          getAllJDBGames().catch(() => []),
        ])

        const imagePool = (jdbGames || [])
          .map(g => g.image)
          .filter(src => src && src !== '/placeholder-game.png')

        let result = acewinGames
        if (result && result.length > 0 && imagePool.length > 0) {
          result = result.map(g => {
            const idx = Math.abs(Number(g.gameId) || 0) % imagePool.length
            const img = imagePool[idx]
            return { ...g, image: img, portraitImage: img, squareImage: img }
          })
        }

        console.log('[AceWin] Loaded:', result?.length || 0, '| image pool:', imagePool.length)

        if (result && result.length > 0) {
          setGames(result)
        } else {
          // Backend catalogue unavailable — surface a lobby tile so the
          // player can still launch the game directly.
          setGames([LOBBY_FALLBACK])
        }
      } catch (e) {
        console.error('[AceWin] Error:', e)
        setGames([LOBBY_FALLBACK])
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

  // Transfer Wallet: /exit kicks the session & withdraws-all
  const closeGame = async () => {
    if (user?.accountId) {
      try {
        await exitAceWinGame(user.accountId)
      } catch (error) {
        console.error('[AceWin] Exit error:', error)
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

    if (launchingGame === game.id) return

    setLaunchingGame(game.id)
    showToast(`Launching ${game.name}...`, 'info')

    // Cap the deposit to whatever the player actually has so we don't 6006
    const mainBalance = Number(user?.balance) || 0
    const amount = Math.min(DEFAULT_LAUNCH_AMOUNT, Math.floor(mainBalance))

    try {
      const result = await launchAceWinGame(game, user?.accountId, {
        amount: amount > 0 ? amount : undefined,
      })
      if (result.success && result.gameUrl) {
        setEmbeddedGame({ url: result.gameUrl, name: game.name })
        showToast(`${game.name} launched!`, 'success')
      } else {
        if (result.errorCode === 6006) {
          showToast('Insufficient balance. Top up to play.', 'error')
        } else if (result.errorCode === 17) {
          showToast('Your AceWin account is suspended.', 'error')
        } else {
          showToast(result.error || 'AceWin is temporarily unavailable.', 'error')
        }
      }
    } catch (error) {
      console.error('[AceWin Launch] error:', error)
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
          <span>Telegram: @Team33 | AceWin Games (Transfer Wallet)</span>
        </div>
      </div>

      <div className="slot-content">
        <div className="provider-header">
          <img src={acewinLogo} alt="AceWin" className="provider-logo" />
        </div>

        <ProviderTabs active="acewin" />

        <div className="games-count">
          {filteredGames.length} AceWin games available
        </div>

        {!loading && games.length > 0 && bar}

        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="slot-games-layout">
            {filteredGames.length > 0 ? (
              <div className="game-category-section acewin-section">
                <h2 className="category-title">
                  <span className="category-icon">🎯</span>
                  AceWin Games
                  <span className="category-count">({filteredGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {filteredGames.map(renderGameCard)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No AceWin games available right now.</p>
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
