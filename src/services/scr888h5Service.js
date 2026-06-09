/**
 * SCR888H5 Game Service (Transfer Wallet, multi-operator)
 *
 * API base: /api/scr888h5
 * Endpoints: /games, /launch, /balance, /deposit, /withdraw, /withdraw-all,
 *            /transfer-out, /clear-stuck, /history, /health
 *
 * Multi-operator model (post 2026-06-09 fix):
 *   - alias=normal (default, omitted)       → main wallet operator
 *   - alias=bonus  (accountAlias=bonus)     → bonus_wallet operator
 *
 * A player is bonus-locked iff bonus_wallet.balance > 0. While locked,
 * EVERY SCR888H5 call must carry accountAlias=bonus — calling without it
 * defaults to normal and the main wallet is restricted, so the launch is
 * rejected with "Main wallet … is restricted". This service resolves the
 * alias automatically by calling getAccountType() at request time and
 * appending accountAlias=bonus whenever the player is on bonus.
 *
 * Transfer wallet semantics: launch deposits funds from the alias's funding
 * pool into SCR; transfer-out (matching alias) sweeps SCR's freeBalance
 * back into the same pool. Auto-withdraw timer fires N minutes after launch
 * as a safety net.
 */

const BASE_URL = 'https://seamless.team33.mx';

// sessionStorage key for the alias of the active SCR888H5 session — the
// matching /transfer-out (and /balance, /withdraw etc.) MUST use the same
// alias that /launch used. We can't always recompute from current
// bonus_wallet balance: the launch's deposit may have already drained it
// to 0 even though the SCR-side player is still on the bonus operator.
const SCR_ALIAS_KEY = 'scr888h5:alias';

const readStoredScrAlias = () => {
  try { return sessionStorage.getItem(SCR_ALIAS_KEY) || null; } catch { return null; }
};
const writeStoredScrAlias = (alias) => {
  try { sessionStorage.setItem(SCR_ALIAS_KEY, alias); } catch { /* ignore */ }
};
const clearStoredScrAlias = () => {
  try { sessionStorage.removeItem(SCR_ALIAS_KEY); } catch { /* ignore */ }
};

/**
 * Resolve the SCR888H5 alias for the given account. Returns 'bonus' or
 * 'normal' (never null) so callers can use it directly. Priority:
 *   1. Persisted alias from the most recent launch (covers the case where
 *      bonus_wallet has been debited to 0 by the launch's deposit but the
 *      matching exit still needs accountAlias=bonus to find the SCR player).
 *   2. Derived from current bonus_wallet balance via getAccountType.
 */
const resolveScrAlias = async (accountId) => {
  try {
    const stored = readStoredScrAlias();
    if (stored === 'bonus' || stored === 'normal') return stored;
    const { getAccountType } = await import('./bonusWalletService.js');
    const accountType = await getAccountType(accountId);
    return accountType === 'bonus' ? 'bonus' : 'normal';
  } catch (e) {
    console.warn('[SCR888H5] resolveScrAlias failed:', e?.message);
    return 'normal';
  }
};

const withAlias = (params, alias) => {
  // Backend default is normal, so we only emit the param when it's bonus.
  if (alias === 'bonus') params.set('accountAlias', alias);
  return params;
};

let cachedGames = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

const fetchWithTimeout = async (url, options = {}, timeout = 20000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const transformGame = (game) => {
  const name = game.gameName || game.GameName || game.name || 'Unknown Game';
  const gameId = game.gameId ?? game.gameCode ?? game.GameCode ?? game.code ?? game.id;

  return {
    id: `scr888h5-${gameId}`,
    gameId: gameId,
    slug: `scr888h5-${gameId}`,
    name: name,
    provider: 'SCR888H5',
    image: game.imageUrl || game.ImageUrl || game.image || '/placeholder-game.png',
    portraitImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    squareImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    category: (game.gameType || 'slot').toLowerCase(),
    rawCategory: game.gameType ?? game.GameType ?? game.category ?? null,
    isHot: game.isHot || false,
    isNew: game.isNew || false,
    hasDemo: game.hasDemo || false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Experience the thrill of ${name}! This exciting game from SCR888H5 offers amazing gameplay.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],
    isSCR888H5: true,
    providerType: 'transfer',
    originalData: game,
  };
};

export const fetchSCR888H5Games = async () => {
  try {
    const urls = [`${BASE_URL}/api/scr888h5/games`, `/api/scr888h5/games`];

    for (const url of urls) {
      try {
        console.log('[SCR888H5Service] Fetching games from:', url);
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;

        const text = await response.text();
        if (!text || text.startsWith('<!')) continue;

        const data = JSON.parse(text);
        if (data.success === false) continue;

        let games = Array.isArray(data) ? data : (data.games || data.data || []);

        if (games.length > 0) {
          console.log('[SCR888H5Service] Found', games.length, 'games');
          return { success: true, games: games.map(g => transformGame(g)) };
        }
      } catch (err) {
        console.log('[SCR888H5Service] Error:', err.message);
      }
    }
    return { success: false, games: [], error: 'All API endpoints failed' };
  } catch (error) {
    return { success: false, games: [], error: error.message };
  }
};

export const getAllSCR888H5Games = async () => {
  if (cachedGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedGames;
  }
  const result = await fetchSCR888H5Games();
  if (result.success && result.games.length > 0) {
    cachedGames = result.games;
    cacheTimestamp = Date.now();
    return result.games;
  }
  return [];
};

export const launchSCR888H5Game = async (game, accountId) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    const gameId = typeof game === 'object' ? (game?.gameId ?? game?.id) : game;
    if (gameId === undefined || gameId === null || gameId === '') {
      return { success: false, error: 'Missing gameId' };
    }

    const alias = await resolveScrAlias(accountId);
    const params = withAlias(new URLSearchParams({ accountId, gameId: String(gameId) }), alias);
    const urls = [`${BASE_URL}/api/scr888h5/launch?${params}`, `/api/scr888h5/launch?${params}`];
    console.log('[SCR888H5/launch] alias=', alias || 'normal', 'accountId=', accountId, 'gameId=', gameId);

    for (const url of urls) {
      try {
        console.log('[SCR888H5/launch] → GET', url);
        const response = await fetchWithTimeout(url);
        console.log('[SCR888H5/launch] ← status', response.status, url);
        if (!response.ok) continue;
        const data = await response.json();
        console.log('[SCR888H5/launch] ← body', data);
        if (data.success && data.gameUrl) {
          // Persist the alias used so the matching /transfer-out (and any
          // /balance / /withdraw between launch and close) hits the same
          // SCR-side player row — even if bonus_wallet has since been
          // debited to 0 by the launch's own deposit.
          writeStoredScrAlias(alias);
          return { success: true, gameUrl: data.gameUrl.trim(), alias, ...data };
        }
        if (data.success === false) {
          const msg = data.errorCode === 6006 ? 'Insufficient balance'
                    : data.errorCode === 7501 ? 'Wallet not found'
                    : (data.error || data.message || 'Launch failed');
          return { success: false, error: msg, errorCode: data.errorCode, ...data };
        }
      } catch (err) {
        console.log('[SCR888H5Service] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Internal: one-shot transfer-out for a specific alias. Returns the parsed
 * response (or a network-error envelope) so the caller can decide whether
 * to fall back.
 */
const transferOutOnce = async (accountId, alias) => {
  const params = withAlias(new URLSearchParams({ accountId }), alias);
  const url = `${BASE_URL}/api/scr888h5/transfer-out?${params}`;
  console.log('[SCR888H5/transfer-out] alias=', alias, '→', url);
  try {
    const response = await fetchWithTimeout(url, { method: 'POST' });
    const data = await response.json().catch(() => null);
    console.log('[SCR888H5/transfer-out] ←', response.status, data);
    if (!response.ok || !data) {
      return { ok: false, status: response.status, data };
    }
    return { ok: true, data };
  } catch (err) {
    console.log('[SCR888H5/transfer-out] network err:', err.message);
    return { ok: false, status: 0, error: err.message };
  }
};

// -4 ("user does not exist") means the SCR-side player row for the alias
// we tried doesn't exist. Could be a fresh browser (sessionStorage was
// cleared between launch and exit) or we guessed wrong. Caller flips to
// the opposite alias and retries once.
const isNoUserError = (data) => {
  if (!data) return false;
  if (data.errorCode === -4 || data.code === -4) return true;
  const msg = String(data.error || data.message || '').toLowerCase();
  return msg.includes('user does not exist') || msg.includes('player not found');
};

/**
 * POST /api/scr888h5/transfer-out — sweep SCR's freeBalance back into the
 * funding pool that the launch deposited from. Alias MUST match the launch.
 *
 * Strategy:
 *   1. Try with the resolved alias (persisted from launch, or derived from
 *      current bonus_wallet balance).
 *   2. If that returns "-4 user does not exist", retry once with the
 *      opposite alias — covers the case where the user comes back in a
 *      fresh browser and sessionStorage was empty.
 *   3. Clear the persisted alias on a clean sweep so we don't accidentally
 *      use a stale value next session.
 */
export const transferOutSCR888H5 = async (accountId) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'No account ID' };

    const firstAlias = await resolveScrAlias(accountId);
    let attempt = await transferOutOnce(accountId, firstAlias);

    // If the SCR player row doesn't exist on the alias we tried, flip and
    // retry once. Don't loop — one bonus / one normal is the universe.
    if (attempt.ok && attempt.data.success === false && isNoUserError(attempt.data)) {
      const otherAlias = firstAlias === 'bonus' ? 'normal' : 'bonus';
      console.log('[SCR888H5/transfer-out] -4 on', firstAlias, '— retrying as', otherAlias);
      attempt = await transferOutOnce(accountId, otherAlias);
    }

    if (!attempt.ok) {
      return { success: false, error: `Transfer out failed (HTTP ${attempt.status})` };
    }
    const data = attempt.data;
    if (data.success) {
      clearStoredScrAlias();
      return { success: true, amountTransferred: data.amountTransferred ?? 0, ...data };
    }
    return { success: false, error: data.error || data.message || 'Transfer out failed', ...data };
  } catch (error) {
    console.log('[SCR888H5/transfer-out] error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * GET /api/scr888h5/balance — current SCR-side balance for the player on the
 * resolved alias's operator. For the funding-pool balance use the
 * bonus-wallet or wallets API respectively.
 */
export const getSCR888H5Balance = async (accountId) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'No account ID' };

    const alias = await resolveScrAlias(accountId);
    const params = withAlias(new URLSearchParams({ accountId }), alias);
    const response = await fetchWithTimeout(`${BASE_URL}/api/scr888h5/balance?${params}`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, balance: data.balance || data.data?.balance || 0, ...data };
    }
    return { success: false, error: 'Failed to get balance' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /api/scr888h5/deposit?accountId=&amount= — partial top-up mid-session.
 */
export const depositToSCR888H5 = async (accountId, amount) => {
  try {
    if (!accountId) return { success: false, error: 'No account ID' };
    if (!(Number(amount) > 0)) return { success: false, error: 'amount must be > 0' };
    const alias = await resolveScrAlias(accountId);
    const params = withAlias(new URLSearchParams({ accountId, amount: String(amount) }), alias);
    const response = await fetchWithTimeout(`${BASE_URL}/api/scr888h5/deposit?${params}`, { method: 'POST' });
    if (!response.ok) return { success: false, error: `Deposit failed (HTTP ${response.status})` };
    const data = await response.json();
    return data?.success ? { success: true, ...data } : { success: false, error: data?.error || 'Deposit failed', ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /api/scr888h5/withdraw?accountId=&amount= — partial withdraw mid-session.
 */
export const withdrawFromSCR888H5 = async (accountId, amount) => {
  try {
    if (!accountId) return { success: false, error: 'No account ID' };
    if (!(Number(amount) > 0)) return { success: false, error: 'amount must be > 0' };
    const alias = await resolveScrAlias(accountId);
    const params = withAlias(new URLSearchParams({ accountId, amount: String(amount) }), alias);
    const response = await fetchWithTimeout(`${BASE_URL}/api/scr888h5/withdraw?${params}`, { method: 'POST' });
    if (!response.ok) return { success: false, error: `Withdraw failed (HTTP ${response.status})` };
    const data = await response.json();
    return data?.success ? { success: true, ...data } : { success: false, error: data?.error || 'Withdraw failed', ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /api/scr888h5/withdraw-all?accountId= — sweep entire SCR-side balance.
 */
export const withdrawAllFromSCR888H5 = async (accountId) => {
  try {
    if (!accountId) return { success: false, error: 'No account ID' };
    const alias = await resolveScrAlias(accountId);
    const params = withAlias(new URLSearchParams({ accountId }), alias);
    const response = await fetchWithTimeout(`${BASE_URL}/api/scr888h5/withdraw-all?${params}`, { method: 'POST' });
    if (!response.ok) return { success: false, error: `Withdraw-all failed (HTTP ${response.status})` };
    const data = await response.json();
    return data?.success ? { success: true, ...data } : { success: false, error: data?.error || 'Withdraw-all failed', ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /api/scr888h5/clear-stuck?accountId= — recovery helper when a session
 * is wedged on SCR's side. Same alias requirement as everything else.
 */
export const clearStuckSCR888H5 = async (accountId) => {
  try {
    if (!accountId) return { success: false, error: 'No account ID' };
    const alias = await resolveScrAlias(accountId);
    const params = withAlias(new URLSearchParams({ accountId }), alias);
    const response = await fetchWithTimeout(`${BASE_URL}/api/scr888h5/clear-stuck?${params}`, { method: 'POST' });
    if (!response.ok) return { success: false, error: `Clear-stuck failed (HTTP ${response.status})` };
    const data = await response.json();
    return data?.success ? { success: true, ...data } : { success: false, error: data?.error || 'Clear-stuck failed', ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * GET /api/scr888h5/history?accountId=&startDate=&endDate=&page= — bet/win
 * history for the alias scope. Dates are YYYY-MM-DD per SCR's spec.
 */
export const getSCR888H5History = async (accountId, { startDate, endDate, page } = {}) => {
  try {
    if (!accountId) return { success: false, error: 'No account ID' };
    if (!startDate || !endDate) return { success: false, error: 'startDate + endDate required' };
    const alias = await resolveScrAlias(accountId);
    const params = withAlias(new URLSearchParams({ accountId, startDate, endDate }), alias);
    if (page != null) params.set('page', String(page));
    const response = await fetchWithTimeout(`${BASE_URL}/api/scr888h5/history?${params}`);
    if (!response.ok) return { success: false, error: `History failed (HTTP ${response.status})` };
    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearSCR888H5Cache = () => { cachedGames = null; cacheTimestamp = null; };

export const scr888h5Service = {
  fetchGames: fetchSCR888H5Games,
  getAllGames: getAllSCR888H5Games,
  launchGame: launchSCR888H5Game,
  transferOut: transferOutSCR888H5,
  getBalance: getSCR888H5Balance,
  deposit: depositToSCR888H5,
  withdraw: withdrawFromSCR888H5,
  withdrawAll: withdrawAllFromSCR888H5,
  clearStuck: clearStuckSCR888H5,
  history: getSCR888H5History,
  clearCache: clearSCR888H5Cache,
};

export default scr888h5Service;
