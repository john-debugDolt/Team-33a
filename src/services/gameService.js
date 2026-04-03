import { apiClient } from './api';
import { games as localGames, getGamesByCategory, getHotGames as getLocalHotGames, getNewGames as getLocalNewGames, getGameById as getLocalGameById, getGameBySlug, searchGames as localSearchGames, CATEGORIES } from '../data/gameData';
import { getAllAdvantPlayGames, launchAdvantPlayGame } from './advantPlayService';
import { getAllUUSlotGames, launchUUSlotGame } from './uuSlotService';
import { getAllEvo888h5Games, launchEvo888h5Game } from './evo888h5Service';

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

// Cache for combined games (ClotPlay + AdvantPlay)
let cachedCombinedGames = null;
let combinedCacheTimestamp = null;

// ClotPlay API endpoint - use direct URL since Vercel can't proxy HTTP
const CLOTPLAY_API = 'https://accounts.team33.mx/api/games/clotplay';

// Helper function to fetch with timeout (Safari compatibility)
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

// Fetch games from ClotPlay API
export const fetchClotPlayGames = async (page = 1, perPage = 100) => {
  try {
    // Try proxy first (for local dev), then direct API (for production)
    const urls = [
      `/api/games/clotplay?page=${page}&perPage=${perPage}`,
      `${CLOTPLAY_API}?page=${page}&perPage=${perPage}`
    ];

    for (const url of urls) {
      try {
        console.log('[GameService] Trying to fetch games from:', url);
        const response = await fetchWithTimeout(url, 20000);
        if (!response.ok) {
          console.log('[GameService] Response not OK:', response.status);
          continue;
        }
        const data = await response.json();
        console.log('[GameService] API response code:', data.code, 'games count:', data.data?.length);
        if (data.code === 0 && data.data && data.data.length > 0) {
          return {
            success: true,
            games: data.data,
            pagination: data.pagination
          };
        }
        console.log('[GameService] Invalid response from', url, '- trying next');
      } catch (err) {
        console.log('[GameService] Error fetching from', url, ':', err.message);
      }
    }

    console.error('[GameService] All API endpoints failed');
    return { success: false, games: [], error: 'All API endpoints failed' };
  } catch (error) {
    console.error('[GameService] Failed to fetch ClotPlay games:', error);
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

  // Add provider field to ClotPlay games (API doesn't include it)
  allGames = allGames.map(game => ({
    ...game,
    provider: 'ClotPlay',
    isClotPlay: true
  }));

  // Cache the results
  cachedApiGames = allGames;
  cacheTimestamp = Date.now();

  return allGames;
};

// Track which providers failed so we can retry them
let failedProviders = { clotPlay: false, advantPlay: false, uuSlot: false, evo888h5: false };
let isRetrying = false;

// Listeners for game updates (so UI can refresh when more games load)
const gameUpdateListeners = [];
export const onGamesUpdated = (callback) => {
  gameUpdateListeners.push(callback);
  return () => {
    const index = gameUpdateListeners.indexOf(callback);
    if (index > -1) gameUpdateListeners.splice(index, 1);
  };
};
const notifyGamesUpdated = () => {
  gameUpdateListeners.forEach(cb => cb());
};

// Retry failed providers in background
const retryFailedProviders = async () => {
  if (isRetrying) return;

  const hasFailedProviders = Object.values(failedProviders).some(Boolean);
  if (!hasFailedProviders) return;

  isRetrying = true;
  console.log('[GameService] Retrying failed providers in background...');

  const retryPromises = [];

  if (failedProviders.clotPlay) {
    retryPromises.push(
      getAllApiGames().then(games => {
        if (games.length > 0) {
          failedProviders.clotPlay = false;
          return { provider: 'clotPlay', games };
        }
        return null;
      }).catch(() => null)
    );
  }

  if (failedProviders.advantPlay) {
    retryPromises.push(
      getAllAdvantPlayGames().then(games => {
        if (games.length > 0) {
          failedProviders.advantPlay = false;
          return { provider: 'advantPlay', games };
        }
        return null;
      }).catch(() => null)
    );
  }

  if (failedProviders.uuSlot) {
    retryPromises.push(
      getAllUUSlotGames().then(games => {
        if (games.length > 0) {
          failedProviders.uuSlot = false;
          return { provider: 'uuSlot', games };
        }
        return null;
      }).catch(() => null)
    );
  }

  if (failedProviders.evo888h5) {
    retryPromises.push(
      getAllEvo888h5Games().then(games => {
        if (games.length > 0) {
          failedProviders.evo888h5 = false;
          return { provider: 'evo888h5', games };
        }
        return null;
      }).catch(() => null)
    );
  }

  const results = await Promise.all(retryPromises);
  const successfulRetries = results.filter(Boolean);

  if (successfulRetries.length > 0) {
    // Add newly loaded games to cache
    successfulRetries.forEach(({ provider, games }) => {
      console.log(`[GameService] Retry success: ${provider} loaded ${games.length} games`);
      if (cachedCombinedGames) {
        cachedCombinedGames = [...cachedCombinedGames, ...games];
      }
    });

    // Notify UI to refresh
    notifyGamesUpdated();
    console.log('[GameService] Total games after retry:', cachedCombinedGames?.length);
  }

  isRetrying = false;

  // If still have failed providers, retry again after 3 seconds
  const stillHasFailedProviders = Object.values(failedProviders).some(Boolean);
  if (stillHasFailedProviders) {
    setTimeout(retryFailedProviders, 3000);
  }
};

// Get all games from all providers (ClotPlay + AdvantPlay + UUSlot + EVO888H5) with caching
export const getAllCombinedGames = async () => {
  // Return cached data if valid
  if (cachedCombinedGames && combinedCacheTimestamp &&
      (Date.now() - combinedCacheTimestamp < CACHE_DURATION)) {
    console.log('[GameService] Returning cached combined games:', cachedCombinedGames.length);
    return cachedCombinedGames;
  }

  // Fetch from all providers in parallel with error handling
  const results = await Promise.allSettled([
    getAllApiGames(),
    getAllAdvantPlayGames(),
    getAllUUSlotGames(),
    getAllEvo888h5Games()
  ]);

  // Extract games from successful requests and track failures
  const clotPlayGames = results[0].status === 'fulfilled' ? results[0].value : [];
  const advantPlayGames = results[1].status === 'fulfilled' ? results[1].value : [];
  const uuSlotGames = results[2].status === 'fulfilled' ? results[2].value : [];
  const evo888h5Games = results[3].status === 'fulfilled' ? results[3].value : [];

  // Track which providers failed
  failedProviders.clotPlay = clotPlayGames.length === 0;
  failedProviders.advantPlay = advantPlayGames.length === 0;
  failedProviders.uuSlot = uuSlotGames.length === 0;
  failedProviders.evo888h5 = evo888h5Games.length === 0;

  // Log results
  console.log('[GameService] ClotPlay:', clotPlayGames.length, failedProviders.clotPlay ? '(FAILED)' : '');
  console.log('[GameService] AdvantPlay:', advantPlayGames.length, failedProviders.advantPlay ? '(FAILED)' : '');
  console.log('[GameService] UUSlot:', uuSlotGames.length, failedProviders.uuSlot ? '(FAILED)' : '');
  console.log('[GameService] EVO888H5:', evo888h5Games.length, failedProviders.evo888h5 ? '(FAILED)' : '');

  // Combine games from all providers
  const combined = [...clotPlayGames, ...advantPlayGames, ...uuSlotGames, ...evo888h5Games];

  // Always cache whatever we have (so UI shows something)
  cachedCombinedGames = combined;
  combinedCacheTimestamp = Date.now();
  console.log('[GameService] Cached', combined.length, 'games');

  // If some providers failed, retry in background
  const hasFailedProviders = Object.values(failedProviders).some(Boolean);
  if (hasFailedProviders) {
    setTimeout(retryFailedProviders, 2000);
  }

  return combined;
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
  // If game has thumbnails from API (ClotPlay format)
  if (game.thumbnails) {
    const langThumbs = game.thumbnails[lang] || game.thumbnails['en'] || Object.values(game.thumbnails)[0];
    if (langThumbs?.portrait) {
      return langThumbs.portrait;
    }
  }
  // If game already has an image URL (AdvantPlay, UUSlot, EVO888H5)
  if (game.image && game.image.startsWith('http')) return game.image;
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
      // Fetch games from all providers (ClotPlay + AdvantPlay)
      const apiGames = await getAllCombinedGames();

      if (apiGames && apiGames.length > 0) {
        let filteredGames = [...apiGames];

        // Filter by provider
        if (provider && provider !== 'ALL') {
          console.log('[GameService] Filtering by provider:', provider);
          console.log('[GameService] Before filter:', filteredGames.length);
          console.log('[GameService] Sample providers:', filteredGames.slice(0, 5).map(g => g.provider));
          filteredGames = filteredGames.filter(g => {
            const gameProvider = (g.provider || '').toLowerCase();
            return gameProvider === provider.toLowerCase();
          });
          console.log('[GameService] After filter:', filteredGames.length);
        }

        // Filter by search
        if (search && search.trim()) {
          const query = search.toLowerCase();
          filteredGames = filteredGames.filter(g =>
            (g.name || '').toLowerCase().includes(query) ||
            (g.slug || '').toLowerCase().includes(query) ||
            (g.name_cn && g.name_cn.includes(query))
          );
        }

        // Filter by game type / category (skip if 'all' or 'slot' to show all games)
        if (gameType && gameType !== 'all' && gameType !== 'slot') {
          const categoryMap = {
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
      const allGames = await getAllCombinedGames();
      if (allGames && allGames.length > 0) {
        // Extract unique providers
        const providerSet = new Set();
        allGames.forEach(g => {
          if (g.provider) providerSet.add(g.provider);
        });

        const providers = [
          { id: 'ALL', name: 'All Providers', count: allGames.length },
          ...Array.from(providerSet).map(provider => ({
            id: provider,
            name: provider,
            count: allGames.filter(g => g.provider === provider).length
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
   * Supports both ClotPlay and AdvantPlay games
   */
  async requestGameUrl(gameId, userId) {
    // Try to find game in combined cache first, then local
    let game = null;
    const combinedGames = cachedCombinedGames || [];
    game = combinedGames.find(g => g.slug === gameId || g.id === gameId || g.gameId === gameId);

    // Also check individual caches
    if (!game) {
      const apiGames = cachedApiGames || [];
      game = apiGames.find(g => g.slug === gameId || g.id === gameId);
    }

    if (!game) {
      game = getLocalGameById(gameId);
    }

    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    // Get user's actual accountId from localStorage for all providers
    const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
    const accountId = user.accountId || userId;

    // Handle AdvantPlay games separately
    if (game.isAdvantPlay || game.provider === 'AdvantPlay') {
      console.log('[GameService] Launching AdvantPlay game:', game.gameId, 'accountId:', accountId);
      return await launchAdvantPlayGame(game.gameId, accountId);
    }

    // Handle UUSlot games separately
    if (game.isUUSlot || game.provider === 'UUSlot') {
      console.log('[GameService] Launching UUSlot game:', game.gameId, 'accountId:', accountId);
      return await launchUUSlotGame(game.gameId, accountId);
    }

    // Handle EVO888H5 games separately
    if (game.isEvo888h5 || game.provider === 'EVO888H5') {
      console.log('[GameService] Launching EVO888H5 game:', game.gameId, 'accountId:', accountId);
      try {
        const gameUrl = await launchEvo888h5Game(accountId, game.gameId);
        return { success: true, gameUrl };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    // Direct API call to games backend (ClotPlay)
    const GAME_LAUNCH_API = 'https://accounts.team33.mx/api/games/launch';

    // Fallback to demo account if no user logged in
    const ACCOUNT_ID = accountId || 'ACC284290827402874880';

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

      // If API returns a game URL - trim whitespace
      if (data.gameUrl || data.url || data.launchUrl) {
        return {
          success: true,
          gameUrl: (data.gameUrl || data.url || data.launchUrl)?.trim(),
          ...data
        };
      }

      // If API returns success with different structure - trim whitespace
      if (data.success && data.data?.gameUrl) {
        return {
          success: true,
          gameUrl: data.data.gameUrl?.trim(),
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
