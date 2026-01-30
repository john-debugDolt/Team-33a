/**
 * Bank Service - Get available banks for deposits
 * Public API - No authentication required
 *
 * Endpoints:
 * - GET /api/banks - Get all active banks
 * - GET /api/banks/{bankId} - Get specific bank
 */

class BankService {
  /**
   * Get available (active) banks
   * GET /api/banks
   */
  async getAvailableBanks() {
    try {
      const response = await fetch('/api/banks');
      const data = await response.json();

      if (response.ok) {
        const banks = Array.isArray(data) ? data : [];
        const activeBanks = banks.filter(b => b.status === 'ACTIVE');

        return {
          success: true,
          banks: activeBanks,
          recommendedBank: activeBanks[0] || null,
        };
      }

      return { success: false, error: 'Failed to fetch banks', banks: [] };
    } catch (error) {
      console.error('[BankService] Get banks error:', error);
      return { success: false, error: 'Failed to fetch banks', banks: [] };
    }
  }

  /**
   * Get bank by ID
   * GET /api/banks/{bankId}
   */
  async getBankById(bankId) {
    try {
      const response = await fetch(`/api/banks/${bankId}`);
      const data = await response.json();

      if (response.ok) {
        return { success: true, bank: data };
      }

      return { success: false, error: 'Bank not found' };
    } catch (error) {
      console.error('[BankService] Get bank error:', error);
      return { success: false, error: 'Failed to fetch bank' };
    }
  }

  /**
   * Format BSB for display (add dash)
   */
  formatBSB(bsb) {
    if (!bsb) return '';
    if (bsb.includes('-')) return bsb;
    if (bsb.length === 6) {
      return `${bsb.slice(0, 3)}-${bsb.slice(3)}`;
    }
    return bsb;
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('[BankService] Copy failed:', error);
      return false;
    }
  }
}

export const bankService = new BankService();
export default bankService;
