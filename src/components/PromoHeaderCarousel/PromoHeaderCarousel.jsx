import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import frame1 from '../../images/promo-header-1.jpg'
import frame2 from '../../images/promo-header-2.jpg'
import frame3 from '../../images/promo-header-3.jpg'
import './PromoHeaderCarousel.css'

// Three-frame crossfade banner that reads like a GIF — ships as three
// JPEGs that fade through CSS opacity transitions. Aspect ratio matches
// the source art (3168 x 1344) so the frames render uncropped. Whole
// banner is a link into /promotions.
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
    <Link
      to="/promotions"
      className="promo-header-carousel"
      aria-label="View team33 promotions"
    >
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
    </Link>
  )
}
