import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameService } from '../services/gameService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CATEGORIES } from '../data/gameData'
import GameDetailModal from '../components/GameDetailModal/GameDetailModal'
import Pagination from '../components/Pagination/Pagination'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import './Slot.css'

const tabs = [
  { id: 'all', label: 'All Games', icon: '🎰' },
  { id: 'hot', label: 'Hot Games', icon: '🔥' },
  { id: 'new', label: 'New Games', icon: null, badge: 'NEW' },
]

// Lazy loading image component
function LazyImage({ src, alt, className }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className={`lazy-image-container ${isLoaded ? 'loaded' : ''}`}>
      {isInView ? (
        <img
          src={src}
          alt={alt}
          className={className}
          onLoad={() => setIsLoaded(true)}
          style={{ opacity: isLoaded ? 1 : 0 }}
        />
      ) : (
        <div className="image-placeholder" />
      )}
      {!isLoaded && isInView && <div className="image-loader" />}
    </div>
  )
}

export default function Slot() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [featuredGame, setFeaturedGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
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
  }, [activeTab, debouncedSearch])

  const fetchGames = useCallback(async () => {
    setLoading(true)

    const params = {
      page: pagination.page,
      limit: 20,
      gameType: 'all',
    }

    if (activeTab === 'hot') {
      params.isHot = true
    } else if (activeTab === 'new') {
      params.isNew = true
    }

    if (debouncedSearch) {
      params.search = debouncedSearch
    }

    const result = await gameService.getGames(params)

    if (result.success) {
      const allGames = result.data.games
      // Set first game as featured if on page 1 and no search
      if (pagination.page === 1 && !debouncedSearch && allGames.length > 0) {
        setFeaturedGame(allGames[0])
        setGames(allGames.slice(1))
      } else {
        setFeaturedGame(null)
        setGames(allGames)
      }
      setPagination(prev => ({
        ...prev,
        totalPages: result.data.totalPages,
        total: result.data.total,
      }))
    }

    setLoading(false)
  }, [pagination.page, activeTab, debouncedSearch])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  const handleGameClick = (game) => {
    setSelectedGame(game)
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
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`slot-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon && <span className="tab-icon">{tab.icon}</span>}
                {tab.badge && <span className="tab-icon new">{tab.badge}</span>}
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
        ) : games.length === 0 && !featuredGame ? (
          <div className="empty-state">
            <p>No games found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            {/* Games by Category */}
            <div className="slot-games-layout">
              {/* Crash Games Section */}
              {(() => {
                const allGames = featuredGame ? [featuredGame, ...games] : games;
                const crashGames = allGames.filter(g => g.category === CATEGORIES.CRASH);
                const slotGames = allGames.filter(g => g.category === CATEGORIES.SLOTS || g.category !== CATEGORIES.CRASH);

                return (
                  <>
                    {crashGames.length > 0 && (
                      <div className="game-category-section">
                        <h2 className="category-title">
                          <span className="category-icon">🚀</span>
                          Crash Games
                          <span className="category-count">({crashGames.length})</span>
                        </h2>
                        <div className="slot-games-grid">
                          {crashGames.map((game) => (
                            <div
                              key={game.id}
                              className="slot-game-card"
                              onClick={() => handleGameClick(game)}
                            >
                              <div className="game-image-wrapper">
                                <LazyImage src={game.image} alt={game.name} className="game-image" />
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
                              </div>
                              <div className="game-name">{game.name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Slot Games Section */}
                    {slotGames.length > 0 && (
                      <div className="game-category-section">
                        <h2 className="category-title">
                          <span className="category-icon">🎰</span>
                          Slot Games
                          <span className="category-count">({slotGames.length})</span>
                        </h2>
                        <div className="slot-games-grid">
                          {slotGames.map((game) => (
                            <div
                              key={game.id}
                              className="slot-game-card"
                              onClick={() => handleGameClick(game)}
                            >
                              <div className="game-image-wrapper">
                                <LazyImage src={game.image} alt={game.name} className="game-image" />
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
                              </div>
                              <div className="game-name">{game.name}</div>
                            </div>
                          ))}
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
                  onClick={() => {
                    setEmbeddedGame(null)
                    setShowExitConfirm(false)
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
                      onClick={() => {
                        setEmbeddedGame(null)
                        setShowExitConfirm(false)
                      }}
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
