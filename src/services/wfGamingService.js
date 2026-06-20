/**
 * WFGaming Game Service (Seamless Wallet)
 * API Base URL: /api/wfgaming
 * Endpoints: /games, /launch, /launch-demo, /kick, /health
 */

const BASE_URL = 'https://accounts.team33.mx';

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
  const gameCode = game.gameCode || game.GameCode || game.code || game.id;

  return {
    id: `wfgaming-${gameCode}`,
    // Expose both gameCode and gameId set to the bare upstream code so
    // any caller pattern (`game.gameCode || game.gameId`) finds it.
    gameCode: gameCode,
    gameId: gameCode,
    slug: `wfgaming-${gameCode}`,
    name: name,
    provider: 'WFGaming',
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
    description: `Experience the thrill of ${name}! This exciting game from WFGaming offers amazing gameplay.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],
    isWFGaming: true,
    providerType: 'seamless',
    originalData: game,
  };
};

export const fetchWFGamingGames = async () => {
  try {
    const urls = [`${BASE_URL}/api/wfgaming/games`];

    for (const url of urls) {
      try {
        console.log('[WFGamingService] Fetching games from:', url);
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;

        const text = await response.text();
        if (!text || text.startsWith('<!')) continue;

        const data = JSON.parse(text);
        if (data.success === false) continue;

        let games = Array.isArray(data) ? data : (data.games || data.data || []);

        if (games.length > 0) {
          console.log('[WFGamingService] Found', games.length, 'games');
          return { success: true, games: games.map(g => transformGame(g)) };
        }
      } catch (err) {
        console.log('[WFGamingService] Error:', err.message);
      }
    }
    return { success: false, games: [], error: 'All API endpoints failed' };
  } catch (error) {
    return { success: false, games: [], error: error.message };
  }
};

export const getAllWFGamingGames = async () => {
  if (cachedGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedGames;
  }
  const result = await fetchWFGamingGames();
  if (result.success && result.games.length > 0) {
    cachedGames = result.games;
    cacheTimestamp = Date.now();
    return result.games;
  }
  return [];
};

// sessionStorage key for the alias of the active WF Gaming session — the
// kick endpoint MUST receive the same alias (normal | freecredit) that the
// launch used; otherwise WF Gaming returns "player not found".
const WF_ALIAS_KEY = 'wf:alias';

const readStoredAlias = () => {
  try { return sessionStorage.getItem(WF_ALIAS_KEY) || null; } catch { return null; }
};
const writeStoredAlias = (alias) => {
  try { sessionStorage.setItem(WF_ALIAS_KEY, alias); } catch { /* ignore */ }
};
const clearStoredAlias = () => {
  try { sessionStorage.removeItem(WF_ALIAS_KEY); } catch { /* ignore */ }
};

export const launchWFGamingGame = async (gameCode, accountId, lang = 'en-us') => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    // Normalise + validate gameCode. URLSearchParams coerces undefined to the
    // literal string "undefined" — WF Gaming then returns "Invalid Game Id"
    // (status 900404). Refuse to fire the request in that case so we don't
    // burn 15 retries on a malformed input. Also strip any slug-style
    // prefix (e.g. "wfgaming-70026") in case a caller hands us the React id
    // instead of the bare provider code.
    let normCode = String(gameCode ?? '').trim();
    if (normCode.toLowerCase() === 'undefined' || normCode.toLowerCase() === 'null') normCode = '';
    if (normCode.startsWith('wfgaming-')) normCode = normCode.slice('wfgaming-'.length);
    if (!normCode) {
      console.error('[WFGaming/launch] missing or invalid gameCode:', gameCode);
      return { success: false, error: 'Missing game code' };
    }

    // Multi-operator routing: bonus_wallet > 0 -> account=freecredit (bonus
    // operator wallet); otherwise account=normal. Persist the alias used so
    // the matching /kick can target the same operator.
    const { getAccountType } = await import('./bonusWalletService.js');
    const accountType = await getAccountType(accountId);
    const alias = accountType === 'bonus' ? 'freecredit' : 'normal';

    const params = new URLSearchParams({ accountId, gameCode: normCode, lang, account: alias });
    const urls = [`${BASE_URL}/api/wfgaming/launch?${params}`];
    console.log('[WFGaming/launch] accountType=', accountType, 'alias=', alias, 'accountId=', accountId, 'gameCode=', gameCode);

    for (const url of urls) {
      try {
        console.log('[WFGaming/launch] → GET', url);
        const response = await fetchWithTimeout(url);
        console.log('[WFGaming/launch] ← status', response.status, url);
        if (!response.ok) continue;
        const data = await response.json();
        console.log('[WFGaming/launch] ← body', data);
        const gameUrl = (data.gameUrl || data.url || data.launchUrl)?.trim();
        if (data.success && gameUrl) {
          // Persist alias for the matching /kick.
          writeStoredAlias(alias);
          return { success: true, gameUrl, alias, ...data };
        }
        if (data.success === false) {
          return { success: false, error: data.error || 'Launch rejected by provider', status: data.status };
        }
      } catch (err) {
        console.log('[WFGamingService] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /api/wfgaming/kick?accountId=&account=
 *
 * Ends the WF Gaming session for the given alias. The alias must match what
 * was used at launch (the backend appends WF Gaming's per-operator suffix
 * internally, and a mismatched alias resolves to a different upstream player
 * id). If alias is omitted, falls back to whatever launch persisted in
 * sessionStorage; refuses to send if the alias can't be determined.
 */
export const kickWFGamingGame = async (accountId, alias) => {
  try {
    if (!accountId) return { success: false, error: 'Missing accountId' };
    const resolved = alias || readStoredAlias();
    if (!resolved) {
      console.warn('[WFGaming/kick] no alias known — refusing to send kick');
      return { success: false, error: 'Unknown session alias' };
    }
    const params = new URLSearchParams({ accountId, account: resolved });
    const urls = [`${BASE_URL}/api/wfgaming/kick?${params}`];
    console.log('[WFGaming/kick] accountId=', accountId, 'alias=', resolved);
    for (const url of urls) {
      try {
        console.log('[WFGaming/kick] → POST', url);
        const response = await fetchWithTimeout(url, { method: 'POST' });
        console.log('[WFGaming/kick] ← status', response.status);
        if (!response.ok) continue;
        const data = await response.json().catch(() => ({}));
        console.log('[WFGaming/kick] ← body', data);
        // Per doc: 200 + success:true means no session is active regardless of prior state.
        clearStoredAlias();
        return { success: data.success !== false, ...data };
      } catch (err) {
        console.log('[WFGaming/kick] error:', err.message);
      }
    }
    return { success: false, error: 'Kick failed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearWFGamingCache = () => { cachedGames = null; cacheTimestamp = null; };

export const wfGamingService = {
  fetchGames: fetchWFGamingGames,
  getAllGames: getAllWFGamingGames,
  launchGame: launchWFGamingGame,
  kick: kickWFGamingGame,
  clearCache: clearWFGamingCache,
};

export default wfGamingService;
