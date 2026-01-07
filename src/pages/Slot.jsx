import { useState, useEffect, useCallback } from 'react'
import { gameService } from '../services/gameService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import GameDetailModal from '../components/GameDetailModal/GameDetailModal'
import Pagination from '../components/Pagination/Pagination'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import './Slot.css'

const providers = [
  { id: 'ALL', name: 'ALL' },
  { id: 'RG', name: 'RG' },
  { id: 'PLAYSTAR', name: 'PLAYSTAR' },
  { id: 'BNG', name: 'BNG' },
  { id: 'REEVO', name: 'REEVO' },
  { id: 'JILI', name: 'JILI' },
  { id: 'FACHAI', name: 'FACHAI' },
  { id: 'RICH88', name: 'RICH88' },
  { id: 'BGM', name: 'BGM' },
  { id: 'YGG', name: 'YGG' },
  { id: 'NAGA', name: 'NAGA' },
  { id: 'VPOWER', name: 'VPOWER' },
  { id: 'JDB', name: 'JDB' },
  { id: 'SG', name: 'SG' },
]

const tabs = [
  { id: 'all', label: 'All Games', icon: '🎰' },
  { id: 'hot', label: 'Hot Games', icon: '🔥' },
  { id: 'new', label: 'New Games', icon: null, badge: 'NEW' },
]

export default function Slot() {
  const { isAuthenticated } = useAuth()
  const { showToast } = useToast()

  const [games, setGames] = useState([])
  const [featuredGame, setFeaturedGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeProvider, setActiveProvider] = useState('ALL')
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedGame, setSelectedGame] = useState(null)
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
  }, [activeProvider, activeTab, debouncedSearch])

  const fetchGames = useCallback(async () => {
    setLoading(true)

    const params = {
      page: pagination.page,
      limit: 35,
      gameType: 'slot',
    }

    if (activeProvider !== 'ALL') {
      params.provider = activeProvider
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
  }, [pagination.page, activeProvider, activeTab, debouncedSearch])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  const handleGameClick = (game) => {
    setSelectedGame(game)
  }

  const handlePlayNow = (game, e) => {
    e.stopPropagation()
    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      return
    }
    showToast(`Launching ${game.name}...`, 'info')
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

        {/* Provider Chips */}
        <div className="slot-providers">
          {providers.map((provider) => (
            <button
              key={provider.id}
              className={`slot-provider-chip ${activeProvider === provider.id ? 'active' : ''}`}
              onClick={() => setActiveProvider(provider.id)}
            >
              <span className="chip-label">{provider.name}</span>
            </button>
          ))}
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
            {/* Games Grid */}
            <div className="slot-games-layout">
              {/* Featured Game */}
              {featuredGame && (
                <div className="featured-game" onClick={() => handleGameClick(featuredGame)}>
                  <div className="featured-game-inner">
                    <img src={featuredGame.image} alt={featuredGame.name} />
                    <div className="featured-overlay">
                      <h3>{featuredGame.name}</h3>
                      <button className="play-btn" onClick={(e) => handlePlayNow(featuredGame, e)}>
                        Play Now
                      </button>
                    </div>
                    <div className="game-badges">
                      {featuredGame.isHot && <span className="game-badge hot">HOT</span>}
                      {featuredGame.isNew && <span className="game-badge new">NEW</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Regular Games Grid */}
              <div className="slot-games-grid">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="slot-game-card"
                    onClick={() => handleGameClick(game)}
                  >
                    <div className="game-image-wrapper">
                      <img src={game.image} alt={game.name} className="game-image" />
                      <div className="game-overlay">
                        <button className="play-btn" onClick={(e) => handlePlayNow(game, e)}>
                          Play Now
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
        />
      )}
    </div>
  )
}
