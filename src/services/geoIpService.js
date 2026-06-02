/**
 * GeoIP detection — used by geo-restricted providers (JDB) to gate launches.
 * Caches the result in localStorage for 1h so we don't hit the API on every
 * game click.
 */

const STORAGE_KEY = 'geoip_country_v1'
const TTL_MS = 60 * 60 * 1000 // 1h

const readCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (!obj?.country || !obj?.fetchedAt) return null
    if (Date.now() - obj.fetchedAt > TTL_MS) return null
    return obj
  } catch {
    return null
  }
}

const writeCache = (country, ip) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ country, ip, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

/**
 * Returns the user's country code (e.g. 'AU') or null if detection failed.
 * Cached for 1h in localStorage.
 */
export const getCountry = async () => {
  const cached = readCache()
  if (cached) return cached.country

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const response = await fetch('https://api.country.is/', { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const data = await response.json()
    if (data?.country) {
      writeCache(data.country, data.ip)
      return data.country
    }
    return null
  } catch (error) {
    console.warn('[GeoIP] detection failed:', error?.message)
    return null
  }
}

export const getCachedIp = () => readCache()?.ip || null

export const clearGeoIpCache = () => {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

export default { getCountry, getCachedIp, clearGeoIpCache }
