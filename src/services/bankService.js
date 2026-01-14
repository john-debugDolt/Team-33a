// Bank Service - Fetch bank details for deposits

export const bankService = {
  // Get all available banks for deposits
  async getAvailableBanks() {
    try {
      const response = await fetch('/api/banks', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch banks:', response.status);
        return { success: false, error: 'Failed to fetch bank details' };
      }

      const data = await response.json();

      // Filter to only active banks and sort by lowest transaction amount
      const activeBanks = Array.isArray(data)
        ? data.filter(bank => bank.status === 'ACTIVE')
        : [];

      return {
        success: true,
        banks: activeBanks,
        // Return the first bank as the recommended one (lowest transaction amount)
        recommendedBank: activeBanks[0] || null,
      };
    } catch (error) {
      console.error('Bank service error:', error);
      return {
        success: false,
        error: 'Unable to fetch bank details. Please try again.',
      };
    }
  },

  // Get a specific bank by ID
  async getBankById(bankId) {
    try {
      const response = await fetch(`/api/banks/${bankId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { success: false, error: 'Bank not found' };
      }

      const data = await response.json();
      return { success: true, bank: data };
    } catch (error) {
      console.error('Get bank error:', error);
      return { success: false, error: 'Failed to fetch bank details' };
    }
  },

  // Format BSB for display (add dash if needed)
  formatBSB(bsb) {
    if (!bsb) return '';
    // If already has dash, return as is
    if (bsb.includes('-')) return bsb;
    // Add dash after first 3 digits
    if (bsb.length === 6) {
      return `${bsb.slice(0, 3)}-${bsb.slice(3)}`;
    }
    return bsb;
  },

  // Copy text to clipboard
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Copy failed:', error);
      return false;
    }
  },
};

export default bankService;
