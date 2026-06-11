/**
 * Launch Tracker — remembers transfer-wallet game launches so we can sweep
 * funds back when the user returns to team33 after walking away mid-game.
 *
 * Flow:
 *   - Provider page calls recordLaunch(KEY, accountId) on successful launch.
 *   - Provider page calls clearLaunch(KEY) when the user explicitly exits.
 *   - Layout calls sweepAllReturns() on app mount + visibilitychange:
 *     for any provider still in the record, hits its /exit endpoint and
 *     clears the record. Backend's 20-min auto-withdraw remains the final
 *     safety net for cases this misses.
 */

import { exitAceWinGame } from './acewinTransferService'
import { exitFunTaGame } from './funtaGamingService'
import { exitDragoonSoftGame } from './dragoonSoftService'
import { exitVPowerGame } from './vpowerService'
import { exitWin8Game } from './win8Service'
import { exitPegasusGame } from './pegasusService'
import { exitLucky365Game } from './lucky365Service'
import { exitAllBet } from './allbetService'
import { exitSexyBaccarat, exitSV388 } from './awcTransferService'
import { exitM9Game } from './m9TransferService'
import { exitEvo888h5Bonus } from './evo888h5Service'
import { exitRich88Game } from './rich88TransferService'
import { walletService } from './walletService'

const STORAGE_KEY = 'team33_active_launches_v1'

// Stable provider keys used by launch/exit recording across all pages.
export const ProviderKey = {
  ACEWIN: 'ACEWIN',
  FUNTA: 'FUNTA',
  DRAGOONSOFT: 'DRAGOONSOFT',
  VPOWER: 'VPOWER',
  WIN8: 'WIN8',
  PEGASUS: 'PEGASUS',
  LUCKY365: 'LUCKY365',
  ALLBET: 'ALLBET',
  SEXYBCRT: 'SEXYBCRT',
  SV388: 'SV388',
  M8BET: 'M8BET',
  EVO888H5_BONUS: 'EVO888H5_BONUS',
  // Rich88 supports two operator-scoped sessions in parallel for the same
  // accountId — each has its own Rich88-side balance and auto-withdraw
  // timer, so the tracker records them separately.
  RICH88_NORMAL: 'RICH88_NORMAL',
  RICH88_FOC: 'RICH88_FOC',
  // Back-compat: old records written under "RICH88" will be migrated on the
  // first sweep — we treat the key as normal-operator unless the entry says
  // otherwise.
  RICH88: 'RICH88',
}

const EXIT_MAP = {
  ACEWIN: exitAceWinGame,
  FUNTA: exitFunTaGame,
  DRAGOONSOFT: exitDragoonSoftGame,
  VPOWER: exitVPowerGame,
  WIN8: exitWin8Game,
  PEGASUS: exitPegasusGame,
  LUCKY365: exitLucky365Game,
  ALLBET: exitAllBet,
  SEXYBCRT: exitSexyBaccarat,
  SV388: exitSV388,
  M8BET: exitM9Game,
  // EVO bonus: /exit reads EVO's live balance and sweeps it (HALF_UP), with
  // automatic floor-withdraw recovery when the round overshoots. Doesn't use
  // the deposited amount — player may have won/lost during play. See
  // exitEvo888h5Bonus in evo888h5Service.js.
  EVO888H5_BONUS: (accountId) => exitEvo888h5Bonus(accountId),
  // Rich88 /exit is operator-scoped — it only touches the session under
  // the operator you pass, so the two parallel sessions need separate
  // entries (RICH88_NORMAL / RICH88_FOC). Each calls /exit with the right
  // operator. Funds land in the correct pool (main vs bonus_wallet) per
  // the operator.
  RICH88_NORMAL: (accountId) => exitRich88Game(accountId, 'normal'),
  RICH88_FOC: (accountId) => exitRich88Game(accountId, 'foc'),
  // Back-compat for any record written under the old RICH88 key — read the
  // operator from the entry (default normal).
  RICH88: (accountId, entry) => exitRich88Game(accountId, entry?.operator || 'normal'),
}

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

const write = (obj) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export const recordLaunch = (provider, accountId, extra = {}) => {
  if (!provider || !accountId) return
  const cur = read()
  cur[provider] = { accountId, launchedAt: Date.now(), ...extra }
  write(cur)
  console.log('[LaunchTracker] recorded:', provider, extra)
}

export const clearLaunch = (provider) => {
  if (!provider) return
  const cur = read()
  if (cur[provider]) {
    delete cur[provider]
    write(cur)
    console.log('[LaunchTracker] cleared:', provider)
  }
}

export const getActiveLaunches = () => read()

/**
 * LIFO view over the active launches. Insertion order is preserved by
 * JS objects, so the last key is the most-recently-launched provider.
 */
export const getLaunchStack = () => Object.keys(read())

export const peekLastLaunch = () => {
  const cur = read()
  const keys = Object.keys(cur)
  if (keys.length === 0) return null
  const provider = keys[keys.length - 1]
  return { provider, entry: cur[provider] }
}

export const popLastLaunch = () => {
  const top = peekLastLaunch()
  if (top) clearLaunch(top.provider)
  return top
}

/**
 * Read the pre-launch balance snapshot stashed on the recorded entry by
 * recordLaunch(..., { preLaunchBalance }). Returns null if not present.
 */
export const getPreLaunchBalance = (provider) => {
  const cur = read()
  const entry = provider ? cur[provider] : null
  const v = entry?.preLaunchBalance
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Exit the LIFO-top provider explicitly (no sweep, no other providers
 * touched). Useful for "post-launch balance reads 0, recover" flows.
 * Returns { provider, result } or null if nothing was on the stack.
 */
export const recoverLastLaunch = async () => {
  const top = peekLastLaunch()
  if (!top) return null
  const { provider, entry } = top
  const exitFn = EXIT_MAP[provider]
  const accountId = entry?.accountId
  if (!exitFn || !accountId) {
    clearLaunch(provider)
    return { provider, result: { success: false, error: 'no exit fn / accountId' } }
  }
  try {
    const result = await exitFn(accountId, entry)
    // Only clear on a confirmed-good exit. On failure leave the record so
    // the next sweep (visibility / mount) gets another shot, and the
    // backend's 20-min auto-withdraw is the final fallback. Previously the
    // finally{} cleared regardless and a single network blip orphaned the
    // session client-side.
    if (result?.success) clearLaunch(provider)
    return { provider, result }
  } catch (err) {
    return { provider, result: { success: false, error: err?.message } }
  }
}

/**
 * For every recorded launch, call the provider's exit endpoint.
 * Records are cleared regardless of success — failures fall back to the
 * backend's 20-min auto-withdraw timer.
 *
 * Sweeps run all providers **in parallel** (Promise.allSettled) so a slow
 * upstream on one provider doesn't block the others. Previously this was a
 * serial for-await loop and stranded sessions could stack — N providers ×
 * 20s fetchWithTimeout = N × 20s wall-clock before the next launch could
 * fire. Now the worst case is ~20s regardless of how many entries.
 */
let sweepPromise = null
export const sweepAllReturns = async (onBalanceRefresh) => {
  // Re-entrant: callers joining a running sweep wait for the same promise.
  if (sweepPromise) return sweepPromise
  const active = read()
  const providers = Object.keys(active)
  if (providers.length === 0) return

  sweepPromise = (async () => {
    console.log('[LaunchTracker] sweeping returns (parallel):', providers)
    const results = await Promise.allSettled(providers.map(async (provider) => {
      const exitFn = EXIT_MAP[provider]
      const entry = active[provider]
      const accountId = entry?.accountId
      if (!exitFn || !accountId) {
        clearLaunch(provider)
        return { provider, skipped: true }
      }
      try {
        const result = await exitFn(accountId, entry)
        console.log(`[LaunchTracker] ${provider} exit:`, result?.success ? 'OK' : (result?.error || 'no-op'))
        return { provider, ok: !!result?.success }
      } catch (err) {
        console.warn(`[LaunchTracker] ${provider} exit threw:`, err?.message)
        return { provider, error: err?.message }
      } finally {
        clearLaunch(provider)
      }
    }))
    const anySwept = results.some((r) => r.status === 'fulfilled' && !r.value?.skipped)

    if (anySwept) {
      try {
        const accountId = providers.map(p => active[p]?.accountId).find(Boolean)
        if (accountId) {
          const res = await walletService.getBalance(accountId)
          if (res?.success && typeof res.balance === 'number' && typeof onBalanceRefresh === 'function') {
            onBalanceRefresh(res.balance)
          }
        }
      } catch { /* ignore */ }
    }
  })()

  try {
    await sweepPromise
  } finally {
    sweepPromise = null
  }
}

export default {
  ProviderKey,
  recordLaunch,
  clearLaunch,
  getActiveLaunches,
  sweepAllReturns,
}
