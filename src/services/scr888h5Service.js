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

const BASE_URL = 'https://accounts.team33.mx';

// sessionStorage key — persists the alias used by /launch so follow-up
// balance / withdraw / transfer-out / clear calls hit the same operator
// even though bonus_wallet has been drained into SCR. Without this every
// follow-up call re-reads bonus_wallet.balance (now $0 after launch),
// resolves to "normal", and the backend looks at the wrong operator —
// returning amountTransferred=0 and stranding the SCR-side balance.
const SCR_ALIAS_KEY = 'scr888h5:alias';

const readStoredAlias = () => {
  try { return sessionStorage.getItem(SCR_ALIAS_KEY) || null; } catch { return null; }
};
const writeStoredAlias = (alias) => {
  try {
    if (alias === 'bonus' || alias === 'normal') sessionStorage.setItem(SCR_ALIAS_KEY, alias);
    else sessionStorage.removeItem(SCR_ALIAS_KEY);
  } catch { /* ignore */ }
};
const clearStoredAlias = () => {
  try { sessionStorage.removeItem(SCR_ALIAS_KEY); } catch { /* ignore */ }
};

/**
 * Resolve the alias to use on a follow-up call (transfer-out, balance,
 * withdraw, clear, etc.). Priority:
 *   1. The alias the most-recent launch wrote to sessionStorage. This is
 *      the only correct answer once /launch has run, because the launch
 *      atomically moved the funding-pool balance into SCR — re-reading
 *      bonus_wallet now returns 0 and would mis-route the call.
 *   2. Live bonus_wallet.balance lookup as a fallback (no active session
 *      stored — e.g. a fresh tab calling /balance for status).
 */
const resolveScrAlias = async (accountId) => {
  const persisted = readStoredAlias();
  if (persisted === 'bonus') return 'bonus';
  if (persisted === 'normal') return null;
  try {
    const { getAccountType } = await import('./bonusWalletService.js');
    const accountType = await getAccountType(accountId);
    return accountType === 'bonus' ? 'bonus' : null;
  } catch (e) {
    console.warn('[SCR888H5] resolveScrAlias failed:', e?.message);
    return null;
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
    const urls = [`${BASE_URL}/api/scr888h5/games`];

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

/**
 * GET /api/scr888h5/launch — single attempt, doc-canonical alias resolution.
 *
 * Per the SCR888H5 normal-launch doc, the backend find-or-creates the SCR
 * player on every launch under the resolved alias; the frontend's only
 * responsibility is passing accountAlias=bonus when bonus_wallet > 0 and
 * omitting it otherwise. No client-side retry / alias-flipping: if the
 * backend returns "user does not exist" that's a bootstrap issue on the
 * wallet-service side, not something the frontend can paper over.
 */
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

    // For /launch we MUST resolve fresh from bonus_wallet — the
    // sessionStorage cache from a prior session shouldn't drive a new
    // launch's funding pool.
    let alias = null;
    try {
      const { getAccountType } = await import('./bonusWalletService.js');
      const accountType = await getAccountType(accountId, { force: true });
      alias = accountType === 'bonus' ? 'bonus' : null;
    } catch (e) {
      console.warn('[SCR888H5/launch] alias resolve failed:', e?.message);
    }
    const params = withAlias(new URLSearchParams({ accountId, gameId: String(gameId) }), alias);
    const url = `${BASE_URL}/api/scr888h5/launch?${params}`;
    console.log('[SCR888H5/launch] alias=', alias || 'normal', '→', url);

    let data = null;
    try {
      const response = await fetchWithTimeout(url);
      data = await response.json().catch(() => null);
      console.log('[SCR888H5/launch] ←', response.status, data);
      if (!data) return { success: false, error: `Launch failed (HTTP ${response.status})` };
    } catch (err) {
      console.log('[SCR888H5/launch] network err:', err.message);
      return { success: false, error: err.message };
    }

    if (data.success && data.gameUrl) {
      // Persist the alias so transfer-out / balance / withdraw on this
      // tab hit the same operator — bonus_wallet was just drained into
      // SCR-side and re-resolving from it would default to "normal".
      writeStoredAlias(alias === 'bonus' ? 'bonus' : 'normal');
      return { success: true, gameUrl: data.gameUrl.trim(), alias: alias || 'normal', ...data };
    }
    const msg = data.errorCode === 6006 ? 'Insufficient balance'
              : data.errorCode === 7501 ? 'Wallet not found'
              : (data.error || data.message || 'Launch failed');
    return { success: false, error: msg, errorCode: data.errorCode, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /api/scr888h5/transfer-out — sweep SCR's freeBalance back to the
 * funding pool the launch deposited from. Single attempt; alias is resolved
 * the same way as launch (bonus_wallet > 0 ⇒ alias=bonus, else omit).
 */
export const transferOutSCR888H5 = async (accountId) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'No account ID' };

    const alias = await resolveScrAlias(accountId);
    const params = withAlias(new URLSearchParams({ accountId }), alias);
    const url = `${BASE_URL}/api/scr888h5/transfer-out?${params}`;
    console.log('[SCR888H5/transfer-out] alias=', alias || 'normal', '→', url);

    try {
      const response = await fetchWithTimeout(url, { method: 'POST' });
      const data = await response.json().catch(() => null);
      console.log('[SCR888H5/transfer-out] ←', response.status, data);
      if (!response.ok || !data) return { success: false, error: `Transfer out failed (HTTP ${response.status})` };
      if (data.success) {
        // Session is done — drop the persisted alias so the next launch
        // resolves fresh from bonus_wallet.balance.
        clearStoredAlias();
        return { success: true, amountTransferred: data.amountTransferred ?? 0, ...data };
      }
      return { success: false, error: data.error || data.message || 'Transfer out failed', ...data };
    } catch (err) {
      console.log('[SCR888H5/transfer-out] network err:', err.message);
      return { success: false, error: err.message };
    }
  } catch (error) {
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
