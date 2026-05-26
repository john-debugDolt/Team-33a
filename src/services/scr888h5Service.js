/**
 * SCR888H5 Game Service (Transfer Wallet)
 * API Base URL: /api/scr888h5
 * Endpoints: /games, /launch, /transfer-out, /balance, /health
 *
 * IMPORTANT: This is a Transfer Wallet provider.
 * When player exits a game, call transferOut() to return funds to main wallet.
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
    const urls = [`${BASE_URL}/api/scr888h5/games`, `/api/scr888h5/games`];

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

    const params = new URLSearchParams({ accountId, gameId: String(gameId) });
    const urls = [`${BASE_URL}/api/scr888h5/launch?${params}`, `/api/scr888h5/launch?${params}`];

    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;
        const data = await response.json();
        if (data.success && data.gameUrl) {
          return { success: true, gameUrl: data.gameUrl.trim(), ...data };
        }
        if (data.success === false) {
          const msg = data.errorCode === 6006 ? 'Insufficient balance'
                    : data.errorCode === 7501 ? 'Wallet not found'
                    : (data.error || data.message || 'Launch failed');
          return { success: false, error: msg, errorCode: data.errorCode, ...data };
        }
      } catch (err) {
        console.log('[SCR888H5Service] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Transfer funds out from game wallet back to main wallet.
 * MUST be called when player exits the game.
 */
export const transferOutSCR888H5 = async (accountId) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'No account ID' };

    const url = `${BASE_URL}/api/scr888h5/transfer-out?accountId=${accountId}`;
    console.log('[SCR888H5Service] Transferring out for account:', accountId);

    const response = await fetchWithTimeout(url, { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      console.log('[SCR888H5Service] Transfer out response:', data);
      if (data.success) {
        return { success: true, amountTransferred: data.amountTransferred ?? 0, ...data };
      }
      return { success: false, error: data.error || data.message || 'Transfer out failed', ...data };
    }
    return { success: false, error: 'Transfer out failed' };
  } catch (error) {
    console.log('[SCR888H5Service] Transfer out error:', error.message);
    return { success: false, error: error.message };
  }
};

export const getSCR888H5Balance = async (accountId) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'No account ID' };

    const response = await fetchWithTimeout(`${BASE_URL}/api/scr888h5/balance?accountId=${accountId}`);
    if (response.ok) {
      const data = await response.json();
      return { success: true, balance: data.balance || data.data?.balance || 0 };
    }
    return { success: false, error: 'Failed to get balance' };
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
  clearCache: clearSCR888H5Cache,
};

export default scr888h5Service;
