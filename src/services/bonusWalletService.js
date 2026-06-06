/**
 * Bonus Wallet Service — single source of truth for "is this player on bonus"
 *
 * Endpoint: GET https://seamless.team33.mx/api/bonus-wallet/{accountId}/balance
 *   → { accountId, balance }
 *
 * If balance > 0, the player's main wallet is LOCKED server-side and any
 * non-bonus-capable provider launch will be rejected with WalletRestricted.
 * Multi-operator-capable providers (MegaH5, Rich88, MetaGaming, SCR888H5,
 * EVO888H5) must route to their bonus operator when accountType === "bonus".
 *
 * accountType is derived directly: bonus_wallet.balance > 0 ? "bonus" : "normal"
 */

const BASE_URL = 'https://seamless.team33.mx'

let cachedBalance = null
let cacheTimestamp = null
const CACHE_TTL_MS = 5 * 1000 // 5s — short, since this gates real-money play

const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Returns the player's current bonus_wallet balance, or 0 on error / no account.
 * Cached for 5s to avoid hammering the endpoint during a launch flow.
 */
export const getBonusBalance = async (accountId, { force = false } = {}) => {
  if (!accountId) return 0
  if (!force && cachedBalance !== null && cacheTimestamp &&
      (Date.now() - cacheTimestamp < CACHE_TTL_MS) &&
      cachedBalance.accountId === accountId) {
    return cachedBalance.balance
  }
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/bonus-wallet/${accountId}/balance`
    )
    if (!response.ok) return 0
    const data = await response.json()
    const balance = Number(data?.balance) || 0
    cachedBalance = { accountId, balance }
    cacheTimestamp = Date.now()
    // Mirror to localStorage so the wallet popup / other consumers can read
    // it without spawning their own fetch.
    try {
      localStorage.setItem('team33_bonus_balance', String(balance))
      localStorage.setItem(
        'team33_bonus_meta',
        JSON.stringify({ accountId, balance, fetchedAt: Date.now() })
      )
    } catch { /* ignore */ }
    return balance
  } catch (error) {
    console.warn('[BonusWallet] balance fetch failed:', error?.message)
    return 0
  }
}

/**
 * "bonus" if bonus_wallet > 0, else "normal".
 * This is the ONLY routing signal the frontend needs for the 5 multi-operator
 * providers (MegaH5, Rich88, MetaGaming, SCR888H5, EVO888H5).
 */
export const getAccountType = async (accountId, opts) => {
  const balance = await getBonusBalance(accountId, opts)
  return balance > 0 ? 'bonus' : 'normal'
}

export const clearBonusWalletCache = () => {
  cachedBalance = null
  cacheTimestamp = null
}

/**
 * Operator alias param to add to the launch URL, per provider.
 * Returns null when accountType is 'normal' (use provider's default operator).
 */
export const bonusAliasParam = (providerId) => {
  switch (providerId) {
    case 'megah5':
    case 'metagaming':
      return { name: 'account', value: 'freecredit' }
    case 'rich88':
    case 'richgaming':
      return { name: 'operator', value: 'foc' }
    case 'scr888h5':
      return { name: 'account', value: 'bonus' }
    // EVO888H5 uses a separate endpoint family — no query param.
    case 'evo888h5':
      return null
    default:
      return null
  }
}

export const bonusWalletService = {
  getBonusBalance,
  getAccountType,
  bonusAliasParam,
  clearCache: clearBonusWalletCache,
}

export default bonusWalletService
