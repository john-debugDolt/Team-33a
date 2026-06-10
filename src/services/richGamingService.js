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
  const name = game.game_name || game.gameName || game.GameName || game.name || 'Unknown Game';
  const gameCode = game.game_code ?? game.gameCode ?? game.GameCode ?? game.code ?? game.id;
  const img = game.game_img || game.imageUrl || game.ImageUrl || game.image || '/placeholder-game.png';

  return {
    id: `richgaming-${gameCode}`,
    gameId: gameCode,
    gameCode: gameCode,
    slug: `richgaming-${gameCode}`,
    name: name,
    provider: 'RichGaming',
    image: img,
    portraitImage: img,
    squareImage: img,
    category: (game.gameType || 'slot').toLowerCase(),
    rawCategory: game.gameType ?? game.GameType ?? game.game_type ?? game.category ?? null,
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
    // Absolute seamless host only — wallet-service is not exposed at the
    // apex team33.mx, so a relative fallback would hit the wrong origin
    // and 404 (often with a trailing-slash variant the CDN adds).
    const urls = [`${BASE_URL}/api/richgaming/games`];

    for (const url of urls) {
      try {
        console.log('[RichGamingService] Fetching games from:', url);
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;

        const text = await response.text();
        if (!text || text.startsWith('<!')) continue;

        const data = JSON.parse(text);

        // RichGaming returns { status: true, code: 0, logo_img, game_list: [...] }
        let games = [];
        if (Array.isArray(data?.game_list)) {
          games = data.game_list;
        } else if (Array.isArray(data)) {
          games = data;
        } else if (data?.games) {
          games = data.games;
        } else if (data?.data?.games) {
          games = data.data.games;
        }

        // Filter out disabled games (game_status !== 1)
        const activeGames = games.filter(g => g.game_status === undefined || g.game_status === 1);

        if (activeGames.length > 0) {
          console.log('[RichGamingService] Found', activeGames.length, 'active games');
          return { success: true, games: activeGames.map(g => transformGame(g)) };
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

export const launchRichGamingGame = async (game, accountId, device) => {
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

    // Detect device: 0=Desktop, 1=Mobile
    if (device === undefined) {
      device = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 1 : 0;
    }

    const params = new URLSearchParams({ accountId, gameCode: String(gameCode), device: String(device) });
    // Absolute seamless host only — see games() comment.
    const urls = [`${BASE_URL}/api/richgaming/launch?${params}`];
    console.log('[RichGaming/launch] accountId=', accountId, 'gameCode=', gameCode, 'device=', device);

    for (const url of urls) {
      try {
        console.log('[RichGaming/launch] → GET', url);
        const response = await fetchWithTimeout(url);
        console.log('[RichGaming/launch] ← status', response.status, url);
        if (!response.ok) continue;
        const data = await response.json();
        console.log('[RichGaming/launch] ← body', data);

        // Apidoc: { status: true, code: 0, url: "..." } on success, { status: false, code, message } on error
        if (data.status === true && data.url) {
          return { success: true, gameUrl: data.url.trim(), ...data };
        }
        if (data.status === false) {
          const msg = data.code === 2000 ? 'Invalid request'
                    : data.code === 1500 ? 'Service temporarily unavailable, retrying...'
                    : (data.message || 'Launch failed');
          return { success: false, error: msg, code: data.code, ...data };
        }
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
