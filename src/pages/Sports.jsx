import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { launchM9Game, exitM9Game } from '../services/m9TransferService'
import { walletService } from '../services/walletService'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import GamePortal from '../components/GamePortal'
import m8betLogo from '../images/m8betlogo.jpg'
import './Sports.css'

// AUD to transfer into M9 on launch. Backend caps at 100k.
const DEFAULT_LAUNCH_AMOUNT = 100

const sportsProviders = [
  { id: 'M8BET', name: 'M8BET', tagline: 'Sports Betting', image: m8betLogo, brandLogo: true, wired: true },
]

export default function Sports() {
  const navigate = useNavigate()
  const { isAuthenticated, user, updateBalance, notifyTransactionUpdate } = useAuth()
  const { showToast } = useToast()

  const [launching, setLaunching] = useState(null)
  const [embeddedGame, setEmbeddedGame] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const handleM8BetLaunch = async () => {
    if (!isAuthenticated) {
      showToast('Please login to play', 'warning')
      navigate('/login')
      return
    }
    if (launching === 'M8BET') return

    setLaunching('M8BET')
    showToast('Launching M8BET...', 'info')

    const mainBalance = Number(user?.balance) || 0
    const amount = Math.min(DEFAULT_LAUNCH_AMOUNT, Math.floor(mainBalance))

    try {
      const result = await launchM9Game(user?.accountId, {
        amount: amount > 0 ? amount : undefined,
      })
      if (result.success && result.gameUrl) {
        setEmbeddedGame({ url: result.gameUrl, name: 'M8BET' })
        showToast('M8BET launched!', 'success')
      } else {
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

  const handleProviderClick = (provider) => {
    if (provider.id === 'M8BET') handleM8BetLaunch()
  }

  const closeGame = async () => {
    if (user?.accountId) {
      try {
        await exitM9Game(user.accountId)
      } catch (error) {
        console.error('[M8BET] Exit error:', error)
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
    notifyTransactionUpdate?.()
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
                    <h3>Exit M8BET?</h3>
                    <p>Are you sure you want to exit the sportsbook?</p>
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
