import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { launchAllBet, exitAllBet } from '../services/allbetService'
import { launchSexyBaccarat, exitSexyBaccarat } from '../services/awcTransferService'
import { recordLaunch, clearLaunch, sweepAllReturns, ProviderKey, getPreLaunchBalance } from '../services/launchTracker'
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
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate, freezeBalance, isLaunchBlocked } = useAuth()
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
    // Recovery in flight (post-launch balance read 0 with an active session
    // on the LIFO stack) — auto-watcher is firing /exit to pull funds back.
    // Block new launches until balance settles, otherwise we'd stack
    // sessions on top of an empty wallet.
    if (isLaunchBlocked?.()) {
      showToast('Recovering your balance — please try again in a moment.', 'warning')
      return
    }

    setLaunching(true)
    showToast('Launching AllBet Live Casino...', 'info')

    // Freeze the displayed balance at the pre-launch value for 5s so the
    // player doesn't see the deposit debit before the iframe fully loads.
    const preBalance = Number(user?.balance) || 0
    freezeBalance?.(preBalance, 5000)

    // Sweep any stranded sessions from a previous tab close. Fire-and-forget
    // so the launch isn't blocked waiting on a slow upstream — sweepAllReturns
    // is parallel and idempotent. The recorded ALLBET entry below is added
    // AFTER the sweep snapshots its work, so it won't be exited by mistake.
    sweepAllReturns(updateBalance).catch(() => {})
    recordLaunch(ProviderKey.ALLBET, user?.accountId, { preLaunchBalance: preBalance })

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
    if (isLaunchBlocked?.()) {
      showToast('Recovering your balance — please try again in a moment.', 'warning')
      return
    }

    setLaunching(true)
    showToast('Launching Sexy Baccarat...', 'info')

    const preBalance = Number(user?.balance) || 0
    freezeBalance?.(preBalance, 5000)

    // Fire-and-forget sweep — see handleAllBetLaunch for the rationale.
    sweepAllReturns(updateBalance).catch(() => {})
    recordLaunch(ProviderKey.SEXYBCRT, user?.accountId, { preLaunchBalance: preBalance })

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

  // /exit is idempotent on both AllBet and SEXYBCRT — a transient blip on
  // the first call (network hiccup, RECONCILING state, slow upstream) is
  // safe to retry. We try up to 3 times with backoff so we don't surrender
  // after one wobble. Returns the final result.
  const tryExitWithRetries = async (platform, accountId, attempts = 3) => {
    const exitFn = platform === 'SEXYBCRT' ? exitSexyBaccarat : exitAllBet
    let last = { success: false, error: 'No attempts made' }
    for (let i = 0; i < attempts; i++) {
      try {
        last = await exitFn(accountId)
        if (last?.success) return last
        await new Promise((r) => setTimeout(r, 800 + i * 400))
      } catch (err) {
        last = { success: false, error: err?.message }
      }
    }
    return last
  }

  const closeGame = () => {
    // Close the iframe + dialog immediately. The exit sweep happens in the
    // background so a slow upstream (or a RECONCILING state) never freezes
    // the UI — auto-withdraw + reconciler are the server-side safety net.
    const platform = activePlatform
    const accountId = user?.accountId

    // Pull the pre-launch balance snapshot stashed at recordLaunch time and
    // freeze the displayed balance at that value for 4s. The real
    // refreshBalance / updateBalance calls below are silenced by the freeze;
    // after 4s they unfreeze and the true post-game balance shows.
    const providerKey = platform === 'SEXYBCRT' ? ProviderKey.SEXYBCRT : ProviderKey.ALLBET
    const preBalance = getPreLaunchBalance(providerKey)
    if (preBalance != null) freezeBalance?.(preBalance, 4000)

    setEmbeddedGame(null)
    setShowExitConfirm(false)
    setActivePlatform(null)

    if (!accountId) {
      notifyTransactionUpdate?.()
      return
    }

    ;(async () => {
      try {
        const result = await tryExitWithRetries(platform, accountId, 3)
        if (platform === 'SEXYBCRT') clearLaunch(ProviderKey.SEXYBCRT)
        else clearLaunch(ProviderKey.ALLBET)
        if (!result?.success) {
          console.warn('[LiveCasino] exit still failing after retries:', result?.error)
          // Auto-withdraw / reconciler will sweep eventually. Tell the user.
          showToast(
            'Cash-out is being processed in the background — balance will update shortly.',
            'warning'
          )
        }
        // Always refresh wallet display so the user sees fresh state — the
        // freeze window above silences the immediate update; after 4s the
        // periodic poll picks it up and the display catches up cleanly.
        try {
          const r = await walletService.getBalance(accountId)
          if (r.success && r.balance !== undefined) updateBalance?.(r.balance)
        } catch (err) {
          console.error('[LiveCasino] balance sync error:', err)
        }
      } catch (err) {
        console.error('[LiveCasino] closeGame background error:', err)
      } finally {
        notifyTransactionUpdate?.()
      }
    })()
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
