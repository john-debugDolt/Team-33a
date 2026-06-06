import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { launchAllBet, exitAllBet } from '../services/allbetService'
import { launchSexyBaccarat, exitSexyBaccarat } from '../services/awcTransferService'
import { recordLaunch, clearLaunch, sweepAllReturns, ProviderKey } from '../services/launchTracker'
import { walletService } from '../services/walletService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import GamePortal from '../components/GamePortal'
import allbetLogo from '../images/allbetlogo.jpg'
import sexyLogo from '../images/sexybaccaratlogo.jpg'
import './LiveCasino.css'

const DEFAULT_LAUNCH_AMOUNT = 100

const casinoProviders = [
  { id: 'BG', name: 'BG', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/BG/girl-BG.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/BG/base-title.png' },
  { id: 'SBO', name: 'SBO', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SBO/girl-SBO.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SBO/base-title.png' },
  { id: 'DG', name: 'DG', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/DG/girl-DG.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/DG/base-title.png' },
  { id: 'ALLBET', name: 'ALLBET', wired: true, girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/ALLBET/girl-ALLBET.png', logo: allbetLogo },
  { id: 'SEXY', name: 'SEXY', wired: true, girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SEXY/girl-SEXY.png', logo: sexyLogo },
  { id: 'WM', name: 'WM', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/WM/girl-WM.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/WM/base-title.png' },
  { id: 'BBIN', name: 'BBIN', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/BBIN/girl-BBIN.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/BBIN/base-title.png' },
  { id: 'OG', name: 'OG', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/OG/girl-OG.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/OG/base-title.png' },
  { id: 'AG', name: 'AG', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/AG/girl-AG.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/AG/base-title.png' },
  { id: 'SA', name: 'SA', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SA/girl-SA.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SA/base-title.png' },
]

export default function LiveCasino() {
  const navigate = useNavigate()
  const location = useLocation()
  const autoLaunchedRef = useRef(false)
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [activeProvider, setActiveProvider] = useState('ALLBET')
  const [launching, setLaunching] = useState(false)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [activePlatform, setActivePlatform] = useState(null) // 'ALLBET' | 'SEXYBCRT' for exit routing

  const currentProvider = casinoProviders.find(p => p.id === activeProvider) || casinoProviders[0]

  const handleAllBetLaunch = async () => {
    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      navigate('/login')
      return
    }
    if (launching) return

    setLaunching(true)
    showToast('Launching AllBet Live Casino...', 'info')

    await sweepAllReturns(updateBalance)
    recordLaunch(ProviderKey.ALLBET, user?.accountId)

    const mainBalance = Number(user?.balance) || 0
    const amount = Math.min(DEFAULT_LAUNCH_AMOUNT, Math.floor(mainBalance))

    try {
      const result = await launchAllBet(user?.accountId, {
        amount: amount > 0 ? amount : undefined,
      })
      if (result.success && result.gameUrl) {
        setActivePlatform('ALLBET')
        setEmbeddedGame({ url: result.gameUrl, name: 'AllBet Live Casino' })
        showToast('AllBet launched!', 'success')
      } else {
        clearLaunch(ProviderKey.ALLBET)
        if (result.resultCode === 'LACK_OF_MONEY') {
          showToast('Insufficient balance. Top up to play.', 'error')
        } else if (result.resultCode === 'ILLEGAL_STATE') {
          showToast('Account not initialised — contact support.', 'error')
        } else {
          showToast(result.error || 'AllBet temporarily unavailable.', 'error')
        }
      }
    } catch (error) {
      console.error('[AllBet Launch] error:', error)
      showToast('Failed to launch AllBet', 'error')
    } finally {
      setLaunching(false)
    }
  }

  const handleSexyLaunch = async () => {
    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      navigate('/login')
      return
    }
    if (launching) return

    setLaunching(true)
    showToast('Launching Sexy Baccarat...', 'info')

    await sweepAllReturns(updateBalance)
    recordLaunch(ProviderKey.SEXYBCRT, user?.accountId)

    const mainBalance = Number(user?.balance) || 0
    const amount = Math.min(DEFAULT_LAUNCH_AMOUNT, Math.floor(mainBalance))

    try {
      const result = await launchSexyBaccarat(user?.accountId, {
        amount: amount > 0 ? amount : 0,
      })
      if (result.success && result.gameUrl) {
        setActivePlatform('SEXYBCRT')
        setEmbeddedGame({ url: result.gameUrl, name: 'Sexy Baccarat' })
        showToast('Sexy Baccarat launched!', 'success')
      } else {
        clearLaunch(ProviderKey.SEXYBCRT)
        if (result.awcStatus === '6006' || result.awcStatus === '1004') {
          showToast('Insufficient balance. Top up to play.', 'error')
        } else if (result.awcStatus === '1028') {
          showToast('Sexy Baccarat busy — please try again.', 'warning')
        } else if (result.awcStatus === '1054') {
          showToast('Game temporarily unavailable.', 'error')
        } else {
          showToast(result.error || 'Sexy Baccarat temporarily unavailable.', 'error')
        }
      }
    } catch (error) {
      console.error('[SexyBaccarat Launch] error:', error)
      showToast('Failed to launch Sexy Baccarat', 'error')
    } finally {
      setLaunching(false)
    }
  }

  const handlePlayClick = () => {
    if (currentProvider.id === 'ALLBET') {
      handleAllBetLaunch()
    } else if (currentProvider.id === 'SEXY') {
      handleSexyLaunch()
    } else {
      showToast(`${currentProvider.name} coming soon`, 'info')
    }
  }

  // Auto-launch when navigated from Home's live stripes with state hint
  useEffect(() => {
    if (autoLaunchedRef.current) return
    const target = location.state?.autoLaunch
    if (!target) return
    autoLaunchedRef.current = true
    // Clear the state so back/forward doesn't re-trigger
    navigate(location.pathname, { replace: true, state: {} })
    if (target === 'SEXYBCRT') {
      setActiveProvider('SEXY')
      handleSexyLaunch()
    } else if (target === 'ALLBET') {
      setActiveProvider('ALLBET')
      handleAllBetLaunch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.autoLaunch])

  const closeGame = async () => {
    if (user?.accountId) {
      try {
        // Route /exit to the right provider based on which one was launched.
        // Both auto-withdraw on idle, but explicit exit gives instant feedback.
        if (activePlatform === 'SEXYBCRT') {
          await exitSexyBaccarat(user.accountId)
          clearLaunch(ProviderKey.SEXYBCRT)
        } else {
          await exitAllBet(user.accountId)
          clearLaunch(ProviderKey.ALLBET)
        }
      } catch (error) {
        console.error('[LiveCasino] Exit error:', error)
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
    setActivePlatform(null)
    notifyTransactionUpdate?.()
  }

  return (
    <div className="live-casino-page">
      {/* Hero Section */}
      <div className="casino-hero">
        <div className="casino-hero-bg"></div>

        <div className="casino-content">
          {/* Main Display */}
          <div className="casino-display">
            <div className="casino-logo-display">
              <img src={currentProvider.logo} alt={currentProvider.name} className="casino-logo-img" />
            </div>
            <button
              className="casino-play-btn"
              onClick={handlePlayClick}
              disabled={launching}
            >
              {launching ? 'LAUNCHING…' : <>PLAY <span className="play-icon">▶</span></>}
            </button>
          </div>

          {/* Dealer Girl */}
          <div className="casino-girl">
            <img src={currentProvider.girl} alt={`${currentProvider.name} Dealer`} />
          </div>
        </div>

        {/* Provider Chips Carousel */}
        <div className="casino-chips-wrapper">
          <button className="chips-nav prev">&lt;</button>
          <div className="casino-chips">
            {casinoProviders.map((provider) => (
              <button
                key={provider.id}
                className={`casino-chip ${activeProvider === provider.id ? 'active' : ''}`}
                onClick={() => setActiveProvider(provider.id)}
              >
                <div className="chip-inner">
                  <span className="chip-name">{provider.name}</span>
                </div>
              </button>
            ))}
          </div>
          <button className="chips-nav next">&gt;</button>
        </div>
      </div>

      {/* Marquee */}
      <div className="marquee">
        <span className="marquee-icon">📢</span>
        <div className="marquee-text">
          <span>Telegram: @Team33 | Experience the best live casino games!</span>
        </div>
      </div>

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
                    <h3>Exit AllBet?</h3>
                    <p>Are you sure you want to exit the live casino?</p>
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
