// Wallet Service - Wallet management via external API with localStorage fallback
// API calls use relative URLs which are proxied by Vite (dev) or Vercel serverless functions (prod)
const API_KEY = 'team33-admin-secret-key-2024';
const LOCAL_WALLETS_KEY = 'team33_local_wallets';
const PENDING_TRANSACTIONS_KEY = 'team33_pending_transactions';
const DEFAULT_BALANCE = 0; // Users must deposit via agent/admin

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

// Generate unique Transaction ID
const generateTransactionId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${timestamp}-${random}`;
};

// Pending transactions helpers
const getPendingTransactions = () => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_TRANSACTIONS_KEY) || '[]');
  } catch {
    return [];
  }
};

const savePendingTransactions = (transactions) => {
  localStorage.setItem(PENDING_TRANSACTIONS_KEY, JSON.stringify(transactions));
};

// Generate unique Wallet ID (WAL-XXXXXX format)
const generateWalletId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WAL-${timestamp}${random}`;
};

// Local wallet helpers
const getLocalWallets = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_WALLETS_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveLocalWallet = (accountId, wallet) => {
  const wallets = getLocalWallets();
  wallets[accountId] = wallet;
  localStorage.setItem(LOCAL_WALLETS_KEY, JSON.stringify(wallets));
};

const getLocalWallet = (accountId) => {
  const wallets = getLocalWallets();
  return wallets[accountId];
};

// Check if account is local (ACC- format or old local_ format)
const isLocalAccount = (accountId) => {
  return accountId && (accountId.startsWith('ACC-') || accountId.startsWith('local_'));
};

export const walletService = {
  // Create wallet for an account
  async createWallet(accountId) {
    // For local accounts, create local wallet
    if (isLocalAccount(accountId)) {
      const existingWallet = getLocalWallet(accountId);
      if (existingWallet) {
        return { success: true, wallet: existingWallet, data: existingWallet, walletId: existingWallet.walletId };
      }

      const walletId = generateWalletId();
      const wallet = {
        walletId,
        accountId,
        balance: DEFAULT_BALANCE,
        currency: 'AUD',
        transactions: [],
        createdAt: new Date().toISOString(),
      };
      saveLocalWallet(accountId, wallet);
      return { success: true, wallet, data: wallet, walletId };
    }

    try {
      const response = await fetch(`/api/wallets/${accountId}`, {
        method: 'POST',
        headers,
      });

      const data = await response.json();

      if (response.status === 201 || response.ok) {
        return {
          success: true,
          data: data,
          wallet: data,
        };
      }

      return {
        success: false,
        error: data.error || 'Failed to create wallet',
      };
    } catch (error) {
      console.error('Create wallet error:', error);
      return {
        success: false,
        error: 'Failed to create wallet. Please try again.',
      };
    }
  },

  // Get wallet by account ID
  async getWallet(accountId) {
    try {
      const response = await fetch(`/api/wallets/account/${accountId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Wallet not found' };
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
        wallet: data,
      };
    } catch (error) {
      console.error('Get wallet error:', error);
      return {
        success: false,
        error: 'Failed to fetch wallet details',
      };
    }
  },

  // Get wallet balance
  async getBalance(accountId) {
    // If no accountId provided, try to get from localStorage
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'No account ID' };
    }

    // Check for local wallet (for fallback)
    const localWallet = getLocalWallet(accountId);

    // Try API first for cross-browser/device balance sync
    try {
      const response = await fetch(`/api/wallets/account/${accountId}/balance`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        const apiBalance = data.balance || 0;
        const localBalance = localWallet?.balance || 0;

        // Use the HIGHER balance to prevent losing money from race conditions
        // This handles cases where:
        // 1. Admin approved deposit locally but backend API hasn't synced
        // 2. Backend wallet doesn't exist yet
        const finalBalance = Math.max(apiBalance, localBalance);

        // Only update local wallet if API has a higher balance
        if (localWallet && apiBalance > localBalance) {
          localWallet.balance = apiBalance;
          localWallet.updatedAt = new Date().toISOString();
          saveLocalWallet(accountId, localWallet);
        }

        return {
          success: true,
          data: {
            balance: finalBalance,
            currency: data.currency || 'AUD',
            total: finalBalance,
            available: finalBalance,
          },
          balance: finalBalance,
          currency: data.currency || 'AUD',
          source: apiBalance >= localBalance ? 'api' : 'local-priority',
        };
      }

      // API returned error - fall through to localStorage fallback
      console.log('Wallet API error, falling back to localStorage');
    } catch (error) {
      console.log('Wallet API unavailable, using localStorage:', error.message);
    }

    // Fallback to localStorage (for offline mode or API errors)
    let wallet = localWallet;
    if (!wallet) {
      // Create wallet if doesn't exist
      // IMPORTANT: Check user object for existing balance (games may have updated it)
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const existingBalance = (user.accountId === accountId && user.balance != null)
        ? Number(user.balance)
        : DEFAULT_BALANCE;

      const walletId = generateWalletId();
      wallet = {
        walletId,
        accountId,
        balance: existingBalance,
        currency: 'AUD',
        transactions: [],
        createdAt: new Date().toISOString(),
      };
      saveLocalWallet(accountId, wallet);
    } else {
      // Sync wallet balance with user balance if user has a higher balance (from game updates)
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.accountId === accountId && user.balance != null && user.balance > wallet.balance) {
        wallet.balance = user.balance;
        saveLocalWallet(accountId, wallet);
      }
    }

    return {
      success: true,
      data: {
        walletId: wallet.walletId,
        balance: wallet.balance,
        currency: wallet.currency || 'AUD',
        total: wallet.balance,
        available: wallet.balance,
      },
      walletId: wallet.walletId,
      balance: wallet.balance,
      currency: wallet.currency || 'AUD',
      source: 'localStorage',
    };
  },

  // Deposit to wallet
  async deposit(amount, paymentMethod = 'Credit Card', accountId = null) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'No account ID' };
    }

    // For local accounts, handle deposit locally
    if (isLocalAccount(accountId)) {
      let wallet = getLocalWallet(accountId);
      if (!wallet) {
        wallet = { accountId, balance: DEFAULT_BALANCE, currency: 'AUD', transactions: [] };
      }

      const depositAmount = Number(amount);
      const balanceBefore = wallet.balance;
      wallet.balance += depositAmount;

      const transaction = {
        id: `txn_${Date.now()}`,
        type: 'DEPOSIT',
        amount: depositAmount,
        balanceBefore,
        balanceAfter: wallet.balance,
        description: `${paymentMethod} deposit`,
        reference: `DEP-${Date.now()}`,
        createdAt: new Date().toISOString(),
        status: 'COMPLETED',
      };
      wallet.transactions = [transaction, ...(wallet.transactions || [])];
      saveLocalWallet(accountId, wallet);

      return {
        success: true,
        data: { ...transaction, newBalance: wallet.balance },
        transaction,
        newBalance: wallet.balance,
      };
    }

    try {
      const response = await fetch(`/api/wallets/account/${accountId}/deposit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: Number(amount),
          description: `${paymentMethod} deposit`,
          reference: `DEP-${Date.now()}`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: {
            ...data,
            newBalance: data.balanceAfter,
          },
          transaction: data,
          newBalance: data.balanceAfter,
        };
      }

      return {
        success: false,
        error: data.error || 'Deposit failed',
      };
    } catch (error) {
      console.error('Deposit error:', error);
      return {
        success: false,
        error: 'Failed to process deposit. Please try again.',
      };
    }
  },

  // Withdraw from wallet
  async withdraw(amount, paymentMethod = 'Bank Transfer', accountId = null) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'No account ID' };
    }

    // For local accounts, handle withdrawal locally
    if (isLocalAccount(accountId)) {
      let wallet = getLocalWallet(accountId);
      if (!wallet) {
        wallet = { accountId, balance: DEFAULT_BALANCE, currency: 'AUD', transactions: [] };
      }

      const withdrawAmount = Number(amount);
      if (wallet.balance < withdrawAmount) {
        return {
          success: false,
          error: `Insufficient funds. Current balance: $${wallet.balance.toFixed(2)}`,
          currentBalance: wallet.balance,
          requestedAmount: withdrawAmount,
        };
      }

      const balanceBefore = wallet.balance;
      wallet.balance -= withdrawAmount;

      const transaction = {
        id: `txn_${Date.now()}`,
        type: 'WITHDRAWAL',
        amount: withdrawAmount,
        balanceBefore,
        balanceAfter: wallet.balance,
        description: `${paymentMethod} withdrawal`,
        reference: `WD-${Date.now()}`,
        createdAt: new Date().toISOString(),
        status: 'COMPLETED',
      };
      wallet.transactions = [transaction, ...(wallet.transactions || [])];
      saveLocalWallet(accountId, wallet);

      return {
        success: true,
        data: { ...transaction, newBalance: wallet.balance },
        transaction,
        newBalance: wallet.balance,
      };
    }

    try {
      const response = await fetch(`/api/wallets/account/${accountId}/withdraw`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: Number(amount),
          description: `${paymentMethod} withdrawal`,
          reference: `WD-${Date.now()}`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: {
            ...data,
            newBalance: data.balanceAfter,
          },
          transaction: data,
          newBalance: data.balanceAfter,
        };
      }

      // Handle insufficient funds
      if (data.error === 'Insufficient funds') {
        return {
          success: false,
          error: `Insufficient funds. Current balance: $${data.currentBalance?.toFixed(2)}`,
          currentBalance: data.currentBalance,
          requestedAmount: data.requestedAmount,
        };
      }

      return {
        success: false,
        error: data.error || 'Withdrawal failed',
      };
    } catch (error) {
      console.error('Withdraw error:', error);
      return {
        success: false,
        error: 'Failed to process withdrawal. Please try again.',
      };
    }
  },

  // Get transaction history
  async getTransactions({ page = 0, limit = 20, size = 20, type = null, accountId = null } = {}) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'No account ID' };
    }

    // For local accounts, get transactions from localStorage
    if (isLocalAccount(accountId)) {
      const wallet = getLocalWallet(accountId);
      let transactions = wallet?.transactions || [];

      // Filter by type if specified
      if (type && type !== 'all') {
        transactions = transactions.filter(t => t.type === type.toUpperCase());
      }

      const pageSize = size || limit;
      const startIndex = page * pageSize;
      const paginatedTransactions = transactions.slice(startIndex, startIndex + pageSize);

      return {
        success: true,
        data: {
          transactions: paginatedTransactions,
          pagination: {
            page,
            totalPages: Math.ceil(transactions.length / pageSize),
            total: transactions.length,
          },
        },
        transactions: paginatedTransactions,
        pagination: {
          page,
          size: pageSize,
          totalElements: transactions.length,
          totalPages: Math.ceil(transactions.length / pageSize),
        },
      };
    }

    try {
      const pageSize = size || limit;
      let url = `/api/wallets/account/${accountId}/transactions?page=${page}&size=${pageSize}`;
      if (type && type !== 'all') {
        url += `&type=${type.toUpperCase()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to fetch transactions' };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          transactions: data.content,
          pagination: {
            page: data.page,
            totalPages: data.totalPages,
            total: data.totalElements,
          },
        },
        transactions: data.content,
        pagination: {
          page: data.page,
          size: data.size,
          totalElements: data.totalElements,
          totalPages: data.totalPages,
        },
      };
    } catch (error) {
      console.error('Get transactions error:', error);
      return {
        success: false,
        error: 'Failed to fetch transaction history',
      };
    }
  },

  // Check-in status (stub - may not exist on external API)
  async getCheckInStatus() {
    return {
      success: true,
      data: {
        canCheckIn: false,
        isCheckedToday: true,
      },
    };
  },

  // Check-in (stub - may not exist on external API)
  async checkIn() {
    return {
      success: false,
      error: 'Daily check-in not available',
    };
  },

  // Alias for backwards compatibility
  async dailyCheckIn() {
    return this.checkIn();
  },

  // Transfer (stub - may not exist on external API)
  async transfer(amount, recipientUsername) {
    return {
      success: false,
      error: 'Transfer not available',
    };
  },

  // Format currency for display
  formatCurrency(amount, currency = 'AUD') {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  },

  // Update balance directly (for game sync)
  async updateBalance(newBalance, accountId = null) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'No account ID' };
    }

    if (isLocalAccount(accountId)) {
      let wallet = getLocalWallet(accountId);
      if (!wallet) {
        wallet = { accountId, balance: DEFAULT_BALANCE, currency: 'AUD', transactions: [] };
      }
      wallet.balance = Number(newBalance);
      saveLocalWallet(accountId, wallet);

      // Also update user in localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.accountId === accountId) {
        user.balance = wallet.balance;
        localStorage.setItem('user', JSON.stringify(user));
      }

      return { success: true, balance: wallet.balance };
    }

    // For external accounts, just update localStorage (external API handles its own balance)
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.accountId === accountId) {
      user.balance = Number(newBalance);
      localStorage.setItem('user', JSON.stringify(user));
    }
    return { success: true, balance: newBalance };
  },

  // Record game win/loss transaction
  async recordGameTransaction(amount, gameType, isWin, accountId = null) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId || !isLocalAccount(accountId)) {
      return { success: false, error: 'Only available for local accounts' };
    }

    let wallet = getLocalWallet(accountId);
    if (!wallet) {
      wallet = { accountId, balance: DEFAULT_BALANCE, currency: 'AUD', transactions: [] };
    }

    const balanceBefore = wallet.balance;
    wallet.balance += isWin ? Number(amount) : -Number(amount);
    if (wallet.balance < 0) wallet.balance = 0;

    const transaction = {
      id: `txn_${Date.now()}`,
      type: isWin ? 'GAME_WIN' : 'GAME_LOSS',
      amount: Number(amount),
      balanceBefore,
      balanceAfter: wallet.balance,
      description: `${gameType} - ${isWin ? 'Win' : 'Loss'}`,
      reference: `GAME-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
    };
    wallet.transactions = [transaction, ...(wallet.transactions || [])];
    saveLocalWallet(accountId, wallet);

    // Update user balance in localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.accountId === accountId) {
      user.balance = wallet.balance;
      localStorage.setItem('user', JSON.stringify(user));
    }

    return {
      success: true,
      transaction,
      newBalance: wallet.balance,
    };
  },

  // Sync balance from user object (call this when game iframe updates balance)
  syncBalanceFromUser() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.accountId && isLocalAccount(user.accountId)) {
      let wallet = getLocalWallet(user.accountId);
      if (wallet && wallet.balance !== user.balance) {
        wallet.balance = user.balance;
        saveLocalWallet(user.accountId, wallet);
      }
    }
    return user.balance;
  },

  // Request a deposit (creates pending transaction for admin approval)
  async requestDeposit(amount, paymentMethod = 'Bank Transfer', bankDetails = {}) {
    const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
    const accountId = user.accountId || user.id;

    if (!accountId) {
      return { success: false, error: 'Not logged in' };
    }

    const depositAmount = Number(amount);
    if (depositAmount < 10) {
      return { success: false, error: 'Minimum deposit is $10' };
    }
    if (depositAmount > 10000) {
      return { success: false, error: 'Maximum deposit is $10,000' };
    }

    try {
      // Step 1: Initiate deposit via API (use relative URL for Vercel proxy)
      const initiateResponse = await fetch(`/api/deposits/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: accountId,
          amount: depositAmount
        })
      });

      if (!initiateResponse.ok) {
        const error = await initiateResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to initiate deposit');
      }

      const initiateData = await initiateResponse.json();
      const depositId = initiateData.depositId;

      // Step 2: Verify deposit to move to PENDING_REVIEW
      const verifyResponse = await fetch(`/api/deposits/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId })
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to verify deposit');
      }

      const verifyData = await verifyResponse.json();

      return {
        success: true,
        depositId: depositId,
        status: verifyData.status,
        message: verifyData.message || 'Deposit submitted. Awaiting admin approval.'
      };

    } catch (error) {
      console.error('Deposit API error:', error);

      // Fallback to localStorage if API fails
      const transaction = {
        id: generateTransactionId(),
        accountId: accountId,
        username: user.firstName ? `${user.firstName} ${user.lastName}` : user.username || accountId,
        phone: user.phoneNumber || user.phone || '',
        type: 'DEPOSIT',
        amount: depositAmount,
        bank: bankDetails.bank || 'N/A',
        bankAccount: bankDetails.accountNumber || '',
        paymentMethod: paymentMethod,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: bankDetails.notes || '',
        proofUrl: bankDetails.proofUrl || null
      };

      const pending = getPendingTransactions();
      pending.unshift(transaction);
      savePendingTransactions(pending);

      return {
        success: true,
        transaction,
        message: 'Deposit request submitted (offline mode). Awaiting admin approval.'
      };
    }
  },

  // Request a withdrawal (creates pending transaction for admin approval)
  async requestWithdrawal(amount, paymentMethod = 'Bank Transfer', bankDetails = {}) {
    const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
    const accountId = user.accountId || user.id;

    if (!accountId) {
      return { success: false, error: 'Not logged in' };
    }

    const withdrawAmount = Number(amount);
    if (withdrawAmount < 20) {
      return { success: false, error: 'Minimum withdrawal is $20' };
    }

    // Check current balance
    const balanceResult = await this.getBalance(accountId);
    if (!balanceResult.success) {
      return { success: false, error: 'Could not verify balance' };
    }

    const currentBalance = balanceResult.balance || 0;
    if (currentBalance < withdrawAmount) {
      return {
        success: false,
        error: `Insufficient funds. Current balance: $${currentBalance.toFixed(2)}`,
        currentBalance,
        requestedAmount: withdrawAmount
      };
    }

    const transaction = {
      id: generateTransactionId(),
      accountId: accountId,
      username: user.firstName ? `${user.firstName} ${user.lastName}` : user.username || accountId,
      phone: user.phoneNumber || user.phone || '',
      type: 'WITHDRAWAL',
      amount: withdrawAmount,
      bank: bankDetails.bank || 'N/A',
      bankAccount: bankDetails.accountNumber || '',
      bankName: bankDetails.accountName || '',
      bsb: bankDetails.bsb || '',
      paymentMethod: paymentMethod,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: bankDetails.notes || ''
    };

    // Save to pending transactions
    const pending = getPendingTransactions();
    pending.unshift(transaction);
    savePendingTransactions(pending);

    return {
      success: true,
      transaction,
      message: 'Withdrawal request submitted. Awaiting admin approval.'
    };
  },

  // Get user's pending transactions
  async getPendingTransactions(accountId = null) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId || user.id;
    }

    if (!accountId) {
      return { success: false, error: 'Not logged in' };
    }

    const allPending = getPendingTransactions();
    const userPending = allPending.filter(tx => tx.accountId === accountId);

    return {
      success: true,
      transactions: userPending
    };
  },

  // Get all transactions including pending (for user view)
  async getAllUserTransactions(accountId = null) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('team33_user') || localStorage.getItem('user') || '{}');
      accountId = user.accountId || user.id;
    }

    if (!accountId) {
      return { success: false, error: 'Not logged in' };
    }

    // Get completed transactions from wallet
    const walletTx = await this.getTransactions({ accountId });
    const completedTx = walletTx.success ? walletTx.transactions : [];

    // Get pending transactions
    const allPending = getPendingTransactions();
    const userPending = allPending.filter(tx => tx.accountId === accountId);

    // Get all transactions history
    const allHistoryStr = localStorage.getItem('team33_all_transactions');
    const allHistory = allHistoryStr ? JSON.parse(allHistoryStr) : [];
    const userHistory = allHistory.filter(tx => tx.accountId === accountId);

    // Combine and sort by date
    const allTransactions = [...userPending, ...userHistory, ...completedTx]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      success: true,
      transactions: allTransactions
    };
  }
};

export default walletService;
