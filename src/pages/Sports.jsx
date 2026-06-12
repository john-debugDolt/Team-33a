import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { launchM9Game, exitM9Game, isMobileDevice } from '../services/m9TransferService'
import { launchSV388, exitSV388 } from '../services/awcTransferService'
import { recordLaunch, clearLaunchIfMatches, sweepAllReturns, getPreLaunchBalance, getLaunchTimestamp, ProviderKey } from '../services/launchTracker'
import { walletService } from '../services/walletService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import GamePortal from '../components/GamePortal'
import m8betLogo from '../images/m8betlogo.jpg'
import sv388Logo from '../images/sv388logo.jpg'
import './Sports.css'

// AUD to transfer into M9 on launch. Backend caps at 100k.
const DEFAULT_LAUNCH_AMOUNT = 100

const sportsProviders = [
  { id: 'M8BET', name: 'M8BET', tagline: 'Sports Betting', image: m8betLogo, brandLogo: true, wired: true },
  { id: 'SV388', name: 'SV388', tagline: 'Live Cockfighting', image: sv388Logo, brandLogo: true, wired: true },
]

export default function Sports() {
  const navigate = useNavigate()
  const location = useLocation()
  const autoLaunchedRef = useRef(false)
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate, freezeBalance, isLaunchBlocked } = useAuth()
  const { showToast } = useToast()

  const [launching, setLaunching] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [activePlatform, setActivePlatform] = useState(null) // 'M8BET' | 'SV388'

  const handleM8BetLaunch = async () => {
    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      navigate('/login')
      return
    }
    if (launching === 'M8BET') return
    if (isLaunchBlocked?.()) {
      showToast('Recovering your balance — please try again in a moment.', 'warning')
      return
    }

    setLaunching('M8BET')
    showToast('Launching M8BET...', 'info')

    const preBalance = Number(user?.balance) || 0
    freezeBalance?.(preBalance, 5000)

    sweepAllReturns(updateBalance).catch(() => {})
    recordLaunch(ProviderKey.M8BET, user?.accountId, { preLaunchBalance: preBalance })

    const mainBalance = Number(user?.balance) || 0
    const amount = Math.min(DEFAULT_LAUNCH_AMOUNT, Math.floor(mainBalance))

    try {
      const result = await launchM9Game(user?.accountId, {
        amount: amount > 0 ? amount : undefined,
      })
      if (result.success && result.gameUrl) {
        setActivePlatform('M8BET')
        // M8BET's mobile site refuses to render inside an iframe (X-Frame-Options
        // + third-party cookie restrictions on Safari iOS / Chrome Android), so
        // on touch devices we navigate the top window to the launch URL. The
        // launchTracker entry was recorded above; the sweep on return will call
        // /exit and pull funds back. URL TTL is ~60s so we navigate immediately.
        if (isMobileDevice()) {
          showToast('Opening M8BET…', 'success')
          window.location.href = result.gameUrl
          return
        }
        setEmbeddedGame({ url: result.gameUrl, name: 'M8BET' })
        showToast('M8BET launched!', 'success')
      } else {
        clearLaunch(ProviderKey.M8BET)
        if (result.errcode === -100) {
          showToast(result.error || 'Insufficient balance — top up to play', 'error')
        } else if (result.errcode === -1) {
          showToast('M8BET in maintenance. Try again shortly.', 'error')
        } else {
          showToast(result.error || 'M8BET is temporarily unavailable.', 'error')
        }
      }
    } catch (error) {
      console.error('[M8BET Launch] error:', error)
      showToast('Failed to launch M8BET', 'error')
    } finally {
      setLaunching(null)
    }
  }

  const handleSV388Launch = async () => {
    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      navigate('/login')
      return
    }
    if (launching === 'SV388') return
    if (isLaunchBlocked?.()) {
      showToast('Recovering your balance — please try again in a moment.', 'warning')
      return
    }

    setLaunching('SV388')
    showToast('Launching SV388...', 'info')

    const preBalance = Number(user?.balance) || 0
    freezeBalance?.(preBalance, 5000)

    sweepAllReturns(updateBalance).catch(() => {})
    recordLaunch(ProviderKey.SV388, user?.accountId, { preLaunchBalance: preBalance })

    const mainBalance = Number(user?.balance) || 0
    const amount = Math.min(DEFAULT_LAUNCH_AMOUNT, Math.floor(mainBalance))

    try {
      const result = await launchSV388(user?.accountId, {
        amount: amount > 0 ? amount : 0,
      })
      if (result.success && result.gameUrl) {
        setActivePlatform('SV388')
        setEmbeddedGame({ url: result.gameUrl, name: 'SV388' })
        showToast('SV388 launched!', 'success')
      } else {
        clearLaunch(ProviderKey.SV388)
        if (result.awcStatus === '6006' || result.awcStatus === '1004') {
          showToast('Insufficient balance. Top up to play.', 'error')
        } else if (result.awcStatus === '1028') {
          showToast('SV388 busy — please try again.', 'warning')
        } else if (result.awcStatus === '1054') {
          showToast('SV388 temporarily unavailable.', 'error')
        } else {
          showToast(result.error || 'SV388 temporarily unavailable.', 'error')
        }
      }
    } catch (error) {
      console.error('[SV388 Launch] error:', error)
      showToast('Failed to launch SV388', 'error')
    } finally {
      setLaunching(null)
    }
  }

  // Auto-launch when navigated from Home's live stripes with state hint
  useEffect(() => {
    if (autoLaunchedRef.current) return
    const target = location.state?.autoLaunch
    if (!target) return
    autoLaunchedRef.current = true
    navigate(location.pathname, { replace: true, state: {} })
    if (target === 'SV388') handleSV388Launch()
    else if (target === 'M8BET') handleM8BetLaunch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.autoLaunch])

  const handleProviderClick = (provider) => {
    if (provider.id === 'M8BET') handleM8BetLaunch()
    else if (provider.id === 'SV388') handleSV388Launch()
  }

  const closeGame = () => {
    const providerKey = activePlatform === 'SV388' ? ProviderKey.SV388 : ProviderKey.M8BET
    const preBalance = getPreLaunchBalance(providerKey)
    const launchedAt = getLaunchTimestamp(providerKey)
    if (preBalance != null) freezeBalance?.(preBalance, 4000)
    const platformAtClose = activePlatform
    setEmbeddedGame(null)
    setShowExitConfirm(false)
    setActivePlatform(null)
    ;(async () => {
      if (user?.accountId) {
        try {
          if (platformAtClose === 'SV388') {
            const result = await exitSV388(user.accountId)
            if (result?.success) clearLaunchIfMatches(ProviderKey.SV388, launchedAt)
          } else {
            const result = await exitM9Game(user.accountId)
            if (result?.success) clearLaunchIfMatches(ProviderKey.M8BET, launchedAt)
          }
        } catch (error) {
          console.error('[Sports] Exit error:', error)
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
      notifyTransactionUpdate?.()
    })()
  }

  return (
    <div className="sports-page">
      {/* Hero Section */}
      <div className="sports-hero">
        <div className="sports-hero-bg">
          <img
            src="https://www.rooking.live/rooking/img/bg-sport2.webp"
            alt="Sports Background"
            className="hero-bg-image"
          />
        </div>

        <div className="sports-content">
          {/* Provider Cards Grid */}
          <div className="sports-providers-grid">
            {sportsProviders.map((provider) => (
              <div key={provider.id} className="sports-provider-card">
                <div className="provider-card-inner">
                  <div className={`provider-card-image ${provider.brandLogo ? 'brand-logo' : ''}`}>
                    {provider.image ? (
                      <img src={provider.image} alt={provider.name} />
                    ) : (
                      <div className="provider-card-text-only">{provider.name}</div>
                    )}
                  </div>
                  <div className="provider-card-overlay">
                    <span className="provider-name">{provider.name}</span>
                    {provider.tagline && (
                      <span className="provider-tagline">{provider.tagline}</span>
                    )}
                    <button
                      className="play-now-btn"
                      onClick={() => handleProviderClick(provider)}
                      disabled={launching === provider.id}
                    >
                      {launching === provider.id ? 'Launching…' : 'Play Now'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Marquee */}
      <div className="marquee">
        <span className="marquee-icon">📢</span>
        <div className="marquee-text">
          <span>Telegram: @Team33 | Welcome to Team33 sports betting!</span>
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
                    <h3>Exit {embeddedGame.name}?</h3>
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
