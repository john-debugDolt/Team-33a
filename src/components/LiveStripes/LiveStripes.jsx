import { useNavigate } from 'react-router-dom'
import './LiveStripes.css'

// Sexy Baccarat cards — all launch the SEXYBCRT platform via LiveCasino
import sexy1 from '../../images/sexybaccarat1.jpg'
import sexy2 from '../../images/seybaccarat2.jpg'   // (original filename has a typo)
import sexy3 from '../../images/sexybaccarat3.jpg'
import sexy4 from '../../images/sexybaccarat4.jpg'
import sexy5 from '../../images/sexybaccarat5.jpg'
import sexy6 from '../../images/sexybaccarat6.jpg'

// AllBet roulette cards — launch the ALLBET hub via LiveCasino
import rouletteAllbet1 from '../../images/live roulette allbet.jpg'
import rouletteAllbet2 from '../../images/live roulette allbet 2.jpg'
import rouletteAllbet3 from '../../images/live roulette allbet 3.jpg'

// Live Sports
import sv388Logo from '../../images/sv388logo.jpg'
import m8betLogo from '../../images/m8betlogo.jpg'

const BACCARAT_CARDS = [
  { id: 'sexy-1', image: sexy1, label: 'Sexy Baccarat' },
  { id: 'sexy-2', image: sexy2, label: 'Sexy Baccarat' },
  { id: 'sexy-3', image: sexy3, label: 'Sexy Baccarat' },
  { id: 'sexy-4', image: sexy4, label: 'Sexy Baccarat' },
  { id: 'sexy-5', image: sexy5, label: 'Sexy Baccarat' },
  { id: 'sexy-6', image: sexy6, label: 'Sexy Baccarat' },
]

const ROULETTE_CARDS = [
  { id: 'roulette-1', image: rouletteAllbet1, label: 'AllBet Roulette' },
  { id: 'roulette-2', image: rouletteAllbet2, label: 'AllBet Roulette' },
  { id: 'roulette-3', image: rouletteAllbet3, label: 'AllBet Roulette' },
]

const SPORTS_CARDS = [
  { id: 'sv388', image: sv388Logo, label: 'SV388', brandLogo: true },
  { id: 'm8bet', image: m8betLogo, label: 'M8BET', brandLogo: true },
]

function LiveCard({ card, onClick }) {
  return (
    <button
      className={`live-card ${card.brandLogo ? 'brand-logo' : ''}`}
      onClick={onClick}
      aria-label={card.label}
    >
      <img src={card.image} alt={card.label} className="live-card-image" />
      <span className="live-card-tag">LIVE</span>
      <div className="live-card-overlay">
        <span className="live-card-label">{card.label}</span>
      </div>
    </button>
  )
}

function LiveStripe({ title, icon, cards, onCardClick }) {
  return (
    <div className="live-stripe">
      <h3 className="live-stripe-title">
        <span className="live-stripe-icon">{icon}</span>
        {title}
      </h3>
      <div className="live-stripe-scroll">
        {cards.map(card => (
          <LiveCard
            key={card.id}
            card={card}
            onClick={() => onCardClick(card)}
          />
        ))}
      </div>
    </div>
  )
}

export default function LiveStripes() {
  const navigate = useNavigate()

  const handleBaccaratClick = () => {
    // SEXYBCRT lives in LiveCasino; auto-launch via location state.
    navigate('/live-casino', { state: { autoLaunch: 'SEXYBCRT' } })
  }

  const handleRouletteClick = () => {
    // AllBet hub in LiveCasino.
    navigate('/live-casino', { state: { autoLaunch: 'ALLBET' } })
  }

  const handleSportsClick = (card) => {
    if (card.id === 'sv388') {
      navigate('/sports', { state: { autoLaunch: 'SV388' } })
    } else if (card.id === 'm8bet') {
      navigate('/sports', { state: { autoLaunch: 'M8BET' } })
    }
  }

  return (
    <section className="live-stripes-section">
      <LiveStripe
        title="Live Baccarat"
        icon="🃏"
        cards={BACCARAT_CARDS}
        onCardClick={handleBaccaratClick}
      />
      <LiveStripe
        title="Live Roulette"
        icon="🎡"
        cards={ROULETTE_CARDS}
        onCardClick={handleRouletteClick}
      />
      <LiveStripe
        title="Live Sports"
        icon="⚽"
        cards={SPORTS_CARDS}
        onCardClick={handleSportsClick}
      />
    </section>
  )
}
