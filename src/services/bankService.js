// Bank Service - Fetch bank details for deposits with rotation logic

const ROTATION_THRESHOLD = 3; // Switch bank after 3 deposits
const ROTATION_KEY = 'team33_bank_rotation';

export const bankService = {
  // Get rotation data from localStorage
  getRotationData() {
    try {
      const data = localStorage.getItem(ROTATION_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Reset if data is older than 24 hours
        if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
          return { counts: {}, timestamp: Date.now() };
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse rotation data:', e);
    }
    return { counts: {}, timestamp: Date.now() };
  },

  // Save rotation data to localStorage
  saveRotationData(data) {
    try {
      localStorage.setItem(ROTATION_KEY, JSON.stringify({
        ...data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Failed to save rotation data:', e);
    }
  },

  // Increment bank usage count
  incrementBankUsage(bankId) {
    const data = this.getRotationData();
    data.counts[bankId] = (data.counts[bankId] || 0) + 1;
    this.saveRotationData(data);
  },

  // Get all available banks for deposits with smart rotation
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

      // Filter to only active banks
      const activeBanks = Array.isArray(data)
        ? data.filter(bank => bank.status === 'ACTIVE')
        : [];

      if (activeBanks.length === 0) {
        return {
          success: true,
          banks: [],
          recommendedBank: null,
        };
      }

      // Get rotation data
      const rotationData = this.getRotationData();

      // Sort banks by:
      // 1. First, by local usage count (fewer uses = higher priority)
      // 2. Then by totalTransactedAmount (lower = higher priority)
      const sortedBanks = activeBanks.sort((a, b) => {
        const countA = rotationData.counts[a.id] || 0;
        const countB = rotationData.counts[b.id] || 0;

        // If one bank has reached threshold and other hasn't, prefer the other
        if (countA >= ROTATION_THRESHOLD && countB < ROTATION_THRESHOLD) return 1;
        if (countB >= ROTATION_THRESHOLD && countA < ROTATION_THRESHOLD) return -1;

        // If both under or over threshold, sort by total transacted amount
        const amountA = a.totalTransactedAmount || 0;
        const amountB = b.totalTransactedAmount || 0;
        return amountA - amountB;
      });

      // Select the recommended bank (first in sorted list)
      const recommendedBank = sortedBanks[0];

      console.log('[BankService] Bank rotation:', {
        rotationCounts: rotationData.counts,
        selectedBank: recommendedBank?.bankName,
        selectedBankCount: rotationData.counts[recommendedBank?.id] || 0,
        threshold: ROTATION_THRESHOLD
      });

      return {
        success: true,
        banks: sortedBanks,
        recommendedBank: recommendedBank || null,
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
