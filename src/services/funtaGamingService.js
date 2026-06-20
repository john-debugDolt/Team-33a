/**
 * FunTa Gaming Transfer Wallet Service
 * Base: /api/funta-transfer
 * Endpoints: /games, /launch, /withdraw, /exit, /balance, /deposit, /health
 *
 * Transfer wallet semantics: player funds live on FunTa's side while playing.
 * - /launch requires gameId (no lobby URL exists)
 * - /launch with no amount sweeps main wallet (capped at 100k MYR)
 * - /withdraw requires amount; use /exit for "cash out everything"
 * - Currency: MYR (ISO 458) displayed 1:1
 * - Backend auto-withdraws after ~20 min as safety net
 * - Response carries top-level booleans for branching without parsing codes
 */

import { getGameIcon, pickProviderIcon } from './gameIconRegistry'

const BASE_URL = 'https://accounts.team33.mx'
const FUNTA_MYR = 458

let cachedGames = null
let cacheTimestamp = null
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24h — catalogue is stable

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

// FunTa name keys vary by locale: name_en, name_zh, name_cn, name_ja, etc.
const pickName = (game) =>
  game.name_en || game.name_zh || game.name_cn || game.name || `FunTa Game ${game.id}`

const transformGame = (game, defaultImage) => {
  const name = pickName(game)
  const id = game.id
  const category = (game.category || 'slots').toLowerCase()
  const bundled = getGameIcon('Funta Gaming', name) || pickProviderIcon('Funta Gaming', id)
  const image = bundled || defaultImage || '/placeholder-game.png'

  return {
    id: `funta-${id}`,
    gameId: id,
    slug: `funta-${id}`,
    name,
    provider: 'FunTa',
    image,
    portraitImage: image,
    squareImage: image,
    category,
    rawCategory: category,
    isHot: false,
    isNew: false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Play ${name} on FunTa Gaming.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols'],
    isFunTa: true,
    providerType: 'transfer',
    blockCountry: game.block_country || [],
    edition: game.edition,
    originalData: game,
  }
}

export const fetchFunTaGames = async (defaultImage) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/funta-transfer/games`)
    if (!response.ok) return { success: false, games: [], error: `HTTP ${response.status}` }
    const data = await response.json()
    if (!data?.success || !Array.isArray(data.games)) {
      return { success: false, games: [], error: data?.error_msg || 'Catalogue unavailable' }
    }
    // Keep only enabled games that support MYR (458)
    const valid = data.games.filter(g =>
      g.enable === 1 && Array.isArray(g.currency) && g.currency.includes(FUNTA_MYR)
    )
    return { success: true, games: valid.map(g => transformGame(g, defaultImage)) }
  } catch (error) {
    console.warn('[FunTaService] games fetch error:', error.message)
    return { success: false, games: [], error: error.message }
  }
}

export const getAllFunTaGames = async (defaultImage) => {
  if (cachedGames && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedGames
  }
  const result = await fetchFunTaGames(defaultImage)
  if (result.success && result.games.length > 0) {
    cachedGames = result.games
    cacheTimestamp = Date.now()
    return result.games
  }
  return []
}

/**
 * Launch a FunTa game session.
 * gameId is REQUIRED — there is no lobby URL. Omitting it returns 04-361.
 * amount omitted → sweep main wallet (capped at 100k MYR by backend).
 */
export const launchFunTaGame = async (game, accountId, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }

    const gameId = game?.gameId ?? options.gameId
    if (!gameId) return { success: false, error: 'Game not selected' }

    const params = new URLSearchParams({ accountId, gameId: String(gameId) })
    if (options.amount !== undefined && options.amount !== null) {
      params.set('amount', String(options.amount))
    }
    params.set('lang', options.lang || 'en')
    if (options.nickname) params.set('nickname', options.nickname)
    if (options.maxBetLimit) params.set('maxBetLimit', String(options.maxBetLimit))

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/funta-transfer/launch?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Launch failed (HTTP ${response.status})` }

    const data = await response.json()
    // FunTa uses `link` (not `gameUrl`)
    if (data.success && data.link) {
      return { success: true, gameUrl: data.link, link: data.link, ...data }
    }
    return {
      success: false,
      error: data.error_msg || `Launch failed (${data.error_code || 'unknown'})`,
      errorCode: data.error_code,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Withdraw a specific amount from FunTa back to main wallet.
 * For "withdraw all" use exitFunTaGame instead.
 */
export const withdrawFunTa = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount) })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/funta-transfer/withdraw?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success || data.duplicateReference) return { success: true, ...data }
    return { success: false, error: data.error_msg || `Withdraw failed (${data.error_code})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Withdraw-all and end the session — the right call for "Cash out" buttons.
 * Backend reads FunTa balance, withdraws that amount, cancels auto-withdraw timer.
 * If balance is already 0, returns success immediately.
 */
export const exitFunTaGame = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/funta-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Exit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success || data.duplicateReference) return { success: true, ...data }
    return { success: false, error: data.error_msg || `Exit failed (${data.error_code})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getFunTaBalance = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/funta-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    return {
      success: true,
      balance: data.balance ?? 0,
      currency: data.currency,
      username: data.username,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToFunTa = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount) })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/funta-transfer/deposit?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success || data.duplicateReference) return { success: true, ...data }
    return { success: false, error: data.error_msg || `Deposit failed (${data.error_code})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const clearFunTaCache = () => {
  cachedGames = null
  cacheTimestamp = null
}

export const funtaGamingService = {
  fetchGames: fetchFunTaGames,
  getAllGames: getAllFunTaGames,
  launchGame: launchFunTaGame,
  exitGame: exitFunTaGame,
  withdraw: withdrawFunTa,
  deposit: depositToFunTa,
  getBalance: getFunTaBalance,
  clearCache: clearFunTaCache,
}

export default funtaGamingService
