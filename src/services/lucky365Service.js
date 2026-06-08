/**
 * Lucky365 Transfer Wallet Service
 * Base: /api/lucky365-transfer
 * Endpoints: /games, /launch, /withdraw, /exit, /balance, /deposit, /player, /transfer, /transfers, /health
 *
 * Transfer wallet semantics: player credit lives on Lucky365's side while playing.
 * - /launch takes JSON body
 * - /exit, /balance, /deposit, /withdraw, /games take query params
 * - /deposit/withdraw use Idempotency-Key HTTP header
 * - Launch URL field is `url` (linkgame format)
 * - Backend auto-withdraws after 20 min as safety net
 * - State machine: OK / CONFIRMED / RECONCILING / FAILED / DEPOSIT_FAILED / PENDING
 * - Codes: S100 = OK, F6006 = insufficient main balance, F7502 = blocked
 */

import { getGameIcon, pickProviderIcon } from './gameIconRegistry'

const BASE_URL = 'https://seamless.team33.mx'

let cachedGames = null
let cacheTimestamp = null
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24h

const fetchWithTimeout = async (url, options = {}, timeout = 20000) => {
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

const resolveAccountId = (accountId) => {
  if (accountId) return accountId
  try {
    const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}')
    return user.accountId
  } catch {
    return null
  }
}

const newRequestId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* ignore */ }
  return 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 12)
}

const isMobileDevice = () => {
  try {
    return window.matchMedia && window.matchMedia('(pointer:coarse)').matches
  } catch {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  }
}

// Lucky365 type numerics → our category vocabulary (best guess from prod data)
const TYPE_CATEGORY = {
  10: 'slots',
  13: 'card',
  16: 'arcade',
}

const transformGame = (game, defaultImage) => {
  const id = String(game.gameCode || game.gameId || '')
  const name = game.gameName || `Lucky365 ${id}`
  const rawType = String(game.type ?? 10)
  const category = TYPE_CATEGORY[Number(rawType)] || 'slots'
  const bundled = getGameIcon('Lucky365', name) || pickProviderIcon('Lucky365', id)
  const image = bundled || game.imageUrl || game.icon || defaultImage || '/placeholder-game.png'

  return {
    id: `lucky365-${id}`,
    gameId: id,
    slug: `lucky365-${id}`,
    name,
    provider: 'Lucky365',
    image,
    portraitImage: image,
    squareImage: image,
    category,
    rawCategory: rawType,
    isHot: false,
    isNew: false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Play ${name} on Lucky365.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Slots'],
    isLucky365: true,
    providerType: 'transfer',
    originalData: game,
  }
}

export const fetchLucky365Games = async (defaultImage) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/lucky365-transfer/games`)
    if (!response.ok) return { success: false, games: [], error: `HTTP ${response.status}` }
    const data = await response.json()
    // Real envelope: { code: "S100", data: { games: [...] } } — spec said `items` but live returns `games`
    const list = data?.data?.games || data?.data?.items || data?.games || []
    if (data?.code !== 'S100' || !Array.isArray(list)) {
      return { success: false, games: [], error: data?.message || 'Catalogue unavailable' }
    }
    return { success: true, games: list.map(g => transformGame(g, defaultImage)) }
  } catch (error) {
    console.warn('[Lucky365Service] games fetch error:', error.message)
    return { success: false, games: [], error: error.message }
  }
}

export const getAllLucky365Games = async (defaultImage) => {
  if (cachedGames && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedGames
  }
  const result = await fetchLucky365Games(defaultImage)
  if (result.success && result.games.length > 0) {
    cachedGames = result.games
    cacheTimestamp = Date.now()
    return result.games
  }
  return []
}

/**
 * Launch a Lucky365 game session.
 * gameCode optional (omit → lobby). amount omitted → sweep main wallet (capped at 100k).
 */
export const launchLucky365Game = async (game, accountId, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }

    const gameCode = game?.gameId ?? options.gameCode
    const requestId = options.requestId || newRequestId()
    const isMobile = isMobileDevice()

    const body = {
      accountId,
      requestId,
      language: options.language || 'en-us',
      appType: options.appType ?? 1, // 1=Web, 2=iOS, 3=Android
      deviceType: options.deviceType ?? 1,
    }
    if (gameCode) body.gameCode = gameCode
    if (options.amount !== undefined && options.amount !== null) body.amount = options.amount
    if (options.playerName) body.playerName = options.playerName
    if (options.callbackAddress) body.callbackAddress = options.callbackAddress

    const response = await fetchWithTimeout(`${BASE_URL}/api/lucky365-transfer/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) return { success: false, error: `Launch failed (HTTP ${response.status})`, requestId }

    const data = await response.json()
    if (data.state === 'OK' && data.url) {
      return { success: true, gameUrl: data.url, requestId, ...data }
    }
    return {
      success: false,
      error: data.message || `Launch failed (${data.code || data.state})`,
      code: data.code,
      state: data.state,
      requestId,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * End session + sweep all funds back. Right call for explicit cash-out.
 */
export const exitLucky365Game = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/lucky365-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Exit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED' || data.code === 'S100') return { success: true, ...data }
    if (data.state === 'RECONCILING') {
      return { success: false, error: 'Processing — balance will update shortly.', reconciling: true, ...data }
    }
    return { success: false, error: data.message || `Exit failed (${data.code || data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Partial withdraw. Omit amount → withdraw-all (but prefer /exit for that).
 */
export const withdrawLucky365 = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const params = new URLSearchParams({ accountId })
    if (amount !== undefined && amount !== null && amount > 0) params.set('amount', String(amount))

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/lucky365-transfer/withdraw?${params}`,
      { method: 'POST', headers: { 'Idempotency-Key': newRequestId() } }
    )
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    if (data.state === 'RECONCILING') {
      return { success: false, error: 'Processing — balance will update shortly.', reconciling: true, ...data }
    }
    return { success: false, error: data.message || `Withdraw failed (${data.code})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getLucky365Balance = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/lucky365-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    if (data.loginId || typeof data.balance === 'number') {
      return {
        success: true,
        balance: data.balance ?? 0,
        reward: data.reward ?? 0,
        userId: data.userId,
        loginId: data.loginId,
        blocked: !!data.blocked,
        status: data.status,
        ...data,
      }
    }
    return { success: false, error: 'Balance fetch failed', ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToLucky365 = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount) })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/lucky365-transfer/deposit?${params}`,
      { method: 'POST', headers: { 'Idempotency-Key': newRequestId() } }
    )
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    return { success: false, error: data.message || `Deposit failed (${data.code})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const clearLucky365Cache = () => {
  cachedGames = null
  cacheTimestamp = null
}

export const lucky365Service = {
  fetchGames: fetchLucky365Games,
  getAllGames: getAllLucky365Games,
  launchGame: launchLucky365Game,
  exitGame: exitLucky365Game,
  withdraw: withdrawLucky365,
  deposit: depositToLucky365,
  getBalance: getLucky365Balance,
  clearCache: clearLucky365Cache,
}

export default lucky365Service
