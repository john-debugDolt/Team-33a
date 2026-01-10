import { apiClient } from './api';
import { CDN_BASE, games as localGames, getGamesByCategory, getHotGames as getLocalHotGames, getNewGames as getLocalNewGames, getGameById as getLocalGameById, getGameBySlug, searchGames as localSearchGames, CATEGORIES } from '../data/gameData';

// CDN Image URL Generators
export const getPortraitUrl = (slug) => {
  return `${CDN_BASE}/${slug}-portrait.jpg`;
};

export const getSquareUrl = (slug) => {
  return `${CDN_BASE}/${slug}-square.jpg`;
};

// Enhance a game object with image URLs and default values
export const enhanceGameWithImages = (game) => {
  if (!game) return null;
  return {
    ...game,
    portraitImage: getPortraitUrl(game.slug),
    squareImage: getSquareUrl(game.slug),
    image: getPortraitUrl(game.slug), // Default image
    // Default values for modal display
    rating: game.rating || 4.5,
    playCount: game.playCount || Math.floor(Math.random() * 50000) + 10000,
    description: game.description || `Experience the thrill of ${game.name}! This exciting ${game.category} game from ${game.provider} offers amazing gameplay and big win potential.`,
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
  async getGames({ page = 1, limit = 36, provider = 'ALL', search = '', gameType = 'slot', isHot, isNew, useLocal = true } = {}) {
    // Use local game data
    if (useLocal) {
      let filteredGames = [...localGames];

      // Filter by provider
      if (provider && provider !== 'ALL') {
        filteredGames = filteredGames.filter(g => g.provider === provider);
      }

      // Filter by search
      if (search && search.trim()) {
        const query = search.toLowerCase();
        filteredGames = filteredGames.filter(g =>
          g.name.toLowerCase().includes(query) ||
          g.slug.toLowerCase().includes(query)
        );
      }

      // Filter by game type / category
      if (gameType && gameType !== 'all') {
        const categoryMap = {
          'slot': CATEGORIES.SLOTS,
          'slots': CATEGORIES.SLOTS,
          'crash': CATEGORIES.CRASH,
          'instant-win': CATEGORIES.INSTANT_WIN,
          'card-game': CATEGORIES.CARD_GAME,
          'fishing': CATEGORIES.FISHING,
          'live-casino': CATEGORIES.LIVE_CASINO,
        };
        const category = categoryMap[gameType] || gameType;
        filteredGames = filteredGames.filter(g => g.category === category);
      }

      // Filter by hot
      if (isHot === 'true' || isHot === true) {
        filteredGames = filteredGames.filter(g => g.isHot);
      }

      // Filter by new
      if (isNew === 'true' || isNew === true) {
        filteredGames = filteredGames.filter(g => g.isNew);
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
    }

    // Use API
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', limit);

    if (provider && provider !== 'ALL') {
      params.append('provider', provider);
    }

    if (search && search.trim()) {
      params.append('search', search.trim());
    }

    if (gameType && gameType !== 'all') {
      params.append('gameType', gameType);
    }

    if (isHot === 'true' || isHot === true) {
      params.append('isHot', 'true');
    }

    if (isNew === 'true' || isNew === true) {
      params.append('isNew', 'true');
    }

    const response = await apiClient.get(`/games?${params.toString()}`);

    // Normalize response format and add images
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          games: response.data.games.map(enhanceGameWithImages),
          pagination: response.data.pagination,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 1
        }
      };
    }

    return response;
  },

  async getGameById(id, useLocal = true) {
    if (useLocal) {
      const game = getLocalGameById(id);
      if (game) {
        return { success: true, data: enhanceGameWithImages(game) };
      }
      return { success: false, error: 'Game not found' };
    }
    const response = await apiClient.get(`/games/${id}`);
    if (response.success && response.data) {
      return { success: true, data: enhanceGameWithImages(response.data) };
    }
    return response;
  },

  async getFeaturedGames(limit = 6, useLocal = true) {
    if (useLocal) {
      const hotGames = getLocalHotGames().slice(0, limit);
      return { success: true, data: { games: hotGames.map(enhanceGameWithImages) } };
    }
    const response = await apiClient.get(`/games/featured?limit=${limit}`);
    if (response.success && response.data) {
      return {
        success: true,
        data: { games: response.data.games?.map(enhanceGameWithImages) || [] }
      };
    }
    return response;
  },

  async getHotGames(limit = 12, useLocal = true) {
    if (useLocal) {
      const hotGames = getLocalHotGames().slice(0, limit);
      return { success: true, data: { games: hotGames.map(enhanceGameWithImages) } };
    }
    const response = await apiClient.get(`/games/hot?limit=${limit}`);
    if (response.success && response.data) {
      return {
        success: true,
        data: { games: response.data.games?.map(enhanceGameWithImages) || [] }
      };
    }
    return response;
  },

  async getNewGames(limit = 12, useLocal = true) {
    if (useLocal) {
      const newGames = getLocalNewGames().slice(0, limit);
      return { success: true, data: { games: newGames.map(enhanceGameWithImages) } };
    }
    const response = await apiClient.get(`/games/new?limit=${limit}`);
    if (response.success && response.data) {
      return {
        success: true,
        data: { games: response.data.games?.map(enhanceGameWithImages) || [] }
      };
    }
    return response;
  },

  async getProviders(useLocal = true) {
    if (useLocal) {
      const providerNames = [...new Set(localGames.map(g => g.provider))];
      const providers = [
        { id: 'ALL', name: 'ALL' },
        ...providerNames.map(name => ({
          id: name,
          name: name,
          count: localGames.filter(g => g.provider === name).length
        }))
      ];
      return {
        success: true,
        data: { providers }
      };
    }
    return await apiClient.get('/games/providers');
  },

  async searchGames(query, limit = 20, useLocal = true) {
    if (!query || query.trim().length < 2) {
      return { success: true, data: { games: [] } };
    }

    if (useLocal) {
      const results = localSearchGames(query).slice(0, limit);
      return { success: true, data: { games: results.map(enhanceGameWithImages) } };
    }

    const response = await apiClient.get(`/games?search=${encodeURIComponent(query.trim())}&limit=${limit}`);
    if (response.success && response.data) {
      return {
        success: true,
        data: { games: response.data.games?.map(enhanceGameWithImages) || [] }
      };
    }
    return response;
  },

  /**
   * Request game launch URL from backend
   * Uses Team33 Game Launch API (HTTPS)
   */
  async requestGameUrl(gameId, userId) {
    const game = getLocalGameById(gameId);
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    const GAME_LAUNCH_API = 'https://api.team33.mx/api/games/launch';
    const ACCOUNT_ID = 'ACC284290827402874880';

    try {
      const response = await fetch(GAME_LAUNCH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: ACCOUNT_ID,
          gameId: game.gameId || game.slug
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
        return {
          success: false,
          error: data.error || data.message || 'Failed to launch game'
        };
      }

      // Return raw response for debugging
      console.log('Game launch API response:', data);
      return {
        success: false,
        error: 'Unexpected response from game server',
        rawResponse: data
      };

    } catch (error) {
      console.error('Game launch API error:', error);
      return {
        success: false,
        error: 'Failed to connect to game server. Please try again.'
      };
    }
  }
};

// Export constants and helpers
export { CDN_BASE, CATEGORIES, localGames as games };

export default gameService;
