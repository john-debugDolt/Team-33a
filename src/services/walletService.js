/**
 * Wallet Service - Balance, Deposits, Withdrawals
 * Public APIs - No authentication required
 *
 * Balance: GET /api/accounts/{accountId}/balance (needs JWT - use accountService)
 * Deposits: /api/deposits/...
 * Withdrawals: /api/withdrawals/...
 */

import { accountService } from './accountService';

// API base - call accounts.team33.mx directly
const API_BASE = 'https://accounts.team33.mx';

class WalletService {
  /**
   * Get wallet balance
   * Uses accountService which has JWT auth
   */
  async getBalance(accountId) {
    return accountService.getBalance(accountId);
  }

  /**
   * Initiate a deposit
   * POST /api/deposits/initiate
   * @param {string} accountId - Account ID
   * @param {number} amount - Deposit amount
   * @param {string|null} bonusCode - Optional promo/bonus code
   */
  async initiateDeposit(accountId, amount, bonusCode = null) {
    try {
      const body = {
        accountId,
        amount: Number(amount),
      };

      // Add bonus code if provided
      if (bonusCode) {
        body.bonusCode = bonusCode;
      }

      const response = await fetch(`${API_BASE}/api/deposits/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.status === 201 || response.ok) {
        // Handle assignedBank object from API response
        const bank = data.assignedBank || {};
        return {
          success: true,
          depositId: data.depositId,
          amount: data.amount,
          status: data.status,
          message: data.message,
          // Bank details from assignedBank object
          bankId: bank.bankId || data.bankId,
          bankName: bank.bankName || data.bankName,
          accountName: bank.accountName || data.accountName,
          bsb: bank.bsb || data.bsb,
          accountNumber: bank.accountNumber || data.accountNumber,
          payId: bank.payId || data.payId,
        };
      }

      return {
        success: false,
        error: data.message || 'Failed to initiate deposit',
      };
    } catch (error) {
      console.error('[WalletService] Deposit initiate error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Verify a deposit (submit for review)
   * POST /api/deposits/verify
   */
  async verifyDeposit(depositId) {
    try {
      const response = await fetch(`${API_BASE}/api/deposits/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          depositId: data.depositId,
          status: data.status,
          message: data.message,
        };
      }

      return {
        success: false,
        error: data.message || 'Failed to verify deposit',
      };
    } catch (error) {
      console.error('[WalletService] Deposit verify error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Get deposit by ID
   * GET /api/deposits/{depositId}
   */
  async getDeposit(depositId) {
    try {
      const response = await fetch(`${API_BASE}/api/deposits/${depositId}`);
      const data = await response.json();

      if (response.ok) {
        return { success: true, deposit: data };
      }

      return { success: false, error: 'Deposit not found' };
    } catch (error) {
      console.error('[WalletService] Get deposit error:', error);
      return { success: false, error: 'Failed to fetch deposit' };
    }
  }

  /**
   * Get deposits by account
   * GET /api/deposits/account/{accountId}
   */
  async getDeposits(accountId) {
    try {
      const response = await fetch(`${API_BASE}/api/deposits/account/${accountId}`);
      const data = await response.json();

      if (response.ok) {
        const deposits = Array.isArray(data) ? data : (data.content || []);
        return { success: true, deposits };
      }

      return { success: false, error: 'Failed to fetch deposits', deposits: [] };
    } catch (error) {
      console.error('[WalletService] Get deposits error:', error);
      return { success: false, error: 'Failed to fetch deposits', deposits: [] };
    }
  }

  /**
   * Request a withdrawal
   * POST /api/withdrawals/request
   *
   * Submits a withdrawal request for admin approval.
   * Checks turnover requirements before allowing withdrawal.
   *
   * @param {Object} params - Withdrawal parameters
   * @param {string} params.accountId - Account ID
   * @param {number} params.amount - Withdrawal amount
   * @param {string} params.method - Payment method: BANK_TRANSFER, PAYPAL, CRYPTO
   * @param {Object} params.bankDetails - Bank details for BANK_TRANSFER
   * @param {string} params.paypalEmail - PayPal email for PAYPAL
   * @param {Object} params.cryptoDetails - Crypto details for CRYPTO
   */
  async requestWithdrawal({ accountId, amount, method = 'BANK_TRANSFER', bankDetails, paypalEmail, cryptoDetails }) {
    try {
      const body = {
        accountId,
        amount: Number(amount),
        currency: 'AUD',
        method,
      };

      // Add payment method specific details
      if (method === 'BANK_TRANSFER' && bankDetails) {
        body.bankDetails = {
          accountName: bankDetails.accountHolderName || bankDetails.accountName,
          accountNumber: bankDetails.accountNumber,
          bsb: bankDetails.bsb?.replace(/-/g, ''),
          bankName: bankDetails.bankName || 'Bank Transfer',
        };
        // Support PayID as alternative
        if (bankDetails.payId) {
          body.bankDetails.payId = bankDetails.payId;
        }
      } else if (method === 'PAYPAL' && paypalEmail) {
        body.paypalEmail = paypalEmail;
      } else if (method === 'CRYPTO' && cryptoDetails) {
        body.cryptoDetails = cryptoDetails;
      }

      const response = await fetch(`${API_BASE}/api/withdrawals/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.status === 201 || response.ok) {
        return {
          success: true,
          withdrawalId: data.withdrawalId || data.withdrawId,
          amount: data.amount,
          status: data.status,
          method: data.method,
          estimatedProcessingTime: data.estimatedProcessingTime,
          message: data.message || 'Withdrawal request submitted successfully',
        };
      }

      // Handle specific error codes
      const errorCode = data.error || data.errorCode;
      let errorMessage = data.message || 'Failed to submit withdrawal';

      switch (errorCode) {
        case 'TURNOVER_NOT_MET':
          errorMessage = `You must wager $${data.turnoverRemaining?.toFixed(2) || '0.00'} more before withdrawing`;
          break;
        case 'INSUFFICIENT_BALANCE':
          errorMessage = 'Insufficient withdrawable balance';
          break;
        case 'BELOW_MINIMUM':
          errorMessage = `Minimum withdrawal is $${data.minimumWithdrawal?.toFixed(2) || '20.00'}`;
          break;
        case 'ABOVE_MAXIMUM':
          errorMessage = `Maximum withdrawal is $${data.maximumWithdrawal?.toFixed(2) || '10,000.00'}`;
          break;
        case 'INVALID_BANK_DETAILS':
          errorMessage = 'Invalid bank details provided';
          break;
        case 'TOO_MANY_REQUESTS':
          errorMessage = 'Only 3 withdrawal requests per day allowed';
          break;
      }

      return {
        success: false,
        error: errorMessage,
        errorCode,
        turnoverRemaining: data.turnoverRemaining,
        minimumWithdrawal: data.minimumWithdrawal,
      };
    } catch (error) {
      console.error('[WalletService] Withdrawal request error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Cancel a pending withdrawal
   * POST /api/withdrawals/{withdrawalId}/cancel
   *
   * @param {string} withdrawalId - Withdrawal ID to cancel
   * @param {string} accountId - Account ID (for verification)
   * @param {string} reason - Reason for cancellation
   */
  async cancelWithdrawal(withdrawalId, accountId, reason = '') {
    try {
      const response = await fetch(`${API_BASE}/api/withdrawals/${withdrawalId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          reason: reason || 'Cancelled by user',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          withdrawalId: data.withdrawalId,
          status: data.status,
          refundedAmount: data.refundedAmount,
          message: data.message || 'Withdrawal cancelled. Funds returned to your balance.',
        };
      }

      return {
        success: false,
        error: data.message || 'Failed to cancel withdrawal',
      };
    } catch (error) {
      console.error('[WalletService] Cancel withdrawal error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Get withdrawal history for an account with pagination
   * GET /api/withdrawals/history/{accountId}
   *
   * @param {string} accountId - Account ID
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.limit - Items per page (default: 20)
   * @param {string} params.status - Filter by status: PENDING, APPROVED, REJECTED, COMPLETED
   */
  async getWithdrawalHistory(accountId, params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 20,
        ...(params.status && { status: params.status }),
      }).toString();

      const response = await fetch(
        `${API_BASE}/api/withdrawals/history/${accountId}?${queryParams}`
      );
      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          withdrawals: data.withdrawals || [],
          pagination: data.pagination || {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
          },
        };
      }

      return {
        success: false,
        error: 'Failed to fetch withdrawal history',
        withdrawals: [],
      };
    } catch (error) {
      console.error('[WalletService] Get withdrawal history error:', error);
      return {
        success: false,
        error: 'Network error',
        withdrawals: [],
      };
    }
  }

  /**
   * Get detailed balance information
   * GET /api/wallets/{accountId}/balance
   *
   * @param {string} accountId - Account ID
   * @returns {Object} Balance details including:
   *   - cashBalance: Real money (deposits + winnings)
   *   - bonusBalance: Bonus funds (subject to turnover)
   *   - totalBalance: Total balance
   *   - withdrawableBalance: Amount user can actually withdraw
   */
  async getDetailedBalance(accountId) {
    try {
      const response = await fetch(`${API_BASE}/api/wallets/${accountId}/balance`);
      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          accountId: data.accountId,
          cashBalance: data.cashBalance || 0,
          bonusBalance: data.bonusBalance || 0,
          totalBalance: data.totalBalance || data.balance || 0,
          withdrawableBalance: data.withdrawableBalance || data.cashBalance || 0,
          currency: data.currency || 'AUD',
        };
      }

      return {
        success: false,
        error: 'Failed to fetch balance details',
        cashBalance: 0,
        bonusBalance: 0,
        totalBalance: 0,
        withdrawableBalance: 0,
      };
    } catch (error) {
      console.error('[WalletService] Get detailed balance error:', error);
      return {
        success: false,
        error: 'Network error',
        cashBalance: 0,
        bonusBalance: 0,
        totalBalance: 0,
        withdrawableBalance: 0,
      };
    }
  }

  /**
   * Get withdrawal by ID
   * GET /api/withdrawals/{withdrawId}
   */
  async getWithdrawal(withdrawId) {
    try {
      const response = await fetch(`${API_BASE}/api/withdrawals/${withdrawId}`);
      const data = await response.json();

      if (response.ok) {
        return { success: true, withdrawal: data };
      }

      return { success: false, error: 'Withdrawal not found' };
    } catch (error) {
      console.error('[WalletService] Get withdrawal error:', error);
      return { success: false, error: 'Failed to fetch withdrawal' };
    }
  }

  /**
   * Get withdrawals by account
   * GET /api/withdrawals/account/{accountId}
   */
  async getWithdrawals(accountId) {
    try {
      const response = await fetch(`${API_BASE}/api/withdrawals/account/${accountId}`);
      const data = await response.json();

      if (response.ok) {
        const withdrawals = Array.isArray(data) ? data : (data.content || []);
        return { success: true, withdrawals };
      }

      return { success: false, error: 'Failed to fetch withdrawals', withdrawals: [] };
    } catch (error) {
      console.error('[WalletService] Get withdrawals error:', error);
      return { success: false, error: 'Failed to fetch withdrawals', withdrawals: [] };
    }
  }

  /**
   * Get pending withdrawals
   * GET /api/withdrawals/account/{accountId}/pending
   */
  async getPendingWithdrawals(accountId) {
    try {
      const response = await fetch(`${API_BASE}/api/withdrawals/account/${accountId}/pending`);
      const data = await response.json();

      if (response.ok) {
        const withdrawals = Array.isArray(data) ? data : (data.content || []);
        return { success: true, withdrawals };
      }

      return { success: false, error: 'Failed to fetch pending withdrawals', withdrawals: [] };
    } catch (error) {
      console.error('[WalletService] Get pending withdrawals error:', error);
      return { success: false, error: 'Failed to fetch withdrawals', withdrawals: [] };
    }
  }

  /**
   * Get all transactions (deposits + withdrawals + bonus claims)
   */
  async getTransactions(accountId) {
    try {
      // Import bonusService dynamically to avoid circular dependency
      const { default: bonusService } = await import('./bonusService');

      const [depositsResult, withdrawalsResult, bonusClaimsResult] = await Promise.all([
        this.getDeposits(accountId),
        this.getWithdrawals(accountId),
        bonusService.getUserClaims(accountId),
      ]);

      const deposits = (depositsResult.deposits || []).map(d => ({
        id: d.depositId,
        type: 'deposit',
        amount: d.amount,
        status: d.status?.toLowerCase(),
        createdAt: d.createdAt,
        description: 'Deposit',
      }));

      const withdrawals = (withdrawalsResult.withdrawals || []).map(w => ({
        id: w.withdrawId,
        type: 'withdrawal',
        amount: w.amount,
        status: w.status?.toLowerCase(),
        createdAt: w.createdAt,
        description: 'Withdrawal',
      }));

      // Map bonus claims to transaction format
      const bonuses = (bonusClaimsResult || []).map(b => ({
        id: b.claimId || b.id,
        type: 'bonus',
        amount: b.bonusAmount || b.amount || 0,
        status: this.mapBonusStatus(b.status),
        createdAt: b.claimedAt || b.createdAt,
        description: b.bonusName || b.displayName || 'Bonus',
        bonusCode: b.bonusCode,
        turnoverRequired: b.turnoverRequired,
        turnoverCompleted: b.turnoverCompleted,
      }));

      const transactions = [...deposits, ...withdrawals, ...bonuses]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return { success: true, transactions };
    } catch (error) {
      console.error('[WalletService] Get transactions error:', error);
      return { success: false, error: 'Failed to fetch transactions', transactions: [] };
    }
  }

  /**
   * Map bonus claim status to display status
   */
  mapBonusStatus(status) {
    const statusMap = {
      'CLAIMED': 'completed',
      'CREDITED': 'completed',
      'ACTIVE': 'pending',
      'COMPLETING': 'pending',
      'COMPLETED': 'completed',
      'PENDING': 'pending',
      'EXPIRED': 'failed',
      'FORFEITED': 'failed',
      'CANCELLED': 'failed',
    };
    return statusMap[status] || status?.toLowerCase() || 'pending';
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount, currency = 'AUD') {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
    }).format(amount || 0);
  }

  /**
   * Get commission earnings for an account
   * GET /api/accounts/{accountId}/commissions
   *
   * @param {string} accountId - Account ID
   * @param {Object} params - Optional filters (status: PENDING|CREDITED, type: DEPOSIT|PLAY)
   */
  async getCommissionEarnings(accountId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = `${API_BASE}/api/accounts/${accountId}/commissions${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        const earnings = Array.isArray(data) ? data : (data.content || data.earnings || []);
        return { success: true, earnings };
      }

      return { success: false, error: 'Failed to fetch commission earnings', earnings: [] };
    } catch (error) {
      console.error('[WalletService] Get commission earnings error:', error);
      return { success: false, error: 'Failed to fetch commission earnings', earnings: [] };
    }
  }

  /**
   * Get pending commission total for an account
   * GET /api/accounts/{accountId}/commissions/pending-total
   *
   * @param {string} accountId - Account ID
   */
  async getPendingCommissionTotal(accountId) {
    try {
      const response = await fetch(`${API_BASE}/api/accounts/${accountId}/commissions/pending-total`);
      const data = await response.json();

      if (response.ok) {
        const pendingTotal = typeof data === 'number' ? data : (data.pendingTotal ?? data.total ?? 0);
        return { success: true, pendingTotal };
      }

      return { success: false, error: 'Failed to fetch pending total', pendingTotal: 0 };
    } catch (error) {
      console.error('[WalletService] Get pending commission total error:', error);
      return { success: false, error: 'Failed to fetch pending total', pendingTotal: 0 };
    }
  }

  /**
   * Get turnover status for an account
   * GET /api/wallets/{accountId}/turnover
   *
   * Returns current turnover (wagering) requirements for an account.
   * Turnover must be fulfilled before user can withdraw bonus funds.
   *
   * @param {string} accountId - Account ID
   * @returns {Object} Turnover status including:
   *   - totalTurnoverRequired: Sum of all turnover requirements
   *   - turnoverCompleted: Total amount wagered toward turnover
   *   - turnoverRemaining: Amount still needed to wager
   *   - canWithdraw: true if no pending turnover
   *   - requirements: Array of individual turnover records
   */
  async getTurnoverStatus(accountId) {
    try {
      const response = await fetch(`${API_BASE}/api/wallets/${accountId}/turnover`);
      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          accountId: data.accountId,
          totalTurnoverRequired: data.totalTurnoverRequired || 0,
          turnoverCompleted: data.turnoverCompleted || 0,
          turnoverRemaining: data.turnoverRemaining || 0,
          canWithdraw: data.canWithdraw ?? true,
          requirements: data.requirements || [],
        };
      }

      return {
        success: false,
        error: data.message || 'Failed to fetch turnover status',
        totalTurnoverRequired: 0,
        turnoverCompleted: 0,
        turnoverRemaining: 0,
        canWithdraw: true,
        requirements: [],
      };
    } catch (error) {
      console.error('[WalletService] Get turnover status error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
        totalTurnoverRequired: 0,
        turnoverCompleted: 0,
        turnoverRemaining: 0,
        canWithdraw: true,
        requirements: [],
      };
    }
  }

  /**
   * Check withdrawal eligibility for an account
   * GET /api/wallets/{accountId}/can-withdraw
   *
   * Quick check if user can withdraw funds.
   * Returns minimum withdrawal amount and turnover status.
   *
   * @param {string} accountId - Account ID
   * @returns {Object} Withdrawal eligibility:
   *   - canWithdraw: true if user can withdraw
   *   - reason: Explanation if can't withdraw
   *   - turnoverRemaining: Amount still needed to wager
   *   - minimumWithdrawal: Minimum withdrawal amount
   */
  async checkWithdrawalEligibility(accountId) {
    try {
      const response = await fetch(`${API_BASE}/api/wallets/${accountId}/can-withdraw`);
      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          canWithdraw: data.canWithdraw ?? true,
          reason: data.reason || null,
          turnoverRemaining: data.turnoverRemaining || 0,
          minimumWithdrawal: data.minimumWithdrawal || 20,
        };
      }

      return {
        success: false,
        error: data.message || 'Failed to check withdrawal eligibility',
        canWithdraw: true,
        reason: null,
        turnoverRemaining: 0,
        minimumWithdrawal: 20,
      };
    } catch (error) {
      console.error('[WalletService] Check withdrawal eligibility error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
        canWithdraw: true,
        reason: null,
        turnoverRemaining: 0,
        minimumWithdrawal: 20,
      };
    }
  }

  /**
   * Calculate turnover progress percentage
   * @param {number} completed - Amount completed
   * @param {number} required - Total required
   * @returns {number} Progress percentage (0-100)
   */
  calculateTurnoverProgress(completed, required) {
    if (!required || required <= 0) return 100;
    const progress = (completed / required) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }
}

export const walletService = new WalletService();
export default walletService;
