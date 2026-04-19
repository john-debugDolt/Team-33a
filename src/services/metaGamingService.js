/**
 * MetaGaming Game Service (Seamless Wallet)
 * API Base URL: /api/metagaming
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
    id: `metagaming-${gameCode}`,
    gameId: gameCode,
    slug: `metagaming-${gameCode}`,
    name: name,
    provider: 'MetaGaming',
    image: game.imageUrl || game.ImageUrl || game.image || '/placeholder-game.png',
    portraitImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    squareImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    category: (game.gameType || 'slot').toLowerCase(),
    isHot: game.isHot || false,
    isNew: game.isNew || false,
    hasDemo: game.hasDemo || false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Experience the thrill of ${name}! This exciting game from MetaGaming offers amazing gameplay.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],
    isMetaGaming: true,
    providerType: 'seamless',
    originalData: game,
  };
};

export const fetchMetaGamingGames = async () => {
  try {
    const urls = [
      `${BASE_URL}/api/metagaming/games`,
      `/api/metagaming/games`
    ];

    for (const url of urls) {
      try {
        console.log('[MetaGamingService] Fetching games from:', url);
        const response = await fetchWithTimeout(url);

        if (!response.ok) continue;

        const text = await response.text();
        if (!text || text.startsWith('<!')) continue;

        const data = JSON.parse(text);

        if (data.success === false) {
          console.log('[MetaGamingService] API returned error:', data.error);
          continue;
        }

        let games = Array.isArray(data) ? data : (data.games || data.data || []);

        if (games.length > 0) {
          console.log('[MetaGamingService] Found', games.length, 'games');
          return {
            success: true,
            games: games.map(g => transformGame(g)),
            count: data.count || games.length
          };
        }
      } catch (err) {
        console.log('[MetaGamingService] Error:', err.message);
      }
    }

    return { success: false, games: [], error: 'All API endpoints failed' };
  } catch (error) {
    console.error('[MetaGamingService] Failed:', error);
    return { success: false, games: [], error: error.message };
  }
};

export const getAllMetaGamingGames = async () => {
  if (cachedGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedGames;
  }

  const result = await fetchMetaGamingGames();
  if (result.success && result.games.length > 0) {
    cachedGames = result.games;
    cacheTimestamp = Date.now();
    return result.games;
  }
  return [];
};

export const launchMetaGamingGame = async (gameCode, accountId, lang = 'en-us') => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) return { success: false, error: 'Please login to play' };

    const params = new URLSearchParams({ accountId, gameCode, lang });
    const urls = [
      `${BASE_URL}/api/metagaming/launch?${params}`,
      `/api/metagaming/launch?${params}`
    ];

    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;

        const data = await response.json();
        const gameUrl = (data.gameUrl || data.url || data.launchUrl)?.trim();

        if (gameUrl) {
          return { success: true, gameUrl, ...data };
        }

        if (data.error) {
          return { success: false, error: data.error };
        }
      } catch (err) {
        console.log('[MetaGamingService] Launch error:', err.message);
      }
    }

    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const launchMetaGamingDemo = async (gameCode, accountId) => {
  try {
    const params = new URLSearchParams({ accountId: accountId || 'demo', gameCode });
    const response = await fetchWithTimeout(`${BASE_URL}/api/metagaming/launch/demo?${params}`, { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      return { success: true, gameUrl: data.gameUrl };
    }
    return { success: false, error: 'Failed to launch demo' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const kickMetaGamingPlayer = async (accountId) => {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/metagaming/kick?accountId=${accountId}`, { method: 'POST' });
    return response.ok ? { success: true } : { success: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearMetaGamingCache = () => {
  cachedGames = null;
  cacheTimestamp = null;
};

export const metaGamingService = {
  fetchGames: fetchMetaGamingGames,
  getAllGames: getAllMetaGamingGames,
  launchGame: launchMetaGamingGame,
  launchDemo: launchMetaGamingDemo,
  kickPlayer: kickMetaGamingPlayer,
  clearCache: clearMetaGamingCache,
};

export default metaGamingService;
