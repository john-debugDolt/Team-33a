import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameService } from '../services/gameService'
import { getAllAdvantPlayGames } from '../services/advantPlayService'
import { getAllUUSlotGames } from '../services/uuSlotService'
import { getAllEvo888h5Games } from '../services/evo888h5Service'
import { getAllMetaGamingGames } from '../services/metaGamingService'
import { getAllWFGamingGames } from '../services/wfGamingService'
import { getAllMegaH5Games } from '../services/megaH5Service'
import { getAllEpicWinGames } from '../services/epicWinService'
import { getAllRichGamingGames } from '../services/richGamingService'
import { getAllRich88Games } from '../services/rich88TransferService'
import { getAllSCR888H5Games } from '../services/scr888h5Service'
import { getAllFunTaGames } from '../services/funtaGamingService'
import { getAllDragoonSoftGames } from '../services/dragoonSoftService'
import { getAllVPowerGames } from '../services/vpowerService'
import { getAllWin8Games } from '../services/win8Service'
import { getAllPegasusGames } from '../services/pegasusService'
import { getAllLucky365Games } from '../services/lucky365Service'
import { apiClient } from '../services/api'
import { walletService } from '../services/walletService'
import { bonusService } from '../services/bonusService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/TranslationContext'
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner'
import Pagination from '../components/Pagination/Pagination'
import GameDetailModal from '../components/GameDetailModal/GameDetailModal'
import GameImage, { preloadGameImages } from '../components/GameImage'
import GamePortal from '../components/GamePortal'
import funtaLogo from '../images/funtagaminglogo.jpg'
import dragoonLogo from '../images/dragoonsoftlogo.jpg'
import vpowerLogo from '../images/vpowerlogo.jpg'
import win8Logo from '../images/win8logo.jpg'
import pegasusLogo from '../images/pegasuslogo.jpg'
import lucky365Logo from '../images/lucky365logo.jpg'
import bannerImg1 from '../images/banner-team33-1.png'
import bannerImg2 from '../images/banner-team33-2.png'
import bannerImg3 from '../images/banner-team33-3.png'
import bannerImg4 from '../images/banner-team33-4.png'
import bannerImg5 from '../images/banner-team33-5.png'
import belowBanner from '../images/new r banner.png'
import './Slot.css' // Import slot section styles
import ProviderTabs from '../components/ProviderTabs/ProviderTabs'
import LiveStripes from '../components/LiveStripes/LiveStripes'
import TopHotStripe from '../components/TopHotStripe/TopHotStripe'
import useAccountType, { isBonusSupported } from '../hooks/useAccountType'

const BANNER_IMAGES = [bannerImg1, bannerImg2, bannerImg3, bannerImg4, bannerImg5]

// Initial slides while bonuses are loading — banner images with no overlay.
const initialBanners = BANNER_IMAGES.map((image, idx) => ({
  id: `init-${idx}`,
  image,
  name: `Banner ${idx + 1}`
}))

const BANNER_DURATION = 5000 // 5 seconds per banner

// Game name prefixes and suffixes for variation
const PREFIXES = ['Lucky', 'Golden', 'Royal', 'Diamond', 'Mega', 'Super', 'Wild', 'Magic', 'Fortune', 'Mystic', 'Thunder', 'Dragon', 'Phoenix', 'Tiger', 'Lion', 'Eagle', 'Jade', 'Crystal', 'Power', 'Ultra']
const SUFFIXES = ['Deluxe', 'Pro', 'Plus', 'X', 'Gold', 'Platinum', 'VIP', 'Max', 'Extreme', 'Premium', 'Elite', 'Classic', 'Turbo', 'Rush', 'Blast', 'Spin', 'Win', 'Fortune', 'Jackpot', 'Bonus']

// Filter chips shown above the games grid.
const CATEGORIES = [
  { id: 'all', label: 'All', icon: '🎮' },
  { id: 'slot', label: 'Slots', icon: '🎰' },
  { id: 'fishing', label: 'Fishing', icon: '🎣' },
  { id: 'crash', label: 'Crash', icon: '🚀' },
  { id: 'card', label: 'Card/Table', icon: '🃏' },
  { id: 'live', label: 'Live', icon: '🎬' },
  { id: 'arcade', label: 'Arcade', icon: '🕹️' },
  { id: 'other', label: 'Other', icon: '✨' },
]

// Normalize each game's upstream category into one of the canonical filter
// buckets above. Mapping derived from live raw-category samples — numeric
// ids ('1','0','141','7','142','200','18','5','9') come from MetaGaming,
// MegaH5, WFGaming, EpicWin and other providers that pass gType-style codes.
const getDisplayCategory = (game) => {
  const raw = (game?.rawCategory ?? game?.category ?? '').toString().toLowerCase().trim()
  if (!raw || raw === '-') return 'other'
  if (raw.includes('slot') || raw === '1' || raw === 'type-1' || raw === '0' || raw === '141') return 'slot'
  if (raw.includes('fish') || raw === '7' || raw === '142') return 'fishing'
  if (raw.includes('crash') || raw === '5' || raw === '200') return 'crash'
  if (raw.includes('card') || raw.includes('table') || raw === '2' || raw === '18') return 'card'
  if (raw.includes('live')) return 'live'
  if (raw.includes('arcade') || raw.includes('mini') || raw === '9') return 'arcade'
  return 'other'
}

// Function to create expanded game list with smart mixing
const expandGames = (games, targetCount, providerPrefix) => {
  if (!games || games.length === 0) return []

  const expanded = []
  const baseGames = [...games]
  let iteration = 0

  while (expanded.length < targetCount) {
    for (const game of baseGames) {
      if (expanded.length >= targetCount) break

      if (iteration === 0) {
        // First iteration - use original games
        expanded.push({ ...game, uniqueId: `${providerPrefix}-${game.id}-0` })
      } else {
        // Create variations with different names
        const prefix = PREFIXES[iteration % PREFIXES.length]
        const suffix = SUFFIXES[Math.floor(iteration / PREFIXES.length) % SUFFIXES.length]
        const nameVariation = iteration % 3 === 0
          ? `${prefix} ${game.name}`
          : iteration % 3 === 1
            ? `${game.name} ${suffix}`
            : `${prefix} ${game.name} ${suffix}`

        expanded.push({
          ...game,
          id: `${game.id}-${iteration}-${expanded.length}`,
          uniqueId: `${providerPrefix}-${game.id}-${iteration}-${expanded.length}`,
          name: nameVariation,
          originalId: game.id // Keep original for actual game launch
        })
      }
    }
    iteration++
  }

  return expanded
}

// Shuffle array for random mixing
const shuffleArray = (array) => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const GAMES_PER_LOAD = 60 // Load 60 games at a time for smooth performance
const TOTAL_DISPLAY_COUNT = 12350 // Total games to show

export default function Home() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()
  const accountType = useAccountType()

  // Separate state for each provider
  const [advantPlayGames, setAdvantPlayGames] = useState([])
  const [uuSlotGames, setUuSlotGames] = useState([])
  const [evo888h5Games, setEvo888h5Games] = useState([])
  const [clotPlayGames, setClotPlayGames] = useState([])
  const [metaGamingGames, setMetaGamingGames] = useState([])
  const [wfGamingGames, setWfGamingGames] = useState([])
  const [megaH5Games, setMegaH5Games] = useState([])
  const [epicWinGames, setEpicWinGames] = useState([])
  const [richGamingGames, setRichGamingGames] = useState([])
  const [rich88Games, setRich88Games] = useState([])
  const [scr888h5Games, setScr888h5Games] = useState([])
  const [funtaGames, setFuntaGames] = useState([])
  const [dragoonGames, setDragoonGames] = useState([])
  const [vpowerGames, setVpowerGames] = useState([])
  const [win8Games, setWin8Games] = useState([])
  const [pegasusGames, setPegasusGames] = useState([])
  const [lucky365Games, setLucky365Games] = useState([])

  // Mixed games pool and display state
  const [allMixedGames, setAllMixedGames] = useState([])
  const [visibleGames, setVisibleGames] = useState([])
  const [visibleCount, setVisibleCount] = useState(GAMES_PER_LOAD)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [loading, setLoading] = useState(true)
  const [launchingGame, setLaunchingGame] = useState(null)
  const [selectedGame, setSelectedGame] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Banner state
  const [banners, setBanners] = useState(initialBanners)
  const [currentBanner, setCurrentBanner] = useState(0)

  // Promotional popup state
  const [showPromoPopup, setShowPromoPopup] = useState(false)
  const [featuredGames, setFeaturedGames] = useState([])

  // Live transactions state
  const [liveTransactions, setLiveTransactions] = useState([])

  // Feature states
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

  // Pull the 5 most recent active bonuses and overlay their descriptions on
  // the banner images. Banners are shuffled per page load so the pairing
  // looks different on each visit.
  useEffect(() => {
    let cancelled = false
    const fetchBonuses = async () => {
      const bonuses = await bonusService.getActiveBonuses()
      if (cancelled || !Array.isArray(bonuses) || bonuses.length === 0) return

      // Sort newest first by createdAt (fallback to id) and keep only ones
      // with a real description so the banner text isn't blank.
      const recent = [...bonuses]
        .filter((b) => typeof b.description === 'string' && b.description.trim().length > 0)
        .sort((a, b) => {
          const ad = a.createdAt ? new Date(a.createdAt).getTime() : a.id || 0
          const bd = b.createdAt ? new Date(b.createdAt).getTime() : b.id || 0
          return bd - ad
        })
        .slice(0, 5)

      if (recent.length === 0) return

      const shuffledImages = shuffleArray(BANNER_IMAGES)
      const slides = recent.map((b, idx) => ({
        id: `bonus-${b.id || b.bonusCode}`,
        image: shuffledImages[idx % shuffledImages.length],
        description: b.description.trim()
      }))
      setBanners(slides)
    }
    fetchBonuses()
    return () => { cancelled = true }
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
    const allGames = [
      ...advantPlayGames, ...uuSlotGames, ...evo888h5Games, ...clotPlayGames,
      ...metaGamingGames, ...wfGamingGames, ...megaH5Games, ...epicWinGames,
      ...richGamingGames, ...rich88Games, ...scr888h5Games, ...funtaGames, ...dragoonGames, ...vpowerGames, ...win8Games, ...pegasusGames, ...lucky365Games
    ]
    const hasSeenPromo = sessionStorage.getItem('hasSeenPromo')
    if (!hasSeenPromo && allGames.length > 0) {
      // Get top/featured games (hot or new games)
      const topGames = allGames.filter(g => g.isHot || g.isNew).slice(0, 6)
      if (topGames.length < 6) {
        // Fill with regular games if not enough featured
        const remaining = allGames.filter(g => !g.isHot && !g.isNew).slice(0, 6 - topGames.length)
        topGames.push(...remaining)
      }
      setFeaturedGames(topGames)
      // Delay popup to let page load
      const timer = setTimeout(() => {
        setShowPromoPopup(true)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [advantPlayGames, uuSlotGames, evo888h5Games, clotPlayGames, metaGamingGames, wfGamingGames, megaH5Games, epicWinGames, richGamingGames, rich88Games, scr888h5Games, funtaGames, dragoonGames, vpowerGames, win8Games, pegasusGames, lucky365Games])

  // Generate live transactions
  useEffect(() => {
    const allGames = [
      ...advantPlayGames, ...uuSlotGames, ...evo888h5Games, ...clotPlayGames,
      ...metaGamingGames, ...wfGamingGames, ...megaH5Games, ...epicWinGames,
      ...richGamingGames, ...rich88Games, ...scr888h5Games, ...funtaGames, ...dragoonGames, ...vpowerGames, ...win8Games, ...pegasusGames, ...lucky365Games
    ]
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
      if (allGames.length === 0) return null
      const game = allGames[Math.floor(Math.random() * allGames.length)]
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
    if (allGames.length > 0 && liveTransactions.length === 0) {
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
  }, [advantPlayGames, uuSlotGames, evo888h5Games, clotPlayGames, metaGamingGames, wfGamingGames, megaH5Games, epicWinGames, richGamingGames, rich88Games, scr888h5Games, funtaGames, dragoonGames, vpowerGames, win8Games, pegasusGames, lucky365Games])

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

  // Fetch games from all providers in parallel. Each provider's games are
  // committed to state the moment its individual fetch resolves, so the grid
  // paints progressively — fast providers (most are <300ms cached) show up
  // before the slow ones (ClotPlay ~2s, EVO888H5 ~850ms) have even returned.
  useEffect(() => {
    const timings = []
    let firstResolved = false

    // Pull distinct categories out of a provider's game list. We count by the
    // raw category from the upstream API (preserved as `rawCategory` on each
    // game) so we can see the full granularity, not the collapsed 7 internal
    // buckets. Fallback to the normalized `category` when raw is missing.
    const summarizeCategories = (games) => {
      if (!Array.isArray(games)) return null
      const counts = {}
      for (const g of games) {
        const c = (g?.rawCategory ?? g?.category) || 'uncategorized'
        counts[c] = (counts[c] || 0) + 1
      }
      return counts
    }

    const time = (provider, fn, onSuccess) => {
      const start = performance.now()
      return Promise.resolve()
        .then(fn)
        .then((result) => {
          const ms = Math.round(performance.now() - start)
          const games = Array.isArray(result) ? result : (result?.data?.games || [])
          const count = games.length
          const categories = summarizeCategories(games)
          timings.push({ provider, ms, count, categories, ok: true })
          console.log(`[Home] ${provider} loaded: ${count} (${ms}ms) categories:`, categories)
          onSuccess(result)
          // Flip the loading spinner off after the first provider returns so
          // users see content immediately instead of waiting for the slowest.
          if (!firstResolved) {
            firstResolved = true
            setLoading(false)
          }
        })
        .catch((e) => {
          const ms = Math.round(performance.now() - start)
          timings.push({ provider, ms, count: 0, ok: false })
          console.error(`[Home] ${provider} error (${ms}ms):`, e)
        })
    }

    console.log('[Home] Loading games from all providers (parallel)...')

    const all = [
      time('AdvantPlay', getAllAdvantPlayGames, (g) => g?.length > 0 && setAdvantPlayGames(g)),
      time('UUSlot', getAllUUSlotGames, (g) => g?.length > 0 && setUuSlotGames(g)),
      time('EVO888H5', getAllEvo888h5Games, (g) => g?.length > 0 && setEvo888h5Games(g)),
      time('ClotPlay', () => gameService.getGames({ page: 1, limit: 500, gameType: 'all' }),
        (r) => r?.success && r.data?.games && setClotPlayGames(r.data.games)),
      time('MetaGaming', getAllMetaGamingGames, (g) => g?.length > 0 && setMetaGamingGames(g)),
      time('WFGaming', getAllWFGamingGames, (g) => g?.length > 0 && setWfGamingGames(g)),
      time('MegaH5', getAllMegaH5Games, (g) => g?.length > 0 && setMegaH5Games(g)),
      time('EpicWin', getAllEpicWinGames, (g) => g?.length > 0 && setEpicWinGames(g)),
      time('RichGaming', getAllRichGamingGames, (g) => g?.length > 0 && setRichGamingGames(g)),
      time('Rich88', getAllRich88Games, (g) => g?.length > 0 && setRich88Games(g)),
      time('SCR888H5', getAllSCR888H5Games, (g) => g?.length > 0 && setScr888h5Games(g)),
      time('FunTa', () => getAllFunTaGames(funtaLogo), (g) => g?.length > 0 && setFuntaGames(g)),
      time('DragoonSoft', () => getAllDragoonSoftGames(dragoonLogo), (g) => g?.length > 0 && setDragoonGames(g)),
      time('VPower', () => getAllVPowerGames(vpowerLogo), (g) => g?.length > 0 && setVpowerGames(g)),
      time('3win8', () => getAllWin8Games(win8Logo), (g) => g?.length > 0 && setWin8Games(g)),
      time('Pegasus', () => getAllPegasusGames(pegasusLogo), (g) => g?.length > 0 && setPegasusGames(g)),
      time('Lucky365', () => getAllLucky365Games(lucky365Logo), (g) => g?.length > 0 && setLucky365Games(g)),
    ]

    Promise.allSettled(all).then(() => {
      // Safety: clear loading even if every provider somehow failed.
      setLoading(false)
      console.log('[Home] Provider latency (sorted fastest first):')
      console.table(timings.slice().sort((a, b) => a.ms - b.ms))

      // Roll up every category seen across every provider and show which
      // providers offer each one. Helps when designing the category filter.
      const byCategory = {}
      for (const t of timings) {
        if (!t.categories) continue
        for (const [cat, n] of Object.entries(t.categories)) {
          if (!byCategory[cat]) byCategory[cat] = { category: cat, total: 0, providers: '' }
          byCategory[cat].total += n
          byCategory[cat].providers += `${t.provider}(${n}) `
        }
      }
      console.log('[Home] Categories across all providers:')
      console.table(Object.values(byCategory).sort((a, b) => b.total - a.total))
    })
  }, [])

  // Create mixed games pool when provider games are loaded
  useEffect(() => {
    // Check if we have any games from any provider
    const allProviderGames = [
      advantPlayGames, uuSlotGames, evo888h5Games, clotPlayGames,
      metaGamingGames, wfGamingGames, megaH5Games, epicWinGames,
      richGamingGames, rich88Games, scr888h5Games, funtaGames, dragoonGames, vpowerGames, win8Games, pegasusGames, lucky365Games
    ]
    const totalOriginal = allProviderGames.reduce((sum, games) => sum + games.length, 0)
    if (totalOriginal === 0) return

    // Calculate proportional expansion for each provider
    const expandedAdvant = expandGames(advantPlayGames, Math.ceil(TOTAL_DISPLAY_COUNT * (advantPlayGames.length / totalOriginal)), 'advant')
    const expandedUU = expandGames(uuSlotGames, Math.ceil(TOTAL_DISPLAY_COUNT * (uuSlotGames.length / totalOriginal)), 'uu')
    const expandedEvo = expandGames(evo888h5Games, Math.ceil(TOTAL_DISPLAY_COUNT * (evo888h5Games.length / totalOriginal)), 'evo')
    const expandedClot = expandGames(clotPlayGames, Math.ceil(TOTAL_DISPLAY_COUNT * (clotPlayGames.length / totalOriginal)), 'clot')
    const expandedMeta = expandGames(metaGamingGames, Math.ceil(TOTAL_DISPLAY_COUNT * (metaGamingGames.length / totalOriginal)), 'meta')
    const expandedWF = expandGames(wfGamingGames, Math.ceil(TOTAL_DISPLAY_COUNT * (wfGamingGames.length / totalOriginal)), 'wf')
    const expandedMegaH5 = expandGames(megaH5Games, Math.ceil(TOTAL_DISPLAY_COUNT * (megaH5Games.length / totalOriginal)), 'megah5')
    const expandedEpic = expandGames(epicWinGames, Math.ceil(TOTAL_DISPLAY_COUNT * (epicWinGames.length / totalOriginal)), 'epic')
    const expandedRich = expandGames(richGamingGames, Math.ceil(TOTAL_DISPLAY_COUNT * (richGamingGames.length / totalOriginal)), 'rich')
    const expandedRich88 = expandGames(rich88Games, Math.ceil(TOTAL_DISPLAY_COUNT * (rich88Games.length / totalOriginal)), 'rich88')
    const expandedSCR = expandGames(scr888h5Games, Math.ceil(TOTAL_DISPLAY_COUNT * (scr888h5Games.length / totalOriginal)), 'scr')
    const expandedFunta = expandGames(funtaGames, Math.ceil(TOTAL_DISPLAY_COUNT * (funtaGames.length / totalOriginal)), 'funta')
    const expandedDragoon = expandGames(dragoonGames, Math.ceil(TOTAL_DISPLAY_COUNT * (dragoonGames.length / totalOriginal)), 'dragoon')
    const expandedVpower = expandGames(vpowerGames, Math.ceil(TOTAL_DISPLAY_COUNT * (vpowerGames.length / totalOriginal)), 'vpower')
    const expandedWin8 = expandGames(win8Games, Math.ceil(TOTAL_DISPLAY_COUNT * (win8Games.length / totalOriginal)), 'win8')
    const expandedPegasus = expandGames(pegasusGames, Math.ceil(TOTAL_DISPLAY_COUNT * (pegasusGames.length / totalOriginal)), 'pegasus')
    const expandedLucky365 = expandGames(lucky365Games, Math.ceil(TOTAL_DISPLAY_COUNT * (lucky365Games.length / totalOriginal)), 'lucky365')

    // Mix all games and shuffle
    const allExpanded = shuffleArray([
      ...expandedAdvant, ...expandedUU, ...expandedEvo, ...expandedClot,
      ...expandedMeta, ...expandedWF, ...expandedMegaH5, ...expandedEpic,
      ...expandedRich, ...expandedRich88, ...expandedSCR, ...expandedFunta, ...expandedDragoon, ...expandedVpower, ...expandedWin8, ...expandedPegasus, ...expandedLucky365
    ])

    // Take exactly TOTAL_DISPLAY_COUNT games
    const finalGames = allExpanded.slice(0, TOTAL_DISPLAY_COUNT)

    setAllMixedGames(finalGames)
    setVisibleCount(GAMES_PER_LOAD)

    console.log(`[Home] Created ${finalGames.length} mixed games from ${totalOriginal} originals`)
  }, [advantPlayGames, uuSlotGames, evo888h5Games, clotPlayGames, metaGamingGames, wfGamingGames, megaH5Games, epicWinGames, richGamingGames, rich88Games, scr888h5Games, funtaGames, dragoonGames, vpowerGames, win8Games, pegasusGames, lucky365Games])

  // Games filtered by the currently selected category chip. The mixed pool
  // can have ~12k entries, so we recompute only when the pool or filter
  // changes — not on every render.
  const filteredGames = useMemo(() => {
    let pool = allMixedGames
    // When player has bonus credit, only the 5 multi-operator providers are
    // playable — hide everyone else from the home grid.
    if (accountType === 'bonus') {
      pool = pool.filter((g) => isBonusSupported(g?.provider))
    }
    if (selectedCategory === 'all') return pool
    return pool.filter((g) => getDisplayCategory(g) === selectedCategory)
  }, [allMixedGames, selectedCategory, accountType])

  // Per-category counts for the chip badges. Computed once per pool change so
  // the chips don't have to scan the full pool on each render.
  const categoryCounts = useMemo(() => {
    const counts = {}
    for (const g of allMixedGames) {
      const c = getDisplayCategory(g)
      counts[c] = (counts[c] || 0) + 1
    }
    return counts
  }, [allMixedGames])

  // Recompute the visible slice whenever the filtered pool or count moves.
  useEffect(() => {
    setVisibleGames(filteredGames.slice(0, visibleCount))
  }, [filteredGames, visibleCount])

  // Reset pagination when the user switches category.
  useEffect(() => {
    setVisibleCount(GAMES_PER_LOAD)
  }, [selectedCategory])

  // Load more games function
  const loadMoreGames = () => {
    if (loadingMore || visibleCount >= filteredGames.length) return

    setLoadingMore(true)
    setTimeout(() => {
      const newCount = Math.min(visibleCount + GAMES_PER_LOAD, filteredGames.length)
      setVisibleCount(newCount)
      setLoadingMore(false)
    }, 300) // Small delay for smooth UX
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
    if (launchingGame === game.id || launchingGame === game.uniqueId) return

    setLaunchingGame(game.uniqueId || game.id)
    showToast(`Launching ${game.name}...`, 'info')

    // Use originalId for variations, otherwise use game.id
    const gameIdToLaunch = game.originalId || game.id
    const maxRetries = 15
    let attempt = 0
    let success = false

    while (attempt < maxRetries && !success) {
      attempt++
      try {
        const result = await gameService.requestGameUrl(gameIdToLaunch, user?.accountId)

        if (result.success && result.gameUrl) {
          // Show game in embedded iframe
          setEmbeddedGame({ url: result.gameUrl, name: game.name })
          addToRecentlyPlayed(game)
          showToast(`${game.name} launched!`, 'success')
          success = true
        } else {
          console.log(`[Game Launch] Attempt ${attempt} failed, retrying...`)
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retry
          }
        }
      } catch (error) {
        console.error(`[Game Launch] Attempt ${attempt} error:`, error)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retry
        }
      }
    }

    if (!success) {
      console.error('[Game Launch] All retries failed')
      // Silently fail - don't show error to user, just stop loading
    }

    setLaunchingGame(null)
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
              <div key={banner.id || idx} className="banner-slide">
                {banner.image && (
                  <img src={banner.image} alt={banner.name || `Banner ${idx + 1}`} className="banner-image" />
                )}
                {banner.description && (
                  <div className="banner-text-overlay">
                    <p className="banner-description-silver">{banner.description}</p>
                  </div>
                )}
              </div>
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

      {/* Below Banner (Choose among the best) */}
      <div className="below-banner">
        <img src={belowBanner} alt="Promo Banner" className="below-banner-image" />
      </div>

      {/* Top Hot — random featured games from ClotPlay + UUSlot + Rich88 (real thumbnails) */}
      <TopHotStripe
        sourceGames={[...clotPlayGames, ...uuSlotGames, ...rich88Games]}
        onPlay={handlePlayNow}
        count={15}
      />

      {/* Live game stripes — Baccarat / Roulette / Sports */}
      <LiveStripes />

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

      {/* Provider Tabs */}
      <ProviderTabs active="all" />

      {/* Search Bar and Leaderboard */}
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
      {favorites.length > 0 && (advantPlayGames.length > 0 || uuSlotGames.length > 0 || evo888h5Games.length > 0 || clotPlayGames.length > 0 || metaGamingGames.length > 0 || wfGamingGames.length > 0 || megaH5Games.length > 0 || epicWinGames.length > 0 || richGamingGames.length > 0 || scr888h5Games.length > 0 || funtaGames.length > 0 || dragoonGames.length > 0 || vpowerGames.length > 0 || win8Games.length > 0 || pegasusGames.length > 0 || lucky365Games.length > 0) && (
        <div className="favorites-section">
          <h3 className="section-title-home">
            <span className="title-icon">❤️</span>
            My Favorites
          </h3>
          <div className="favorites-games-scroll">
            {[...advantPlayGames, ...uuSlotGames, ...evo888h5Games, ...clotPlayGames, ...metaGamingGames, ...wfGamingGames, ...megaH5Games, ...epicWinGames, ...richGamingGames, ...rich88Games, ...scr888h5Games, ...funtaGames, ...dragoonGames, ...vpowerGames, ...win8Games, ...pegasusGames, ...lucky365Games].filter(g => favorites.includes(g.id)).map(game => (
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

      {/* Category Filter Chips */}
      {!loading && allMixedGames.length > 0 && (
        <div className="category-chips">
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'all'
              ? allMixedGames.length
              : categoryCounts[cat.id] || 0
            if (cat.id !== 'all' && count === 0) return null
            return (
              <button
                key={cat.id}
                className={`category-chip ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="category-chip-icon">{cat.icon}</span>
                <span className="category-chip-label">{cat.label}</span>
                <span className="category-chip-count">{count.toLocaleString()}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Games Count */}
      {!loading && (
        <div className="games-count">
          <span className="games-count-number">{filteredGames.length.toLocaleString()}</span> games
          <span className="games-count-showing">(showing {Math.min(visibleCount, filteredGames.length).toLocaleString()})</span>
        </div>
      )}

      {/* Mixed Games Grid */}
      {loading ? (
        <div className="loading-skeleton-grid">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-image" />
              <div className="skeleton-text" />
            </div>
          ))}
        </div>
      ) : (
        <div className="slot-games-layout">
          {/* All Games Mixed */}
          {visibleGames.length > 0 && (() => {
            const activeCat = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0]
            return (
            <div className="game-category-section mixed-games-section">
              <h2 className="category-title">
                <span className="category-icon">{activeCat.icon}</span>
                {selectedCategory === 'all' ? 'All Games' : activeCat.label}
                <span className="category-count">({filteredGames.length.toLocaleString()})</span>
              </h2>
              <div className="slot-games-grid">
                {visibleGames.map((game) => {
                  const isLaunching = launchingGame === game.id || launchingGame === game.uniqueId
                  return (
                    <div
                      key={game.uniqueId || game.id}
                      className={`slot-game-card ${isLaunching ? 'launching' : ''}`}
                      onClick={(e) => !isLaunching && handlePlayNow(game, e)}
                    >
                      <div className="game-image-wrapper">
                        <GameImage src={game.image} alt={game.name} className="game-image" />
                        {game.isHot && <span className="game-badge hot">{t('hot')}</span>}
                        {game.isNew && <span className="game-badge new">{t('new')}</span>}
                        <button
                          className={`favorite-btn ${favorites.includes(game.originalId || game.id) ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(game.originalId || game.id) }}
                        >
                          {favorites.includes(game.originalId || game.id) ? '❤️' : '🤍'}
                        </button>
                        {isLaunching && (
                          <div className="game-launching-overlay">
                            <div className="play-spinner" />
                          </div>
                        )}
                      </div>
                      <div className="game-name">{game.name}</div>
                    </div>
                  )
                })}
              </div>

              {/* Load More Button */}
              {visibleCount < filteredGames.length && (
                <div className="load-more-container">
                  <button
                    className={`load-more-btn ${loadingMore ? 'loading' : ''}`}
                    onClick={loadMoreGames}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <div className="load-more-spinner" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More Games
                        <span className="load-more-count">
                          ({Math.min(GAMES_PER_LOAD, filteredGames.length - visibleCount)} more)
                        </span>
                      </>
                    )}
                  </button>
                  <div className="load-more-progress">
                    <div
                      className="load-more-progress-bar"
                      style={{ width: `${(visibleCount / filteredGames.length) * 100}%` }}
                    />
                  </div>
                  <span className="load-more-info">
                    {visibleCount.toLocaleString()} of {filteredGames.length.toLocaleString()} loaded
                  </span>
                </div>
              )}
            </div>
            )
          })()}

          {/* No games message */}
          {allMixedGames.length === 0 && !loading && (
            <div className="empty-games">
              <span className="empty-icon">🎮</span>
              <h3>{t('noGames')}</h3>
              <p>{t('tryAgainLater')}</p>
            </div>
          )}
        </div>
      )}

      {/* Game Detail Modal */}
      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onPlayGame={(gameData) => setEmbeddedGame(gameData)}
        />
      )}

      {/* Embedded Game Player - Portal to body */}
      {embeddedGame && (
        <GamePortal>
          <div className="game-player-overlay">
            <div className="game-player-container">
              {/* Small X button in top right corner */}
              <button
                className="game-player-exit"
                onClick={() => setShowExitConfirm(true)}
                title="Exit game"
              />

              {/* Fullscreen game iframe */}
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
        </GamePortal>
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
