import { useState } from 'react'
import './Sports.css'

const sportsProviders = [
  { id: 'BTI', name: 'BTI', image: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/provider-banner/sport_BTI.png' },
  { id: 'SBO', name: 'SBO', image: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/provider-banner/sport_SBO.png' },
  { id: 'CMD', name: 'CMD', image: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/provider-banner/sport_CMD.png' },
  { id: '3SING', name: '3SING', image: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/provider-banner/sport_3SING.png' },
  { id: 'UG', name: 'UG', image: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/provider-banner/sport_UG.png' },
]

export default function Sports() {
  const [activeProvider, setActiveProvider] = useState('BTI')

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
          {/* Provider Filter Tabs */}
          <div className="sports-tabs">
            {sportsProviders.map((provider) => (
              <button
                key={provider.id}
                className={`sports-tab ${activeProvider === provider.id ? 'active' : ''}`}
                onClick={() => setActiveProvider(provider.id)}
              >
                {provider.name}
              </button>
            ))}
          </div>

          {/* Provider Cards Grid */}
          <div className="sports-providers-grid">
            {sportsProviders.map((provider) => (
              <div key={provider.id} className="sports-provider-card">
                <div className="provider-card-inner">
                  <div className="provider-card-image">
                    <img src={provider.image} alt={provider.name} />
                  </div>
                  <div className="provider-card-overlay">
                    <span className="provider-name">{provider.name}</span>
                    <button className="play-now-btn">Play Now</button>
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
    </div>
  )
}
