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
import { exitJDBGame } from './jdbTransferService'
import { exitJokerGame } from './jokerService'
import { withdrawEvo888h5Bonus } from './evo888h5Service'
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
  JDB: 'JDB',
  JOKER: 'JOKER',
  EVO888H5_BONUS: 'EVO888H5_BONUS',
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
  JDB: exitJDBGame,
  JOKER: exitJokerGame,
  // EVO bonus carries the deposited amount in the recorded entry; the
  // withdraw call signs it back out of EVO into the bonus_wallet ledger.
  EVO888H5_BONUS: (accountId, entry) => withdrawEvo888h5Bonus(accountId, entry?.amount),
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
 * For every recorded launch, call the provider's exit endpoint.
 * Records are cleared regardless of success — failures fall back to the
 * backend's 20-min auto-withdraw timer.
 */
let sweepPromise = null
export const sweepAllReturns = async (onBalanceRefresh) => {
  // Re-entrant: callers joining a running sweep wait for the same promise.
  if (sweepPromise) return sweepPromise
  const active = read()
  const providers = Object.keys(active)
  if (providers.length === 0) return

  sweepPromise = (async () => {
    console.log('[LaunchTracker] sweeping returns:', providers)
    let anySwept = false
    for (const provider of providers) {
      const exitFn = EXIT_MAP[provider]
      const entry = active[provider]
      const accountId = entry?.accountId
      if (!exitFn || !accountId) {
        clearLaunch(provider)
        continue
      }
      try {
        const result = await exitFn(accountId, entry)
        console.log(`[LaunchTracker] ${provider} exit:`, result?.success ? 'OK' : (result?.error || 'no-op'))
        anySwept = true
      } catch (err) {
        console.warn(`[LaunchTracker] ${provider} exit threw:`, err?.message)
      } finally {
        clearLaunch(provider)
      }
    }

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
