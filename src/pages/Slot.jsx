import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameService } from '../services/gameService'
import { getAllAdvantPlayGames } from '../services/advantPlayService'
import { getAllUUSlotGames } from '../services/uuSlotService'
import { getAllEvo888h5Games } from '../services/evo888h5Service'
import { walletService } from '../services/walletService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import GameDetailModal from '../components/GameDetailModal/GameDetailModal'
import Pagination from '../components/Pagination/Pagination'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import GameImage, { preloadGameImages } from '../components/GameImage'
import './Slot.css'

// Provider tabs - All Games + each provider
const providerTabs = [
  { id: 'ALL', label: 'All Games', icon: '🎮' },
  { id: 'AdvantPlay', label: 'AdvantPlay', icon: '🎯' },
  { id: 'UUSlot', label: 'UUSlot', icon: '🎰' },
  { id: 'EVO888H5', label: 'EVO888H5', icon: '🌟' },
  { id: 'ClotPlay', label: 'ClotPlay', icon: '🎲' },
]

export default function Slot() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [activeProvider, setActiveProvider] = useState('ALL') // Provider tab
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null) // { url, name }
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  })

  // Sync balance when game closes and listen for game messages
  useEffect(() => {
    const syncBalance = async () => {
      if (user?.accountId) {
        try {
          const result = await walletService.getBalance(user.accountId)
          if (result.success && result.balance !== undefined) {
            if (typeof updateBalance === 'function') {
              updateBalance(result.balance)
            }
            const storedUser = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}')
            if (storedUser.accountId) {
              storedUser.balance = result.balance
              localStorage.setItem('user', JSON.stringify(storedUser))
              if (localStorage.getItem('team33_user')) {
                localStorage.setItem('team33_user', JSON.stringify(storedUser))
              }
            }
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
        walletService.updateBalance(data.balance, user?.accountId)
        if (typeof updateBalance === 'function') {
          updateBalance(data.balance)
        }
      }
      if (data?.type === 'GAME_WIN' || data?.type === 'GAME_LOSS') {
        const isWin = data.type === 'GAME_WIN'
        walletService.recordGameTransaction(
          data.amount || 0,
          data.gameName || embeddedGame?.name || 'Game',
          isWin,
          user?.accountId
        )
        notifyTransactionUpdate() // Refresh transaction history
      }
      if (data?.type === 'GAME_EXIT') {
        syncBalance()
        setEmbeddedGame(null)
        notifyTransactionUpdate() // Refresh transaction history
      }
    }

    window.addEventListener('message', handleGameMessage)
    return () => window.removeEventListener('message', handleGameMessage)
  }, [embeddedGame, user?.accountId, updateBalance, notifyTransactionUpdate])

  // Poll balance from API while game is running (every 10 seconds)
  useEffect(() => {
    if (!embeddedGame || !user?.accountId) return

    const pollBalance = async () => {
      try {
        const result = await walletService.getBalance(user.accountId)
        if (result.success && result.balance !== undefined) {
          // Only update if balance changed
          if (result.balance !== user?.balance) {
            updateBalance(result.balance)
          }
        }
      } catch (error) {
        console.error('Balance poll error:', error)
      }
    }

    // Poll immediately when game starts
    pollBalance()

    // Then poll every 10 seconds
    const interval = setInterval(pollBalance, 10000)

    return () => clearInterval(interval)
  }, [embeddedGame, user?.accountId, user?.balance, updateBalance])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [debouncedSearch, activeProvider])

  // Fetch games from specific provider service
  const fetchProviderGames = async (provider) => {
    switch (provider) {
      case 'AdvantPlay':
        return await getAllAdvantPlayGames()
      case 'UUSlot':
        return await getAllUUSlotGames()
      case 'EVO888H5':
        return await getAllEvo888h5Games()
      case 'ClotPlay':
        // ClotPlay uses gameService
        const result = await gameService.getGames({ page: 1, limit: 1000, gameType: 'all' })
        return result.success ? result.data.games.filter(g => !g.isAdvantPlay && !g.isUUSlot && !g.isEvo888h5) : []
      default:
        return []
    }
  }

  const fetchGames = useCallback(async () => {
    setLoading(true)

    try {
      let allGames = []

      if (activeProvider === 'ALL') {
        // Fetch from all providers in parallel
        const [advantPlay, uuSlot, evo888h5, clotPlay] = await Promise.allSettled([
          getAllAdvantPlayGames(),
          getAllUUSlotGames(),
          getAllEvo888h5Games(),
          gameService.getGames({ page: 1, limit: 1000, gameType: 'all' })
        ])

        // Extract games from each provider
        const advantPlayGames = advantPlay.status === 'fulfilled' ? advantPlay.value : []
        const uuSlotGames = uuSlot.status === 'fulfilled' ? uuSlot.value : []
        const evo888h5Games = evo888h5.status === 'fulfilled' ? evo888h5.value : []
        const clotPlayResult = clotPlay.status === 'fulfilled' ? clotPlay.value : { success: false }
        const clotPlayGames = clotPlayResult.success ? clotPlayResult.data.games.filter(g =>
          !g.isAdvantPlay && !g.isUUSlot && !g.isEvo888h5
        ) : []

        console.log('[Slot] Loaded - AdvantPlay:', advantPlayGames.length, 'UUSlot:', uuSlotGames.length, 'EVO888H5:', evo888h5Games.length, 'ClotPlay:', clotPlayGames.length)

        allGames = [...advantPlayGames, ...uuSlotGames, ...evo888h5Games, ...clotPlayGames]
      } else {
        // Fetch from specific provider only
        allGames = await fetchProviderGames(activeProvider)
        console.log('[Slot] Loaded', activeProvider, ':', allGames.length, 'games')
      }

      // Apply search filter if needed
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase()
        allGames = allGames.filter(g =>
          (g.name || '').toLowerCase().includes(query)
        )
      }

      setGames(allGames)
      setPagination(prev => ({
        ...prev,
        totalPages: 1,
        total: allGames.length,
      }))

      // Preload game images in background
      const imageUrls = allGames.map(game => game.image).filter(Boolean)
      preloadGameImages(imageUrls)
    } catch (error) {
      console.error('[Slot] Error fetching games:', error)
      setGames([])
    }

    setLoading(false)
  }, [debouncedSearch, activeProvider])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  // Auto-refresh games every 30 seconds to catch any updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchGames()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchGames])

  const handleGameClick = (game) => {
    setSelectedGame(game)
  }

  // Close game and sync balance from API
  const closeGame = async () => {
    // Sync balance from API before closing
    if (user?.accountId) {
      try {
        const result = await walletService.getBalance(user.accountId)
        if (result.success && result.balance !== undefined) {
          updateBalance(result.balance)
        }
      } catch (error) {
        console.error('Balance sync error on close:', error)
      }
    }
    setEmbeddedGame(null)
    setShowExitConfirm(false)
    notifyTransactionUpdate()
  }

  const handlePlayNow = async (game, e) => {
    if (e) e.stopPropagation()

    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      navigate('/login')
      return
    }

    // Prevent double clicks
    if (launchingGame === game.id) return

    setLaunchingGame(game.id)
    showToast(`Launching ${game.name}...`, 'info')

    try {
      const result = await gameService.requestGameUrl(game.id, user?.id)

      if (result.success && result.gameUrl) {
        // Show game in embedded iframe
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

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
        {/* Filter Header */}
        <div className="slot-filters-header">
          <div className="slot-tabs">
            {providerTabs.map((tab) => (
              <button
                key={tab.id}
                className={`slot-tab ${activeProvider === tab.id ? 'active' : ''}`}
                onClick={() => setActiveProvider(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="slot-search">
            <input
              type="text"
              placeholder="Search game..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
        </div>

        {/* Games Count */}
        <div className="games-count">
          {pagination.total} games found
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="loading-wrapper">
            <LoadingSpinner />
          </div>
        ) : games.length === 0 ? (
          <div className="empty-state">
            <p>No games found. Try a different search.</p>
          </div>
        ) : (
          <>
            {/* Games Display */}
            <div className="slot-games-layout">
              {(() => {
                // Get provider class name
                const getProviderClass = (game) => {
                  if (game.isAdvantPlay || game.provider === 'AdvantPlay') return 'advantplay-card';
                  if (game.isUUSlot || game.provider === 'UUSlot') return 'uuslot-card';
                  if (game.isEvo888h5 || game.provider === 'EVO888H5') return 'evo888h5-card';
                  return 'clotplay-card';
                };

                // Get provider badge
                const getProviderBadge = (game) => {
                  if (game.isAdvantPlay || game.provider === 'AdvantPlay') {
                    return <span className="provider-badge advantplay">AdvantPlay</span>;
                  }
                  if (game.isUUSlot || game.provider === 'UUSlot') {
                    return <span className="provider-badge uuslot">UUSlot</span>;
                  }
                  if (game.isEvo888h5 || game.provider === 'EVO888H5') {
                    return <span className="provider-badge evo888h5">EVO888H5</span>;
                  }
                  return <span className="provider-badge clotplay">ClotPlay</span>;
                };

                // Helper function to render a game card
                const renderGameCard = (game) => (
                  <div
                    key={game.id}
                    className={`slot-game-card ${getProviderClass(game)}`}
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
                      {(game.isHot || game.isNew) && (
                        <div className="game-badges">
                          {game.isHot && <span className="game-badge hot">HOT</span>}
                          {game.isNew && <span className="game-badge new">NEW</span>}
                        </div>
                      )}
                      {/* Provider badge */}
                      {getProviderBadge(game)}
                    </div>
                    <div className="game-name">{game.name}</div>
                  </div>
                );

                // Get section styling based on active provider
                const getSectionConfig = (provider) => {
                  switch(provider) {
                    case 'AdvantPlay': return { class: 'advantplay-section', icon: '🎯', tag: 'purple', tagText: 'Premium Provider' };
                    case 'UUSlot': return { class: 'uuslot-section', icon: '🎰', tag: 'orange', tagText: 'Hot Provider' };
                    case 'EVO888H5': return { class: 'evo888h5-section', icon: '🌟', tag: 'pink', tagText: 'Star Provider' };
                    case 'ClotPlay': return { class: 'clotplay-section', icon: '🎲', tag: 'emerald', tagText: 'Top Provider' };
                    default: return { class: '', icon: '🎮', tag: 'emerald', tagText: 'All Providers' };
                  }
                };

                // If specific provider selected, show single section
                if (activeProvider !== 'ALL') {
                  const config = getSectionConfig(activeProvider);
                  return (
                    <div className={`game-category-section ${config.class}`}>
                      <h2 className="category-title">
                        <span className="category-icon">{config.icon}</span>
                        {activeProvider} Games
                        <span className="category-count">({games.length})</span>
                        <span className={`provider-tag ${config.tag}`}>{config.tagText}</span>
                      </h2>
                      <div className="slot-games-grid">
                        {games.map(renderGameCard)}
                      </div>
                    </div>
                  );
                }

                // For ALL - group by provider
                const advantPlayGames = games.filter(g => g.isAdvantPlay || g.provider === 'AdvantPlay');
                const uuSlotGames = games.filter(g => g.isUUSlot || g.provider === 'UUSlot');
                const evo888h5Games = games.filter(g => g.isEvo888h5 || g.provider === 'EVO888H5');
                const clotPlayGames = games.filter(g => g.isClotPlay || g.provider === 'ClotPlay');

                return (
                  <>
                    {/* AdvantPlay Games Section */}
                    {advantPlayGames.length > 0 && (
                      <div className="game-category-section advantplay-section">
                        <h2 className="category-title">
                          <span className="category-icon">🎯</span>
                          AdvantPlay Games
                          <span className="category-count">({advantPlayGames.length})</span>
                          <span className="provider-tag purple">Premium Provider</span>
                        </h2>
                        <div className="slot-games-grid">
                          {advantPlayGames.map(renderGameCard)}
                        </div>
                      </div>
                    )}

                    {/* UUSlot Games Section */}
                    {uuSlotGames.length > 0 && (
                      <div className="game-category-section uuslot-section">
                        <h2 className="category-title">
                          <span className="category-icon">🎰</span>
                          UUSlot Games
                          <span className="category-count">({uuSlotGames.length})</span>
                          <span className="provider-tag orange">Hot Provider</span>
                        </h2>
                        <div className="slot-games-grid">
                          {uuSlotGames.map(renderGameCard)}
                        </div>
                      </div>
                    )}

                    {/* EVO888H5 Games Section */}
                    {evo888h5Games.length > 0 && (
                      <div className="game-category-section evo888h5-section">
                        <h2 className="category-title">
                          <span className="category-icon">🌟</span>
                          EVO888H5 Games
                          <span className="category-count">({evo888h5Games.length})</span>
                          <span className="provider-tag pink">Star Provider</span>
                        </h2>
                        <div className="slot-games-grid">
                          {evo888h5Games.map(renderGameCard)}
                        </div>
                      </div>
                    )}

                    {/* ClotPlay Games Section */}
                    {clotPlayGames.length > 0 && (
                      <div className="game-category-section clotplay-section">
                        <h2 className="category-title">
                          <span className="category-icon">🎲</span>
                          ClotPlay Games
                          <span className="category-count">({clotPlayGames.length})</span>
                          <span className="provider-tag emerald">Top Provider</span>
                        </h2>
                        <div className="slot-games-grid">
                          {clotPlayGames.map(renderGameCard)}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
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

            {/* Mobile Floating Exit Button */}
            <button
              className="mobile-exit-btn"
              onClick={() => setShowExitConfirm(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              EXIT GAME
            </button>

            {/* Exit Confirmation Dialog */}
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
                    <button
                      className="exit-btn-yes"
                      onClick={closeGame}
                    >
                      Yes, Exit
                    </button>
                    <button
                      className="exit-btn-no"
                      onClick={() => setShowExitConfirm(false)}
                    >
                      No, Continue Playing
                    </button>
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
