/**
 * AllBet Live Casino Transfer Wallet Service
 * Base: /api/allbet-transfer
 * Endpoints: /launch, /balance, /exit, /deposit, /withdraw, /transfer-state, /maintenance, /demo, /health
 *
 * Transfer wallet semantics: player funds live on AllBet's side while playing.
 * - /launch takes JSON body, returns `url` to the live casino lobby
 * - /balance, /exit, /deposit, /withdraw take query params
 * - Currency: MYR (despite ledger labelling — known backend mismatch)
 * - X-Request-Id required per attempt for idempotent retries (same UUID across retries of same logical click)
 * - language MUST be 'en' (not 'en_US')
 * - No catalogue — AllBet is a live casino hub, /launch returns the lobby URL
 * - Backend auto-withdraws after 20 min as safety net
 */

const BASE_URL = 'https://seamless.team33.mx'

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
  // Fallback: not RFC4122-compliant but unique enough
  return 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 12)
}

const isMobileDevice = () => {
  try {
    return window.matchMedia && window.matchMedia('(pointer:coarse)').matches
  } catch {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  }
}

/**
 * Launch AllBet live casino. Returns the lobby URL.
 * - amount omitted → sweep main wallet (capped at 100k MYR)
 * - amount=0 → no deposit, just open the lobby (player has 0 chips)
 * - requestId can be reused for safe-retry of the same logical click
 */
export const launchAllBet = async (accountId, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }

    const body = {
      accountId,
      language: options.language || 'en',
    }
    if (options.amount !== undefined && options.amount !== null) {
      body.amount = options.amount
    }
    if (options.returnUrl) body.returnUrl = options.returnUrl
    body.appType = options.appType ?? (isMobileDevice() ? 3 : 6) // 3=H5Mobile, 6=H5PC

    const requestId = options.requestId || newRequestId()

    const response = await fetchWithTimeout(`${BASE_URL}/api/allbet-transfer/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) return { success: false, error: `Launch failed (HTTP ${response.status})`, requestId }
    const data = await response.json()

    if (data.state === 'OK' && data.url) {
      return { success: true, gameUrl: data.url, requestId, ...data }
    }
    return {
      success: false,
      error: data.message || `Launch failed (${data.resultCode || data.state || 'unknown'})`,
      resultCode: data.resultCode,
      state: data.state,
      requestId,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Demo launch — no money moves.
 */
export const launchAllBetDemo = async (lang = 'en') => {
  try {
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/allbet-transfer/demo?lang=${encodeURIComponent(lang)}`
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
 * Kick + sweep all credit back to main wallet. Use on game exit.
 * Safe on 0 balance (returns CONFIRMED with amount:0).
 */
export const exitAllBet = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/allbet-transfer/exit?accountId=${accountId}`,
      { method: 'POST', headers: { 'X-Request-Id': newRequestId() } }
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

export const getAllBetBalance = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/allbet-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    if (data.resultCode === 'OK') {
      return {
        success: true,
        balance: data.balance ?? 0,
        currency: data.currency || 'MYR',
        player: data.player,
        ...data,
      }
    }
    return { success: false, error: `Balance fetch failed (${data.resultCode})` }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToAllBet = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount) })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/allbet-transfer/deposit?${params}`,
      { method: 'POST', headers: { 'X-Request-Id': newRequestId() } }
    )
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    return { success: false, error: data.message || `Deposit failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const withdrawAllBet = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount) })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/allbet-transfer/withdraw?${params}`,
      { method: 'POST', headers: { 'X-Request-Id': newRequestId() } }
    )
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    return { success: false, error: data.message || `Withdraw failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getAllBetMaintenance = async () => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/allbet-transfer/maintenance`)
    if (!response.ok) return { success: false, maintenance: false }
    const data = await response.json()
    return {
      success: !!data.success,
      maintenance: !!data.maintenance,
      ...data,
    }
  } catch (error) {
    return { success: false, maintenance: false, error: error.message }
  }
}

export const allbetService = {
  launchGame: launchAllBet,
  launchDemo: launchAllBetDemo,
  exitGame: exitAllBet,
  withdraw: withdrawAllBet,
  deposit: depositToAllBet,
  getBalance: getAllBetBalance,
  getMaintenance: getAllBetMaintenance,
}

export default allbetService
