// Wallet Service - Wallet management via external API with localStorage fallback
const API_KEY = 'team33-admin-secret-key-change-in-prod';
const LOCAL_WALLETS_KEY = 'team33_local_wallets';
const DEFAULT_BALANCE = 0; // Users must deposit via agent/admin

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
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

const isLocalAccount = (accountId) => {
  return accountId && accountId.startsWith('local_');
};

export const walletService = {
  // Create wallet for an account
  async createWallet(accountId) {
    // For local accounts, create local wallet
    if (isLocalAccount(accountId)) {
      const existingWallet = getLocalWallet(accountId);
      if (existingWallet) {
        return { success: true, wallet: existingWallet, data: existingWallet };
      }

      const wallet = {
        accountId,
        balance: DEFAULT_BALANCE,
        currency: 'AUD',
        transactions: [],
        createdAt: new Date().toISOString(),
      };
      saveLocalWallet(accountId, wallet);
      return { success: true, wallet, data: wallet };
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

    // For local accounts, get balance from localStorage
    if (isLocalAccount(accountId)) {
      let wallet = getLocalWallet(accountId);
      if (!wallet) {
        // Create wallet if doesn't exist
        wallet = {
          accountId,
          balance: DEFAULT_BALANCE,
          currency: 'AUD',
          transactions: [],
          createdAt: new Date().toISOString(),
        };
        saveLocalWallet(accountId, wallet);
      }
      return {
        success: true,
        data: {
          balance: wallet.balance,
          currency: wallet.currency || 'AUD',
          total: wallet.balance,
          available: wallet.balance,
        },
        balance: wallet.balance,
        currency: wallet.currency || 'AUD',
      };
    }

    try {
      const response = await fetch(`/api/wallets/${accountId}/balance`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to get balance' };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          balance: data.balance,
          currency: data.currency,
          total: data.balance,
          available: data.balance,
        },
        balance: data.balance,
        currency: data.currency,
      };
    } catch (error) {
      console.error('Get balance error:', error);
      return {
        success: false,
        error: 'Failed to fetch balance',
      };
    }
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
      const response = await fetch(`/api/wallets/${accountId}/deposit`, {
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
      const response = await fetch(`/api/wallets/${accountId}/withdraw`, {
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
      let url = `/api/wallets/${accountId}/transactions?page=${page}&size=${pageSize}`;
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
};

export default walletService;
