/**
 * EpicWin Game Service (Seamless Wallet)
 * API Base URL: /api/epicwin/game
 * Endpoints: /list, /launch, /kick, /health
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
  const gameCode = game.gameCode || game.GameCode || game.code || game.id || game.mType;

  return {
    id: `epicwin-${gameCode}`,
    gameId: gameCode,
    slug: `epicwin-${gameCode}`,
    name: name,
    provider: 'EpicWin',
    image: game.imageUrl || game.ImageUrl || game.image || '/placeholder-game.png',
    portraitImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    squareImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    category: (game.gameType || game.gType || 'slot').toString().toLowerCase(),
    isHot: game.isHot || false,
    isNew: game.isNew || false,
    hasDemo: true,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Experience the thrill of ${name}! This exciting game from EpicWin offers amazing gameplay.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],
    isEpicWin: true,
    providerType: 'seamless',
    originalData: game,
  };
};

export const fetchEpicWinGames = async (lang = 'en', currency = 'AUD') => {
  try {
    const params = new URLSearchParams({ lang, currency });
    const urls = [`${BASE_URL}/api/epicwin/game/list?${params}`, `/api/epicwin/game/list?${params}`];

    for (const url of urls) {
      try {
        console.log('[EpicWinService] Fetching games from:', url);
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;

        const text = await response.text();
        if (!text || text.startsWith('<!')) continue;

        const data = JSON.parse(text);
        if (data.success === false) continue;

        let games = Array.isArray(data) ? data : (data.games || data.data || data.Game || []);

        if (games.length > 0) {
          console.log('[EpicWinService] Found', games.length, 'games');
          return { success: true, games: games.map(g => transformGame(g)) };
        }
      } catch (err) {
        console.log('[EpicWinService] Error:', err.message);
      }
    }
    return { success: false, games: [], error: 'All API endpoints failed' };
  } catch (error) {
    return { success: false, games: [], error: error.message };
  }
};

export const getAllEpicWinGames = async () => {
  if (cachedGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedGames;
  }
  const result = await fetchEpicWinGames();
  if (result.success && result.games.length > 0) {
    cachedGames = result.games;
    cacheTimestamp = Date.now();
    return result.games;
  }
  return [];
};

export const launchEpicWinGame = async (gameCode, accountId, launchDemo = false) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    const params = new URLSearchParams({
      accountId,
      gameCode,
      launchDemo: launchDemo.toString()
    });
    const urls = [`${BASE_URL}/api/epicwin/game/launch?${params}`, `/api/epicwin/game/launch?${params}`];

    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;
        const data = await response.json();
        const gameUrl = (data.gameUrl || data.url || data.launchUrl)?.trim();
        if (gameUrl) return { success: true, gameUrl, ...data };
        if (data.error) return { success: false, error: data.error };
      } catch (err) {
        console.log('[EpicWinService] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearEpicWinCache = () => { cachedGames = null; cacheTimestamp = null; };

export const epicWinService = {
  fetchGames: fetchEpicWinGames,
  getAllGames: getAllEpicWinGames,
  launchGame: launchEpicWinGame,
  clearCache: clearEpicWinCache,
};

export default epicWinService;
