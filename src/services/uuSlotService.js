/**
 * UUSlot Game Service
 * Handles fetching games from UUSlot API and game launching
 *
 * API Base URL: https://uuslot.seamless.team33.mx
 * Endpoints:
 *   - GET /api/uuslot/game/list - Get game list
 *   - GET /api/uuslot/game/launch - Launch a game
 *   - GET /api/uuslot/game/health - Health check
 *   - GET /api/uuslot/game/config - Get configuration
 */

// UUSlot API Base URL
const UUSLOT_BASE_URL = 'https://uuslot.seamless.team33.mx';

// Cache for UUSlot games
let cachedUUSlotGames = null;
let uuSlotCacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Game type mapping
const GAME_TYPE_MAP = {
  1: 'slot',       // Slots
  2: 'table',      // Table games
  3: 'live',       // Live casino
  4: 'fishing',    // Fishing
  5: 'crash',      // Crash
};

/**
 * Helper function to fetch with timeout
 */
const fetchWithTimeout = async (url, timeout = 20000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/**
 * Get current language for game names
 */
const getCurrentLanguage = () => {
  const lang = localStorage.getItem('language') || 'en';
  if (lang.startsWith('zh') || lang === 'cn') return 'zh-cn';
  return 'en-us';
};

/**
 * Get localized game name from OtherName array
 */
const getLocalizedName = (game) => {
  const lang = getCurrentLanguage();

  if (game.OtherName && Array.isArray(game.OtherName)) {
    const localizedEntry = game.OtherName.find(entry => entry.startsWith(lang));
    if (localizedEntry) {
      return localizedEntry.split('|')[1] || game.GameName;
    }
  }

  return game.GameName;
};

/**
 * Map UUSlot game type to internal category
 */
const mapUUSlotCategory = (gameType, method) => {
  // First try by GameType number
  if (GAME_TYPE_MAP[gameType]) {
    return GAME_TYPE_MAP[gameType];
  }

  // Fallback to Method string
  const methodLower = (method || '').toLowerCase();
  if (methodLower.includes('slot')) return 'slot';
  if (methodLower.includes('table')) return 'table';
  if (methodLower.includes('live')) return 'live';
  if (methodLower.includes('fish')) return 'fishing';
  if (methodLower.includes('crash')) return 'crash';

  return 'slot'; // Default to slot
};

/**
 * Check if game is hot/popular based on sequence
 */
const isGameHot = (game) => {
  // Games with low sequence numbers are featured/popular
  return game.Sequence && game.Sequence <= 10;
};

/**
 * Check if game is new based on game events or high GameId
 */
const isGameNew = (game) => {
  // Check for NEW event tag
  if (game.GameEvent && Array.isArray(game.GameEvent)) {
    return game.GameEvent.some(e =>
      (typeof e === 'string' && e.toUpperCase().includes('NEW')) ||
      (e.tag && e.tag.toUpperCase().includes('NEW'))
    );
  }
  // High GameId might indicate newer game
  return game.GameId > 15000;
};

/**
 * Transform UUSlot game to internal game format
 */
const transformUUSlotGame = (game) => {
  const name = getLocalizedName(game);

  return {
    // Required fields
    id: `uuslot-${game.GameCode}`,
    gameId: game.GameCode,
    slug: `uuslot-${game.GameCode}`,
    name: name,
    provider: 'UUSlot',

    // Images - UUSlot provides direct image URLs
    image: game.ImageUrl,
    portraitImage: game.ImageUrl,
    squareImage: game.ImageUrl,

    // Category and tags
    category: mapUUSlotCategory(game.GameType, game.Method),
    isHot: isGameHot(game),
    isNew: isGameNew(game),
    hasDemo: game.HasDemo || false,
    isH5Support: game.IsH5Support || true,

    // Default game details for modal
    rating: 4.5,
    playCount: Math.floor(Math.random() * 25000) + 5000,
    description: `Experience the thrill of ${name}! This exciting game from UUSlot offers amazing gameplay with stunning graphics and big win potential.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],

    // UUSlot specific
    isUUSlot: true,
    gameType: game.GameType,
    method: game.Method,
    providerCode: game.GameProvideCode,
    providerName: game.GameProvideName,
    originalData: game,
  };
};

/**
 * Fetch games from UUSlot API
 */
export const fetchUUSlotGames = async () => {
  try {
    // Try direct URL first, then proxy
    const urls = [
      `${UUSLOT_BASE_URL}/api/uuslot/game/list`,
      `/api/uuslot/game/list`
    ];

    for (const url of urls) {
      try {
        console.log('[UUSlotService] Fetching games from:', url);
        const response = await fetchWithTimeout(url, 20000);

        if (!response.ok) {
          console.log('[UUSlotService] Response not OK:', response.status);
          continue;
        }

        const text = await response.text();

        // Check if response is empty or HTML
        if (!text || text.startsWith('<!') || text.startsWith('<html')) {
          console.log('[UUSlotService] Invalid response (empty or HTML)');
          continue;
        }

        const data = JSON.parse(text);
        console.log('[UUSlotService] API response success:', data.success);

        // UUSlot returns { success: true, games: [...] }
        let games = [];
        if (Array.isArray(data)) {
          games = data;
        } else if (data.games && Array.isArray(data.games)) {
          games = data.games;
        } else if (data.data && Array.isArray(data.data)) {
          games = data.data;
        }

        // Filter active games only
        games = games.filter(g => g.IsActive !== false);

        if (games.length > 0) {
          console.log('[UUSlotService] Found', games.length, 'games');
          return {
            success: true,
            games: games.map(g => transformUUSlotGame(g)),
            rawGames: games,
          };
        }

        console.log('[UUSlotService] No games found in response');
      } catch (err) {
        console.log('[UUSlotService] Error fetching from', url, ':', err.message);
      }
    }

    console.error('[UUSlotService] All API endpoints failed');
    return { success: false, games: [], error: 'All API endpoints failed' };

  } catch (error) {
    console.error('[UUSlotService] Failed to fetch UUSlot games:', error);
    return { success: false, games: [], error: error.message };
  }
};

/**
 * Get all UUSlot games with caching
 */
export const getAllUUSlotGames = async () => {
  // Return cached data if valid
  if (cachedUUSlotGames && uuSlotCacheTimestamp &&
      (Date.now() - uuSlotCacheTimestamp < CACHE_DURATION)) {
    console.log('[UUSlotService] Returning cached games');
    return cachedUUSlotGames;
  }

  const result = await fetchUUSlotGames();

  if (result.success && result.games.length > 0) {
    cachedUUSlotGames = result.games;
    uuSlotCacheTimestamp = Date.now();
    return result.games;
  }

  return [];
};

/**
 * Clear UUSlot games cache
 */
export const clearUUSlotCache = () => {
  cachedUUSlotGames = null;
  uuSlotCacheTimestamp = null;
};

/**
 * Launch a UUSlot game
 * @param {string} gameCode - UUSlot game code
 * @param {string} accountId - User's account ID
 * @param {boolean} launchDemo - Launch in demo mode
 */
export const launchUUSlotGame = async (gameCode, accountId, launchDemo = false) => {
  try {
    // Get account ID from localStorage if not provided
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'Please login to play' };
    }

    // Build launch URL
    const params = new URLSearchParams({
      accountId: accountId,
      gameCode: gameCode,
      launchDemo: launchDemo.toString()
    });

    // Try direct URL first, then proxy
    const urls = [
      `${UUSLOT_BASE_URL}/api/uuslot/game/launch?${params}`,
      `/api/uuslot/game/launch?${params}`
    ];

    for (const url of urls) {
      try {
        console.log('[UUSlotService] Launching game from:', url);
        const response = await fetchWithTimeout(url, 20000);

        if (!response.ok) {
          console.log('[UUSlotService] Launch response not OK:', response.status);
          continue;
        }

        const data = await response.json();
        console.log('[UUSlotService] Launch response:', data.success);

        // Check for game URL in response and trim whitespace
        const gameUrl = (data.gameUrl || data.url || data.launchUrl)?.trim();

        if (gameUrl) {
          return {
            success: true,
            gameUrl: gameUrl,
            ticket: data.ticket,
            ...data
          };
        }

        // If response indicates error
        if (data.error || data.message) {
          return {
            success: false,
            error: data.error || data.message
          };
        }

      } catch (err) {
        console.log('[UUSlotService] Error launching from', url, ':', err.message);
      }
    }

    return { success: false, error: 'Failed to launch game. Please try again.' };

  } catch (error) {
    console.error('[UUSlotService] Game launch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check UUSlot service health
 */
export const checkUUSlotHealth = async () => {
  try {
    const urls = [
      `${UUSLOT_BASE_URL}/api/uuslot/game/health`,
      `/api/uuslot/game/health`
    ];

    for (const url of urls) {
      try {
        const response = await fetchWithTimeout(url, 5000);
        if (response.ok) {
          const data = await response.json();
          return { success: true, status: data.status, enabled: data.enabled };
        }
      } catch (err) {
        // Continue to next URL
      }
    }

    return { success: false, status: 'unhealthy' };

  } catch (error) {
    return { success: false, status: 'error', error: error.message };
  }
};

/**
 * Get UUSlot configuration
 */
export const getUUSlotConfig = async () => {
  try {
    const response = await fetchWithTimeout(`${UUSLOT_BASE_URL}/api/uuslot/game/config`, 5000);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('[UUSlotService] Failed to get config:', error);
    return null;
  }
};

// Export service object
export const uuSlotService = {
  fetchGames: fetchUUSlotGames,
  getAllGames: getAllUUSlotGames,
  launchGame: launchUUSlotGame,
  checkHealth: checkUUSlotHealth,
  getConfig: getUUSlotConfig,
  clearCache: clearUUSlotCache,
};

export default uuSlotService;
