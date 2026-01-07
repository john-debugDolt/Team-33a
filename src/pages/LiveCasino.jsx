import { useState } from 'react'
import './LiveCasino.css'

const casinoProviders = [
  { id: 'BG', name: 'BG', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/BG/girl-BG.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/BG/base-title.png' },
  { id: 'SBO', name: 'SBO', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SBO/girl-SBO.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SBO/base-title.png' },
  { id: 'DG', name: 'DG', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/DG/girl-DG.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/DG/base-title.png' },
  { id: 'ALLBET', name: 'ALLBET', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/ALLBET/girl-ALLBET.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/ALLBET/base-title.png' },
  { id: 'SEXY', name: 'SEXY', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SEXY/girl-SEXY.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SEXY/base-title.png' },
  { id: 'WM', name: 'WM', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/WM/girl-WM.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/WM/base-title.png' },
  { id: 'BBIN', name: 'BBIN', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/BBIN/girl-BBIN.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/BBIN/base-title.png' },
  { id: 'OG', name: 'OG', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/OG/girl-OG.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/OG/base-title.png' },
  { id: 'AG', name: 'AG', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/AG/girl-AG.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/AG/base-title.png' },
  { id: 'SA', name: 'SA', girl: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SA/girl-SA.png', logo: 'https://d2a18plfx719u2.cloudfront.net/frontend/game/games/live/page/SA/base-title.png' },
]

export default function LiveCasino() {
  const [activeProvider, setActiveProvider] = useState('BG')
  const currentProvider = casinoProviders.find(p => p.id === activeProvider) || casinoProviders[0]

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
            <button className="casino-play-btn">
              PLAY <span className="play-icon">▶</span>
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
    </div>
  )
}
