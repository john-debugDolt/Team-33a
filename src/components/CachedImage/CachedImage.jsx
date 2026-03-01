import { useState, useEffect, useRef } from 'react'
import './CachedImage.css'

// IndexedDB configuration for image caching
const DB_NAME = 'team33_image_cache'
const DB_VERSION = 1
const STORE_NAME = 'images'
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// In-memory cache for faster access (session-level)
const memoryCache = new Map()

// IndexedDB helper functions
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

// Get cached image from IndexedDB
const getCachedImage = async (url) => {
  // Check memory cache first (fastest)
  if (memoryCache.has(url)) {
    return memoryCache.get(url)
  }

  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(url)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (result && Date.now() - result.timestamp < CACHE_EXPIRY) {
          // Cache hit and not expired - store in memory for faster access
          memoryCache.set(url, result.blob)
          resolve(result.blob)
        } else {
          resolve(null) // Cache miss or expired
        }
      }
    })
  } catch (error) {
    console.warn('IndexedDB cache read error:', error)
    return null
  }
}

// Save image to IndexedDB cache
const cacheImage = async (url, blob) => {
  // Store in memory cache
  memoryCache.set(url, blob)

  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({
        url,
        blob,
        timestamp: Date.now()
      })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch (error) {
    console.warn('IndexedDB cache write error:', error)
  }
}

// Fetch image and convert to blob
const fetchImageAsBlob = async (url) => {
  const response = await fetch(url, {
    mode: 'cors',
    cache: 'force-cache' // Use browser cache if available
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return await response.blob()
}

// Clean up expired cache entries periodically
const cleanupCache = async () => {
  try {
    const db = await openDB()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('timestamp')
    const cutoff = Date.now() - CACHE_EXPIRY

    const request = index.openCursor(IDBKeyRange.upperBound(cutoff))
    request.onsuccess = (event) => {
      const cursor = event.target.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
  } catch (error) {
    console.warn('Cache cleanup error:', error)
  }
}

// Run cleanup on module load (once per session)
if (typeof window !== 'undefined') {
  setTimeout(cleanupCache, 5000) // Delay to not block initial load
}

/**
 * CachedImage Component
 *
 * A lazy-loading image component with:
 * - IndexedDB caching for 24 hours
 * - Memory cache for instant display of already-loaded images
 * - Retry logic with exponential backoff
 * - Intersection Observer for lazy loading
 * - Graceful fallback to placeholder
 */
export default function CachedImage({ src, alt, className, placeholder = '/placeholder-game.png' }) {
  const [imageSrc, setImageSrc] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const imgRef = useRef(null)
  const retryTimeoutRef = useRef(null)
  const isMountedRef = useRef(true)

  const MAX_RETRIES = 4
  const BASE_RETRY_DELAY = 1500 // 1.5 seconds

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px', threshold: 0.01 } // Start loading 300px before visible
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => {
      observer.disconnect()
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      isMountedRef.current = false
    }
  }, [])

  // Reset state when src changes
  useEffect(() => {
    setImageSrc(null)
    setIsLoaded(false)
    setIsError(false)
    setRetryCount(0)
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }
  }, [src])

  // Load image when in view
  useEffect(() => {
    if (!isInView || !src || src === 'undefined' || src === 'null') {
      if (isInView && (!src || src === 'undefined' || src === 'null')) {
        setImageSrc(placeholder)
        setIsLoaded(true)
      }
      return
    }

    const loadImage = async () => {
      try {
        // Try to get from cache first
        const cachedBlob = await getCachedImage(src)

        if (cachedBlob && isMountedRef.current) {
          // Use cached image
          const objectUrl = URL.createObjectURL(cachedBlob)
          setImageSrc(objectUrl)
          setIsLoaded(true)
          return
        }

        // Fetch and cache the image
        const blob = await fetchImageAsBlob(src)

        if (!isMountedRef.current) return

        // Cache for future use
        await cacheImage(src, blob)

        // Display the image
        const objectUrl = URL.createObjectURL(blob)
        setImageSrc(objectUrl)
        setIsLoaded(true)
        setIsError(false)

      } catch (error) {
        if (!isMountedRef.current) return

        console.warn(`Image load failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`, src, error.message)

        if (retryCount < MAX_RETRIES) {
          // Retry with exponential backoff
          const delay = BASE_RETRY_DELAY * Math.pow(1.5, retryCount)
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setRetryCount(prev => prev + 1)
            }
          }, delay)
        } else {
          // Max retries reached - show placeholder
          setIsError(true)
          setImageSrc(placeholder)
          setIsLoaded(true)
        }
      }
    }

    loadImage()
  }, [isInView, src, retryCount, placeholder])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc)
      }
    }
  }, [imageSrc])

  return (
    <div ref={imgRef} className={`cached-image-container ${isLoaded ? 'loaded' : ''}`}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          className={`${className} ${isError ? 'error' : ''}`}
          style={{ opacity: isLoaded ? 1 : 0 }}
        />
      ) : (
        <div className="image-placeholder" />
      )}
      {!isLoaded && isInView && <div className="image-loader" />}
    </div>
  )
}

/**
 * Preload images into cache
 * Call this with game image URLs to preload them in the background
 */
export const preloadImages = async (urls) => {
  const validUrls = urls.filter(url => url && url !== 'undefined' && url !== 'null' && url !== '/placeholder-game.png')

  // Preload in batches to avoid overwhelming the browser
  const BATCH_SIZE = 5

  for (let i = 0; i < validUrls.length; i += BATCH_SIZE) {
    const batch = validUrls.slice(i, i + BATCH_SIZE)

    await Promise.allSettled(
      batch.map(async (url) => {
        // Skip if already cached
        if (memoryCache.has(url)) return

        try {
          const cached = await getCachedImage(url)
          if (cached) return // Already in IndexedDB

          const blob = await fetchImageAsBlob(url)
          await cacheImage(url, blob)
        } catch (error) {
          // Silently fail for preloading - not critical
        }
      })
    )

    // Small delay between batches to not block main thread
    if (i + BATCH_SIZE < validUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

/**
 * Clear the image cache
 * Useful for debugging or when user logs out
 */
export const clearImageCache = async () => {
  memoryCache.clear()

  try {
    const db = await openDB()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.clear()
  } catch (error) {
    console.warn('Failed to clear image cache:', error)
  }
}
