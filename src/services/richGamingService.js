/**
 * RichGaming Game Service (Seamless Wallet)
 * API Base URL: /api/richgaming
 * Endpoints: /games, /launch, /health
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
    id: `richgaming-${gameCode}`,
    gameId: gameCode,
    slug: `richgaming-${gameCode}`,
    name: name,
    provider: 'RichGaming',
    image: game.imageUrl || game.ImageUrl || game.image || '/placeholder-game.png',
    portraitImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    squareImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    category: (game.gameType || 'slot').toLowerCase(),
    isHot: game.isHot || false,
    isNew: game.isNew || false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Experience the thrill of ${name}! This exciting game from RichGaming offers amazing gameplay.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],
    isRichGaming: true,
    providerType: 'seamless',
    originalData: game,
  };
};

export const fetchRichGamingGames = async () => {
  try {
    const urls = [`${BASE_URL}/api/richgaming/games`, `/api/richgaming/games`];

    for (const url of urls) {
      try {
        console.log('[RichGamingService] Fetching games from:', url);
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;

        const text = await response.text();
        if (!text || text.startsWith('<!')) continue;

        const data = JSON.parse(text);

        // RichGaming returns { status: true, data: { games: [...] } }
        let games = [];
        if (data.status === true && data.data?.games) {
          games = data.data.games;
        } else if (Array.isArray(data)) {
          games = data;
        } else if (data.games) {
          games = data.games;
        }

        if (games.length > 0) {
          console.log('[RichGamingService] Found', games.length, 'games');
          return { success: true, games: games.map(g => transformGame(g)) };
        }
      } catch (err) {
        console.log('[RichGamingService] Error:', err.message);
      }
    }
    return { success: false, games: [], error: 'All API endpoints failed' };
  } catch (error) {
    return { success: false, games: [], error: error.message };
  }
};

export const getAllRichGamingGames = async () => {
  if (cachedGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedGames;
  }
  const result = await fetchRichGamingGames();
  if (result.success && result.games.length > 0) {
    cachedGames = result.games;
    cacheTimestamp = Date.now();
    return result.games;
  }
  return [];
};

export const launchRichGamingGame = async (gameCode, accountId, device = 0) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    // Detect device: 0=Desktop, 1=Mobile
    if (device === undefined) {
      device = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 1 : 0;
    }

    const params = new URLSearchParams({ accountId, gameCode, device: device.toString() });
    const urls = [`${BASE_URL}/api/richgaming/launch?${params}`, `/api/richgaming/launch?${params}`];

    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;
        const data = await response.json();

        // RichGaming returns { status: true, data: { gameUrl: "..." } }
        const gameUrl = (data.data?.gameUrl || data.gameUrl || data.url)?.trim();
        if (gameUrl) return { success: true, gameUrl, ...data };
        if (data.error) return { success: false, error: data.error };
      } catch (err) {
        console.log('[RichGamingService] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearRichGamingCache = () => { cachedGames = null; cacheTimestamp = null; };

export const richGamingService = {
  fetchGames: fetchRichGamingGames,
  getAllGames: getAllRichGamingGames,
  launchGame: launchRichGamingGame,
  clearCache: clearRichGamingCache,
};

export default richGamingService;
