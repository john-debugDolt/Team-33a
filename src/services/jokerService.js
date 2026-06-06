/**
 * Joker (Joker Gaming / JKR) Transfer Wallet Service
 * Base: /api/joker-transfer
 * Endpoints: /games, /launch, /withdraw, /exit, /balance, /deposit, /health
 *
 * Transfer wallet semantics: player chips live on Joker's side while playing.
 * - /launch takes a JSON body
 * - /exit, /deposit, /withdraw, /balance take query params
 * - URL field is `url`
 * - State: OK / DEPOSIT_FAILED / LAUNCH_FAILED on launch
 * - State: CONFIRMED / FAILED / RECONCILING on transfer endpoints
 * - Currency: MYR 1:1 (game points scale ×100 in-game)
 * - Backend auto-withdraws after 20 min as safety net
 * - /games currently 599s server-side (backend buffer cap < ~250KB payload)
 */

const BASE_URL = 'https://seamless.team33.mx'

let cachedGames = null
let cacheTimestamp = null
const CACHE_DURATION = 24 * 60 * 60 * 1000

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

const transformGame = (game, defaultImage) => {
  const id = String(game.Code || game.code || game.GameCode || game.id || '')
  const name = game.Name || game.GameName || game.name || `Joker Game ${id}`
  const rawType = String(game.Type || game.GameType || 'slots').toLowerCase()
  const category = ['fish', 'fishing'].includes(rawType) ? 'fishing' :
                   ['table', 'card'].includes(rawType) ? 'card' :
                   rawType === 'arcade' ? 'arcade' : 'slots'
  const image = game.ImageURL || game.ImageUrl || game.imageUrl || defaultImage || '/placeholder-game.png'

  return {
    id: `joker-${id}`,
    gameId: id,
    slug: `joker-${id}`,
    name,
    provider: 'Joker',
    image,
    portraitImage: image,
    squareImage: image,
    category,
    rawCategory: rawType,
    isHot: !!game.Hot,
    isNew: !!game.New,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Play ${name} on Joker Gaming.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Slots'],
    isJoker: true,
    providerType: 'transfer',
    originalData: game,
  }
}

export const fetchJokerGames = async (defaultImage) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/joker-transfer/games`)
    if (!response.ok) return { success: false, games: [], error: `HTTP ${response.status}` }
    const data = await response.json()
    if (data?.success === false) {
      console.warn('[JokerService] /games failed:', data?.message)
      return { success: false, games: [], error: data?.message }
    }
    const list = data?.ListGames || data?.data?.ListGames || data?.data || []
    if (!Array.isArray(list) || list.length === 0) {
      return { success: false, games: [], error: 'empty catalogue' }
    }
    return { success: true, games: list.map(g => transformGame(g, defaultImage)) }
  } catch (error) {
    console.warn('[JokerService] games fetch error:', error.message)
    return { success: false, games: [], error: error.message }
  }
}

export const getAllJokerGames = async (defaultImage) => {
  if (cachedGames && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedGames
  }
  const result = await fetchJokerGames(defaultImage)
  if (result.success && result.games.length > 0) {
    cachedGames = result.games
    cacheTimestamp = Date.now()
    return result.games
  }
  return []
}

/**
 * Launch a Joker game session.
 * gameCode optional (omit → lobby). amount null/0 → sweep main wallet (cap 100k).
 */
export const launchJokerGame = async (game, accountId, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }

    const gameCode = game?.gameId ?? options.gameCode
    const requestId = options.requestId || newRequestId()
    const body = {
      accountId,
      requestId,
      language: options.language || 'en',
      mobile: options.mobile ?? false,
    }
    if (gameCode) body.gameCode = gameCode
    if (options.amount !== undefined && options.amount !== null) body.amount = options.amount
    if (options.username) body.username = options.username
    if (options.template) body.template = options.template

    const response = await fetchWithTimeout(`${BASE_URL}/api/joker-transfer/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      return {
        success: false,
        error: data?.message || `Launch failed (HTTP ${response.status})`,
        state: data?.state,
        requestId,
        ...data,
      }
    }

    const data = await response.json()
    if (data.state === 'OK' && data.url) {
      return { success: true, gameUrl: data.url, requestId, ...data }
    }
    return {
      success: false,
      error: data.message || `Launch failed (${data.state})`,
      state: data.state,
      requestId,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Sign-out + sweep all chips back. Right call for explicit cash-out.
 */
export const exitJokerGame = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/joker-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Exit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    if (data.state === 'RECONCILING') {
      return { success: false, error: 'Processing — balance will update shortly.', reconciling: true, ...data }
    }
    return { success: false, error: data.message || `Exit failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const withdrawJoker = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const params = new URLSearchParams({ accountId, requestId: newRequestId() })
    if (amount !== undefined && amount !== null && amount > 0) params.set('amount', String(amount))

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/joker-transfer/withdraw?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    if (data.state === 'RECONCILING') {
      return { success: false, error: 'Processing — balance will update shortly.', reconciling: true, ...data }
    }
    return { success: false, error: data.message || `Withdraw failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getJokerBalance = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/joker-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    if (data.httpStatus === 200) {
      return { success: true, balance: data.credit ?? 0, username: data.username, ...data }
    }
    return { success: false, error: data.message || 'Balance fetch failed' }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToJoker = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount), requestId: newRequestId() })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/joker-transfer/deposit?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    return { success: false, error: data.message || `Deposit failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const clearJokerCache = () => {
  cachedGames = null
  cacheTimestamp = null
}

export const jokerService = {
  fetchGames: fetchJokerGames,
  getAllGames: getAllJokerGames,
  launchGame: launchJokerGame,
  exitGame: exitJokerGame,
  withdraw: withdrawJoker,
  deposit: depositToJoker,
  getBalance: getJokerBalance,
  clearCache: clearJokerCache,
}

export default jokerService
