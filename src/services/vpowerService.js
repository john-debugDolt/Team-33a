/**
 * VPower Gaming Transfer Wallet Service
 * Base: /api/vpower-transfer
 * Endpoints: /games, /launch, /withdraw, /exit, /balance, /deposit, /health
 *
 * Transfer wallet semantics: player funds live on VPower's side while playing.
 * - All endpoints take query strings (not JSON bodies)
 * - gameId required (no lobby)
 * - /launch returns flat shape: { status, url, token, vpUsername, errorCode, message }
 * - Other endpoints return VPowerTransferResponse with pre-computed booleans
 * - Currency: AUD displayed 1:1
 * - 7-day token lifetime; re-call /launch to refresh
 * - /games currently 500s in prod (NAT IP allowlist) — fallback static list embedded
 */

const BASE_URL = 'https://seamless.team33.mx'

let cachedGames = null
let cacheTimestamp = null
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24h

// Static catalogue per spec §7 — used when /games is unavailable.
// Cross-reference with /games once that endpoint is healthy.
const STATIC_GAMES = [
  // Fishing
  { gameid: 1001, name: 'JinChanBuYu', type: 'fish' },
  { gameid: 1002, name: 'LiKuiBuYu', type: 'fish' },
  { gameid: 1004, name: 'Ocean King III', type: 'fish' },
  { gameid: 1005, name: 'YaoQianShu', type: 'fish' },
  { gameid: 1006, name: 'Mermaid Beauty', type: 'fish' },
  { gameid: 1007, name: 'HaiDiLao', type: 'fish' },
  { gameid: 1008, name: 'Kirin Storm', type: 'fish' },
  { gameid: 1009, name: 'Spongebob', type: 'fish' },
  { gameid: 1010, name: 'Insect Paradise', type: 'fish' },
  { gameid: 1011, name: 'Bird Hunter', type: 'fish' },
  { gameid: 1012, name: "Fisherman's Wharf", type: 'fish' },
  { gameid: 1016, name: 'Thanos Avengers', type: 'fish' },
  { gameid: 1020, name: 'Ocean Paradise', type: 'fish' },
  { gameid: 1021, name: 'Thunder Dragon', type: 'fish' },
  { gameid: 1022, name: 'Master Of The Deep', type: 'fish' },
  { gameid: 1023, name: 'Fire Phoenix', type: 'fish' },
  { gameid: 1024, name: 'Ocean Monster 2', type: 'fish' },
  { gameid: 1025, name: "King Kong's Rampage", type: 'fish' },
  { gameid: 1026, name: 'Monster Awaken plus', type: 'fish' },
  { gameid: 1028, name: 'Buffalo Thunder', type: 'fish' },
  { gameid: 1029, name: 'Legend Of The Phoenix', type: 'fish' },
  { gameid: 1030, name: 'Sea Food Paradise II Plus', type: 'fish' },
  { gameid: 1036, name: 'Golden Legend Plus', type: 'fish' },
  { gameid: 1042, name: 'Lucky Fishing', type: 'fish' },
  { gameid: 1044, name: 'Fantasy Unicorn', type: 'fish' },
  { gameid: 1045, name: 'Dragon Storm', type: 'fish' },
  { gameid: 1046, name: 'Legendary Panda', type: 'fish' },
  { gameid: 1049, name: "Fish's Fun World", type: 'fish' },
  { gameid: 1050, name: 'Fire Dragon Ball', type: 'fish' },
  { gameid: 1066, name: 'Daily Fishing', type: 'fish' },
  // Slots
  { gameid: 3001, name: 'God Of Wealth', type: 'slot' },
  { gameid: 3002, name: 'Great Blue', type: 'slot' },
  { gameid: 3003, name: 'Highway King', type: 'slot' },
  { gameid: 3004, name: 'Dolphin Reef', type: 'slot' },
  { gameid: 3005, name: 'Bonus Bear', type: 'slot' },
  { gameid: 3006, name: 'Safari Heat', type: 'slot' },
  { gameid: 3007, name: 'Thai Paradise', type: 'slot' },
  { gameid: 3008, name: 'Shui Hu', type: 'slot' },
  { gameid: 3009, name: 'Panther Moon', type: 'slot' },
  { gameid: 3010, name: 'Funky Monkey', type: 'slot' },
  { gameid: 3011, name: 'Jin Qian Wa', type: 'slot' },
  { gameid: 3012, name: 'Sea World', type: 'slot' },
  { gameid: 3013, name: 'Boy King Treasure', type: 'slot' },
  { gameid: 3014, name: 'Iceland', type: 'slot' },
  { gameid: 3015, name: 'Amazing Thailand', type: 'slot' },
  { gameid: 3016, name: 'Golden Tour', type: 'slot' },
  { gameid: 3017, name: 'Victory', type: 'slot' },
  { gameid: 3018, name: 'Fairy Garden Plus', type: 'slot' },
  { gameid: 3019, name: 'Irish Luck', type: 'slot' },
  { gameid: 3020, name: 'Dragon', type: 'slot' },
  { gameid: 3021, name: 'Silent Samurai', type: 'slot' },
  { gameid: 3022, name: 'Top Gun', type: 'slot' },
  { gameid: 3023, name: 'T-REX', type: 'slot' },
  { gameid: 3024, name: 'Indian Myth', type: 'slot' },
  { gameid: 3025, name: 'Panda', type: 'slot' },
  { gameid: 3026, name: 'Captain Treasure', type: 'slot' },
  { gameid: 3027, name: 'Japan', type: 'slot' },
  { gameid: 3028, name: 'Fruit', type: 'slot' },
  { gameid: 3029, name: 'Feng Shen', type: 'slot' },
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

const resolveAccountId = (accountId) => {
  if (accountId) return accountId
  try {
    const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}')
    return user.accountId
  } catch {
    return null
  }
}

const transformGame = (game, defaultImage) => {
  // Handle both schemas: live API uses TitleCase (GameID, GameName_EN, GameType,
  // Image1, IsNew); static fallback uses lowercase (gameid, name, type).
  const id = game.GameID ?? game.gameid ?? game.gameId ?? game.id
  const name = game.GameName_EN || game.GameName || game.name || (id ? `VPower Game ${id}` : 'VPower Game')
  const rawType = (game.GameType || game.type || 'slot').toLowerCase()
  const category = rawType === 'fish' ? 'fishing' : rawType === 'slot' ? 'slots' : rawType
  // Live API ships real thumbnails in Image1 — use them when present
  const image = game.Image1 || game.imageUrl || defaultImage || '/placeholder-game.png'

  return {
    id: `vpower-${id}`,
    gameId: id,
    slug: `vpower-${id}`,
    name,
    provider: 'VPower',
    image,
    portraitImage: image,
    squareImage: image,
    category,
    rawCategory: rawType,
    isHot: false,
    isNew: !!(game.IsNew || game.isNew),
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Play ${name} on VPower Gaming.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols'],
    isVPower: true,
    providerType: 'transfer',
    originalData: game,
  }
}

export const fetchVPowerGames = async (defaultImage) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/vpower-transfer/games`)
    if (response.ok) {
      const data = await response.json()
      if (data?.success && Array.isArray(data.Data)) {
        // Live schema doesn't have an `enable` flag; presence = enabled.
        // Old schema had `enable: 0` for disabled — preserve that filter.
        const enabled = data.Data.filter(g => g.enable !== 0)
        if (enabled.length > 0) {
          return { success: true, games: enabled.map(g => transformGame(g, defaultImage)), source: 'live' }
        }
      }
    }
    // Fallback: static catalogue
    console.warn('[VPowerService] /games unavailable, using static catalogue')
    return { success: true, games: STATIC_GAMES.map(g => transformGame(g, defaultImage)), source: 'static' }
  } catch (error) {
    console.warn('[VPowerService] games fetch error, using static:', error.message)
    return { success: true, games: STATIC_GAMES.map(g => transformGame(g, defaultImage)), source: 'static' }
  }
}

export const getAllVPowerGames = async (defaultImage) => {
  if (cachedGames && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedGames
  }
  const result = await fetchVPowerGames(defaultImage)
  if (result.success && result.games.length > 0) {
    cachedGames = result.games
    cacheTimestamp = Date.now()
    return result.games
  }
  return []
}

/**
 * Launch a VPower game session.
 * gameId is REQUIRED. amount omitted → sweep main wallet (capped at 100k AUD).
 * Returns single-use URL with 7-day token lifetime.
 */
export const launchVPowerGame = async (game, accountId, options = {}) => {
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
    if (options.backUrl) params.set('backUrl', options.backUrl)

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/vpower-transfer/launch?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Launch failed (HTTP ${response.status})` }

    const data = await response.json()
    // VPower /launch returns flat shape: status, url, token, vpUsername, errorCode, message
    if (data.status === 'OK' && data.url) {
      return { success: true, gameUrl: data.url, ...data }
    }
    return {
      success: false,
      error: data.message || `Launch failed (${data.errorCode || 'unknown'})`,
      errorCode: data.errorCode,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Cash-out + end session. Internally: signout → withdraw-all.
 * Returns success:false on real failure (post 2026-05-30 fix); retry is safe.
 */
export const exitVPowerGame = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/vpower-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Exit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success) return { success: true, ...data }
    return {
      success: false,
      error: data.message || data.Info || `Exit failed (${data.ErrorCode})`,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Partial withdraw. Omit amount for withdraw-all (but prefer /exit for that).
 */
export const withdrawVPower = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const params = new URLSearchParams({ accountId })
    if (amount !== undefined && amount !== null) params.set('amount', String(amount))

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/vpower-transfer/withdraw?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success) return { success: true, ...data }
    return { success: false, error: data.message || `Withdraw failed (${data.ErrorCode})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getVPowerBalance = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/vpower-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    if (data.success) {
      return {
        success: true,
        balance: Number(data.Credit) || 0,
        username: data.Username,
        ...data,
      }
    }
    return { success: false, error: data.message || `Balance fetch failed (${data.ErrorCode})` }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToVPower = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount) })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/vpower-transfer/deposit?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success) return { success: true, ...data }
    return { success: false, error: data.message || `Deposit failed (${data.ErrorCode})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const clearVPowerCache = () => {
  cachedGames = null
  cacheTimestamp = null
}

export const vpowerService = {
  fetchGames: fetchVPowerGames,
  getAllGames: getAllVPowerGames,
  launchGame: launchVPowerGame,
  exitGame: exitVPowerGame,
  withdraw: withdrawVPower,
  deposit: depositToVPower,
  getBalance: getVPowerBalance,
  clearCache: clearVPowerCache,
  STATIC_GAMES,
}

export default vpowerService
