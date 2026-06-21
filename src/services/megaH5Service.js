/**
 * MegaH5 Game Service (Seamless Wallet)
 * API Base URL: /api/megah5
 * Endpoints: /games, /launch, /kick, /health
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
    id: `megah5-${gameCode}`,
    gameId: gameCode,
    slug: `megah5-${gameCode}`,
    name: name,
    provider: 'MegaH5',
    image: game.imageUrl || game.ImageUrl || game.image || '/placeholder-game.png',
    portraitImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    squareImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    category: String(game.gameType ?? 'slot').toLowerCase(),
    rawCategory: game.gameType ?? game.GameType ?? game.category ?? null,
    isHot: game.isHot || false,
    isNew: game.isNew || false,
    hasDemo: game.hasDemo || false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Experience the thrill of ${name}! This exciting game from MegaH5 offers amazing gameplay.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],
    isMegaH5: true,
    providerType: 'seamless',
    originalData: game,
  };
};

export const fetchMegaH5Games = async () => {
  // Direct to accounts.team33.mx — the prior same-origin proxy attempt
  // (`/api/megah5/games`) was a dead branch in production: team33.mx is
  // served by S3+CloudFront, not Vercel, so the rewrite never fires and
  // S3's 301 to a trailing-slash variant lands on the SPA fallback (404).
  // CORS on accounts.team33.mx allows team33.mx, so the direct call works.
  try {
    const url = `${BASE_URL}/api/megah5/games`;
    console.log('[MegaH5Service] Fetching games from:', url);
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return { success: false, games: [], error: `HTTP ${response.status}` };
    }
    const text = await response.text();
    if (!text || text.startsWith('<!')) {
      return { success: false, games: [], error: 'Non-JSON response' };
    }
    const data = JSON.parse(text);
    if (data.success === false) {
      return { success: false, games: [], error: data.message || 'fetch failed' };
    }
    const games = Array.isArray(data) ? data : (data.games || data.data || []);
    console.log('[MegaH5Service] Found', games.length, 'games (count:', data.count, ')');
    return { success: true, games: games.map(g => transformGame(g)) };
  } catch (error) {
    return { success: false, games: [], error: error.message };
  }
};

export const getAllMegaH5Games = async () => {
  if (cachedGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedGames;
  }
  const result = await fetchMegaH5Games();
  if (result.success && result.games.length > 0) {
    cachedGames = result.games;
    cacheTimestamp = Date.now();
    return result.games;
  }
  return [];
};

export const launchMegaH5Game = async (game, accountId, lang = 'en-us') => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    const gameCode = typeof game === 'object' ? (game?.gameCode ?? game?.gameId) : game;
    if (gameCode === undefined || gameCode === null || gameCode === '') {
      return { success: false, error: 'Missing gameCode' };
    }

    const params = new URLSearchParams({ accountId, gameCode: String(gameCode), lang });
    // Multi-operator routing — when bonus_wallet > 0, pass the bonus alias
    // so the launch is booked against the bonus operator (freecredit).
    // Force-refresh: the 5s cache can't be allowed to strand a just-credited
    // player on the default operator (or vice versa after a withdrawal).
    const { getAccountType } = await import('./bonusWalletService.js');
    const accountType = await getAccountType(accountId, { force: true });
    if (accountType === 'bonus') {
      params.set('account', 'freecredit');
    }
    // Direct to accounts.team33.mx — see fetchMegaH5Games comment.
    const url = `${BASE_URL}/api/megah5/launch?${params}`;
    console.log('[MegaH5/launch] accountType=', accountType, 'accountId=', accountId, 'gameCode=', gameCode);
    console.log('[MegaH5/launch] → GET', url);
    const response = await fetchWithTimeout(url);
    console.log('[MegaH5/launch] ← status', response.status);
    if (!response.ok) {
      return { success: false, error: `Launch failed (HTTP ${response.status})` };
    }
    const data = await response.json();
    console.log('[MegaH5/launch] ← body', data);
    if (data.success && data.gameUrl) {
      return { success: true, gameUrl: data.gameUrl.trim(), ...data };
    }
    return { success: false, error: data.message || data.error || 'Launch failed', ...data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const kickMegaH5Player = async (accountId, alias) => {
  try {
    const params = new URLSearchParams({ accountId });
    if (alias) params.set('account', alias);
    const response = await fetchWithTimeout(`${BASE_URL}/api/megah5/kick?${params}`, { method: 'POST' });
    return response.ok ? { success: true } : { success: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearMegaH5Cache = () => { cachedGames = null; cacheTimestamp = null; };

export const megaH5Service = {
  fetchGames: fetchMegaH5Games,
  getAllGames: getAllMegaH5Games,
  launchGame: launchMegaH5Game,
  kickPlayer: kickMegaH5Player,
  clearCache: clearMegaH5Cache,
};

export default megaH5Service;
