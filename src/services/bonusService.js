/**
 * Bonus Service for Site Frontend
 * Fetches active bonuses/promotions to display to users
 */

import { apiClient } from './api';

// Bonus types for display
export const BONUS_TYPE_LABELS = {
  FIRST_DEPOSIT: 'First Deposit',
  RELOAD: 'Reload Bonus',
  REFERRAL: 'Referral Bonus',
  CASHBACK: 'Cashback',
  FREE_SPIN: 'Free Spins',
  LOYALTY: 'VIP Reward',
  PROMOTIONAL: 'Special Promo',
  PERCENTAGE: 'Match Bonus',
  FIXED: 'Fixed Bonus'
};

// Bonus type icons for UI
export const BONUS_TYPE_ICONS = {
  FIRST_DEPOSIT: '🎁',
  RELOAD: '🔄',
  REFERRAL: '👥',
  CASHBACK: '💰',
  FREE_SPIN: '🎰',
  LOYALTY: '👑',
  PROMOTIONAL: '🎉',
  PERCENTAGE: '📈',
  FIXED: '💵'
};

class BonusService {
  /**
   * Get all active bonuses
   * GET /api/bonuses/filter?isActive=true
   */
  async getActiveBonuses() {
    try {
      const response = await apiClient.get('/api/bonuses/filter?isActive=true');

      // Handle different response formats
      if (Array.isArray(response)) {
        // Filter out system bonuses that shouldn't be shown to users
        return response.filter(bonus =>
          bonus.bonusCode !== 'SYSTEM_DIRECT_CREDIT' &&
          bonus.isAvailable !== false
        );
      }

      if (response.success && Array.isArray(response.data)) {
        return response.data.filter(bonus =>
          bonus.bonusCode !== 'SYSTEM_DIRECT_CREDIT' &&
          bonus.isAvailable !== false
        );
      }

      return [];
    } catch (error) {
      console.error('[BonusService] Error fetching bonuses:', error);
      return [];
    }
  }

  /**
   * Get bonus by code
   * GET /api/bonuses/code/{bonusCode}
   */
  async getBonusByCode(bonusCode) {
    try {
      const response = await apiClient.get(`/api/bonuses/code/${bonusCode}`);

      if (response && !response.error) {
        return response;
      }

      if (response.success && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('[BonusService] Error fetching bonus by code:', error);
      return null;
    }
  }

  /**
   * Format bonus for display in promo cards
   */
  formatBonusForDisplay(bonus) {
    const isPercentage = bonus.bonusType === 'PERCENTAGE';

    return {
      id: bonus.id,
      code: bonus.bonusCode,
      title: bonus.displayName,
      description: bonus.description || '',
      type: bonus.bonusType,
      typeLabel: BONUS_TYPE_LABELS[bonus.bonusType] || bonus.bonusType,
      icon: BONUS_TYPE_ICONS[bonus.bonusType] || '🎁',

      // Value display
      value: bonus.bonusValue,
      valueDisplay: isPercentage
        ? `${bonus.bonusValue}%`
        : `$${bonus.bonusValue?.toFixed(0) || '0'}`,

      // Max bonus
      maxBonus: bonus.maxBonusAmount,
      maxBonusDisplay: bonus.maxBonusAmount
        ? `Up to $${bonus.maxBonusAmount}`
        : 'Unlimited',

      // Requirements
      minDeposit: bonus.minDeposit || 0,
      minDepositDisplay: bonus.minDeposit > 0
        ? `Min. deposit: $${bonus.minDeposit}`
        : 'No minimum',

      turnover: bonus.turnoverMultiplier || 0,
      turnoverDisplay: bonus.turnoverMultiplier > 0
        ? `${bonus.turnoverMultiplier}x turnover`
        : 'No wagering',

      // Availability
      remainingClaims: bonus.remainingClaims,
      isLimited: bonus.maxClaims !== null,
      availabilityDisplay: bonus.maxClaims
        ? `${bonus.remainingClaims || 0} left`
        : 'Unlimited',

      // Code requirement
      requiresCode: bonus.requiresCode || false,

      // Styling hints based on bonus value
      highlight: isPercentage && bonus.bonusValue >= 100,
      gradient: this.getGradientForBonus(bonus)
    };
  }

  /**
   * Get gradient colors based on bonus type/value
   */
  getGradientForBonus(bonus) {
    const type = bonus.bonusType;
    const value = bonus.bonusValue || 0;

    if (type === 'FIRST_DEPOSIT') {
      return 'linear-gradient(135deg, #6366f1, #8b5cf6)';
    }
    if (type === 'PERCENTAGE' && value >= 100) {
      return 'linear-gradient(135deg, #f59e0b, #ef4444)';
    }
    if (type === 'CASHBACK') {
      return 'linear-gradient(135deg, #10b981, #059669)';
    }
    if (type === 'LOYALTY' || type === 'FREE_SPIN') {
      return 'linear-gradient(135deg, #f59e0b, #d97706)';
    }
    if (type === 'REFERRAL') {
      return 'linear-gradient(135deg, #3b82f6, #2563eb)';
    }

    // Default gradient
    return 'linear-gradient(135deg, #6366f1, #8b5cf6)';
  }

  /**
   * Get headline text for bonus card
   */
  getBonusHeadline(bonus) {
    const formatted = this.formatBonusForDisplay(bonus);

    if (bonus.bonusType === 'PERCENTAGE') {
      if (bonus.maxBonusAmount) {
        return `${formatted.valueDisplay} MATCH UP TO $${bonus.maxBonusAmount}`;
      }
      return `${formatted.valueDisplay} MATCH BONUS`;
    }

    if (bonus.bonusType === 'FIXED') {
      return `GET $${bonus.bonusValue} FREE`;
    }

    if (bonus.bonusType === 'CASHBACK') {
      return `${formatted.valueDisplay} CASHBACK`;
    }

    return formatted.title.toUpperCase();
  }

  /**
   * Check if bonus is available to claim
   */
  isBonusAvailable(bonus) {
    if (!bonus.isActive) return false;
    if (bonus.isAvailable === false) return false;
    if (bonus.remainingClaims !== null && bonus.remainingClaims <= 0) return false;
    if (bonus.endDate && new Date(bonus.endDate) < new Date()) return false;
    return true;
  }
}

export const bonusService = new BonusService();
export default bonusService;
