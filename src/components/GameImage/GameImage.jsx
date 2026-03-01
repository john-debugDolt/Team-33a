import { useState, useEffect, useRef } from 'react'
import './GameImage.css'

// Track which images have successfully loaded (session memory cache)
const loadedImages = new Set()

// Track images currently being preloaded
const preloadingImages = new Set()

/**
 * GameImage Component
 *
 * Improved lazy-loading image component that:
 * - Uses standard <img> tags for CDN compatibility
 * - Does NOT add cache-busting on retries (allows browser caching)
 * - Tracks successfully loaded images in memory
 * - Has smarter retry logic with faster initial retries
 */
export default function GameImage({ src, alt, className }) {
  const [isLoaded, setIsLoaded] = useState(() => loadedImages.has(src))
  const [hasError, setHasError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isInView, setIsInView] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)
  const imgRef = useRef(null)
  const retryTimeoutRef = useRef(null)
  const isMountedRef = useRef(true)

  const MAX_RETRIES = 5
  const PLACEHOLDER = '/placeholder-game.png'

  // Check if src is valid
  const isValidSrc = src && src !== 'undefined' && src !== 'null' && src !== PLACEHOLDER

  // Intersection Observer for lazy loading
  useEffect(() => {
    isMountedRef.current = true

    // If already loaded before, show immediately
    if (loadedImages.has(src)) {
      setIsInView(true)
      setIsLoaded(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px', threshold: 0.01 }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      isMountedRef.current = false
      observer.disconnect()
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [src])

  // Reset state when src changes
  useEffect(() => {
    if (loadedImages.has(src)) {
      setIsLoaded(true)
      setHasError(false)
      setCurrentSrc(src)
    } else {
      setIsLoaded(false)
      setHasError(false)
      setRetryCount(0)
      setCurrentSrc(src)
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }
  }, [src])

  const handleLoad = () => {
    if (!isMountedRef.current) return

    setIsLoaded(true)
    setHasError(false)

    // Remember this image loaded successfully
    if (isValidSrc) {
      loadedImages.add(src)
    }
  }

  const handleError = () => {
    if (!isMountedRef.current) return

    if (retryCount < MAX_RETRIES && isValidSrc) {
      // Retry with faster initial delays: 500ms, 1s, 1.5s, 2s, 3s
      const delay = Math.min(500 + (retryCount * 500), 3000)

      retryTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          // Force image reload by briefly clearing src then setting it back
          setCurrentSrc('')
          setTimeout(() => {
            if (isMountedRef.current) {
              setCurrentSrc(src)
              setRetryCount(prev => prev + 1)
            }
          }, 50)
        }
      }, delay)
    } else {
      // Max retries reached - show placeholder
      setHasError(true)
      setCurrentSrc(PLACEHOLDER)
      setIsLoaded(true)
    }
  }

  // Determine what to display
  const displaySrc = isValidSrc ? currentSrc : PLACEHOLDER

  return (
    <div ref={imgRef} className={`game-image-container ${isLoaded ? 'loaded' : ''}`}>
      {isInView && displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          className={`${className} ${hasError ? 'error' : ''}`}
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

/**
 * Preload game images in the background
 * Uses Image() objects which respect browser cache
 */
export const preloadGameImages = (urls) => {
  if (!urls || !Array.isArray(urls)) return

  const validUrls = urls.filter(url =>
    url &&
    url !== 'undefined' &&
    url !== 'null' &&
    url !== '/placeholder-game.png' &&
    !loadedImages.has(url) &&
    !preloadingImages.has(url)
  )

  // Preload in small batches to avoid overwhelming the browser
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

    // Load next batch after a short delay
    if (start + BATCH_SIZE < validUrls.length) {
      setTimeout(loadBatch, 200)
    }
  }

  // Start preloading after a short delay to not block initial render
  setTimeout(loadBatch, 100)
}
