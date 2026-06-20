/**
 * Dragoon Soft (DragonSoft) Transfer Wallet Service
 * Base: /api/dragonsoft-transfer
 * Endpoints: /games, /launch, /withdraw, /exit, /balance, /deposit, /demo, /health
 *
 * Transfer wallet semantics: player funds live on DragonSoft's side while playing.
 * - /launch and /withdraw and /deposit take JSON bodies (NOT query strings)
 * - /exit and /balance take query params
 * - gameId is a 4-digit STRING ("1001"), not a number
 * - Currency: AUD displayed 1:1
 * - Backend auto-withdraws after ~20 min as safety net
 */

import { getGameIcon, pickProviderIcon } from './gameIconRegistry'

const BASE_URL = 'https://accounts.team33.mx'

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

// DragonSoft type ids → friendly category labels (per spec: 1 = fishing)
const TYPE_CATEGORY = {
  '1': 'fishing',
  '3': 'slots',
  '4': 'arcade',
}

const pickName = (names) => {
  if (!names) return 'DragonSoft Game'
  return names.en_us || names.en || names.zh_cn || Object.values(names)[0] || 'DragonSoft Game'
}

const transformGame = (game, defaultImage) => {
  const name = pickName(game.names)
  const id = String(game.id) // keep as string — DragonSoft requires it
  const category = TYPE_CATEGORY[String(game.type)] || 'slots'
  const bundled = getGameIcon('DragoonSoft', name) || pickProviderIcon('DragoonSoft', id)
  const image = bundled || defaultImage || '/placeholder-game.png'

  return {
    id: `dragoon-${id}`,
    gameId: id,
    slug: `dragoon-${id}`,
    name,
    provider: 'Dragoon Soft',
    image,
    portraitImage: image,
    squareImage: image,
    category,
    rawCategory: String(game.type),
    isHot: !!game.hot,
    isNew: !!game.latest,
    active: game.active !== false,
    weight: Number(game.weight) || 0,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Play ${name} on Dragoon Soft.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols'],
    isDragoonSoft: true,
    providerType: 'transfer',
    originalData: game,
  }
}

export const fetchDragoonSoftGames = async (defaultImage) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/dragonsoft-transfer/games`)
    if (!response.ok) return { success: false, games: [], error: `HTTP ${response.status}` }
    const data = await response.json()
    if (data?.status !== 'OK' || !Array.isArray(data.games)) {
      return { success: false, games: [], error: data?.msg || 'Catalogue unavailable' }
    }
    // Drop disabled games (still render but `active:false` means skip launch)
    const active = data.games.filter(g => g.active !== false)
    // Sort by weight desc (per spec), tie-break alphabetically by en_us name
    active.sort((a, b) => {
      const wd = (Number(b.weight) || 0) - (Number(a.weight) || 0)
      if (wd !== 0) return wd
      return (a.names?.en_us || '').localeCompare(b.names?.en_us || '')
    })
    return { success: true, games: active.map(g => transformGame(g, defaultImage)) }
  } catch (error) {
    console.warn('[DragoonSoftService] games fetch error:', error.message)
    return { success: false, games: [], error: error.message }
  }
}

export const getAllDragoonSoftGames = async (defaultImage) => {
  if (cachedGames && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedGames
  }
  const result = await fetchDragoonSoftGames(defaultImage)
  if (result.success && result.games.length > 0) {
    cachedGames = result.games
    cacheTimestamp = Date.now()
    return result.games
  }
  return []
}

/**
 * Launch a DragonSoft game session.
 * gameId is REQUIRED (4-digit string). amount omitted → sweep main wallet
 * up to 100k cap. Returns single-use JWT URL.
 */
export const launchDragoonSoftGame = async (game, accountId, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }

    const gameId = String(game?.gameId ?? options.gameId ?? '')
    if (!gameId) return { success: false, error: 'Game not selected' }

    const body = {
      accountId,
      gameId,
      lang: options.lang || 'en_us',
    }
    if (options.amount !== undefined && options.amount !== null) {
      body.amount = options.amount
    }
    if (options.backurl) body.backurl = options.backurl
    if (options.btn) body.btn = options.btn
    if (options.extra) body.extra = options.extra
    if (options.maxBet !== undefined) body.maxBet = options.maxBet
    if (options.minBet !== undefined) body.minBet = options.minBet
    if (options.level) body.level = options.level

    const response = await postJson(`${BASE_URL}/api/dragonsoft-transfer/launch`, body)
    if (!response.ok) return { success: false, error: `Launch failed (HTTP ${response.status})` }

    const data = await response.json()
    if (data.state === 'OK' && data.url) {
      return { success: true, gameUrl: data.url, ...data }
    }
    // Branch on saga state
    if (data.state === 'RECONCILING') {
      return { success: false, error: 'Processing — your balance will update shortly.', reconciling: true, ...data }
    }
    return {
      success: false,
      error: data.message || `Launch failed (${data.state || data.dsCode || 'unknown'})`,
      dsCode: data.dsCode,
      state: data.state,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Demo launch — no money moves, no player record.
 */
export const launchDragoonSoftDemo = async (gameId, lang = 'en_us') => {
  try {
    if (!gameId) return { success: false, error: 'Game not selected' }
    const params = new URLSearchParams({ gameId: String(gameId), lang })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/dragonsoft-transfer/demo?${params}`
    )
    if (!response.ok) return { success: false, error: `Demo failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'OK' && data.url) {
      return { success: true, gameUrl: data.url, ...data }
    }
    return { success: false, error: data.message || 'Demo unavailable', ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Withdraw from DragonSoft back to main wallet.
 * Omit `amount` (or pass 0) for withdraw-all.
 */
export const withdrawDragoonSoft = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const body = { accountId }
    if (amount !== undefined && amount !== null && amount > 0) body.amount = amount

    const response = await postJson(`${BASE_URL}/api/dragonsoft-transfer/withdraw`, body)
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    if (data.state === 'RECONCILING') {
      return { success: false, error: 'Processing — your balance will update shortly.', reconciling: true, ...data }
    }
    return { success: false, error: data.message || `Withdraw failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Logout + withdraw-all. Use on explicit cash-out / game close.
 * Safe to call even when DragonSoft balance is 0 (returns CONFIRMED).
 */
export const exitDragoonSoftGame = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/dragonsoft-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Exit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    return { success: false, error: data.message || `Exit failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getDragoonSoftBalance = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/dragonsoft-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    if (data.code === 1) {
      return { success: true, balance: data.balance ?? 0, ...data }
    }
    return { success: false, error: data.msg || `Balance fetch failed (code ${data.code})` }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToDragoonSoft = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const response = await postJson(`${BASE_URL}/api/dragonsoft-transfer/deposit`, {
      accountId,
      amount,
    })
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    return { success: false, error: data.message || `Deposit failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const clearDragoonSoftCache = () => {
  cachedGames = null
  cacheTimestamp = null
}

export const dragoonSoftService = {
  fetchGames: fetchDragoonSoftGames,
  getAllGames: getAllDragoonSoftGames,
  launchGame: launchDragoonSoftGame,
  launchDemo: launchDragoonSoftDemo,
  exitGame: exitDragoonSoftGame,
  withdraw: withdrawDragoonSoft,
  deposit: depositToDragoonSoft,
  getBalance: getDragoonSoftBalance,
  clearCache: clearDragoonSoftCache,
}

export default dragoonSoftService
