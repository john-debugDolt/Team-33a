import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameService } from '../services/gameService'
import { apiClient } from '../services/api'
import { walletService } from '../services/walletService'
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

// Lazy loading image component - keeps retrying until image loads
function LazyImage({ src, alt, className }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef(null)
  const retryTimeoutRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px', threshold: 0.1 }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      observer.disconnect()
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false)
    setRetryCount(0)
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }
  }, [src])

  const handleError = () => {
    // Keep retrying with increasing delays: 2s, 3s, 4s, 5s, then cap at 5s
    const delay = Math.min(2000 + (retryCount * 1000), 5000)
    retryTimeoutRef.current = setTimeout(() => {
      setRetryCount(prev => prev + 1)
    }, delay)
  }

  // Generate image URL with cache-busting on retry
  const getImageSrc = () => {
    if (!src || src === 'undefined' || src === 'null') return '/placeholder-game.png'
    if (retryCount > 0) {
      return `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`
    }
    return src
  }

  return (
    <div ref={imgRef} className={`lazy-image-container ${isLoaded ? 'loaded' : ''}`}>
      {isInView ? (
        <img
          key={retryCount} // Force remount on retry
          src={getImageSrc()}
          alt={alt}
          className={className}
          onLoad={() => setIsLoaded(true)}
          onError={handleError}
          style={{ opacity: isLoaded ? 1 : 0 }}
        />
      ) : (
        <div className="image-placeholder" />
      )}
      {!isLoaded && isInView && <div className="image-loader" />}
    </div>
  )
}

// Game categories
const GAME_CATEGORIES = [
  { id: 'all', name: 'All Games', icon: '🎮' },
  { id: 'slots', name: 'Slots', icon: '🎰' },
  { id: 'table', name: 'Table Games', icon: '🃏' },
  { id: 'live', name: 'Live Casino', icon: '🎲' },
  { id: 'fishing', name: 'Fishing', icon: '🐟' },
  { id: 'crash', name: 'Crash', icon: '📈' }
]

export default function Home() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [games, setGames] = useState([])
  const [allGames, setAllGames] = useState([]) // Store all games for filtering
  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null) // { url, name }
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Banner state
  const [banners, setBanners] = useState(defaultBanners)
  const [currentBanner, setCurrentBanner] = useState(0)

  // Promotional popup state
  const [showPromoPopup, setShowPromoPopup] = useState(false)
  const [featuredGames, setFeaturedGames] = useState([])

  // Live transactions state
  const [liveTransactions, setLiveTransactions] = useState([])

  // New feature states
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [favorites, setFavorites] = useState([])
  const [recentlyPlayed, setRecentlyPlayed] = useState([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardData, setLeaderboardData] = useState([])
  const [testimonials] = useState([
    { id: 1, name: 'Alex K.', avatar: 'A', date: '2 days ago', stars: 5, text: 'Amazing platform! Won $500 on my first day. The games are fair and withdrawals are super fast.' },
    { id: 2, name: 'Sarah M.', avatar: 'S', date: '1 week ago', stars: 5, text: 'Best online casino I\'ve ever played. Customer support is available 24/7 and very helpful.' },
    { id: 3, name: 'Wei Z.', avatar: 'W', date: '3 days ago', stars: 4, text: 'Great variety of games. Love the daily spin wheel - won $50 yesterday!' },
    { id: 4, name: 'John D.', avatar: 'J', date: '5 days ago', stars: 5, text: 'Secure and trustworthy. Been playing for months without any issues. Highly recommend!' },
    { id: 5, name: 'Maria L.', avatar: 'M', date: '1 week ago', stars: 5, text: 'The VIP program is excellent. Great bonuses and exclusive promotions for loyal players.' }
  ])

  // Fetch banners on mount (skip if endpoint doesn't exist)
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const result = await apiClient.get('/banners')
        if (result.success && result.data?.banners?.length > 0) {
          setBanners(result.data.banners)
        }
      } catch (err) {
        // Banners API may not exist - silently ignore
      }
    }
    // Disabled - banners endpoint not available
    // fetchBanners()
  }, [])

  // Sync balance when game closes and listen for game messages
  useEffect(() => {
    // Function to sync balance from backend
    const syncBalance = async () => {
      if (user?.accountId) {
        try {
          const result = await walletService.getBalance(user.accountId)
          if (result.success && result.balance !== undefined) {
            // Update user balance in context if available
            if (typeof updateBalance === 'function') {
              updateBalance(result.balance)
            }
            // Also update localStorage
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

    // Sync balance when game closes
    if (!embeddedGame && user?.accountId) {
      syncBalance()
    }

    // Listen for messages from game iframe (balance updates, game results)
    const handleGameMessage = (event) => {
      // Validate origin if needed
      const data = event.data

      if (data?.type === 'BALANCE_UPDATE' && data.balance !== undefined) {
        // Update balance from game iframe message
        walletService.updateBalance(data.balance, user?.accountId)
        if (typeof updateBalance === 'function') {
          updateBalance(data.balance)
        }
      }

      if (data?.type === 'GAME_WIN' || data?.type === 'GAME_LOSS') {
        // Record game transaction
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
        // Game requested exit, sync balance and close
        syncBalance()
        setEmbeddedGame(null)
        notifyTransactionUpdate() // Refresh transaction history
      }
    }

    window.addEventListener('message', handleGameMessage)
    return () => window.removeEventListener('message', handleGameMessage)
  }, [embeddedGame, user?.accountId, notifyTransactionUpdate])

  // Show promo popup on first visit (once per session)
  useEffect(() => {
    const hasSeenPromo = sessionStorage.getItem('hasSeenPromo')
    if (!hasSeenPromo && games.length > 0) {
      // Get top/featured games (hot or new games)
      const topGames = games.filter(g => g.isHot || g.isNew).slice(0, 6)
      if (topGames.length < 6) {
        // Fill with regular games if not enough featured
        const remaining = games.filter(g => !g.isHot && !g.isNew).slice(0, 6 - topGames.length)
        topGames.push(...remaining)
      }
      setFeaturedGames(topGames)
      // Delay popup to let page load
      const timer = setTimeout(() => {
        setShowPromoPopup(true)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [games])

  // Generate live transactions
  useEffect(() => {
    // Diverse names from around the world
    const userNames = [
      // Australia & New Zealand
      'Liam M***', 'Charlotte W***', 'Oliver T***', 'Amelia B***', 'Jack S***',
      // USA & Canada
      'Mason J***', 'Sophia R***', 'Ethan C***', 'Isabella H***', 'Noah P***',
      // UK & Ireland
      'George K***', 'Olivia D***', 'Harry M***', 'Isla F***', 'Oscar L***',
      // Germany & Austria
      'Felix S***', 'Mia W***', 'Leon M***', 'Emma B***', 'Paul K***',
      // France & Belgium
      'Lucas D***', 'Jade M***', 'Hugo L***', 'Léa P***', 'Nathan B***',
      // Spain & Latin America
      'Mateo G***', 'Sofía R***', 'Diego M***', 'Valentina L***', 'Santiago C***',
      // Italy
      'Leonardo R***', 'Aurora B***', 'Francesco M***', 'Giulia V***', 'Alessandro P***',
      // Netherlands & Belgium
      'Daan V***', 'Emma D***', 'Sem B***', 'Julia K***', 'Lucas M***',
      // Sweden & Norway
      'William A***', 'Ella L***', 'Oscar N***', 'Maja S***', 'Filip J***',
      // Poland & Eastern Europe
      'Jakub K***', 'Zuzanna W***', 'Antoni N***', 'Lena M***', 'Szymon P***',
      // Russia & Ukraine
      'Artem S***', 'Sofia K***', 'Maxim P***', 'Anastasia V***', 'Ivan M***',
      // Japan
      'Haruto T***', 'Yui S***', 'Sota N***', 'Hina K***', 'Riku M***',
      // South Korea
      'Minjun K***', 'Seo-yeon P***', 'Jiwon L***', 'Yuna C***', 'Hyun J***',
      // China
      'Wei L***', 'Xiao M***', 'Chen W***', 'Mei Z***', 'Jun L***',
      // India
      'Aarav S***', 'Aanya P***', 'Vihaan R***', 'Saanvi K***', 'Arjun M***',
      // Brazil
      'Miguel S***', 'Helena O***', 'Arthur C***', 'Alice F***', 'Bernardo R***',
      // Middle East
      'Omar A***', 'Fatima H***', 'Yusuf K***', 'Layla M***', 'Ahmed S***',
      // Southeast Asia
      'Rizky P***', 'Putri W***', 'Thanh N***', 'Mai T***', 'Arif R***',
      // Africa
      'Kwame A***', 'Amara O***', 'Chidi N***', 'Zara M***', 'Kofi B***'
    ]

    const generateTransaction = () => {
      if (games.length === 0) return null
      const game = games[Math.floor(Math.random() * games.length)]
      const amount = (Math.random() * 500 + 10).toFixed(2)
      const user = userNames[Math.floor(Math.random() * userNames.length)]
      return {
        id: Date.now() + Math.random(),
        user,
        game: game.name,
        gameImage: game.image,
        amount,
        timestamp: new Date()
      }
    }

    // Initialize with some transactions
    if (games.length > 0 && liveTransactions.length === 0) {
      const initial = []
      for (let i = 0; i < 5; i++) {
        const txn = generateTransaction()
        if (txn) initial.push(txn)
      }
      setLiveTransactions(initial)
    }

    // Add new transaction every 6-10 seconds (slower)
    const interval = setInterval(() => {
      const newTxn = generateTransaction()
      if (newTxn) {
        setLiveTransactions(prev => [newTxn, ...prev.slice(0, 9)])
      }
    }, 6000 + Math.random() * 4000)

    return () => clearInterval(interval)
  }, [games])

  // Load favorites and recently played from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favorites')
    const savedRecent = localStorage.getItem('recentlyPlayed')
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites))
    if (savedRecent) setRecentlyPlayed(JSON.parse(savedRecent))

  }, [])


  // Generate leaderboard data
  useEffect(() => {
    const generateLeaderboard = () => {
      const names = [
        'Alex K***', 'Sarah M***', 'John D***', 'Maria L***', 'Wei Z***',
        'Arjun P***', 'Yuki T***', 'Mohammed A***', 'Emma W***', 'Lucas R***'
      ]
      return names.map((name, index) => ({
        rank: index + 1,
        name,
        winnings: Math.floor((10 - index) * 5000 + Math.random() * 3000),
        gamesPlayed: Math.floor(50 + Math.random() * 200)
      }))
    }
    setLeaderboardData(generateLeaderboard())
  }, [])

  // Filter games by category and search
  useEffect(() => {
    let filtered = allGames

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(game => {
        const gameName = game.name.toLowerCase()
        const gameType = (game.gameType || '').toLowerCase()

        switch (activeCategory) {
          case 'slots':
            return gameType.includes('slot') || gameName.includes('slot')
          case 'table':
            return gameType.includes('table') || gameName.includes('poker') ||
                   gameName.includes('blackjack') || gameName.includes('roulette') ||
                   gameName.includes('baccarat')
          case 'live':
            return gameType.includes('live') || gameName.includes('live')
          case 'fishing':
            return gameType.includes('fish') || gameName.includes('fish')
          case 'crash':
            return gameType.includes('crash') || gameName.includes('crash') ||
                   gameName.includes('aviator')
          default:
            return true
        }
      })
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(game =>
        game.name.toLowerCase().includes(query)
      )
    }

    setGames(filtered)
  }, [allGames, activeCategory, searchQuery])

  // Toggle favorite
  const toggleFavorite = (gameId) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(gameId)
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
      localStorage.setItem('favorites', JSON.stringify(newFavorites))
      return newFavorites
    })
  }

  // Add to recently played
  const addToRecentlyPlayed = (game) => {
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(g => g.id !== game.id)
      const updated = [game, ...filtered].slice(0, 10)
      localStorage.setItem('recentlyPlayed', JSON.stringify(updated))
      return updated
    })
  }

  // Fetch games
  const fetchGames = async () => {
    setLoading(true)
    const result = await gameService.getGames({
      page: pagination.page,
      limit: 50,
      gameType: 'all'
    })

    if (result.success) {
      setAllGames(result.data.games)
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
        addToRecentlyPlayed(game)
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

      {/* Live Transactions */}
      {liveTransactions.length > 0 && (
        <div className="live-transactions-section">
          <div className="live-transactions-header">
            <div className="live-indicator">
              <span className="live-dot"></span>
              <span>LIVE WINS</span>
            </div>
          </div>
          <div className="live-transactions-list">
            {liveTransactions.slice(0, 5).map((txn, index) => (
              <div key={txn.id} className="live-transaction-item" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="txn-game-image">
                  <img src={txn.gameImage} alt={txn.game} />
                </div>
                <div className="txn-details">
                  <span className="txn-user">{txn.user}</span>
                  <span className="txn-game">{txn.game}</span>
                </div>
                <div className="txn-amount">
                  <span className="txn-won">Won</span>
                  <span className="txn-value">${txn.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Categories */}
      <div className="games-toolbar">
        <div className="search-container">
          <button
            className={`search-toggle ${showSearch ? 'active' : ''}`}
            onClick={() => setShowSearch(!showSearch)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          {showSearch && (
            <input
              type="text"
              className="search-input"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          )}
        </div>

        <div className="category-tabs">
          {GAME_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="cat-icon">{cat.icon}</span>
              <span className="cat-name">{cat.name}</span>
            </button>
          ))}
        </div>

        <button
          className="leaderboard-btn"
          onClick={() => setShowLeaderboard(true)}
          title="Leaderboard"
        >
          🏆
        </button>
      </div>

      {/* Recently Played Section */}
      {recentlyPlayed.length > 0 && (
        <div className="recent-section">
          <h3 className="section-title-home">
            <span className="title-icon">🕐</span>
            Recently Played
          </h3>
          <div className="recent-games-scroll">
            {recentlyPlayed.map(game => (
              <div
                key={game.id}
                className="recent-game-card"
                onClick={() => handlePlayNow(game)}
              >
                <img src={game.image} alt={game.name} />
                <span className="recent-game-name">{game.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favorites Section */}
      {favorites.length > 0 && allGames.length > 0 && (
        <div className="favorites-section">
          <h3 className="section-title-home">
            <span className="title-icon">❤️</span>
            My Favorites
          </h3>
          <div className="favorites-games-scroll">
            {allGames.filter(g => favorites.includes(g.id)).map(game => (
              <div
                key={game.id}
                className="favorite-game-card"
                onClick={() => handlePlayNow(game)}
              >
                <img src={game.image} alt={game.name} />
                <span className="favorite-game-name">{game.name}</span>
                <button
                  className="remove-favorite"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(game.id)
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Games Count */}
      {!loading && (
        <div className="games-count">
          {searchQuery ? `Found ${games.length} games` : t('showingGames', { count: games.length, total: pagination.total })}
        </div>
      )}

      {/* Game Grid */}
      {loading ? (
        <div className="loading-skeleton-grid">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-image" />
              <div className="skeleton-text" />
            </div>
          ))}
        </div>
      ) : games.length === 0 && (searchQuery || activeCategory !== 'all') ? (
        <div className="no-games-found">
          <span className="empty-icon">🔍</span>
          <h3>No games found</h3>
          <p>Try adjusting your search or filters</p>
          <button
            className="clear-filters-btn"
            onClick={() => {
              setSearchQuery('')
              setActiveCategory('all')
            }}
          >
            Clear Filters
          </button>
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
                <button
                  className={`favorite-btn ${favorites.includes(game.id) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(game.id)
                  }}
                  title={favorites.includes(game.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {favorites.includes(game.id) ? '❤️' : '🤍'}
                </button>
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

      {/* Promotional Popup */}
      {showPromoPopup && featuredGames.length > 0 && (
        <div className="promo-popup-overlay" onClick={() => {
          setShowPromoPopup(false)
          sessionStorage.setItem('hasSeenPromo', 'true')
        }}>
          <div className="promo-popup" onClick={(e) => e.stopPropagation()}>
            <button
              className="promo-popup-close"
              onClick={() => {
                setShowPromoPopup(false)
                sessionStorage.setItem('hasSeenPromo', 'true')
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>

            <div className="promo-popup-header">
              <div className="promo-popup-badge">HOT</div>
              <h2>Top Games to Play</h2>
              <p>Check out our most popular games!</p>
            </div>

            <div className="promo-popup-games">
              {featuredGames.map((game) => (
                <div
                  key={game.id}
                  className="promo-game-card"
                  onClick={() => {
                    setShowPromoPopup(false)
                    sessionStorage.setItem('hasSeenPromo', 'true')
                    handlePlayNow(game)
                  }}
                >
                  <div className="promo-game-image">
                    <img src={game.image} alt={game.name} />
                    {game.isHot && <span className="promo-badge hot">HOT</span>}
                    {game.isNew && <span className="promo-badge new">NEW</span>}
                    <div className="promo-game-overlay">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                  <span className="promo-game-name">{game.name}</span>
                </div>
              ))}
            </div>

            <button
              className="promo-popup-cta"
              onClick={() => {
                setShowPromoPopup(false)
                sessionStorage.setItem('hasSeenPromo', 'true')
              }}
            >
              Explore All Games
            </button>
          </div>
        </div>
      )}


      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="leaderboard-overlay" onClick={() => setShowLeaderboard(false)}>
          <div className="leaderboard-modal" onClick={(e) => e.stopPropagation()}>
            <button className="leaderboard-close" onClick={() => setShowLeaderboard(false)}>
              ✕
            </button>

            <div className="leaderboard-header">
              <h2>🏆 Top Winners</h2>
              <p>This week's leaderboard</p>
            </div>

            <div className="leaderboard-list">
              {leaderboardData.map((player, index) => (
                <div key={index} className={`leaderboard-item rank-${index + 1}`}>
                  <div className="leaderboard-rank">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </div>
                  <div className="leaderboard-info">
                    <span className="leaderboard-name">{player.name}</span>
                    <span className="leaderboard-games">{player.gamesPlayed} games</span>
                  </div>
                  <div className="leaderboard-winnings">
                    ${player.winnings.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Testimonials Section */}
      <div className="testimonials-section">
        <div className="testimonials-header">
          <h2>What Players Say</h2>
          <p>Join thousands of satisfied players</p>
        </div>
        <div className="testimonials-scroll">
          {testimonials.map(testimonial => (
            <div key={testimonial.id} className="testimonial-card">
              <div className="testimonial-header">
                <div className="testimonial-avatar">{testimonial.avatar}</div>
                <div className="testimonial-info">
                  <span className="testimonial-name">{testimonial.name}</span>
                  <span className="testimonial-date">{testimonial.date}</span>
                </div>
                <div className="testimonial-stars">
                  {'⭐'.repeat(testimonial.stars)}
                </div>
              </div>
              <p className="testimonial-text">{testimonial.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Animated Background Particles */}
      <div className="bg-particles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${15 + Math.random() * 10}s`
          }} />
        ))}
      </div>
    </>
  )
}
