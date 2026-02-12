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
   */
  async initiateDeposit(accountId, amount) {
    try {
      const response = await fetch(`${API_BASE}/api/deposits/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          amount: Number(amount),
        }),
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
   * POST /api/withdrawals
   */
  async requestWithdrawal({ accountId, amount, bankName, accountHolderName, bsb, accountNumber, payId }) {
    try {
      const body = {
        accountId,
        amount: Number(amount),
        bankName,
        accountHolderName,
      };

      // Add bank details (either BSB+AccountNumber or PayID)
      if (bsb && accountNumber) {
        body.bsb = bsb;
        body.accountNumber = accountNumber;
      }
      if (payId) {
        body.payId = payId;
      }

      const response = await fetch(`${API_BASE}/api/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.status === 201 || response.ok) {
        return {
          success: true,
          withdrawId: data.withdrawId,
          amount: data.amount,
          status: data.status,
          balanceBefore: data.balanceBefore,
          balanceAfter: data.balanceAfter,
        };
      }

      return {
        success: false,
        error: data.message || 'Failed to submit withdrawal',
      };
    } catch (error) {
      console.error('[WalletService] Withdrawal error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
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
   * Get all transactions (deposits + withdrawals)
   */
  async getTransactions(accountId) {
    try {
      const [depositsResult, withdrawalsResult] = await Promise.all([
        this.getDeposits(accountId),
        this.getWithdrawals(accountId),
      ]);

      const deposits = (depositsResult.deposits || []).map(d => ({
        id: d.depositId,
        type: 'deposit',
        amount: d.amount,
        status: d.status?.toLowerCase(),
        createdAt: d.createdAt,
      }));

      const withdrawals = (withdrawalsResult.withdrawals || []).map(w => ({
        id: w.withdrawId,
        type: 'withdrawal',
        amount: w.amount,
        status: w.status?.toLowerCase(),
        createdAt: w.createdAt,
      }));

      const transactions = [...deposits, ...withdrawals]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return { success: true, transactions };
    } catch (error) {
      console.error('[WalletService] Get transactions error:', error);
      return { success: false, error: 'Failed to fetch transactions', transactions: [] };
    }
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
}

export const walletService = new WalletService();
export default walletService;
