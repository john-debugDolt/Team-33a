import { apiClient } from './api';

// Categories matching the admin panel
export const promotionCategories = [
  { id: 'ALL', name: 'ALL', icon: '🎁' },
  { id: 'SLOTS', name: 'SLOTS', icon: '🎰' },
  { id: 'CASINO', name: 'CASINO', icon: '🎲' },
  { id: 'SPORT', name: 'SPORT', icon: '⚽' },
  { id: 'VIP', name: 'VIP', icon: '👑' },
  { id: 'UNLIMITED', name: 'UNLIMITED', icon: '♾️' },
];

export const promotionService = {
  async getPromotions({ category = 'ALL' } = {}) {
    const params = new URLSearchParams();

    if (category && category !== 'ALL') {
      params.append('category', category);
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/promotions?${queryString}` : '/promotions';

    return await apiClient.get(endpoint);
  },

  async getPromotionById(id) {
    return await apiClient.get(`/promotions/${id}`);
  },

  getCategories() {
    return promotionCategories;
  },

  async claimPromotion(promoId) {
    return await apiClient.post(`/promotions/${promoId}/claim`, {});
  }
};

export default promotionService;
