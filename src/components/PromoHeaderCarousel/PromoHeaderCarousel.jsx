import { useEffect, useState } from 'react'
import frame1 from '../../images/promo-header-1.jpg'
import frame2 from '../../images/promo-header-2.jpg'
import frame3 from '../../images/promo-header-3.jpg'
import './PromoHeaderCarousel.css'

// Three-frame crossfade banner that reads like a GIF — ships as three
// JPEGs that fade through CSS opacity transitions. Sized to the same
// 16:5 aspect the existing home banner-carousel uses so it slots in
// where the static banner art used to sit.
const FRAMES = [frame1, frame2, frame3]
const FRAME_DURATION_MS = 3500

export default function PromoHeaderCarousel() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (FRAMES.length < 2) return
    const id = setInterval(() => {
      setActive((i) => (i + 1) % FRAMES.length)
    }, FRAME_DURATION_MS)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="promo-header-carousel" role="img" aria-label="Team33 promotions banner">
      {FRAMES.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          aria-hidden="true"
          decoding="async"
          loading={i === 0 ? 'eager' : 'lazy'}
          className={`promo-header-frame ${i === active ? 'is-active' : ''}`}
        />
      ))}
      <span className="promo-header-veil" aria-hidden="true" />
    </div>
  )
}
