import { apiClient } from './api';
import { games as localGames, getGamesByCategory, getHotGames as getLocalHotGames, getNewGames as getLocalNewGames, getGameById as getLocalGameById, getGameBySlug, searchGames as localSearchGames, CATEGORIES } from '../data/gameData';

// Get headers for API calls (no auth token needed for user frontend)
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};

// Cache for API games data
let cachedApiGames = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Fetch games from ClotPlay API
export const fetchClotPlayGames = async (page = 1, perPage = 100) => {
  try {
    const response = await fetch(`/api/games/clotplay?page=${page}&perPage=${perPage}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    if (data.code === 0 && data.data) {
      return {
        success: true,
        games: data.data,
        pagination: data.pagination
      };
    }
    return { success: false, games: [], error: 'Invalid API response' };
  } catch (error) {
    console.error('Failed to fetch ClotPlay games:', error);
    return { success: false, games: [], error: error.message };
  }
};

// Get all games from API with caching
export const getAllApiGames = async () => {
  // Return cached data if valid
  if (cachedApiGames && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedApiGames;
  }

  // Fetch all pages
  let allGames = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchClotPlayGames(page, 100);
    if (result.success && result.games.length > 0) {
      allGames = [...allGames, ...result.games];
      hasMore = result.pagination && page < result.pagination.last_page;
      page++;
    } else {
      hasMore = false;
    }
  }

  // Cache the results
  cachedApiGames = allGames;
  cacheTimestamp = Date.now();

  return allGames;
};

// Get current language for thumbnails
const getCurrentLanguage = () => {
  // Check localStorage or default to 'en'
  const lang = localStorage.getItem('language') || 'en';
  // Map to API language codes
  if (lang.startsWith('zh') || lang === 'cn') return 'cn';
  if (lang === 'th') return 'th';
  return 'en';
};

// Get image URL from API game data
export const getPortraitUrl = (game) => {
  if (!game) return '/placeholder-game.png';
  const lang = getCurrentLanguage();
  // If game has thumbnails from API
  if (game.thumbnails) {
    const langThumbs = game.thumbnails[lang] || game.thumbnails['en'] || Object.values(game.thumbnails)[0];
    if (langThumbs?.portrait) return langThumbs.portrait;
  }
  // Fallback to portrait image if set
  if (game.portraitImage) return game.portraitImage;
  return '/placeholder-game.png';
};

export const getSquareUrl = (game) => {
  if (!game) return '/placeholder-game.png';
  const lang = getCurrentLanguage();
  // If game has thumbnails from API
  if (game.thumbnails) {
    const langThumbs = game.thumbnails[lang] || game.thumbnails['en'] || Object.values(game.thumbnails)[0];
    if (langThumbs?.square) return langThumbs.square;
  }
  // Fallback to square image if set
  if (game.squareImage) return game.squareImage;
  return '/placeholder-game.png';
};

// Enhance a game object with image URLs and default values
export const enhanceGameWithImages = (game) => {
  if (!game) return null;

  // Get portrait URL - handles both API format and local format
  const portraitImage = getPortraitUrl(game);
  const squareImage = getSquareUrl(game);

  return {
    ...game,
    // Normalize field names from API
    id: game.id || game.slug,
    gameId: game.gameId || game.slug,
    name: game.name,
    isHot: game.isHot === 1 || game.isHot === true || game.isPopular === 1,
    isNew: game.isNew === 1 || game.isNew === true,
    isMaintenance: game.isMaintenance === 1,
    provider: game.provider || 'ClotPlay',
    // Image URLs
    portraitImage,
    squareImage,
    image: portraitImage, // Default image for display
    // Default values for modal display
    rating: game.rating || 4.5,
    playCount: game.playCount || Math.floor(Math.random() * 50000) + 10000,
    description: game.description || `Experience the thrill of ${game.name}! This exciting ${game.category || 'slot'} game offers amazing gameplay and big win potential.`,
    rtp: game.rtp || 96.5,
    volatility: game.volatility || 'Medium',
    minBet: game.minBet || 0.10,
    maxBet: game.maxBet || 100,
    features: game.features || ['Free Spins', 'Wild Symbols', 'Bonus Round'],
  };
};

// Get all local games with images
export const getAllLocalGamesWithImages = () => {
  return localGames.map(game => enhanceGameWithImages(game));
};

// Get local games by category with images
export const getLocalGamesByCategoryWithImages = (category) => {
  return getGamesByCategory(category).map(game => enhanceGameWithImages(game));
};

// Get hot local games with images
export const getHotLocalGamesWithImages = () => {
  return getLocalHotGames().map(game => enhanceGameWithImages(game));
};

// Get new local games with images
export const getNewLocalGamesWithImages = () => {
  return getLocalNewGames().map(game => enhanceGameWithImages(game));
};

// Search local games with images
export const searchLocalGamesWithImages = (query) => {
  return localSearchGames(query).map(game => enhanceGameWithImages(game));
};

// Game Service with API calls
export const gameService = {
  async getGames({ page = 1, limit = 36, provider = 'ALL', search = '', gameType = 'slot', isHot, isNew, useLocal = false } = {}) {
    try {
      // Fetch games from ClotPlay API
      const apiGames = await getAllApiGames();

      if (apiGames && apiGames.length > 0) {
        let filteredGames = [...apiGames];

        // Filter by search
        if (search && search.trim()) {
          const query = search.toLowerCase();
          filteredGames = filteredGames.filter(g =>
            g.name.toLowerCase().includes(query) ||
            g.slug.toLowerCase().includes(query) ||
            (g.name_cn && g.name_cn.includes(query))
          );
        }

        // Filter by game type / category
        if (gameType && gameType !== 'all') {
          const categoryMap = {
            'slot': 'slot_game',
            'slots': 'slot_game',
            'crash': 'crash',
            'instant-win': 'instant_win',
            'card-game': 'card_game',
            'fishing': 'fishing',
            'live-casino': 'live_casino',
            'table': 'table_game',
          };
          const category = categoryMap[gameType] || gameType;
          filteredGames = filteredGames.filter(g => {
            const gameCategory = (g.category || '').toLowerCase();
            return gameCategory.includes(category) || category.includes(gameCategory);
          });
        }

        // Filter by hot/popular
        if (isHot === 'true' || isHot === true) {
          filteredGames = filteredGames.filter(g => g.isPopular === 1);
        }

        // Filter by new
        if (isNew === 'true' || isNew === true) {
          filteredGames = filteredGames.filter(g => g.isNew === 1);
        }

        // Filter out games under maintenance
        filteredGames = filteredGames.filter(g => g.isMaintenance !== 1);

        // Paginate
        const start = (page - 1) * limit;
        const paginatedGames = filteredGames.slice(start, start + limit);

        return {
          success: true,
          data: {
            games: paginatedGames.map(enhanceGameWithImages),
            pagination: {
              page,
              limit,
              total: filteredGames.length,
              totalPages: Math.ceil(filteredGames.length / limit)
            },
            total: filteredGames.length,
            totalPages: Math.ceil(filteredGames.length / limit)
          }
        };
      }

      // Fallback to local data if API fails
      console.warn('API games not available, falling back to local data');
      let filteredGames = [...localGames];

      // Filter by search
      if (search && search.trim()) {
        const query = search.toLowerCase();
        filteredGames = filteredGames.filter(g =>
          g.name.toLowerCase().includes(query) ||
          g.slug.toLowerCase().includes(query)
        );
      }

      // Paginate
      const start = (page - 1) * limit;
      const paginatedGames = filteredGames.slice(start, start + limit);

      return {
        success: true,
        data: {
          games: paginatedGames.map(enhanceGameWithImages),
          pagination: {
            page,
            limit,
            total: filteredGames.length,
            totalPages: Math.ceil(filteredGames.length / limit)
          },
          total: filteredGames.length,
          totalPages: Math.ceil(filteredGames.length / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching games:', error);
      // Return empty on error
      return {
        success: false,
        data: { games: [], pagination: { page: 1, limit, total: 0, totalPages: 0 }, total: 0, totalPages: 0 },
        error: error.message
      };
    }
  },

  async getGameById(id) {
    try {
      const apiGames = await getAllApiGames();
      const game = apiGames.find(g => g.slug === id || g.id === id);
      if (game) {
        return { success: true, data: enhanceGameWithImages(game) };
      }
      // Fallback to local
      const localGame = getLocalGameById(id);
      if (localGame) {
        return { success: true, data: enhanceGameWithImages(localGame) };
      }
      return { success: false, error: 'Game not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getFeaturedGames(limit = 6) {
    try {
      const apiGames = await getAllApiGames();
      if (apiGames && apiGames.length > 0) {
        // Get popular games or first games as featured
        const hotGames = apiGames
          .filter(g => g.isPopular === 1 || g.isNew === 1)
          .slice(0, limit);
        const games = hotGames.length >= limit ? hotGames : apiGames.slice(0, limit);
        return { success: true, data: { games: games.map(enhanceGameWithImages) } };
      }
      // Fallback
      const hotGames = getLocalHotGames().slice(0, limit);
      return { success: true, data: { games: hotGames.map(enhanceGameWithImages) } };
    } catch (error) {
      return { success: false, data: { games: [] }, error: error.message };
    }
  },

  async getHotGames(limit = 12) {
    try {
      const apiGames = await getAllApiGames();
      if (apiGames && apiGames.length > 0) {
        const hotGames = apiGames.filter(g => g.isPopular === 1).slice(0, limit);
        const games = hotGames.length > 0 ? hotGames : apiGames.slice(0, limit);
        return { success: true, data: { games: games.map(enhanceGameWithImages) } };
      }
      const hotGames = getLocalHotGames().slice(0, limit);
      return { success: true, data: { games: hotGames.map(enhanceGameWithImages) } };
    } catch (error) {
      return { success: false, data: { games: [] }, error: error.message };
    }
  },

  async getNewGames(limit = 12) {
    try {
      const apiGames = await getAllApiGames();
      if (apiGames && apiGames.length > 0) {
        const newGames = apiGames.filter(g => g.isNew === 1).slice(0, limit);
        const games = newGames.length > 0 ? newGames : apiGames.slice(0, limit);
        return { success: true, data: { games: games.map(enhanceGameWithImages) } };
      }
      const newGames = getLocalNewGames().slice(0, limit);
      return { success: true, data: { games: newGames.map(enhanceGameWithImages) } };
    } catch (error) {
      return { success: false, data: { games: [] }, error: error.message };
    }
  },

  async getProviders() {
    try {
      const apiGames = await getAllApiGames();
      if (apiGames && apiGames.length > 0) {
        // Extract unique categories as providers
        const categories = [...new Set(apiGames.map(g => g.category || 'Other'))];
        const providers = [
          { id: 'ALL', name: 'ALL' },
          ...categories.map(cat => ({
            id: cat,
            name: cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            count: apiGames.filter(g => g.category === cat).length
          }))
        ];
        return { success: true, data: { providers } };
      }
      // Fallback
      const providerNames = [...new Set(localGames.map(g => g.provider))];
      const providers = [
        { id: 'ALL', name: 'ALL' },
        ...providerNames.map(name => ({
          id: name,
          name: name,
          count: localGames.filter(g => g.provider === name).length
        }))
      ];
      return { success: true, data: { providers } };
    } catch (error) {
      return { success: false, data: { providers: [{ id: 'ALL', name: 'ALL' }] } };
    }
  },

  async searchGames(query, limit = 20) {
    if (!query || query.trim().length < 2) {
      return { success: true, data: { games: [] } };
    }

    try {
      const apiGames = await getAllApiGames();
      if (apiGames && apiGames.length > 0) {
        const q = query.toLowerCase();
        const results = apiGames
          .filter(g =>
            g.name.toLowerCase().includes(q) ||
            g.slug.toLowerCase().includes(q) ||
            (g.name_cn && g.name_cn.includes(q))
          )
          .slice(0, limit);
        return { success: true, data: { games: results.map(enhanceGameWithImages) } };
      }
      // Fallback
      const results = localSearchGames(query).slice(0, limit);
      return { success: true, data: { games: results.map(enhanceGameWithImages) } };
    } catch (error) {
      return { success: false, data: { games: [] }, error: error.message };
    }
  },

  /**
   * Request game launch URL from backend
   * Uses Team33 Game Launch API (proxied through vercel.json/vite.config.js to avoid CORS)
   * Includes automatic retry logic for transient failures
   */
  async requestGameUrl(gameId, userId) {
    // Try to find game in API cache first, then local
    let game = null;
    const apiGames = cachedApiGames || [];
    game = apiGames.find(g => g.slug === gameId || g.id === gameId);

    if (!game) {
      game = getLocalGameById(gameId);
    }

    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    // Direct API call to games backend
    const GAME_LAUNCH_API = 'https://accounts.team33.mx/api/games/launch';

    // Get user's actual accountId from localStorage
    const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
    const userAccountId = user.accountId || userId;

    // Fallback to demo account if no user logged in
    const ACCOUNT_ID = userAccountId || 'ACC284290827402874880';

    // Retry configuration
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 500; // ms between retries

    // Helper function to delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Helper function to make the API call
    const makeRequest = async () => {
      const response = await fetch(GAME_LAUNCH_API, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          accountId: ACCOUNT_ID,
          gameId: game.slug || game.gameId // Use slug from API
        })
      });

      const data = await response.json();

      // If API returns a game URL
      if (data.gameUrl || data.url || data.launchUrl) {
        return {
          success: true,
          gameUrl: data.gameUrl || data.url || data.launchUrl,
          ...data
        };
      }

      // If API returns success with different structure
      if (data.success && data.data?.gameUrl) {
        return {
          success: true,
          gameUrl: data.data.gameUrl,
          ...data.data
        };
      }

      // If API returns error
      if (data.error || data.message) {
        let errorMsg = data.error || data.message || 'Failed to launch game';
        // Check if error is HTML (Cloudflare block page) - show clean message
        if (typeof errorMsg === 'string' && (errorMsg.includes('<!DOCTYPE') || errorMsg.includes('<html'))) {
          errorMsg = 'Game server temporarily unavailable. Please try again.';
        }
        return {
          success: false,
          error: errorMsg,
          shouldRetry: true // Mark as retryable
        };
      }

      // Return raw response for debugging
      return {
        success: false,
        error: 'Unexpected response from game server',
        rawResponse: data,
        shouldRetry: true
      };
    };

    // Attempt with retries
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await makeRequest();

        // If successful, return immediately
        if (result.success) {
          return result;
        }

        // If not retryable or last attempt, return the error
        if (!result.shouldRetry || attempt === MAX_RETRIES) {
          return { success: false, error: result.error };
        }

        // Store error and retry after delay
        lastError = result.error;
        await delay(RETRY_DELAY * attempt); // Exponential backoff

      } catch (error) {
        console.error(`Game launch API error (attempt ${attempt}/${MAX_RETRIES}):`, error);
        lastError = 'Failed to connect to game server.';

        // If last attempt, return error
        if (attempt === MAX_RETRIES) {
          return {
            success: false,
            error: 'Failed to connect to game server. Please try again.'
          };
        }

        // Wait before retry
        await delay(RETRY_DELAY * attempt);
      }
    }

    // Should not reach here, but just in case
    return {
      success: false,
      error: lastError || 'Failed to launch game. Please try again.'
    };
  }
};

// Export constants and helpers
export { CATEGORIES, localGames as games };

export default gameService;
