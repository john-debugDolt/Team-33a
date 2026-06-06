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

/**
 * Single-balance source for the UI.
 *
 * Returns `{ success, balance, currency, accountType }` regardless of pool —
 * caller doesn't need to know which one is being read. When bonus_wallet > 0
 * we surface that as THE balance (real wallet is server-locked). Otherwise
 * we surface the real wallet.
 *
 * Used by walletService.getBalance to keep all existing consumers consistent.
 */
export const getDisplayBalance = async (accountId) => {
  if (!accountId) return { success: false, balance: 0, currency: 'MYR', accountType: 'normal' }
  // Reuses the 5s cache, so this is one network call in practice.
  const bonusBalance = await getBonusBalance(accountId)
  if (bonusBalance > 0) {
    return { success: true, balance: bonusBalance, currency: 'MYR', accountType: 'bonus' }
  }
  // Fall through to real wallet via accountService.
  try {
    const { accountService } = await import('./accountService.js')
    const res = await accountService.getBalance(accountId)
    return {
      success: !!res?.success,
      balance: res?.balance ?? 0,
      currency: res?.currency || 'AUD',
      accountType: 'normal',
    }
  } catch (error) {
    console.warn('[BonusWallet] real balance fall-through failed:', error?.message)
    return { success: false, balance: 0, currency: 'MYR', accountType: 'normal' }
  }
}

export const clearBonusWalletCache = () => {
  cachedBalance = null
  cacheTimestamp = null
}

/**
 * Clear the player's bonus_wallet (zeros it). After this returns success,
 * the real wallet auto-unlocks server-side because bonus_wallet.balance === 0.
 *
 * Endpoint: POST https://accounts.team33.mx/api/wallets/{accountId}/clear-bonus
 *   ?referenceId=<required>
 *   &description=<optional>
 *
 * Per backend, referenceId is used for idempotency. We append a timestamp
 * so each click registers as a distinct operation.
 */
export const clearBonus = async (accountId, { description = '' } = {}) => {
  if (!accountId) return { success: false, error: 'No account ID' }
  try {
    const referenceId = `user-hit-clear-balance-${Date.now()}`
    const params = new URLSearchParams({ referenceId })
    if (description) params.set('description', description)
    const response = await fetch(
      `https://accounts.team33.mx/api/wallets/${accountId}/clear-bonus?${params}`,
      { method: 'POST' }
    )
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      return {
        success: false,
        error: data?.error || data?.message || `Clear failed (HTTP ${response.status})`,
        status: response.status,
        ...(data || {}),
      }
    }
    // Invalidate cache so the next balance read goes to the wire.
    clearBonusWalletCache()
    try {
      localStorage.setItem('team33_bonus_balance', '0')
      localStorage.setItem(
        'team33_bonus_meta',
        JSON.stringify({ accountId, balance: 0, fetchedAt: Date.now() })
      )
    } catch { /* ignore */ }
    return { success: true, ...(data || {}) }
  } catch (error) {
    return { success: false, error: error.message }
  }
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
  getDisplayBalance,
  bonusAliasParam,
  clearBonus,
  clearCache: clearBonusWalletCache,
}

export default bonusWalletService
