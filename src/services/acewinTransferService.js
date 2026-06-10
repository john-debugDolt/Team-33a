/**
 * AceWin (Macross) Transfer Wallet Service
 * Base: /api/acewin-transfer
 * Endpoints: /games, /launch, /withdraw, /exit, /balance, /deposit, /health
 *
 * Transfer wallet semantics: player chips live on AceWin's side.
 * /launch optionally deposits, /exit (or /withdraw) returns chips to main wallet.
 * Backend auto-withdraws after ~20 min as a safety net.
 */

import { getGameIcon, pickProviderIcon } from './gameIconRegistry'

const BASE_URL = 'https://seamless.team33.mx'

let cachedGames = null
let cacheTimestamp = null
const CACHE_DURATION = 5 * 60 * 1000

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

// AceWin catalogue returns name as a localized object: {en-US, zh-CN, zh-TW}.
const pickName = (raw) => {
  if (!raw) return 'AceWin Game'
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object') {
    return raw['en-US'] || raw['en-us'] || raw.en || Object.values(raw)[0] || 'AceWin Game'
  }
  return String(raw)
}

const transformGame = (game, defaultImage) => {
  const name = pickName(game.gameName || game.GameName || game.name)
  const gameId = game.gameId ?? game.GameId ?? game.id
  const categoryId = game.GameCategoryId ?? game.gameCategoryId ?? game.category
  // Prefer bundled per-game icon, fall back to a deterministic pool pick, then upstream/borrowed.
  const bundled = getGameIcon('AceWin', name) || pickProviderIcon('AceWin', gameId)
  const image = bundled || game.imageUrl || game.ImageUrl || game.image || defaultImage || '/placeholder-game.png'

  return {
    id: `acewin-${gameId}`,
    gameId,
    slug: `acewin-${gameId}`,
    name,
    provider: 'AceWin',
    image,
    portraitImage: image,
    squareImage: image,
    category: (game.gameType || game.GameType || categoryId || 'slot').toString().toLowerCase(),
    rawCategory: categoryId ?? null,
    isHot: !!game.JP,
    isNew: false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Play ${name} on AceWin.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols'],
    isAceWin: true,
    providerType: 'transfer',
    originalData: game,
  }
}

export const fetchAceWinGames = async (defaultImage) => {
  try {
    const urls = [`${BASE_URL}/api/acewin-transfer/games`]
    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url)
        if (!response.ok) continue
        const text = await response.text()
        if (!text || text.startsWith('<!')) continue
        const data = JSON.parse(text)
        // Backend wraps the upstream envelope. Real games are in data.Data (array).
        // If upstream fails it returns ErrorCode 9999 with Data:null.
        if (data?.ErrorCode === 9999 || data?.success === false) {
          console.warn('[AceWinService] upstream catalogue error:', data?.Message)
          continue
        }
        let games = Array.isArray(data)
          ? data
          : (data.Data?.GameList || data.Data || data.games || data.gameList || [])
        if (Array.isArray(games) && games.length > 0) {
          return { success: true, games: games.map(g => transformGame(g, defaultImage)) }
        }
      } catch (err) {
        console.warn('[AceWinService] games fetch error:', err.message)
      }
    }
    return { success: false, games: [], error: 'No games returned' }
  } catch (error) {
    return { success: false, games: [], error: error.message }
  }
}

export const getAllAceWinGames = async (defaultImage) => {
  if (cachedGames && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedGames
  }
  const result = await fetchAceWinGames(defaultImage)
  if (result.success && result.games.length > 0) {
    cachedGames = result.games
    cacheTimestamp = Date.now()
    return result.games
  }
  return []
}

/**
 * Launch a game session. Optionally deposits `amount` MYR into AceWin
 * atomically, then returns a single-use SSO URL (gameUrl).
 */
export const launchAceWinGame = async (game, accountId, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }

    const params = new URLSearchParams({ accountId })
    if (options.amount !== undefined && options.amount !== null) {
      params.set('amount', String(options.amount))
    }
    const gameId = game?.gameId ?? options.gameId
    if (gameId !== undefined && gameId !== null && gameId !== '') {
      params.set('gameId', String(gameId))
    }
    params.set('lang', options.lang || 'en-us')

    const url = `${BASE_URL}/api/acewin-transfer/launch?${params}`
    const response = await fetchWithTimeout(url, { method: 'POST' })
    if (!response.ok) {
      return { success: false, error: `Launch failed (HTTP ${response.status})` }
    }
    const data = await response.json()
    const gameUrl = data.gameUrl || data.url
    if (data.success && gameUrl) {
      return { success: true, gameUrl, ...data }
    }
    return {
      success: false,
      error: data.message || `Launch failed (code ${data.errorCode})`,
      errorCode: data.errorCode,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Withdraw chips from AceWin back to main wallet.
 * Omit `amount` for withdraw-all (the normal case on exit).
 */
export const withdrawAceWin = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const params = new URLSearchParams({ accountId })
    if (amount !== undefined && amount !== null) params.set('amount', String(amount))

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/acewin-transfer/withdraw?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success && data.ErrorCode === 0) return { success: true, ...data }
    return { success: false, error: data.Message || `Withdraw failed (code ${data.ErrorCode})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Kick + withdraw-all. Use on explicit exit / logout.
 */
export const exitAceWinGame = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/acewin-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Exit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success && data.ErrorCode === 0) return { success: true, ...data }
    return { success: false, error: data.Message || `Exit failed (code ${data.ErrorCode})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// AceWin rate-limits /balance, so we cap polling at 1 call / 5 s per
// accountId by returning the previous snapshot when called more often.
const ACEWIN_BALANCE_MIN_INTERVAL_MS = 5000
const acewinBalanceCache = new Map() // accountId -> { ts, snapshot }

/**
 * GET /api/acewin-transfer/balance?accountId=
 *
 * Response (post 2026-06-10 contract):
 *   { success: true, status: "0000", balance: <MYR>, memberStatus: 1|2, online: bool, ... }
 *
 * Gate on body.success (new). status "0000" is kept as a back-compat fallback
 * for any caller still inspecting it. balance is top-level MYR already
 * converted from coins; no need to dig into a nested envelope.
 *
 * memberStatus: 1 = active in-game, 2 = inactive.
 *
 * Polling cap: caller is throttled to one upstream hit per 5s per accountId;
 * intervening calls return the previous snapshot with { cached: true }.
 */
export const getAceWinBalance = async (accountId, { force = false } = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const now = Date.now()
    const cached = acewinBalanceCache.get(accountId)
    if (!force && cached && now - cached.ts < ACEWIN_BALANCE_MIN_INTERVAL_MS) {
      return { ...cached.snapshot, cached: true }
    }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/acewin-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: `Failed to get balance (HTTP ${response.status})` }
    const data = await response.json()

    const ok = data?.success === true || data?.status === '0000'
    if (ok) {
      const snapshot = {
        success: true,
        balance: data.balance ?? 0,
        memberStatus: data.memberStatus,
        online: data.online,
        status: data.status,
        acewinAccount: data.acewinAccount,
        ...data,
      }
      acewinBalanceCache.set(accountId, { ts: now, snapshot })
      return snapshot
    }
    return { success: false, error: data?.error || data?.message || `Balance fetch failed (${data?.status || '-'})` }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToAceWin = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount) })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/acewin-transfer/deposit?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success && data.ErrorCode === 0) return { success: true, ...data }
    return { success: false, error: data.Message || `Deposit failed (code ${data.ErrorCode})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const clearAceWinCache = () => {
  cachedGames = null
  cacheTimestamp = null
}

export const acewinTransferService = {
  fetchGames: fetchAceWinGames,
  getAllGames: getAllAceWinGames,
  launchGame: launchAceWinGame,
  exitGame: exitAceWinGame,
  withdraw: withdrawAceWin,
  deposit: depositToAceWin,
  getBalance: getAceWinBalance,
  clearCache: clearAceWinCache,
}

export default acewinTransferService
