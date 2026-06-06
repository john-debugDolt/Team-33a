import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllVPowerGames, exitVPowerGame, launchVPowerGame } from '../services/vpowerService'
import { recordLaunch, clearLaunch, sweepAllReturns, ProviderKey } from '../services/launchTracker'
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
import vpowerLogo from '../images/vpowerlogo.jpg'

const DEFAULT_LAUNCH_AMOUNT = 100

export default function VPower() {
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
    labels: { slots: 'Slots', fishing: 'Fishing' },
  })

  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      try {
        const [vpowerGames, jdbGames] = await Promise.all([
          getAllVPowerGames(vpowerLogo),
          getAllJDBGames().catch(() => []),
        ])

        const imagePool = (jdbGames || [])
          .map(g => g.image)
          .filter(src => src && src !== '/placeholder-game.png')

        let result = vpowerGames
        // VPower's live API ships real thumbnails (Image1). Keep those.
        // Only borrow JDB images when the game has no real thumbnail
        // (i.e. the static fallback list, where image is just the VPower logo).
        if (result && result.length > 0 && imagePool.length > 0) {
          result = result.map((g, i) => {
            const hasRealThumb = g.image && g.image.startsWith('http')
            if (hasRealThumb) return g
            const numKey = String(g.gameId || i).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
            const img = imagePool[numKey % imagePool.length]
            return { ...g, image: img, portraitImage: img, squareImage: img }
          })
        }

        console.log('[VPower] Loaded:', result?.length || 0, '| image pool:', imagePool.length)
        if (result && result.length > 0) setGames(result)
      } catch (e) {
        console.error('[VPower] Error:', e)
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
        const result = await exitVPowerGame(user.accountId)
        clearLaunch(ProviderKey.VPOWER)
        // Per VPower spec post 2026-05-30 fix: success:false means funds still at VPower.
        // Reconciler will sweep them; let the user know.
        if (!result.success) {
          showToast('Cash-out is being processed — refresh in a minute.', 'warning')
        }
      } catch (error) {
        console.error('[VPower] Exit error:', error)
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

    await sweepAllReturns(updateBalance)
    recordLaunch(ProviderKey.VPOWER, user?.accountId)

    const mainBalance = Number(user?.balance) || 0
    const amount = Math.min(DEFAULT_LAUNCH_AMOUNT, Math.floor(mainBalance))

    try {
      const result = await launchVPowerGame(game, user?.accountId, {
        amount: amount > 0 ? amount : undefined,
      })
      if (result.success && result.gameUrl) {
        setEmbeddedGame({ url: result.gameUrl, name: game.name })
        showToast(`${game.name} launched!`, 'success')
      } else {
        clearLaunch(ProviderKey.VPOWER)
        if (result.errorCode === '14') {
          showToast('Insufficient balance. Top up to play.', 'error')
        } else if (result.errorCode === '25') {
          showToast('Your account is suspended.', 'error')
        } else if (result.errorCode === '17') {
          showToast('VPower is in maintenance — try again shortly.', 'error')
        } else if (result.errorCode === '4') {
          showToast('VPower temporarily unavailable.', 'error')
        } else {
          showToast(result.error || 'VPower is temporarily unavailable.', 'error')
        }
      }
    } catch (error) {
      console.error('[VPower Launch] error:', error)
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
          <span>Telegram: @Team33 | VPower Gaming (Transfer Wallet)</span>
        </div>
      </div>

      <div className="slot-content">
        <div className="provider-header">
          <img src={vpowerLogo} alt="VPower Gaming" className="provider-logo" />
        </div>

        <ProviderTabs active="vpower" />

        <div className="games-count">
          {filteredGames.length} VPower games available
        </div>

        {!loading && games.length > 0 && bar}

        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="slot-games-layout">
            {filteredGames.length > 0 ? (
              <div className="game-category-section vpower-section">
                <h2 className="category-title">
                  <span className="category-icon">🎯</span>
                  VPower Games
                  <span className="category-count">({filteredGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {filteredGames.map(renderGameCard)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No VPower games available right now.</p>
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
