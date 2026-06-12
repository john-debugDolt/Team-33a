import { useEffect, useState } from 'react'
import { bonusService } from '../../services/bonusService'
import slide1 from '../../images/slotgifpic1.jpg'
import slide2 from '../../images/slotgifpic2.jpg'
import './StartupAd.css'

// Picks the most recent active bonus by startDate (falls back to id).
const pickLatest = (list) => {
  if (!list || list.length === 0) return null
  const score = (b) => {
    const t = b?.startDate ? new Date(b.startDate).getTime() : NaN
    return Number.isFinite(t) ? t : (b?.id || 0)
  }
  return [...list].sort((a, b) => score(b) - score(a))[0]
}

export default function StartupAd() {
  const [visible, setVisible] = useState(true)
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    let cancelled = false
    bonusService.getActiveBonuses().then((list) => {
      if (cancelled) return
      const latest = pickLatest(list)
      if (!latest) return
      setHeadline(bonusService.getBonusHeadline(latest))
      setDescription(latest.description || latest.displayName || '')
    }).catch(() => { /* show ad with no copy */ })
    return () => { cancelled = true }
  }, [])

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
        <div className="startup-ad-stage">
          <img src={slide1} alt="" className="startup-ad-frame startup-ad-frame-a" />
          <img src={slide2} alt="" className="startup-ad-frame startup-ad-frame-b" />
          <div className="startup-ad-copy">
            {headline && <div className="startup-ad-headline">{headline}</div>}
            {description && <div className="startup-ad-desc">{description}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
