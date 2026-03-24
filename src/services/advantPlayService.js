/**
 * AdvantPlay Game Service
 * Handles fetching games from AdvantPlay API and game launching
 *
 * API Endpoint: /api/advantplay/game/list?iconSize={size}
 * LoadBalancer URL: http://k8s-team33-walletse-ebcec4c2ff-cf4fe459a5f621a8.elb.ap-southeast-2.amazonaws.com
 */

// AdvantPlay API URL (subdomain configured)
const ADVANTPLAY_BASE_URL = 'https://advantplay.seamless.team33.mx';

// Cache for AdvantPlay games
let cachedAdvantPlayGames = null;
let advantPlayCacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Available icon sizes for AdvantPlay games
export const ADVANTPLAY_ICON_SIZES = {
  THUMBNAIL: '66x67',      // Thumbnail
  SMALL: '112x112',        // Small grid
  DEFAULT: '150x150',      // Default grid
  MEDIUM: '200x200',       // Medium grid
  LARGE: '268x268',        // Large grid
  FEATURED: '300x300',     // Featured
  PORTRAIT: '492x660',     // Portrait banner
  BANNER: '870x570',       // Large banner
};

// Default icon size to use for game cards
const DEFAULT_ICON_SIZE = ADVANTPLAY_ICON_SIZES.MEDIUM; // 200x200 for good quality on game cards

/**
 * Get current language for icon selection
 * Maps app language codes to AdvantPlay language codes
 */
const getCurrentLanguage = () => {
  const lang = localStorage.getItem('language') || 'en';
  // AdvantPlay supports: en, cn, th, etc.
  if (lang.startsWith('zh') || lang === 'cn') return 'cn';
  if (lang === 'th') return 'th';
  return 'en';
};

/**
 * Extract icon URL from AdvantPlay game IconList
 * @param {Object} game - AdvantPlay game object
 * @param {string} iconSize - Desired icon size (e.g., '200x200')
 * @param {string} iconType - Icon type: 'bkg' (with background) or 'transparent'
 */
const getAdvantPlayIconUrl = (game, iconSize = DEFAULT_ICON_SIZE, iconType = 'bkg') => {
  if (!game || !game.IconList || !Array.isArray(game.IconList)) {
    return '/placeholder-game.png';
  }

  const lang = getCurrentLanguage();

  // Find icon for current language, fallback to English
  let iconData = game.IconList.find(i => i.Language === lang);
  if (!iconData) {
    iconData = game.IconList.find(i => i.Language === 'en');
  }
  if (!iconData && game.IconList.length > 0) {
    iconData = game.IconList[0]; // Use first available
  }

  if (!iconData || !iconData.Url) {
    return '/placeholder-game.png';
  }

  // Get icon URL for requested size
  const sizeData = iconData.Url[iconSize];
  if (sizeData) {
    // Prefer 'bkg' (background) for cards, 'transparent' for overlays
    return sizeData[iconType] || sizeData.bkg || sizeData.transparent || '/placeholder-game.png';
  }

  // Fallback to any available size
  const availableSizes = Object.keys(iconData.Url);
  if (availableSizes.length > 0) {
    const fallbackSize = iconData.Url[availableSizes[0]];
    return fallbackSize[iconType] || fallbackSize.bkg || fallbackSize.transparent || '/placeholder-game.png';
  }

  return '/placeholder-game.png';
};

/**
 * Get game name from AdvantPlay IconList based on current language
 */
const getAdvantPlayGameName = (game) => {
  if (!game) return 'Unknown Game';

  // If game has IconList with localized names
  if (game.IconList && Array.isArray(game.IconList)) {
    const lang = getCurrentLanguage();
    let iconData = game.IconList.find(i => i.Language === lang);
    if (!iconData) {
      iconData = game.IconList.find(i => i.Language === 'en');
    }
    if (iconData && iconData.Name) {
      return iconData.Name;
    }
  }

  // Fallback to GameCode
  return game.GameCode || 'Unknown Game';
};

/**
 * Map AdvantPlay category to internal category
 */
const mapAdvantPlayCategory = (gameCategory) => {
  if (!gameCategory || !Array.isArray(gameCategory)) return 'slot';

  const categoryMap = {
    'slot': 'slot',
    'table': 'table',
    'fishing': 'fishing',
    'crash': 'crash',
    'live': 'live_casino',
    'card': 'card_game',
    'arcade': 'instant_win',
  };

  // Check first category
  const firstCategory = gameCategory[0]?.toLowerCase() || 'slot';
  return categoryMap[firstCategory] || 'slot';
};

/**
 * Determine if game is hot/popular based on GameTag
 */
const isGameHot = (game) => {
  const tag = (game.GameTag || '').toUpperCase();
  return tag.includes('TOP') || tag.includes('HOT') || tag.includes('POPULAR');
};

/**
 * Determine if game is new based on GameTag
 */
const isGameNew = (game) => {
  const tag = (game.GameTag || '').toUpperCase();
  return tag.includes('NEW') || tag.includes('LATEST');
};

/**
 * Transform AdvantPlay game to internal game format
 * Maps API response to match existing game structure
 */
const transformAdvantPlayGame = (game, iconSize = DEFAULT_ICON_SIZE) => {
  const name = getAdvantPlayGameName(game);
  const imageUrl = getAdvantPlayIconUrl(game, iconSize, 'bkg');
  const transparentUrl = getAdvantPlayIconUrl(game, iconSize, 'transparent');

  return {
    // Required fields
    id: `advantplay-${game.GameCode}`,
    gameId: game.GameCode,
    slug: `advantplay-${game.GameCode}`,
    name: name,
    provider: 'AdvantPlay',

    // Images
    image: imageUrl,
    portraitImage: getAdvantPlayIconUrl(game, ADVANTPLAY_ICON_SIZES.PORTRAIT, 'bkg'),
    squareImage: imageUrl,
    transparentImage: transparentUrl,

    // Category and tags
    category: mapAdvantPlayCategory(game.GameCategory),
    isHot: isGameHot(game),
    isNew: isGameNew(game),
    gameTag: game.GameTag || '',

    // Default game details for modal
    rating: 4.5,
    playCount: Math.floor(Math.random() * 30000) + 5000,
    description: `Experience the thrill of ${name}! This exciting game from AdvantPlay offers amazing gameplay with stunning graphics and big win potential.`,
    rtp: 96.5,
    volatility: 'Medium',
    minBet: 0.10,
    maxBet: 100,
    features: ['Free Spins', 'Wild Symbols', 'Bonus Round'],

    // AdvantPlay specific
    isAdvantPlay: true,
    originalData: game, // Keep original data for debugging
  };
};

/**
 * Fetch games from AdvantPlay API
 * @param {string} iconSize - Icon size to fetch (default: 200x200)
 */
export const fetchAdvantPlayGames = async (iconSize = DEFAULT_ICON_SIZE) => {
  try {
    // Try both proxy (local dev) and direct URL (production)
    const urls = [
      `/api/advantplay/game/list?iconSize=${iconSize}`,
      `${ADVANTPLAY_BASE_URL}/api/advantplay/game/list?iconSize=${iconSize}`
    ];

    for (const url of urls) {
      try {
        console.log('[AdvantPlayService] Fetching games from:', url);
        const response = await fetch(url);

        if (!response.ok) {
          console.log('[AdvantPlayService] Response not OK:', response.status);
          continue;
        }

        const data = await response.json();
        console.log('[AdvantPlayService] API response:', data);

        // AdvantPlay returns games array directly or in data.games
        let games = [];
        if (Array.isArray(data)) {
          games = data;
        } else if (data.games && Array.isArray(data.games)) {
          games = data.games;
        } else if (data.data && Array.isArray(data.data)) {
          games = data.data;
        }

        if (games.length > 0) {
          console.log('[AdvantPlayService] Found', games.length, 'games');
          return {
            success: true,
            games: games.map(g => transformAdvantPlayGame(g, iconSize)),
            rawGames: games,
          };
        }

        console.log('[AdvantPlayService] No games found in response');
      } catch (err) {
        console.log('[AdvantPlayService] Error fetching from', url, ':', err.message);
      }
    }

    console.error('[AdvantPlayService] All API endpoints failed');
    return { success: false, games: [], error: 'All API endpoints failed' };

  } catch (error) {
    console.error('[AdvantPlayService] Failed to fetch AdvantPlay games:', error);
    return { success: false, games: [], error: error.message };
  }
};

/**
 * Get all AdvantPlay games with caching
 */
export const getAllAdvantPlayGames = async (iconSize = DEFAULT_ICON_SIZE) => {
  // Return cached data if valid
  if (cachedAdvantPlayGames && advantPlayCacheTimestamp &&
      (Date.now() - advantPlayCacheTimestamp < CACHE_DURATION)) {
    console.log('[AdvantPlayService] Returning cached games');
    return cachedAdvantPlayGames;
  }

  const result = await fetchAdvantPlayGames(iconSize);

  if (result.success && result.games.length > 0) {
    cachedAdvantPlayGames = result.games;
    advantPlayCacheTimestamp = Date.now();
    return result.games;
  }

  return [];
};

/**
 * Clear AdvantPlay games cache
 */
export const clearAdvantPlayCache = () => {
  cachedAdvantPlayGames = null;
  advantPlayCacheTimestamp = null;
};

/**
 * Launch an AdvantPlay game
 * @param {string} gameCode - AdvantPlay game code
 * @param {string} accountId - User's account ID
 */
export const launchAdvantPlayGame = async (gameCode, accountId) => {
  try {
    // Get account ID from localStorage if not provided
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'Please login to play' };
    }

    // Try both proxy and direct URL
    const urls = [
      `/api/advantplay/game/launch?accountId=${accountId}&gameCode=${gameCode}`,
      `${ADVANTPLAY_BASE_URL}/api/advantplay/game/launch?accountId=${accountId}&gameCode=${gameCode}`
    ];

    for (const url of urls) {
      try {
        console.log('[AdvantPlayService] Launching game from:', url);
        const response = await fetch(url);

        if (!response.ok) {
          console.log('[AdvantPlayService] Launch response not OK:', response.status);
          continue;
        }

        const data = await response.json();
        console.log('[AdvantPlayService] Launch response:', data);

        // Check for game URL in response
        const gameUrl = data.gameUrl || data.url || data.launchUrl || data.data?.gameUrl;

        if (gameUrl) {
          return {
            success: true,
            gameUrl: gameUrl,
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
        console.log('[AdvantPlayService] Error launching from', url, ':', err.message);
      }
    }

    return { success: false, error: 'Failed to launch game. Please try again.' };

  } catch (error) {
    console.error('[AdvantPlayService] Game launch error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get available icon sizes from AdvantPlay
 */
export const getAdvantPlayIconSizes = async () => {
  try {
    const urls = [
      `/api/advantplay/game/icon-sizes`,
      `${ADVANTPLAY_BASE_URL}/api/advantplay/game/icon-sizes`
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.log('[AdvantPlayService] Error fetching icon sizes:', err.message);
      }
    }

    // Return default sizes if API fails
    return Object.values(ADVANTPLAY_ICON_SIZES);

  } catch (error) {
    console.error('[AdvantPlayService] Failed to get icon sizes:', error);
    return Object.values(ADVANTPLAY_ICON_SIZES);
  }
};

/**
 * Check AdvantPlay service health
 */
export const checkAdvantPlayHealth = async () => {
  try {
    const urls = [
      `/api/advantplay/game/health`,
      `${ADVANTPLAY_BASE_URL}/api/advantplay/game/health`
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return { success: true, status: 'healthy' };
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

// Export service object for consistency with gameService
export const advantPlayService = {
  fetchGames: fetchAdvantPlayGames,
  getAllGames: getAllAdvantPlayGames,
  launchGame: launchAdvantPlayGame,
  getIconSizes: getAdvantPlayIconSizes,
  checkHealth: checkAdvantPlayHealth,
  clearCache: clearAdvantPlayCache,
  ICON_SIZES: ADVANTPLAY_ICON_SIZES,
};

export default advantPlayService;
