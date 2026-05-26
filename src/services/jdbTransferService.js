/**
 * JDB Transfer Game Service (Transfer Wallet)
 * API Base URL: /api/jdb-transfer
 * Endpoints: /games, /launch, /exit, /balance, /health
 *
 * IMPORTANT: This is a Transfer Wallet provider.
 * When player exits a game, call exitGame() to return funds to main wallet.
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
  const mType = game.mType ?? game.gameCode ?? game.GameCode ?? game.code ?? game.id;
  const gType = game.gType ?? game.gameType;

  return {
    id: `jdb-${mType}`,
    gameId: mType,
    gType,
    mType,
    slug: `jdb-${mType}`,
    name: name,
    provider: 'JDB',
    image: game.imageUrl || game.ImageUrl || game.image || '/placeholder-game.png',
    portraitImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    squareImage: game.imageUrl || game.ImageUrl || '/placeholder-game.png',
    category: (game.gameType || game.gType || 'slot').toString().toLowerCase(),
    rawCategory: game.gameType ?? game.gType ?? game.category ?? null,
    isHot: game.isHot || false,
    isNew: game.isNew || false,
    hasDemo: game.hasDemo || false,
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Experience the thrill of ${name}! This exciting game from JDB offers amazing gameplay.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],
    isJDB: true,
    providerType: 'transfer',
    originalData: game,
  };
};

export const fetchJDBGames = async (lang = 'en', currency = 'AUD') => {
  try {
    const params = new URLSearchParams({ lang, currency });
    const urls = [`${BASE_URL}/api/jdb-transfer/games?${params}`, `/api/jdb-transfer/games?${params}`];

    for (const url of urls) {
      try {
        console.log('[JDBService] Fetching games from:', url);
        const response = await fetchWithTimeout(url);
        if (!response.ok) continue;

        const text = await response.text();
        if (!text || text.startsWith('<!')) continue;

        const data = JSON.parse(text);
        if (data.success === false) continue;

        let games = Array.isArray(data) ? data : (data.games || data.data || data.Game || []);

        if (games.length > 0) {
          console.log('[JDBService] Found', games.length, 'games');
          return { success: true, games: games.map(g => transformGame(g)) };
        }
      } catch (err) {
        console.log('[JDBService] Error:', err.message);
      }
    }
    return { success: false, games: [], error: 'All API endpoints failed' };
  } catch (error) {
    return { success: false, games: [], error: error.message };
  }
};

export const getAllJDBGames = async () => {
  if (cachedGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedGames;
  }
  const result = await fetchJDBGames();
  if (result.success && result.games.length > 0) {
    cachedGames = result.games;
    cacheTimestamp = Date.now();
    return result.games;
  }
  return [];
};

export const launchJDBGame = async (game, accountId, options = {}) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'Please login to play' };

    const params = new URLSearchParams({ accountId, lang: options.lang || 'en' });
    const gType = game?.gType ?? options.gType;
    const mType = game?.mType ?? options.mType;
    if (gType !== undefined && gType !== null && gType !== '') params.set('gType', String(gType));
    if (mType !== undefined && mType !== null && mType !== '') params.set('mType', String(mType));
    if (options.amount !== undefined) params.set('amount', String(options.amount));
    if (options.nickname) params.set('nickname', options.nickname);
    if (options.windowMode) params.set('windowMode', String(options.windowMode));
    if (options.isApp) params.set('isApp', 'true');

    const urls = [`${BASE_URL}/api/jdb-transfer/launch?${params}`, `/api/jdb-transfer/launch?${params}`];

    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url, { method: 'POST' });
        if (!response.ok) continue;
        const data = await response.json();
        if (data.status === '0000' && data.path) {
          return { success: true, gameUrl: data.path.trim(), ...data };
        }
        if (data.status && data.status !== '0000') {
          return { success: false, error: data.err_text || `Launch failed (${data.status})`, ...data };
        }
      } catch (err) {
        console.log('[JDBService] Launch error:', err.message);
      }
    }
    return { success: false, error: 'Failed to launch game' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Exit game and transfer funds back to main wallet.
 * MUST be called when player exits the game.
 */
export const exitJDBGame = async (accountId) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'No account ID' };

    const url = `${BASE_URL}/api/jdb-transfer/exit?accountId=${accountId}`;
    console.log('[JDBService] Exiting game for account:', accountId);

    const response = await fetchWithTimeout(url, { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      console.log('[JDBService] Exit response:', data);
      // 6002 (User balance is zero) is a clean no-op
      if (data.status === '0000' || data.status === '6002') {
        return { success: true, ...data };
      }
      return { success: false, error: data.err_text || `Exit failed (${data.status})`, ...data };
    }
    return { success: false, error: 'Exit failed' };
  } catch (error) {
    console.log('[JDBService] Exit error:', error.message);
    return { success: false, error: error.message };
  }
};

export const getJDBBalance = async (accountId) => {
  try {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }
    if (!accountId) return { success: false, error: 'No account ID' };

    const response = await fetchWithTimeout(`${BASE_URL}/api/jdb-transfer/balance?accountId=${accountId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === '0000') {
        return { success: true, balance: data.jdbBalance ?? 0, currency: data.currency, active: data.active, ...data };
      }
      return { success: false, error: data.err_text || `Balance fetch failed (${data.status})` };
    }
    return { success: false, error: 'Failed to get balance' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const clearJDBCache = () => { cachedGames = null; cacheTimestamp = null; };

export const jdbTransferService = {
  fetchGames: fetchJDBGames,
  getAllGames: getAllJDBGames,
  launchGame: launchJDBGame,
  exitGame: exitJDBGame,
  getBalance: getJDBBalance,
  clearCache: clearJDBCache,
};

export default jdbTransferService;
