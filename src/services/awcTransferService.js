/**
 * AWC Multi-Wallet Transfer Service (SEXYBCRT + SV388)
 * Base: /api/awc-transfer
 * Endpoints: /launch, /withdraw, /deposit, /exit, /balance, /health
 *
 * Single REST surface routes to multiple AWC agents via the `platform` field:
 * - SEXYBCRT → rcbteam33 (Sexy Baccarat live casino)
 * - SV388    → svteam33  (cockfighting)
 *
 * - /launch, /withdraw, /deposit take JSON bodies
 * - /exit, /balance take query params (incl. platform)
 * - Currency: MYR, 1:1
 * - X-Request-Id (UUID) recommended for idempotent retries
 * - SEXYBCRT requires gameCode; SV388 gameCode optional (omit = lobby)
 * - Backend auto-withdraws after 20 min as safety net
 */

const BASE_URL = 'https://accounts.team33.mx'

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

const postJson = (url, body, requestId) => fetchWithTimeout(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId || newRequestId(),
  },
  body: JSON.stringify(body),
})

/**
 * Launch an AWC game session.
 * @param platform - 'SEXYBCRT' or 'SV388'
 * @param options - { gameCode?, amount?, language?, gameType?, userName?, isMobileLogin?, requestId? }
 */
export const launchAWCGame = async (accountId, platform, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }
    if (!platform) return { success: false, error: 'Platform not specified' }

    const body = {
      accountId,
      platform,
      gameType: options.gameType || 'LIVE',
      amount: options.amount !== undefined && options.amount !== null ? options.amount : 0,
      language: options.language || 'en',
    }
    if (options.gameCode) body.gameCode = options.gameCode
    if (options.userName) body.userName = options.userName
    if (options.isMobileLogin === undefined) {
      body.isMobileLogin = isMobileDevice()
    } else {
      body.isMobileLogin = options.isMobileLogin
    }

    const requestId = options.requestId || newRequestId()
    const response = await postJson(`${BASE_URL}/api/awc-transfer/launch`, body, requestId)
    if (!response.ok) return { success: false, error: `Launch failed (HTTP ${response.status})`, requestId }

    const data = await response.json()
    if (data.state === 'OK' && data.url) {
      return { success: true, gameUrl: data.url, requestId, ...data }
    }
    return {
      success: false,
      error: data.message || `Launch failed (${data.state || data.awcStatus})`,
      state: data.state,
      awcStatus: data.awcStatus,
      requestId,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Cash out + force logout. Sweeps full AWC balance back + cancels auto-withdraw.
 */
export const exitAWCGame = async (accountId, platform) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!platform) return { success: false, error: 'Platform not specified' }

    const params = new URLSearchParams({ accountId, platform })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/awc-transfer/exit?${params}`,
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

/**
 * Partial withdraw. amount=0 or null → withdraw-all (prefer /exit for that).
 */
export const withdrawAWC = async (accountId, platform, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!platform) return { success: false, error: 'Platform not specified' }

    const body = { accountId, platform, amount: amount ?? 0 }
    const response = await postJson(`${BASE_URL}/api/awc-transfer/withdraw`, body)
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

export const depositToAWC = async (accountId, platform, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!platform) return { success: false, error: 'Platform not specified' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const body = { accountId, platform, amount }
    const response = await postJson(`${BASE_URL}/api/awc-transfer/deposit`, body)
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.state === 'CONFIRMED') return { success: true, ...data }
    return { success: false, error: data.message || `Deposit failed (${data.state})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getAWCBalance = async (accountId, platform) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!platform) return { success: false, error: 'Platform not specified' }

    const params = new URLSearchParams({ accountId, platform })
    const response = await fetchWithTimeout(`${BASE_URL}/api/awc-transfer/balance?${params}`)
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    if (data.status === '0000') {
      return {
        success: true,
        balance: data.awcBalance ?? 0,
        awcUserId: data.awcUserId,
        ...data,
      }
    }
    return { success: false, error: `Balance fetch failed (${data.status})` }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Platform-specific convenience wrappers
export const launchSexyBaccarat = (accountId, options = {}) =>
  launchAWCGame(accountId, 'SEXYBCRT', { gameCode: 'MX-LIVE-002', ...options })

export const launchSV388 = (accountId, options = {}) =>
  launchAWCGame(accountId, 'SV388', options) // gameCode optional

export const exitSexyBaccarat = (accountId) => exitAWCGame(accountId, 'SEXYBCRT')
export const exitSV388 = (accountId) => exitAWCGame(accountId, 'SV388')

export const awcTransferService = {
  launchGame: launchAWCGame,
  exitGame: exitAWCGame,
  withdraw: withdrawAWC,
  deposit: depositToAWC,
  getBalance: getAWCBalance,
  launchSexyBaccarat,
  launchSV388,
  exitSexyBaccarat,
  exitSV388,
}

export default awcTransferService
