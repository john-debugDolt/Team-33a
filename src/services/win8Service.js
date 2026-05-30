/**
 * 3win8 Transfer Wallet Service
 * Base: /api/win8-transfer
 * Endpoints: /games, /platforms, /launch, /withdraw, /exit, /balance, /deposit, /health
 *
 * Transfer wallet semantics: player chips live on 3win8's side while playing.
 * - /launch, /withdraw, /deposit take JSON bodies
 * - /exit, /balance, /games, /platforms take query params
 * - Currency: 1:1 (e.g. AUD), no coin conversion
 * - balance comes back as a STRING with 4 decimal places
 * - Sub-wallet footgun: launching a casino game moves chips from `main`
 *   to a category bucket; /withdraw may need walletType matching game_type
 * - Backend auto-withdraws after 20 min as safety net
 */

const BASE_URL = 'https://seamless.team33.mx'

let cachedGames = null
let cacheTimestamp = null
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24h

// Static fallback used when /games upstream is unreachable.
// Only entries confirmed in the spec — guessing codes triggers PLAY_GAME_FAIL.
const STATIC_GAMES = [
  { game_code: 'casino_sicbo', game_name: 'Sic Bo', game_type: 'online_casino', game_h5: true },
  { game_code: 'casino_baccarat', game_name: 'Baccarat', game_type: 'online_casino', game_h5: true },
]

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

const postJson = (url, body) =>
  fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const resolveAccountId = (accountId) => {
  if (accountId) return accountId
  try {
    const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}')
    return user.accountId
  } catch {
    return null
  }
}

// Map 3win8 game_type → our category vocabulary
const GAME_TYPE_CATEGORY = {
  online_casino: 'casino',
  singleplayer_games: 'slots',
  multiplayer_p2p: 'card',
  online_games: 'arcade',
}

const transformGame = (game, defaultImage) => {
  const code = game.game_code
  const name = game.game_name || `3win8 Game ${code}`
  const rawType = game.game_type || 'online_casino'
  const category = GAME_TYPE_CATEGORY[rawType] || 'slots'
  // 3win8 catalogue ships real image URLs in game_image_url
  const image = game.game_image_url || defaultImage || '/placeholder-game.png'

  return {
    id: `win8-${code}`,
    gameId: code,
    slug: `win8-${code}`,
    name,
    provider: '3win8',
    image,
    portraitImage: image,
    squareImage: image,
    category,
    rawCategory: rawType,
    isHot: false,
    isNew: false,
    h5: !!game.game_h5,
    walletType: rawType, // for the sub-wallet workaround on withdraw
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Play ${name} on 3win8.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Live Casino'],
    isWin8: true,
    providerType: 'transfer',
    originalData: game,
  }
}

export const fetchWin8Games = async (defaultImage) => {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/win8-transfer/games?status=1`
    )
    if (response.ok) {
      const data = await response.json()
      if (data?.status === 'OK' && Array.isArray(data.list) && data.list.length > 0) {
        return { success: true, games: data.list.map(g => transformGame(g, defaultImage)), source: 'live' }
      }
    }
    console.warn('[Win8Service] /games unavailable, using static catalogue')
    return { success: true, games: STATIC_GAMES.map(g => transformGame(g, defaultImage)), source: 'static' }
  } catch (error) {
    console.warn('[Win8Service] games fetch error, using static:', error.message)
    return { success: true, games: STATIC_GAMES.map(g => transformGame(g, defaultImage)), source: 'static' }
  }
}

export const getAllWin8Games = async (defaultImage) => {
  if (cachedGames && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedGames
  }
  const result = await fetchWin8Games(defaultImage)
  if (result.success && result.games.length > 0) {
    cachedGames = result.games
    cacheTimestamp = Date.now()
    return result.games
  }
  return []
}

/**
 * Launch a 3win8 game session. Atomic provision + deposit + URL.
 * gameCode required (or platformCode). amount omitted → sweep main wallet
 * (capped at 100k).
 */
export const launchWin8Game = async (game, accountId, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }

    const gameCode = game?.gameId ?? options.gameCode
    const platformCode = options.platformCode
    if (!gameCode && !platformCode) {
      return { success: false, error: 'Game not selected' }
    }

    const body = {
      accountId,
      language: options.language || 'eng',
    }
    if (gameCode) body.gameCode = gameCode
    if (platformCode) body.platformCode = platformCode
    if (options.amount !== undefined && options.amount !== null) {
      body.amount = options.amount
    }
    if (options.gameSupport) body.gameSupport = options.gameSupport
    if (options.mobile !== undefined) body.mobile = options.mobile
    if (options.walletType) body.walletType = options.walletType
    if (options.requestId) body.requestId = options.requestId
    if (options.backUrl) body.backUrl = options.backUrl
    if (options.nickname) body.nickname = options.nickname

    const response = await postJson(`${BASE_URL}/api/win8-transfer/launch`, body)
    if (!response.ok) return { success: false, error: `Launch failed (HTTP ${response.status})` }
    const data = await response.json()

    if (data.state === 'OK' && data.url) {
      return { success: true, gameUrl: data.url, ...data }
    }
    return {
      success: false,
      error: data.message || `Launch failed (${data.errorCode || data.state})`,
      errorCode: data.errorCode,
      state: data.state,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Sweep all 3win8 chips back to main wallet + cancel auto-withdraw.
 * Use on explicit cash-out / game close.
 */
export const exitWin8Game = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/win8-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Exit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    if (data.state === 'RECONCILING') {
      return { success: false, error: 'Processing — balance will update shortly.', reconciling: true, ...data }
    }
    // INSUFFICIENT_USER_FUND on /exit just means main was already 0 — treat as success
    if (data.errorCode === 'INSUFFICIENT_USER_FUND') {
      return { success: true, alreadyZero: true, ...data }
    }
    return { success: false, error: data.message || `Exit failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Partial withdraw. Omit amount for withdraw-all (prefer /exit for that).
 * walletType defaults to main; pass game category for sub-wallet workaround.
 */
export const withdrawWin8 = async (accountId, amount, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const body = { accountId }
    if (amount !== undefined && amount !== null && amount > 0) body.amount = amount
    if (options.walletType) body.walletType = options.walletType
    if (options.requestId) body.requestId = options.requestId

    const response = await postJson(`${BASE_URL}/api/win8-transfer/withdraw`, body)
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    if (data.state === 'RECONCILING') {
      return { success: false, error: 'Processing — balance will update shortly.', reconciling: true, ...data }
    }
    return { success: false, error: data.message || `Withdraw failed (${data.errorCode || data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getWin8Balance = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/win8-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    if (data.status === 'OK') {
      return {
        success: true,
        // balance arrives as a 4-decimal string — parse it
        balance: parseFloat(data.balance || '0') || 0,
        userStatus: data.userStatus,
        username: data.username,
        ...data,
      }
    }
    return { success: false, error: `Balance fetch failed (${data.status})` }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToWin8 = async (accountId, amount, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const body = { accountId, amount }
    if (options.walletType) body.walletType = options.walletType
    if (options.requestId) body.requestId = options.requestId

    const response = await postJson(`${BASE_URL}/api/win8-transfer/deposit`, body)
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    return { success: false, error: data.message || `Deposit failed (${data.errorCode || data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const clearWin8Cache = () => {
  cachedGames = null
  cacheTimestamp = null
}

export const win8Service = {
  fetchGames: fetchWin8Games,
  getAllGames: getAllWin8Games,
  launchGame: launchWin8Game,
  exitGame: exitWin8Game,
  withdraw: withdrawWin8,
  deposit: depositToWin8,
  getBalance: getWin8Balance,
  clearCache: clearWin8Cache,
  STATIC_GAMES,
}

export default win8Service
