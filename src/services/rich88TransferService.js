/**
 * Rich88 Transfer Wallet Service
 *
 * Endpoints (all under /api/rich88-transfer/*):
 *   POST /launch           accountId, [operator], [gameCode], [entry], [lang], [tokenEffectiveType]
 *   POST /deposit          accountId, amount, [operator]
 *   POST /withdraw         accountId, amount, [operator]
 *   POST /exit             accountId, [operator]
 *   POST /logout           accountId, [operator]
 *   GET  /balance          accountId, [operator]
 *   GET  /games            [activeOnly]
 *   GET  /playing-status   accountId, [operator]
 *   GET  /transfer-status  transferNo
 *   GET  /health           (introspect operators)
 *
 * Multi-operator: operator ∈ { 'normal' (default, main wallet), 'foc' (bonus
 * wallet) }. The SAME accountId can run a normal session and a foc session
 * in parallel — each has independent Rich88-side balance and auto-withdraw.
 * Every follow-up call must use the same operator alias as launch.
 *
 * X-Request-Id is sent on every call for idempotency/tracing.
 *
 * Deterministic error codes (do NOT retry):
 *   -1 in-process / reconciling   (wait, do NOT retry — could duplicate)
 *   -2 player LOCKED
 *   -3 bad input
 *   -4 launch already in progress (or insufficient balance on /deposit)
 *   -5 wallet not found
 *   13002 Rich88-side account missing (call /launch first to bootstrap)
 */

import rich88Logo from '../images/rich88logo.jpg';
import { getGameIcon, pickProviderIcon } from './gameIconRegistry';

const BASE_URL = 'https://accounts.team33.mx';

// sessionStorage key — persists the operator alias for the active Rich88
// session so follow-up balance / withdraw / exit calls hit the right
// operator-scoped Rich88 player row.
const RICH88_OP_KEY = 'rich88:op';

const readStoredOperator = () => {
  try { return sessionStorage.getItem(RICH88_OP_KEY) || null; } catch { return null; }
};
const writeStoredOperator = (op) => {
  try { sessionStorage.setItem(RICH88_OP_KEY, op); } catch { /* ignore */ }
};
const clearStoredOperator = () => {
  try { sessionStorage.removeItem(RICH88_OP_KEY); } catch { /* ignore */ }
};

const newRequestId = () =>
  (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Codes that are deterministic per the doc — surface message, never retry.
const NON_RETRY_CODES = new Set([-2, -3, -4, -5, 13002]);
// -1 = "in process / reconciling" — also do NOT retry; reconciler runs every 60s.
const RECONCILING_CODE = -1;

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

const FALLBACK_IMAGE = rich88Logo;

const transformGame = (game) => {
  const name = game.game_name_enu || game.game_name_chs || game.game_code || 'Unknown Game';
  const gameCode = game.game_code;
  const rawCat = (game.category || '').toLowerCase();
  let category = 'slot';
  if (rawCat.includes('fish')) category = 'fishing';
  else if (rawCat.includes('table') || rawCat.includes('card')) category = 'card';
  else if (rawCat.includes('arcade')) category = 'arcade';
  else if (rawCat.includes('live')) category = 'live';

  return {
    id: `rich88-${gameCode}`,
    gameId: gameCode,
    gameCode: gameCode,
    slug: `rich88-${gameCode}`,
    name,
    provider: 'Rich88',
    // Prefer the bundled icon (matched by game name), fall back to a
    // deterministic pick from the provider pool, then to upstream/logo.
    image: getGameIcon('Rich88', name) || pickProviderIcon('Rich88', gameCode) || game.image || game.thumbnail || FALLBACK_IMAGE,
    portraitImage: getGameIcon('Rich88', name) || pickProviderIcon('Rich88', gameCode) || game.image || FALLBACK_IMAGE,
    squareImage: getGameIcon('Rich88', name) || pickProviderIcon('Rich88', gameCode) || game.image || FALLBACK_IMAGE,
    category,
    rawCategory: game.category || game.game_type,
    isHot: false,
    isNew: false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Experience ${name} from Rich88.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols'],
    isRich88: true,
    providerType: 'transfer',
    originalData: game,
  };
};

export const fetchRich88Games = async () => {
  try {
    // Always use the absolute seamless host — wallet-service is only exposed
    // via seamless.team33.mx (see seamless-ingress.yaml). The relative path
    // resolves against the apex team33.mx which has no wallet-service and
    // hits the wrong Spring controller (Spring's @GetMapping("/games") also
    // refuses /games/ trailing-slash, surfacing as a 404).
    const urls = [`${BASE_URL}/api/rich88-transfer/games`];
    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;
        const data = await response.json();
        // Apidoc: { code: 0, msg: "Success", data: [...] }
        if (data.code !== 0 && data.success === false) continue;
        const list = Array.isArray(data?.data) ? data.data
                   : Array.isArray(data?.games) ? data.games
                   : Array.isArray(data) ? data : [];
        const active = list.filter(g => g.is_active !== false);
        if (active.length > 0) {
          console.log('[Rich88Service] Found', active.length, 'active games');
          return active.map(transformGame);
        }
      } catch (err) {
        console.log('[Rich88Service] Error:', err.message);
      }
    }
    return [];
  } catch (error) {
    console.error('[Rich88Service] Failed:', error);
    return [];
  }
};

export const getAllRich88Games = async () => {
  if (cachedGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedGames;
  }
  const games = await fetchRich88Games();
  if (games.length > 0) {
    cachedGames = games;
    cacheTimestamp = Date.now();
  }
  return games;
};

/**
 * POST /launch — provision player on the chosen operator, sweep leftovers
 * back, deposit the funding-pool balance, return the game URL, arm auto-withdraw.
 *
 * `amount` is intentionally ignored by /launch (the backend always sweeps the
 * full funding pool, capped at maxTransferAmount). Use /deposit for partial
 * buy-ins mid-session.
 *
 * Returns { success, gameUrl, operator, code, ... }.
 */
export const launchRich88Game = async (game, accountId, options = {}) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    const gameCode = typeof game === 'object' ? (game?.gameCode ?? game?.gameId) : game;
    if (!gameCode) return { success: false, error: 'Missing gameCode' };

    const { getAccountType } = await import('./bonusWalletService.js');
    const accountType = await getAccountType(accountId);
    const operator = options.operator || (accountType === 'bonus' ? 'foc' : 'normal');

    const params = new URLSearchParams({
      accountId,
      gameCode: String(gameCode),
      operator,
    });
    // `lang`, `entry`, `tokenEffectiveType` are all optional. Only include
    // them if the caller asked — otherwise let Rich88 use server defaults.
    if (options.lang) params.set('lang', options.lang);
    if (options.entry) params.set('entry', options.entry);
    if (options.tokenEffectiveType) params.set('tokenEffectiveType', options.tokenEffectiveType);

    const requestId = newRequestId();
    // Absolute seamless host only — see games() comment.
    const urls = [`${BASE_URL}/api/rich88-transfer/launch?${params}`];
    console.log('[Rich88/launch] accountType=', accountType, 'operator=', operator, 'accountId=', accountId, 'gameCode=', gameCode);

    for (const url of urls) {
      try {
        console.log('[Rich88/launch] → POST', url, 'X-Request-Id=', requestId);
        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'X-Request-Id': requestId },
        });
        console.log('[Rich88/launch] ← status', response.status, url);
        if (!response.ok) {
          // 5xx / network — caller may retry with the SAME X-Request-Id.
          if (response.status >= 500) continue;
          return { success: false, error: `Launch failed (HTTP ${response.status})`, status: response.status };
        }
        const data = await response.json();
        console.log('[Rich88/launch] ← body', data);
        const gameUrl = (data?.data?.url || data?.url || data?.gameUrl)?.trim();

        if (data.code === 0 && gameUrl) {
          // Persist the operator so /balance, /withdraw, /exit hit the same
          // operator-scoped Rich88 player row.
          writeStoredOperator(operator);
          // Record one launchTracker entry per (provider, operator) so the
          // return-sweep posts /exit with the right operator — independent
          // sessions can run in parallel for normal and foc.
          try {
            const { recordLaunch, ProviderKey } = await import('./launchTracker.js');
            const key = operator === 'foc' ? ProviderKey.RICH88_FOC : ProviderKey.RICH88_NORMAL;
            recordLaunch(key, accountId, { operator });
          } catch (e) { console.log('[Rich88/launch] record failed:', e?.message); }
          return { success: true, gameUrl, operator, code: 0, ...data };
        }

        if (data.code === RECONCILING_CODE) {
          // -1: deposit is reconciling. DO NOT retry — could create a duplicate.
          return {
            success: false,
            code: data.code,
            error: 'Reconciling… your transfer is being verified, please wait a minute.',
          };
        }
        if (NON_RETRY_CODES.has(data.code)) {
          return { success: false, code: data.code, error: data.msg || 'Launch rejected' };
        }
        // Any other non-zero code — surface and don't retry.
        if (data.code && data.code !== 0) {
          return { success: false, code: data.code, error: data.msg || 'Launch failed' };
        }
      } catch (err) {
        console.log('[Rich88Service] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const resolveOperator = (op) => op || readStoredOperator() || 'normal';

/**
 * GET /balance — Rich88-side balance snapshot for one operator.
 * Returns { account, balance, freeBalance, currency, isLogin, isPlaying, ... }
 */
export const getRich88Balance = async (accountId, operator) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    const op = resolveOperator(operator);
    const params = new URLSearchParams({ accountId, operator: op });
    const requestId = newRequestId();
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/rich88-transfer/balance?${params}`,
      { headers: { 'X-Request-Id': requestId } }
    );
    if (!response.ok) return { success: false, balance: 0 };
    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /exit — clean session close for one operator. Cancels auto-withdraw,
 * kicks the player on Rich88, withdraws Rich88 freeBalance back to the right
 * funding pool (main wallet for `normal`, bonus_wallet for `foc`).
 *
 * Will NOT touch a session on the other operator — exits are operator-scoped.
 */
export const exitRich88Game = async (accountId, operator) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    const op = resolveOperator(operator);
    const params = new URLSearchParams({ accountId, operator: op });
    const requestId = newRequestId();
    // Absolute seamless host only — see games() comment.
    const urls = [`${BASE_URL}/api/rich88-transfer/exit?${params}`];
    console.log('[Rich88/exit] accountId=', accountId, 'operator=', op);
    for (const url of urls) {
      try {
        console.log('[Rich88/exit] → POST', url);
        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'X-Request-Id': requestId },
        });
        console.log('[Rich88/exit] ← status', response.status);
        const data = await response.json().catch(() => null);
        console.log('[Rich88/exit] ← body', data);
        if (response.ok) {
          // `Nothing to withdraw` is also code=0 — treat as success.
          if (data?.code === 0 || data?.success === true) {
            // Only clear the stored operator if we just exited THE persisted one.
            if (readStoredOperator() === op) clearStoredOperator();
            return { success: true, ...(data || {}) };
          }
          return { success: false, code: data?.code, error: data?.msg || 'Exit failed', ...(data || {}) };
        }
      } catch (err) {
        console.log('[Rich88/exit] error:', err.message);
      }
    }
    return { success: false, error: 'Exit failed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
// Back-compat alias.
export const exitRich88 = exitRich88Game;

/**
 * POST /logout — lighter than /exit. Clears the Rich88 session token but
 * leaves auto-withdraw armed. Use when the player just closed the game tab.
 */
export const logoutRich88 = async (accountId, operator) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    const op = resolveOperator(operator);
    const params = new URLSearchParams({ accountId, operator: op });
    const requestId = newRequestId();
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/rich88-transfer/logout?${params}`,
      { method: 'POST', headers: { 'X-Request-Id': requestId } }
    );
    if (!response.ok) return { success: false, error: `Logout failed (HTTP ${response.status})` };
    const data = await response.json().catch(() => ({}));
    return { success: data?.code === 0 || data?.success !== false, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /deposit — partial deposit mid-session. amount must be > 0; capped at
 * maxTransferAmount on backend. Common rejections: -3 bad amount, -4 short
 * funding pool, 13002 deposit before launch.
 */
export const depositToRich88 = async (accountId, amount, operator) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    if (!(Number(amount) > 0)) return { success: false, error: 'amount must be > 0' };
    const op = resolveOperator(operator);
    const params = new URLSearchParams({ accountId, amount: String(amount), operator: op });
    const requestId = newRequestId();
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/rich88-transfer/deposit?${params}`,
      { method: 'POST', headers: { 'X-Request-Id': requestId } }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return { success: false, error: 'Deposit failed' };
    if (data.code === 0) return { success: true, ...data };
    return { success: false, code: data.code, error: data.msg || 'Deposit failed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /withdraw — partial withdrawal mid-session.
 */
export const withdrawFromRich88 = async (accountId, amount, operator) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    if (!(Number(amount) > 0)) return { success: false, error: 'amount must be > 0' };
    const op = resolveOperator(operator);
    const params = new URLSearchParams({ accountId, amount: String(amount), operator: op });
    const requestId = newRequestId();
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/rich88-transfer/withdraw?${params}`,
      { method: 'POST', headers: { 'X-Request-Id': requestId } }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return { success: false, error: 'Withdraw failed' };
    if (data.code === 0) return { success: true, ...data };
    return { success: false, code: data.code, error: data.msg || 'Withdraw failed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * GET /playing-status — is the player mid-round?
 * Used by the "Resume?" UI.
 */
export const getRich88PlayingStatus = async (accountId, operator) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    const op = resolveOperator(operator);
    const params = new URLSearchParams({ accountId, operator: op });
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/rich88-transfer/playing-status?${params}`
    );
    if (!response.ok) return { success: false };
    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * GET /transfer-status?transferNo=… — idempotent status check by transferNo.
 * Server looks up the originating operator from the session row, so no
 * operator param needed.
 */
export const getRich88TransferStatus = async (transferNo) => {
  try {
    if (!transferNo) return { success: false, error: 'Missing transferNo' };
    const response = await fetchWithTimeout(
      `${BASE_URL}/api/rich88-transfer/transfer-status?transferNo=${encodeURIComponent(transferNo)}`
    );
    if (!response.ok) return { success: false };
    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearRich88Cache = () => { cachedGames = null; cacheTimestamp = null; };

export default {
  fetchGames: fetchRich88Games,
  getAllGames: getAllRich88Games,
  launchGame: launchRich88Game,
  getBalance: getRich88Balance,
  exit: exitRich88Game,
  logout: logoutRich88,
  deposit: depositToRich88,
  withdraw: withdrawFromRich88,
  playingStatus: getRich88PlayingStatus,
  transferStatus: getRich88TransferStatus,
  clearCache: clearRich88Cache,
};
