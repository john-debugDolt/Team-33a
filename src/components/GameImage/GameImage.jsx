import { useState, useEffect, useRef } from 'react'
import './GameImage.css'

const loadedImages = new Set()
const preloadingImages = new Set()
const PLACEHOLDER = '/placeholder-game.png'

export default function GameImage({ src, alt, className }) {
  const [isInView, setIsInView] = useState(() => loadedImages.has(src))
  const [displaySrc, setDisplaySrc] = useState(() =>
    loadedImages.has(src) ? src : null
  )
  const [isLoaded, setIsLoaded] = useState(() => loadedImages.has(src))
  const [showingPlaceholder, setShowingPlaceholder] = useState(false)

  const imgRef = useRef(null)
  const retryTimeoutRef = useRef(null)
  const probeRef = useRef(null)
  const isMountedRef = useRef(true)
  const retryCountRef = useRef(0)

  const isValidSrc = src && src !== 'undefined' && src !== 'null' && src !== PLACEHOLDER

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
      if (probeRef.current) {
        probeRef.current.onload = null
        probeRef.current.onerror = null
      }
    }
  }, [])

  // Lazy load via IntersectionObserver (skip if already cached)
  useEffect(() => {
    if (loadedImages.has(src)) {
      setIsInView(true)
      return
    }
    const node = imgRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px', threshold: 0.01 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [src])

  // Reset when src changes
  useEffect(() => {
    retryCountRef.current = 0
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)

    if (loadedImages.has(src)) {
      setDisplaySrc(src)
      setIsLoaded(true)
      setShowingPlaceholder(false)
    } else {
      setDisplaySrc(isValidSrc ? src : PLACEHOLDER)
      setIsLoaded(false)
      setShowingPlaceholder(!isValidSrc)
    }
  }, [src, isValidSrc])

  const handleLoad = () => {
    if (!isMountedRef.current) return
    if (displaySrc === PLACEHOLDER) {
      setIsLoaded(true)
      return
    }
    setIsLoaded(true)
    setShowingPlaceholder(false)
    if (isValidSrc) loadedImages.add(src)
  }

  // Background probe — fetches the real URL using a new Image() with cache-busted URL.
  // Once it succeeds, swap the displayed img to the real src.
  // Capped at MAX_RETRIES so dead URLs (e.g. JDB CDN 403s) don't loop forever.
  const MAX_RETRIES = 6
  const scheduleProbe = () => {
    if (!isMountedRef.current || !isValidSrc) return
    if (retryCountRef.current >= MAX_RETRIES) return

    const attempt = retryCountRef.current
    // Backoff: 1s, 2s, 4s, 8s, 15s, 15s, then stop
    const delay = Math.min(1000 * Math.pow(2, attempt), 15000)

    retryTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return

      const probe = new Image()
      probeRef.current = probe
      // Cache buster to force the browser to re-fetch instead of returning the cached failure
      const probeUrl = `${src}${src.includes('?') ? '&' : '?'}_r=${Date.now()}`

      probe.onload = () => {
        if (!isMountedRef.current) return
        loadedImages.add(src)
        setDisplaySrc(src)
        setShowingPlaceholder(false)
        setIsLoaded(true)
      }
      probe.onerror = () => {
        if (!isMountedRef.current) return
        retryCountRef.current += 1
        scheduleProbe()
      }
      probe.src = probeUrl
    }, delay)
  }

  const handleError = () => {
    if (!isMountedRef.current) return
    if (!isValidSrc) {
      setShowingPlaceholder(true)
      setDisplaySrc(PLACEHOLDER)
      setIsLoaded(true)
      return
    }
    // Real image failed — fall back to placeholder visually and start background probing
    setDisplaySrc(PLACEHOLDER)
    setShowingPlaceholder(true)
    setIsLoaded(true)
    scheduleProbe()
  }

  return (
    <div
      ref={imgRef}
      className={`game-image-container ${isLoaded ? 'loaded' : ''} ${showingPlaceholder ? 'placeholder-fallback' : ''}`}
    >
      {isInView && displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          className={className}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          style={{ opacity: isLoaded ? 1 : 0 }}
        />
      ) : (
        <div className="game-image-placeholder" />
      )}
      {!isLoaded && isInView && <div className="game-image-loader" />}
    </div>
  )
}

export const preloadGameImages = (urls) => {
  if (!urls || !Array.isArray(urls)) return

  const validUrls = urls.filter(url =>
    url &&
    url !== 'undefined' &&
    url !== 'null' &&
    url !== PLACEHOLDER &&
    !loadedImages.has(url) &&
    !preloadingImages.has(url)
  )

  const BATCH_SIZE = 4
  let currentBatch = 0

  const loadBatch = () => {
    const start = currentBatch * BATCH_SIZE
    const batch = validUrls.slice(start, start + BATCH_SIZE)
    if (batch.length === 0) return

    batch.forEach(url => {
      preloadingImages.add(url)
      const img = new Image()
      img.onload = () => {
        loadedImages.add(url)
        preloadingImages.delete(url)
      }
      img.onerror = () => {
        preloadingImages.delete(url)
      }
      img.src = url
    })

    currentBatch++
    if (start + BATCH_SIZE < validUrls.length) {
      setTimeout(loadBatch, 200)
    }
  }

  setTimeout(loadBatch, 100)
}
