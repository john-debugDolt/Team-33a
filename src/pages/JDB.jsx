import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllJDBGames, exitJDBGame, launchJDBGame } from '../services/jdbTransferService'
import { getCountry } from '../services/geoIpService'
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

export default function JDB() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  // VPN warning gating — JDB is geo-restricted to AU. Non-AU IPs see a
  // popup before launch so they can connect a VPN or cancel.
  const [pendingVpnGame, setPendingVpnGame] = useState(null)
  const [detectedCountry, setDetectedCountry] = useState(null)

  const { bar, filteredGames } = useCategoryAndSort(games, { labels: { '0': 'Slots', '7': 'Fishing', '9': 'Arcade', '12': 'Bingo', '18': 'Card', '50': 'Lottery', '140': 'eSports', '141': 'New Slots', '142': 'New Fishing', '200': 'Crash', '201': 'Mini' } })

  useEffect(() => {
    const loadGames = async () => {
      setLoading(true)
      try {
        const result = await getAllJDBGames()
        console.log('[JDB] Loaded:', result?.length || 0)
        if (result && result.length > 0) {
          setGames(result)
        }
      } catch (e) {
        console.error('[JDB] Error:', e)
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

  // Transfer Wallet: Call exit to return funds
  const closeGame = async () => {
    // For Transfer Wallet providers, call exit to return funds
    if (user?.accountId) {
      try {
        console.log('[JDB] Calling exit on game close...')
        await exitJDBGame(user.accountId)
      } catch (error) {
        console.error('[JDB] Exit error:', error)
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

  // The actual JDB launch — same retry loop as before, just split out so
  // the VPN-warning popup can gate it.
  const performJDBLaunch = async (game) => {
    setLaunchingGame(game.id)
    showToast(`Launching ${game.name}...`, 'info')

    const maxRetries = 15
    let attempt = 0
    let success = false

    while (attempt < maxRetries && !success) {
      attempt++
      try {
        const result = await launchJDBGame(game, user?.accountId)
        if (result.success && result.gameUrl) {
          setEmbeddedGame({ url: result.gameUrl, name: game.name })
          showToast(`${game.name} launched!`, 'success')
          success = true
        } else {
          console.log(`[Game Launch] Attempt ${attempt} failed:`, result.error)
          if (['6006', '7501', '7502', '8003'].includes(result.status)) {
            showToast(result.error || 'Cannot launch game', 'error')
            break
          }
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

  const handlePlayNow = async (game, e) => {
    if (e) e.stopPropagation()

    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      navigate('/login')
      return
    }
    if (launchingGame === game.id) return

    // Geo-check: JDB games are restricted to AU. Non-AU IPs must confirm
    // they're on a VPN (or cancel).
    const country = await getCountry()
    setDetectedCountry(country)
    if (country && country !== 'AU') {
      setPendingVpnGame(game)
      return
    }
    // AU or unknown — launch directly
    performJDBLaunch(game)
  }

  const confirmVpnAndLaunch = () => {
    const game = pendingVpnGame
    setPendingVpnGame(null)
    if (game) performJDBLaunch(game)
  }

  const cancelVpnLaunch = () => {
    setPendingVpnGame(null)
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
          <span>Telegram: @Team33 | JDB Games (Transfer Wallet)</span>
        </div>
      </div>

      <div className="slot-content">
        <div className="provider-header">
          <img
            src="https://imgs.search.brave.com/YduaC2JMbt9I_sC0tnmPzrYxRj4IT9J-OQvBmWd_wlc/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9hc3Nl/dHMuc2xvdHNsYXVu/Y2guY29tLzMwNzI4/L0lzWGYzcWZFYjM4/VkcwYjVwb0JpWXpy/VFIyZmpjNS1tZXRh/U2tSQ1gweHZaMjlm/TXpBd2VETXdNQzVx/Y0djPS0uanBn"
            alt="JDB"
            className="provider-logo"
          />
        </div>

        <ProviderTabs active="jdb" />

        <div className="games-count">
          {filteredGames.length} JDB games available
        </div>

        {!loading && games.length > 0 && bar}

        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="slot-games-layout">
            {filteredGames.length > 0 ? (
              <div className="game-category-section jdb-section">
                <h2 className="category-title">
                  <span className="category-icon">🎯</span>
                  JDB Games
                  <span className="category-count">({filteredGames.length})</span>
                </h2>
                <div className="slot-games-grid">
                  {filteredGames.map(renderGameCard)}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No JDB games available</p>
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

      {pendingVpnGame && (
        <div className="exit-confirm-overlay" onClick={cancelVpnLaunch}>
          <div className="exit-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="exit-confirm-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M12 9v4M12 17h.01"/>
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
            </div>
            <h3>VPN Required</h3>
            <p>JDB games are restricted to Australia.</p>
            <p style={{ fontSize: '13px', color: '#666', marginTop: '8px' }}>
              Your IP appears to be from <strong>{detectedCountry || 'outside Australia'}</strong>. Please connect to a VPN with an Australian IP to play.
            </p>
            <div className="exit-confirm-buttons">
              <button className="exit-btn-no" onClick={cancelVpnLaunch}>Cancel</button>
              <button className="exit-btn-yes" onClick={confirmVpnAndLaunch}>I'm on a VPN — Continue</button>
            </div>
          </div>
        </div>
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
                    <p style={{fontSize: '12px', color: '#888', marginTop: '8px'}}>Your balance will be transferred back to your main wallet.</p>
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
