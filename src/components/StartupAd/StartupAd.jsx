import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import bonusDaily5 from '../../images/bonus-daily-5.jpg'
import bonusWelcome50 from '../../images/bonus-welcome-50.jpg'
import bonusWelcome28 from '../../images/bonus-welcome-28.jpg'
import bonusWeeklyRebate5 from '../../images/bonus-weeklyrebate-5.jpg'
import bonusWeeklyRebate10 from '../../images/bonus-weeklyrebate-10.jpg'
import bonusWeekly20 from '../../images/bonus-weekly-20.jpg'
import bonusWeekly50 from '../../images/bonus-weekly-50.jpg'
import bonusWeekly80 from '../../images/bonus-weekly-80.jpg'
import './StartupAd.css'

// Pool of bonus key art the popup randomly picks one from on each app
// start. Same JPEGs used by the Promotions tile grid.
const BONUS_ART = [
  bonusDaily5,
  bonusWelcome50,
  bonusWelcome28,
  bonusWeeklyRebate5,
  bonusWeeklyRebate10,
  bonusWeekly20,
  bonusWeekly50,
  bonusWeekly80,
]

export default function StartupAd() {
  const [visible, setVisible] = useState(true)
  // Pick once per mount so the image doesn't reshuffle if the popup
  // re-renders for some reason. Math.random gives a uniform pull.
  const pickedArt = useMemo(
    () => BONUS_ART[Math.floor(Math.random() * BONUS_ART.length)],
    []
  )

  if (!visible) return null

  return (
    <div className="startup-ad-backdrop" role="dialog" aria-modal="true" aria-label="Promotion">
      <div className="startup-ad-card">
        <button
          className="startup-ad-close"
          onClick={() => setVisible(false)}
          aria-label="Close advertisement"
        >
          ×
        </button>
        <Link
          to="/promotions"
          className="startup-ad-link"
          onClick={() => setVisible(false)}
          aria-label="View promotions"
        >
          <img src={pickedArt} alt="Featured bonus promotion" className="startup-ad-art" />
        </Link>
      </div>
    </div>
  )
}
