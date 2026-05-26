/**
 * WFGaming Game Service (Seamless Wallet)
 * API Base URL: /api/wfgaming
 * Endpoints: /games, /launch, /launch-demo, /kick, /health
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
    id: `wfgaming-${gameCode}`,
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
    const urls = [`${BASE_URL}/api/wfgaming/games`, `/api/wfgaming/games`];

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

export const launchWFGamingGame = async (gameCode, accountId, lang = 'en-us') => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    const params = new URLSearchParams({ accountId, gameCode, lang });
    const urls = [`${BASE_URL}/api/wfgaming/launch?${params}`, `/api/wfgaming/launch?${params}`];

    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;
        const data = await response.json();
        const gameUrl = (data.gameUrl || data.url || data.launchUrl)?.trim();
        if (gameUrl) return { success: true, gameUrl, ...data };
        if (data.error) return { success: false, error: data.error };
      } catch (err) {
        console.log('[WFGamingService] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearWFGamingCache = () => { cachedGames = null; cacheTimestamp = null; };

export const wfGamingService = {
  fetchGames: fetchWFGamingGames,
  getAllGames: getAllWFGamingGames,
  launchGame: launchWFGamingGame,
  clearCache: clearWFGamingCache,
};

export default wfGamingService;
