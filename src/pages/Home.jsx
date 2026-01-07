import { useState, useEffect } from 'react'
import { gameService } from '../services/gameService'
import { apiClient } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import Pagination from '../components/Pagination/Pagination'
import GameDetailModal from '../components/GameDetailModal/GameDetailModal'
import defaultBanner1 from '../images/New banner.png'
import defaultBanner2 from '../images/New banner 2.png'
import defaultBanner3 from '../images/New banner 3.png'
import belowBanner from '../images/below banner.png'

const defaultBanners = [
  { id: 'default1', image: defaultBanner1, name: 'Banner 1', link: '' },
  { id: 'default2', image: defaultBanner2, name: 'Banner 2', link: '' },
  { id: 'default3', image: defaultBanner3, name: 'Banner 3', link: '' }
]
const BANNER_DURATION = 5000 // 5 seconds per banner

export default function Home() {
  const [games, setGames] = useState([])
  const [providers, setProviders] = useState([{ id: 'ALL', name: 'ALL' }])
  const [loading, setLoading] = useState(true)
  const [activeProvider, setActiveProvider] = useState('ALL')
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [selectedGame, setSelectedGame] = useState(null)

  // Banner state
  const [banners, setBanners] = useState(defaultBanners)
  const [currentBanner, setCurrentBanner] = useState(0)

  // Fetch banners on mount
  useEffect(() => {
    const fetchBanners = async () => {
      const result = await apiClient.get('/banners')
      if (result.success && result.data?.banners?.length > 0) {
        setBanners(result.data.banners)
      }
    }
    fetchBanners()
  }, [])

  // Fetch providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      const result = await gameService.getProviders()
      if (result.success && result.data?.providers) {
        setProviders(result.data.providers)
      }
    }
    fetchProviders()
  }, [])

  // Fetch games
  const fetchGames = async () => {
    setLoading(true)
    const result = await gameService.getGames({
      page: pagination.page,
      limit: 36,
      provider: activeProvider,
      gameType: 'slot'
    })

    if (result.success) {
      setGames(result.data.games)
      setPagination(prev => ({
        ...prev,
        totalPages: result.data.pagination.totalPages,
        total: result.data.pagination.total
      }))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchGames()
  }, [pagination.page, activeProvider])

  const handleProviderChange = (provider) => {
    setActiveProvider(provider)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    window.scrollTo({ top: 400, behavior: 'smooth' })
  }

  const nextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length)
  }
  const prevBanner = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
  }

  // Auto-scroll banners
  useEffect(() => {
    if (banners.length === 0) return
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, BANNER_DURATION)
    return () => clearInterval(interval)
  }, [banners.length])

  return (
    <>
      {/* Banner Carousel */}
      <div className="banner-carousel">
        <button className="carousel-btn prev" onClick={prevBanner}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="banner-wrapper">
          <div
            className="banner-slider"
            style={{ transform: `translateX(-${currentBanner * 100}%)` }}
          >
            {banners.map((banner, idx) => (
              <img key={banner.id || idx} src={banner.image} alt={banner.name || `Banner ${idx + 1}`} className="banner-image" />
            ))}
          </div>
          <div className="banner-progress">
            <div
              key={currentBanner}
              className="banner-progress-bar"
              style={{ animation: `progressFill ${BANNER_DURATION}ms linear` }}
            />
          </div>
        </div>
        <button className="carousel-btn next" onClick={nextBanner}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <div className="carousel-dots">
          {banners.map((banner, idx) => (
            <button
              key={banner.id || idx}
              className={`dot ${idx === currentBanner ? 'active' : ''}`}
              onClick={() => setCurrentBanner(idx)}
            />
          ))}
        </div>
      </div>

      {/* Below Banner */}
      <div className="below-banner">
        <img src={belowBanner} alt="Promo Banner" className="below-banner-image" />
      </div>

      {/* Marquee */}
      <div className="marquee-container">
        <div className="marquee">
          <span className="marquee-icon">📢</span>
          <div className="marquee-text">
            <span className="marquee-scroll">Welcome to team33! If you encounter any problems, please feel free to contact our customer service. Wish you a happy game.</span>
          </div>
        </div>
      </div>

      {/* Provider Filters */}
      <div className="provider-filters">
        {providers.map((provider) => (
          <button
            key={provider.id}
            className={`provider-btn ${activeProvider === provider.id ? 'active' : ''}`}
            onClick={() => handleProviderChange(provider.id)}
          >
            {provider.name}
          </button>
        ))}
      </div>

      {/* Games Count */}
      {!loading && (
        <div className="games-count">
          Showing {games.length} of {pagination.total} games
        </div>
      )}

      {/* Game Grid */}
      {loading ? (
        <div className="loading-wrapper">
          <LoadingSpinner text="Loading games..." />
        </div>
      ) : games.length === 0 ? (
        <div className="empty-games">
          <span className="empty-icon">🎮</span>
          <h3>No games found</h3>
          <p>Try selecting a different provider</p>
        </div>
      ) : (
        <div className="game-grid">
          {games.map((game) => (
            <div key={game.id} className="game-card" onClick={() => setSelectedGame(game)}>
              <div className="game-image-wrapper">
                <img src={game.image} alt={game.name} className="game-image" />
                {game.isHot && <span className="game-badge hot">HOT</span>}
                {game.isNew && <span className="game-badge new">NEW</span>}
                <div className="game-overlay">
                  <button className="play-btn" onClick={(e) => { e.stopPropagation(); setSelectedGame(game); }}>
                    Play Now
                  </button>
                </div>
              </div>
              <div className="game-name">{game.name}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      )}

      {/* Game Detail Modal */}
      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </>
  )
}
