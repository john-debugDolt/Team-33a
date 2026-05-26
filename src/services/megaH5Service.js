/**
 * MegaH5 Game Service (Seamless Wallet)
 * API Base URL: /api/megah5
 * Endpoints: /games, /launch, /kick, /health
 */

const BASE_URL = 'https://seamless.team33.mx';

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
  try {
    // Prefer same-origin proxy first (avoids CORS), fall back to direct
    const urls = [`/api/megah5/games`, `${BASE_URL}/api/megah5/games`];

    for (const url of urls) {
      try {
        console.log('[MegaH5Service] Fetching games from:', url);
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;

        const text = await response.text();
        if (!text || text.startsWith('<!')) continue;

        const data = JSON.parse(text);
        // Apidoc: { success: true, count, games: [...], message: "OK" }
        if (data.success === false) continue;

        let games = Array.isArray(data) ? data : (data.games || data.data || []);

        if (games.length > 0) {
          console.log('[MegaH5Service] Found', games.length, 'games (count:', data.count, ')');
          return { success: true, games: games.map(g => transformGame(g)) };
        }
      } catch (err) {
        console.log('[MegaH5Service] Error:', err.message);
      }
    }
    return { success: false, games: [], error: 'All API endpoints failed' };
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
    const urls = [`/api/megah5/launch?${params}`, `${BASE_URL}/api/megah5/launch?${params}`];

    for (const url of urls) {
      try {
        // GET verified working against live API; avoids CORS preflight overhead
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;
        const data = await response.json();
        // Apidoc: { success: true, gameUrl: "...", message: "OK" }
        if (data.success && data.gameUrl) {
          return { success: true, gameUrl: data.gameUrl.trim(), ...data };
        }
        if (data.success === false) {
          return { success: false, error: data.message || data.error || 'Launch failed', ...data };
        }
      } catch (err) {
        console.log('[MegaH5Service] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearMegaH5Cache = () => { cachedGames = null; cacheTimestamp = null; };

export const megaH5Service = {
  fetchGames: fetchMegaH5Games,
  getAllGames: getAllMegaH5Games,
  launchGame: launchMegaH5Game,
  clearCache: clearMegaH5Cache,
};

export default megaH5Service;
