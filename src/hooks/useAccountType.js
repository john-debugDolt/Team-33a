import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAccountType } from '../services/bonusWalletService'

/**
 * Reactively expose the player's accountType ("bonus" or "normal").
 *
 * - bonus_wallet.balance > 0   →  "bonus"  (real wallet is server-locked,
 *                                  only multi-operator providers playable)
 * - bonus_wallet.balance === 0 →  "normal" (everything available)
 *
 * Polls /api/bonus-wallet/{accountId}/balance on mount + on storage events
 * (so a balance change written by another tab / by a launch updates here too).
 *
 * Returns null when not authenticated / before first resolution. Treat null
 * as "normal" for default rendering — never block UI on it.
 */
export default function useAccountType(pollMs = 0) {
  const { user, isAuthenticated } = useAuth()
  const [accountType, setAccountType] = useState(null)

  useEffect(() => {
    if (!isAuthenticated || !user?.accountId) {
      setAccountType(null)
      return
    }
    let cancelled = false
    const refresh = async () => {
      try {
        const t = await getAccountType(user.accountId)
        if (!cancelled) setAccountType(t)
      } catch { /* ignore */ }
    }
    refresh()

    // Re-evaluate when the bonus_balance localStorage mirror changes
    // (set by bonusWalletService whenever the endpoint is hit anywhere).
    const onStorage = (e) => {
      if (e.key === 'team33_bonus_balance' || e.key === 'team33_bonus_meta') {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)

    const interval = pollMs > 0 ? setInterval(refresh, pollMs) : null

    return () => {
      cancelled = true
      window.removeEventListener('storage', onStorage)
      if (interval) clearInterval(interval)
    }
  }, [isAuthenticated, user?.accountId, pollMs])

  return accountType
}

// Provider IDs that support bonus operator (the only ones playable on bonus).
export const BONUS_SUPPORTED_PROVIDERS = new Set([
  'megah5',
  'metagaming',
  'scr888h5',
  'rich88',
  'evo888h5',
  'wfgaming',
])

// Game-object `provider` field values that map to the bonus-supported set.
// Used to filter the Home mixed shuffle on bonus.
export const BONUS_SUPPORTED_PROVIDER_NAMES = new Set([
  'MegaH5',
  'MetaGaming',
  'SCR888H5',
  'Rich88',
  'EVO888H5',
  'Evo888H5',
  'WFGaming',
])

export const isBonusSupported = (idOrName) => {
  if (!idOrName) return false
  const v = String(idOrName).trim()
  return BONUS_SUPPORTED_PROVIDERS.has(v.toLowerCase())
      || BONUS_SUPPORTED_PROVIDER_NAMES.has(v)
}
