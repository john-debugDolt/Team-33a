/**
 * Pegasus (PGS / BWG / ION-Slot) Transfer Wallet Service
 * Base: /api/pegasus-transfer
 * Endpoints: /games, /launch, /withdraw, /exit, /balance, /deposit, /health
 *
 * Transfer wallet semantics: player credit lives on Pegasus' gameWallet.
 * - All endpoints take query strings (not JSON bodies)
 * - /launch returns `{code, data: {link}, success, duplicate, notFound, invalidParameter, systemError}`
 * - /balance has custom flat shape `{code, accountId, playerName, balance, currency, exists, suspended}`
 * - /exit, /deposit, /withdraw return `{code, data: {transactionNo, amount, beforeAmount, afterAmount}}`
 * - Currency: MYR displayed 1:1
 * - Catalogue has real thumbnails — `imageUrl` (portrait), `imageUrl_H` (landscape)
 * - Backend auto-withdraws after 20 min as safety net
 * - amount=0 on /launch is a valid no-deposit launch; on /withdraw use omit (backend reads live balance)
 */

const BASE_URL = 'https://seamless.team33.mx'

let cachedGames = null
let cacheTimestamp = null
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24h — /games is per-hour rate-limited at Pegasus

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

// Pegasus gameType (numeric) → our category vocabulary
const GAME_TYPE_CATEGORY = {
  1000: 'slots',
  2000: 'fishing',
  3000: 'arcade',
  4000: 'card',
  5000: 'live',
}

const pickName = (game, lang = 'en-us') => {
  const mappings = game.gameNameMappings
  if (Array.isArray(mappings)) {
    const match = mappings.find(m => m.languageCode === lang)
    if (match?.text) return match.text
  }
  return game.gameName || `Pegasus Game ${game.gameID}`
}

const transformGame = (game, defaultImage) => {
  const id = String(game.gameID ?? game.gameCode)
  const name = pickName(game)
  const rawType = String(game.gameType ?? 1000)
  const category = GAME_TYPE_CATEGORY[Number(rawType)] || 'slots'
  const image = game.imageUrl || game.imageUrl_H || defaultImage || '/placeholder-game.png'

  return {
    id: `pegasus-${id}`,
    gameId: id,
    slug: `pegasus-${id}`,
    name,
    provider: 'Pegasus',
    image,
    portraitImage: game.imageUrl || image,
    squareImage: image,
    landscapeImage: game.imageUrl_H || image,
    category,
    rawCategory: rawType,
    isHot: false,
    isNew: false,
    isPrePaidMode: !!game.isPrePaidMode,
    supportedOrientation: game.supportedOrientation,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Play ${name} on Pegasus.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Slots'],
    isPegasus: true,
    providerType: 'transfer',
    originalData: game,
  }
}

export const fetchPegasusGames = async (defaultImage) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/pegasus-transfer/games`)
    if (!response.ok) return { success: false, games: [], error: `HTTP ${response.status}` }
    const data = await response.json()
    const list = data?.data?.value
    if (!data?.success || !Array.isArray(list)) {
      return { success: false, games: [], error: data?.message || 'Catalogue unavailable' }
    }
    // Drop games disabled at Pegasus
    const active = list.filter(g => g.isLaunchAvailable !== false)
    return { success: true, games: active.map(g => transformGame(g, defaultImage)) }
  } catch (error) {
    console.warn('[PegasusService] games fetch error:', error.message)
    return { success: false, games: [], error: error.message }
  }
}

export const getAllPegasusGames = async (defaultImage) => {
  if (cachedGames && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedGames
  }
  const result = await fetchPegasusGames(defaultImage)
  if (result.success && result.games.length > 0) {
    cachedGames = result.games
    cacheTimestamp = Date.now()
    return result.games
  }
  return []
}

/**
 * Launch a Pegasus game session.
 * gameId optional (omit = generic lobby). amount omitted → sweep main wallet
 * (capped at 100k MYR). amount=0 → launch without depositing.
 */
export const launchPegasusGame = async (game, accountId, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }

    const gameId = game?.gameId ?? options.gameId
    const params = new URLSearchParams({ accountId })
    if (gameId) params.set('gameId', String(gameId))
    if (options.amount !== undefined && options.amount !== null) {
      params.set('amount', String(options.amount))
    }
    params.set('language', options.language || 'en-us')

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/pegasus-transfer/launch?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Launch failed (HTTP ${response.status})` }

    const data = await response.json()
    const link = data?.data?.link
    if (data.success && link) {
      return { success: true, gameUrl: link, ...data }
    }
    return {
      success: false,
      error: data.message || `Launch failed (${data.code})`,
      code: data.code,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Cash out + end session. Cancels auto-withdraw, logout, withdraw-all.
 * If Pegasus balance is already 0, backend short-circuits.
 */
export const exitPegasusGame = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/pegasus-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Exit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success || data.duplicate) return { success: true, ...data }
    // 9999 / 500001 = uncertain outcome, reconciler will resolve
    if (data.code === 9999 || data.systemError) {
      return { success: false, error: 'Cash-out in progress — refresh in a minute.', reconciling: true, ...data }
    }
    return { success: false, error: data.message || `Exit failed (${data.code})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Partial withdraw. Omit amount for withdraw-all (prefer /exit for that).
 */
export const withdrawPegasus = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const params = new URLSearchParams({ accountId })
    if (amount !== undefined && amount !== null && amount > 0) {
      params.set('amount', String(amount))
    }
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/pegasus-transfer/withdraw?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success || data.duplicate) return { success: true, ...data }
    return { success: false, error: data.message || `Withdraw failed (${data.code})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getPegasusBalance = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/pegasus-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    if (data.code === 0) {
      return {
        success: true,
        balance: data.balance ?? 0,
        currency: data.currency || 'MYR',
        playerName: data.playerName,
        exists: data.exists,
        suspended: data.suspended,
        ...data,
      }
    }
    return { success: false, error: `Balance fetch failed (${data.code})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToPegasus = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount) })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/pegasus-transfer/deposit?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success || data.duplicate) return { success: true, ...data }
    return { success: false, error: data.message || `Deposit failed (${data.code})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const clearPegasusCache = () => {
  cachedGames = null
  cacheTimestamp = null
}

export const pegasusService = {
  fetchGames: fetchPegasusGames,
  getAllGames: getAllPegasusGames,
  launchGame: launchPegasusGame,
  exitGame: exitPegasusGame,
  withdraw: withdrawPegasus,
  deposit: depositToPegasus,
  getBalance: getPegasusBalance,
  clearCache: clearPegasusCache,
}

export default pegasusService
