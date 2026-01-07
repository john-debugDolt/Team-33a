import { apiClient } from './api';

export const gameService = {
  async getGames({ page = 1, limit = 36, provider = 'ALL', search = '', gameType = 'slot', isHot, isNew } = {}) {
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

    // Normalize response format
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          games: response.data.games,
          pagination: response.data.pagination,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 1
        }
      };
    }

    return response;
  },

  async getGameById(id) {
    return await apiClient.get(`/games/${id}`);
  },

  async getFeaturedGames(limit = 6) {
    return await apiClient.get(`/games/featured?limit=${limit}`);
  },

  async getHotGames(limit = 12) {
    return await apiClient.get(`/games/hot?limit=${limit}`);
  },

  async getNewGames(limit = 12) {
    return await apiClient.get(`/games/new?limit=${limit}`);
  },

  async getProviders() {
    return await apiClient.get('/games/providers');
  },

  async searchGames(query, limit = 20) {
    if (!query || query.trim().length < 2) {
      return { success: true, data: { games: [] } };
    }

    return await apiClient.get(`/games?search=${encodeURIComponent(query.trim())}&limit=${limit}`);
  }
};

export default gameService;
