/**
 * Admin Transaction Service
 * Manages transactions across all users for admin panel
 * Uses real API endpoints for deposits
 * API calls use relative URLs which are proxied by Vite (dev) or Vercel serverless functions (prod)
 */
import { API_KEY } from '../../services/api';

// LocalStorage keys for withdrawals (no API yet)
const PENDING_TRANSACTIONS_KEY = 'admin_pending_transactions';
const ALL_TRANSACTIONS_KEY = 'admin_all_transactions';
const USER_CACHE_KEY = 'admin_user_cache';

/**
 * NOTE: Wallet balance is now updated internally by the backend when deposits/withdrawals are approved.
 * No need to call a separate wallet API - backend handles it automatically.
 */

/**
 * Get user info cache from localStorage
 */
const getUserCache = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

/**
 * Save user info to cache
 */
const saveToUserCache = (accountId, userInfo) => {
  const cache = getUserCache();
  cache[accountId] = {
    ...userInfo,
    cachedAt: Date.now()
  };
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cache));
};

/**
 * Look up user info by accountId
 */
const lookupUserInfo = async (accountId) => {
  // Check cache first (valid for 5 minutes)
  const cache = getUserCache();
  const cached = cache[accountId];
  if (cached && (Date.now() - cached.cachedAt) < 300000) {
    return cached;
  }

  // Check local accounts
  const localAccounts = JSON.parse(localStorage.getItem('local_accounts') || '[]');
  const localAccount = localAccounts.find(acc => acc.accountId === accountId);
  if (localAccount) {
    const userInfo = {
      username: localAccount.firstName ? `${localAccount.firstName} ${localAccount.lastName}` : accountId,
      phone: localAccount.phoneNumber || ''
    };
    saveToUserCache(accountId, userInfo);
    return userInfo;
  }

  // Try API lookup
  try {
    const response = await fetch(`/api/accounts/${accountId}`, {
      headers: { 'X-API-Key': API_KEY }
    });
    if (response.ok) {
      const account = await response.json();
      const userInfo = {
        username: account.firstName ? `${account.firstName} ${account.lastName}` : account.phoneNumber || accountId,
        phone: account.phoneNumber || ''
      };
      saveToUserCache(accountId, userInfo);
      return userInfo;
    }
  } catch (error) {
    console.log('Could not lookup user info for:', accountId);
  }

  return { username: accountId, phone: '' };
};

/**
 * Save pending transactions to localStorage
 */
const savePendingTransactions = (transactions) => {
  try {
    localStorage.setItem(PENDING_TRANSACTIONS_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error('Error saving pending transactions:', error);
  }
};

/**
 * Get all transactions history from localStorage
 */
const getAllTransactionsHistory = () => {
  try {
    const stored = localStorage.getItem(ALL_TRANSACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading all transactions:', error);
    return [];
  }
};

/**
 * Save all transactions history to localStorage
 */
const saveAllTransactionsHistory = (transactions) => {
  try {
    localStorage.setItem(ALL_TRANSACTIONS_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error('Error saving all transactions:', error);
  }
};

/**
 * Admin Transaction Service
 */
export const transactionService = {
  /**
   * Get all transactions (deposits and withdrawals from API)
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - Transactions list with stats
   */
  async getAllTransactions(filters = {}) {
    let allTransactions = [];
    let apiDeposits = [];
    let apiWithdrawals = [];

    // Fetch deposits from API based on status filter
    try {
      let depositEndpoint = `/api/admin/deposits/pending`;

      if (filters.status === 'APPROVED' || filters.status === 'COMPLETED') {
        depositEndpoint = `/api/admin/deposits/status/COMPLETED`;
      } else if (filters.status === 'REJECTED') {
        depositEndpoint = `/api/admin/deposits/status/REJECTED`;
      } else if (filters.status === 'ALL') {
        // Fetch all statuses
        const [pending, completed, rejected] = await Promise.all([
          fetch(`/api/admin/deposits/pending`, {
            headers: { 'X-API-Key': API_KEY }
          }).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`/api/admin/deposits/status/COMPLETED`, {
            headers: { 'X-API-Key': API_KEY }
          }).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`/api/admin/deposits/status/REJECTED`, {
            headers: { 'X-API-Key': API_KEY }
          }).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);
        apiDeposits = [...pending, ...completed, ...rejected];
      }

      if (filters.status !== 'ALL') {
        const response = await fetch(depositEndpoint, {
          headers: { 'X-API-Key': API_KEY }
        });

        if (response.ok) {
          apiDeposits = await response.json();
        }
      }

      // Transform API deposits to our format and enrich with user info
      const deposits = await Promise.all(apiDeposits.map(async (d) => {
        const userInfo = await lookupUserInfo(d.accountId);
        return {
          id: d.depositId,
          accountId: d.accountId,
          username: userInfo.username,
          phone: userInfo.phone,
          type: 'DEPOSIT',
          amount: d.amount,
          status: d.status === 'PENDING_REVIEW' ? 'PENDING' : d.status,
          originalStatus: d.status,
          createdAt: d.createdAt,
          completedAt: d.completedAt,
          walletId: d.walletId,
          currency: d.currency || 'AUD'
        };
      }));

      allTransactions = [...deposits];

    } catch (error) {
      console.error('Error fetching deposits from API:', error);
    }

    // Fetch withdrawals from API based on status filter
    try {
      let withdrawalEndpoint = `/api/admin/withdrawals/pending`;

      if (filters.status === 'APPROVED' || filters.status === 'COMPLETED') {
        withdrawalEndpoint = `/api/admin/withdrawals/status/COMPLETED`;
      } else if (filters.status === 'REJECTED') {
        withdrawalEndpoint = `/api/admin/withdrawals/status/REJECTED`;
      } else if (filters.status === 'ALL') {
        // Fetch all statuses for withdrawals
        const [pending, completed, rejected] = await Promise.all([
          fetch(`/api/admin/withdrawals/pending`, {
            headers: { 'X-API-Key': API_KEY }
          }).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`/api/admin/withdrawals/status/COMPLETED`, {
            headers: { 'X-API-Key': API_KEY }
          }).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(`/api/admin/withdrawals/status/REJECTED`, {
            headers: { 'X-API-Key': API_KEY }
          }).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);
        apiWithdrawals = [...pending, ...completed, ...rejected];
      }

      if (filters.status !== 'ALL') {
        const response = await fetch(withdrawalEndpoint, {
          headers: { 'X-API-Key': API_KEY }
        });

        if (response.ok) {
          apiWithdrawals = await response.json();
        }
      }

      // Transform API withdrawals to our format and enrich with user info
      const withdrawals = await Promise.all(apiWithdrawals.map(async (w) => {
        const userInfo = await lookupUserInfo(w.accountId);
        // Ensure withdrawal ID has WD prefix for consistent handling
        const rawId = w.withdrawId || w.withdrawalId || w.requestId || w.id;
        const withdrawId = rawId && !String(rawId).startsWith('WD') && !String(rawId).startsWith('WTH')
          ? `WD${rawId}`
          : String(rawId);
        return {
          id: withdrawId,
          originalId: rawId, // Keep original ID for API calls
          accountId: w.accountId,
          username: userInfo.username,
          phone: userInfo.phone,
          type: 'WITHDRAWAL',
          amount: w.amount,
          status: w.status === 'PENDING_REVIEW' ? 'PENDING' : w.status,
          originalStatus: w.status,
          createdAt: w.createdAt,
          completedAt: w.completedAt,
          bank: w.bankName || 'Bank Transfer',
          bankAccount: w.accountNumber,
          bsb: w.bsb,
          payId: w.payId,
          accountHolderName: w.accountHolderName,
          currency: w.currency || 'AUD'
        };
      }));

      allTransactions = [...allTransactions, ...withdrawals];

    } catch (error) {
      console.error('Error fetching withdrawals from API:', error);
    }

    // Get all localStorage transactions (fallback for offline mode)
    const pendingTransactions = JSON.parse(localStorage.getItem(PENDING_TRANSACTIONS_KEY) || '[]');
    const historyTransactions = getAllTransactionsHistory();

    // Combine pending and history localStorage transactions
    let localTransactions = [...pendingTransactions, ...historyTransactions];

    // Filter by status if needed
    if (filters.status && filters.status !== 'ALL') {
      localTransactions = localTransactions.filter(tx =>
        tx.status.toUpperCase() === filters.status.toUpperCase()
      );
    }

    // Only add local transactions that aren't already in API results
    const apiIds = new Set(allTransactions.map(t => t.id));
    localTransactions = localTransactions.filter(tx => !apiIds.has(tx.id));

    allTransactions = [...allTransactions, ...localTransactions];

    // Apply additional filters
    if (filters.type && filters.type !== 'ALL') {
      allTransactions = allTransactions.filter(tx =>
        tx.type.toUpperCase() === filters.type.toUpperCase()
      );
    }

    if (filters.customer) {
      const search = filters.customer.toLowerCase();
      allTransactions = allTransactions.filter(tx =>
        tx.accountId?.toLowerCase().includes(search) ||
        tx.username?.toLowerCase().includes(search) ||
        tx.phone?.toLowerCase().includes(search)
      );
    }

    if (filters.id) {
      const search = filters.id.toLowerCase();
      allTransactions = allTransactions.filter(tx =>
        tx.id.toLowerCase().includes(search)
      );
    }

    if (filters.dateStart) {
      const startDate = new Date(filters.dateStart);
      allTransactions = allTransactions.filter(tx =>
        new Date(tx.createdAt) >= startDate
      );
    }

    if (filters.dateEnd) {
      const endDate = new Date(filters.dateEnd);
      endDate.setHours(23, 59, 59, 999);
      allTransactions = allTransactions.filter(tx =>
        new Date(tx.createdAt) <= endDate
      );
    }

    if (filters.amountMin) {
      const min = parseFloat(filters.amountMin);
      allTransactions = allTransactions.filter(tx => tx.amount >= min);
    }

    if (filters.amountMax) {
      const max = parseFloat(filters.amountMax);
      allTransactions = allTransactions.filter(tx => tx.amount <= max);
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate stats
    const stats = {
      total: allTransactions.length,
      pendingCount: allTransactions.filter(tx => tx.status === 'PENDING' || tx.status === 'PENDING_REVIEW').length,
      approvedCount: allTransactions.filter(tx => tx.status === 'APPROVED' || tx.status === 'COMPLETED').length,
      rejectedCount: allTransactions.filter(tx => tx.status === 'REJECTED').length,
      totalAmount: allTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
      pendingAmount: allTransactions
        .filter(tx => tx.status === 'PENDING' || tx.status === 'PENDING_REVIEW')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    };

    return {
      success: true,
      transactions: allTransactions,
      stats
    };
  },

  /**
   * Get deposit statistics from API
   * @returns {Promise<Object>} - Statistics
   */
  async getStats() {
    try {
      const response = await fetch(`/api/admin/deposits/stats`, {
        headers: { 'X-API-Key': API_KEY }
      });

      if (response.ok) {
        const stats = await response.json();
        return {
          success: true,
          stats: {
            pending: stats.pending || 0,
            pendingReview: stats.pendingReview || 0,
            approved: stats.approved || 0,
            rejected: stats.rejected || 0,
            completed: stats.completed || 0
          }
        };
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }

    return { success: false, error: 'Failed to fetch stats' };
  },

  /**
   * Approve a transaction (deposit or withdrawal)
   * Uses: POST /api/admin/deposits/{requestId}/approve or /api/admin/withdrawals/{requestId}/approve
   * Backend automatically updates the user's wallet balance
   * @param {string} transactionId - Transaction ID to approve
   * @param {string} adminNotes - Optional admin notes
   * @param {Object} txInfo - Optional transaction info (accountId, amount)
   * @returns {Promise<Object>} - Result
   */
  async approveTransaction(transactionId, adminNotes = '', txInfo = null) {
    // Check if it's a deposit (starts with DEP)
    if (transactionId.startsWith('DEP')) {
      try {
        // Get deposit details for local UI update
        let accountId = txInfo?.accountId;
        let amount = txInfo?.amount;

        if (!accountId || !amount) {
          const depositResponse = await fetch(`/api/admin/deposits/${transactionId}`, {
            headers: { 'X-API-Key': API_KEY }
          });
          if (depositResponse.ok) {
            const deposit = await depositResponse.json();
            accountId = deposit.accountId;
            amount = deposit.amount;
          }
        }

        // Call approve API - backend handles wallet credit internally
        const response = await fetch(`/api/admin/deposits/${transactionId}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
          },
          body: JSON.stringify({
            adminId: 'admin1',
            adminNotes: adminNotes || 'Approved via admin panel'
          })
        });

        if (response.ok) {
          const data = await response.json();

          // Update local cache for immediate UI feedback (same browser)
          // Backend has already credited the actual balance
          if (accountId && amount) {
            await this.updateUserBalance(accountId, amount, 'DEPOSIT');
          }

          return {
            success: true,
            depositId: transactionId,
            status: data.status,
            message: data.message || 'Deposit approved and credited to wallet'
          };
        } else {
          const errorText = await response.text();
          console.error('Deposit approval failed:', response.status, errorText);
          let errorMessage = `Error ${response.status}: `;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage += errorJson.message || errorJson.error || errorJson.detail || JSON.stringify(errorJson);
          } catch {
            errorMessage += errorText || 'Failed to approve deposit';
          }
          return {
            success: false,
            error: errorMessage
          };
        }
      } catch (error) {
        console.error('Error approving deposit:', error);
        return { success: false, error: `Network error: ${error.message}` };
      }
    }

    // Check if it's a withdrawal (starts with WD or WTH)
    if (transactionId.startsWith('WD') || transactionId.startsWith('WTH')) {
      try {
        // Get withdrawal details for local UI update
        let accountId = txInfo?.accountId;
        let amount = txInfo?.amount;
        // Use originalId for API calls (strip WD prefix if we added it)
        let apiId = txInfo?.originalId || transactionId;
        if (apiId.startsWith('WD') && !txInfo?.originalId) {
          // Try without the prefix first (in case backend uses numeric IDs)
          apiId = transactionId.replace(/^WD/, '');
        }

        if (!accountId || !amount) {
          // Try fetching with original ID first, then with full ID
          let withdrawalResponse = await fetch(`/api/admin/withdrawals/${apiId}`, {
            headers: { 'X-API-Key': API_KEY }
          });
          if (!withdrawalResponse.ok && apiId !== transactionId) {
            withdrawalResponse = await fetch(`/api/admin/withdrawals/${transactionId}`, {
              headers: { 'X-API-Key': API_KEY }
            });
          }
          if (withdrawalResponse.ok) {
            const withdrawal = await withdrawalResponse.json();
            accountId = withdrawal.accountId;
            amount = withdrawal.amount;
            // Use the ID format that worked
            if (withdrawal.withdrawId || withdrawal.withdrawalId) {
              apiId = withdrawal.withdrawId || withdrawal.withdrawalId;
            }
          }
        }

        // Call approve API - backend handles wallet debit internally
        const response = await fetch(`/api/admin/withdrawals/${apiId}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
          },
          body: JSON.stringify({
            adminId: 'admin1',
            adminNotes: adminNotes || 'Approved via admin panel'
          })
        });

        if (response.ok) {
          const data = await response.json();

          // Update local cache for immediate UI feedback
          if (accountId && amount) {
            await this.updateUserBalance(accountId, amount, 'WITHDRAWAL');
          }

          return {
            success: true,
            withdrawId: transactionId,
            status: data.status,
            message: data.message || 'Withdrawal approved and processed'
          };
        } else {
          const errorText = await response.text();
          console.error('Withdrawal approval failed:', response.status, errorText);
          let errorMessage = `Error ${response.status}: `;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage += errorJson.message || errorJson.error || errorJson.detail || JSON.stringify(errorJson);
          } catch {
            errorMessage += errorText || 'Failed to approve withdrawal';
          }
          return {
            success: false,
            error: errorMessage
          };
        }
      } catch (error) {
        console.error('Error approving withdrawal:', error);
        return { success: false, error: `Network error: ${error.message}` };
      }
    }

    // Handle localStorage transaction approval (fallback for offline mode)
    const pending = JSON.parse(localStorage.getItem(PENDING_TRANSACTIONS_KEY) || '[]');
    const index = pending.findIndex(tx => tx.id === transactionId);

    if (index === -1) {
      return { success: false, error: 'Transaction not found' };
    }

    const transaction = pending[index];
    const txType = transaction.type?.toUpperCase() || 'WITHDRAWAL';

    // Update user's wallet balance based on transaction type
    const walletUpdated = await this.updateUserBalance(
      transaction.accountId,
      transaction.amount,
      txType
    );

    if (!walletUpdated.success) {
      return { success: false, error: 'Failed to update user balance' };
    }

    // Move to history with approved status
    transaction.status = 'APPROVED';
    transaction.updatedAt = new Date().toISOString();
    transaction.adminNotes = adminNotes;
    transaction.processedAt = new Date().toISOString();

    // Remove from pending
    pending.splice(index, 1);
    savePendingTransactions(pending);

    // Add to history
    const history = getAllTransactionsHistory();
    history.unshift(transaction);
    saveAllTransactionsHistory(history);

    return {
      success: true,
      transaction,
      message: `${txType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} ${transactionId} approved successfully`
    };
  },

  /**
   * Reject a transaction (deposit or withdrawal)
   * Uses: POST /api/admin/deposits/{requestId}/reject or /api/admin/withdrawals/{requestId}/reject
   * @param {string} transactionId - Transaction ID to reject
   * @param {string} reason - Rejection reason
   * @param {string} originalId - Original ID for API calls (optional, for withdrawals with prefixed IDs)
   * @returns {Promise<Object>} - Result
   */
  async rejectTransaction(transactionId, reason = '', originalId = null) {
    // Check if it's a deposit (starts with DEP)
    if (transactionId.startsWith('DEP')) {
      try {
        const response = await fetch(`/api/admin/deposits/${transactionId}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
          },
          body: JSON.stringify({
            adminId: 'admin1',
            adminNotes: reason || 'Rejected via admin panel'
          })
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            depositId: transactionId,
            status: data.status,
            message: data.message || 'Deposit rejected'
          };
        } else {
          const error = await response.json().catch(() => ({}));
          return {
            success: false,
            error: error.message || 'Failed to reject deposit'
          };
        }
      } catch (error) {
        console.error('Error rejecting deposit:', error);
        return { success: false, error: 'Network error while rejecting deposit' };
      }
    }

    // Check if it's a withdrawal (starts with WD or WTH)
    if (transactionId.startsWith('WD') || transactionId.startsWith('WTH')) {
      try {
        // Use originalId for API calls (strip WD prefix if we added it)
        let apiId = originalId || transactionId;
        if (apiId.startsWith('WD') && !originalId) {
          apiId = transactionId.replace(/^WD/, '');
        }
        const response = await fetch(`/api/admin/withdrawals/${apiId}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
          },
          body: JSON.stringify({
            adminId: 'admin1',
            adminNotes: reason || 'Rejected via admin panel'
          })
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            withdrawId: transactionId,
            status: data.status,
            message: data.message || 'Withdrawal rejected'
          };
        } else {
          const error = await response.json().catch(() => ({}));
          return {
            success: false,
            error: error.message || 'Failed to reject withdrawal'
          };
        }
      } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        return { success: false, error: 'Network error while rejecting withdrawal' };
      }
    }

    // Handle localStorage transaction rejection (fallback for offline mode)
    const pending = JSON.parse(localStorage.getItem(PENDING_TRANSACTIONS_KEY) || '[]');
    const index = pending.findIndex(tx => tx.id === transactionId);

    if (index === -1) {
      return { success: false, error: 'Transaction not found' };
    }

    const transaction = pending[index];

    // Move to history with rejected status
    transaction.status = 'REJECTED';
    transaction.updatedAt = new Date().toISOString();
    transaction.rejectionReason = reason;
    transaction.processedAt = new Date().toISOString();

    // Remove from pending
    pending.splice(index, 1);
    savePendingTransactions(pending);

    // Add to history
    const history = getAllTransactionsHistory();
    history.unshift(transaction);
    saveAllTransactionsHistory(history);

    return {
      success: true,
      transaction,
      message: `Transaction ${transactionId} rejected`
    };
  },

  /**
   * Update user's wallet balance after withdrawal approval
   * @param {string} accountId - User's account ID
   * @param {number} amount - Transaction amount
   * @param {string} type - 'WITHDRAWAL'
   * @returns {Promise<Object>} - Result
   */
  async updateUserBalance(accountId, amount, type) {
    try {
      const walletsKey = 'local_wallets';
      const walletsStr = localStorage.getItem(walletsKey);
      const wallets = walletsStr ? JSON.parse(walletsStr) : {};

      let wallet = wallets[accountId];

      if (!wallet) {
        for (const [, w] of Object.entries(wallets)) {
          if (w.accountId === accountId) {
            wallet = w;
            break;
          }
        }
      }

      // If no wallet exists, create one with the user's current balance
      if (!wallet) {
        // Get current balance from user object
        let currentBalance = 0;
        const userKeys = ['current_user', 'user'];
        for (const key of userKeys) {
          const userStr = localStorage.getItem(key);
          if (userStr) {
            try {
              const user = JSON.parse(userStr);
              if (user.accountId === accountId || user.id === accountId) {
                currentBalance = user.balance || 0;
                break;
              }
            } catch (e) {
              // Ignore
            }
          }
        }

        wallet = {
          walletId: `WAL-${Date.now()}`,
          accountId: accountId,
          balance: currentBalance,
          currency: 'AUD',
          createdAt: new Date().toISOString()
        };
      }

      const currentBalance = wallet.balance || 0;

      if (type === 'WITHDRAWAL') {
        if (currentBalance < amount) {
          return { success: false, error: 'Insufficient balance' };
        }
        wallet.balance = currentBalance - amount;
      } else if (type === 'DEPOSIT') {
        wallet.balance = currentBalance + amount;
      }

      wallet.updatedAt = new Date().toISOString();
      wallets[accountId] = wallet;
      localStorage.setItem(walletsKey, JSON.stringify(wallets));

      // Also update the current user if they're logged in (check both localStorage keys)
      const userKeys = ['current_user', 'user'];
      for (const key of userKeys) {
        const userStr = localStorage.getItem(key);
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            if (user.accountId === accountId || user.id === accountId) {
              user.balance = wallet.balance;
              user.availableBalance = wallet.balance;
              localStorage.setItem(key, JSON.stringify(user));
            }
          } catch (e) {
            console.error('Error updating user balance in', key, e);
          }
        }
      }

      return { success: true, newBalance: wallet.balance };

    } catch (error) {
      console.error('Error updating user balance:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get a single deposit by ID
   * @param {string} depositId - Deposit ID
   * @returns {Promise<Object>} - Deposit details
   */
  async getDeposit(depositId) {
    try {
      const response = await fetch(`/api/admin/deposits/${depositId}`, {
        headers: { 'X-API-Key': API_KEY }
      });

      if (response.ok) {
        const deposit = await response.json();
        return {
          success: true,
          deposit: {
            id: deposit.depositId,
            accountId: deposit.accountId,
            amount: deposit.amount,
            status: deposit.status,
            createdAt: deposit.createdAt,
            completedAt: deposit.completedAt,
            walletId: deposit.walletId
          }
        };
      }
    } catch (error) {
      console.error('Error fetching deposit:', error);
    }

    return { success: false, error: 'Deposit not found' };
  },

  /**
   * Get deposits by account ID
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} - Deposits list
   */
  async getDepositsByAccount(accountId) {
    try {
      const response = await fetch(`/api/admin/deposits/account/${accountId}`, {
        headers: { 'X-API-Key': API_KEY }
      });

      if (response.ok) {
        const deposits = await response.json();
        return {
          success: true,
          deposits: deposits.map(d => ({
            id: d.depositId,
            accountId: d.accountId,
            amount: d.amount,
            status: d.status,
            createdAt: d.createdAt
          }))
        };
      }
    } catch (error) {
      console.error('Error fetching deposits by account:', error);
    }

    return { success: false, error: 'Failed to fetch deposits' };
  }
};

export default transactionService;
