/**
 * M9 (M8BET / mywinday) Sportsbook Transfer Wallet Service
 * Base: /api/m9-transfer
 * Endpoints: /launch, /withdraw, /exit, /balance, /deposit, /health
 *
 * Transfer wallet semantics: player funds live on M9's side while playing.
 * /launch deposits + returns a single-use login URL (TTL ~60s).
 * /exit (or /withdraw) returns funds to main wallet.
 * Backend auto-withdraws after ~20 min as a safety net.
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

export const isMobileDevice = () => {
  try {
    return window.matchMedia && window.matchMedia('(pointer:coarse)').matches
  } catch {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  }
}

/**
 * Launch an M9 sportsbook session.
 * Returns a single-use login URL valid for ~60s.
 */
export const launchM9Game = async (accountId, options = {}) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'Please login to play' }

    const params = new URLSearchParams({ accountId })
    if (options.amount !== undefined && options.amount !== null) {
      params.set('amount', String(options.amount))
    }
    params.set('lang', options.lang || 'EN-US')
    params.set('accType', options.accType || 'HK')
    // Default to Eastern Australia (33) for AU-focused operator
    params.set('timezoneId', String(options.timezoneId ?? 33))
    if (options.ref) params.set('ref', options.ref)

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/m9-transfer/launch?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Launch failed (HTTP ${response.status})` }

    const data = await response.json()
    if (data.success && data.errcode === 0 && data.login) {
      // Pick the appropriate HTTPS URL for the device
      const gameUrl = isMobileDevice()
        ? (data.login.mobiurlsecure || data.login.weburlsecure)
        : (data.login.weburlsecure || data.login.mobiurlsecure)
      return { success: true, gameUrl, login: data.login, ...data }
    }
    return {
      success: false,
      error: data.errtext || `Launch failed (code ${data.errcode})`,
      errcode: data.errcode,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Withdraw funds from M9 back to main wallet.
 * Omit `amount` for withdraw-all (the normal case).
 */
export const withdrawM9 = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const params = new URLSearchParams({ accountId })
    if (amount !== undefined && amount !== null) params.set('amount', String(amount))

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/m9-transfer/withdraw?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` }
    const data = await response.json()
    // duplicateSerial means the prior request already settled — treat as success
    if ((data.success && data.errcode === 0) || data.duplicateSerial) {
      return { success: true, ...data }
    }
    return { success: false, error: data.errtext || `Withdraw failed (code ${data.errcode})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Kick + withdraw-all. Use on explicit exit / logout.
 */
export const exitM9Game = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/m9-transfer/exit?accountId=${accountId}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Exit failed (HTTP ${response.status})` }
    const data = await response.json()
    if ((data.success && data.errcode === 0) || data.duplicateSerial) {
      return { success: true, ...data }
    }
    return { success: false, error: data.errtext || `Exit failed (code ${data.errcode})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const getM9Balance = async (accountId) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }

    const response = await fetchWithTimeout(
      `${BASE_URL}/api/m9-transfer/balance?accountId=${accountId}`
    )
    if (!response.ok) return { success: false, error: 'Failed to get balance' }
    const data = await response.json()
    return {
      success: data.status === 'ACTIVE' || data.status === 'SUSPENDED',
      balance: data.balance ?? 0,
      status: data.status,
      active: data.active,
      username: data.username,
      ...data,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const depositToM9 = async (accountId, amount) => {
  try {
    accountId = resolveAccountId(accountId)
    if (!accountId) return { success: false, error: 'No account ID' }
    if (!amount || amount <= 0) return { success: false, error: 'Amount required' }

    const params = new URLSearchParams({ accountId, amount: String(amount) })
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/m9-transfer/deposit?${params}`,
      { method: 'POST' }
    )
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` }
    const data = await response.json()
    if (data.success && data.errcode === 0) return { success: true, ...data }
    return { success: false, error: data.errtext || `Deposit failed (code ${data.errcode})`, ...data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const m9TransferService = {
  launchGame: launchM9Game,
  exitGame: exitM9Game,
  withdraw: withdrawM9,
  deposit: depositToM9,
  getBalance: getM9Balance,
}

export default m9TransferService
