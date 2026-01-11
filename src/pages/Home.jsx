import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameService } from '../services/gameService'
import { apiClient } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/TranslationContext'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import Pagination from '../components/Pagination/Pagination'
import GameDetailModal from '../components/GameDetailModal/GameDetailModal'
import defaultBanner1 from '../images/New banner.png'
import defaultBanner2 from '../images/New banner 2.png'
import defaultBanner3 from '../images/New banner 3.png'
import belowBanner from '../images/new r banner.png'

const defaultBanners = [
  { id: 'default1', image: defaultBanner1, name: 'Banner 1', link: '' },
  { id: 'default2', image: defaultBanner2, name: 'Banner 2', link: '' },
  { id: 'default3', image: defaultBanner3, name: 'Banner 3', link: '' }
]
const BANNER_DURATION = 5000 // 5 seconds per banner

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

export default function Home() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null) // { url, name }
  const [showExitConfirm, setShowExitConfirm] = useState(false)

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

  // Fetch games
  const fetchGames = async () => {
    setLoading(true)
    const result = await gameService.getGames({
      page: pagination.page,
      limit: 20,
      gameType: 'all'
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
  }, [pagination.page])

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    // Scroll to games section without visible animation
    window.scrollTo({ top: 350, behavior: 'instant' })
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

  // Handle play now button click
  const handlePlayNow = async (game, e) => {
    if (e) e.stopPropagation()

    if (!isAuthenticated) {
      showToast(t('pleaseLoginToPlay'), 'warning')
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

      {/* Games Count */}
      {!loading && (
        <div className="games-count">
          {t('showingGames', { count: games.length, total: pagination.total })}
        </div>
      )}

      {/* Game Grid */}
      {loading ? (
        <div className="loading-wrapper">
          <LoadingSpinner text={t('loadingGames')} />
        </div>
      ) : games.length === 0 ? (
        <div className="empty-games">
          <span className="empty-icon">🎮</span>
          <h3>{t('noGames')}</h3>
          <p>{t('tryAgainLater')}</p>
        </div>
      ) : (
        <div className="game-grid">
          {games.map((game) => (
            <div key={game.id} className="game-card" onClick={() => setSelectedGame(game)}>
              <div className="game-image-wrapper">
                <LazyImage src={game.image} alt={game.name} className="game-image" />
                {game.isHot && <span className="game-badge hot">{t('hot')}</span>}
                {game.isNew && <span className="game-badge new">{t('new')}</span>}
                <div className="game-overlay">
                  <button
                    className={`play-btn ${launchingGame === game.id ? 'loading' : ''}`}
                    onClick={(e) => handlePlayNow(game, e)}
                    disabled={launchingGame === game.id}
                  >
                    {launchingGame === game.id ? t('launching') : t('playNow')}
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
                  Deposit
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
    </>
  )
}
