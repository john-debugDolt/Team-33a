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
  // Uses backend API: GET /api/accounts/{accountId}/balance
  // Backend handles all balance changes - we just fetch and display
  async getBalance(accountId) {
    // If no accountId provided, try to get from localStorage
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'No account ID' };
    }

    // Check for local wallet (for fallback/cache)
    const localWallet = getLocalWallet(accountId);

    // Try backend API first - this is the source of truth
    try {
      const response = await fetch(`/api/accounts/${accountId}/balance`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        // Backend returns: { accountId, balance, currency }
        const apiBalance = data.balance != null ? Number(data.balance) : null;
        const currency = data.currency || 'AUD';

        // If API returns valid balance, use it and update local cache
        if (apiBalance != null) {
          // Update local wallet cache
          if (localWallet) {
            localWallet.balance = apiBalance;
            localWallet.updatedAt = new Date().toISOString();
            saveLocalWallet(accountId, localWallet);
          } else {
            // Create local cache
            saveLocalWallet(accountId, {
              accountId,
              balance: apiBalance,
              currency,
              transactions: [],
              createdAt: new Date().toISOString(),
            });
          }

          // Update user object in localStorage
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          if (user.accountId === accountId) {
            user.balance = apiBalance;
            localStorage.setItem('user', JSON.stringify(user));
          }

          return {
            success: true,
            data: {
              balance: apiBalance,
              currency: currency,
              total: apiBalance,
              available: apiBalance,
            },
            balance: apiBalance,
            currency: currency,
            source: 'api',
          };
        }
      }

      // API returned error or null balance - fall through to localStorage fallback
      console.log('Balance API returned null or error, using localStorage cache');
    } catch (error) {
      console.log('Balance API unavailable, using localStorage cache:', error.message);
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

  // Daily check-in rewards by day
  _checkInRewards: [10, 20, 30, 50, 75, 100, 200],

  // Get check-in data from localStorage
  _getCheckInData(accountId) {
    try {
      const key = `team33_checkin_${accountId}`;
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      return data;
    } catch {
      return {};
    }
  },

  // Save check-in data to localStorage
  _saveCheckInData(accountId, data) {
    const key = `team33_checkin_${accountId}`;
    localStorage.setItem(key, JSON.stringify(data));
  },

  // Check if it's a new day since last check-in
  _isNewDay(lastCheckIn) {
    if (!lastCheckIn) return true;
    const last = new Date(lastCheckIn);
    const now = new Date();
    return last.toDateString() !== now.toDateString();
  },

  // Check-in status - returns current streak and availability
  async getCheckInStatus(accountId) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'No account ID' };
    }

    const checkInData = this._getCheckInData(accountId);
    const isNewDay = this._isNewDay(checkInData.lastCheckIn);

    // Check if streak is broken (more than 24 hours since last check-in)
    let currentStreak = checkInData.currentStreak || 0;
    let currentDay = checkInData.currentDay || 1;

    if (checkInData.lastCheckIn) {
      const lastDate = new Date(checkInData.lastCheckIn);
      const now = new Date();
      const daysDiff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

      // If more than 1 day missed, reset streak
      if (daysDiff > 1) {
        currentStreak = 0;
        currentDay = 1;
      }
    }

    // Calculate next reward (day index is 0-based)
    const nextRewardIndex = Math.min(currentDay - 1, this._checkInRewards.length - 1);
    const nextReward = this._checkInRewards[nextRewardIndex];

    return {
      success: true,
      data: {
        currentDay,
        currentStreak,
        checkedDays: checkInData.checkedDays || [],
        canCheckIn: isNewDay,
        isCheckedToday: !isNewDay,
        nextReward,
        lastCheckIn: checkInData.lastCheckIn,
      },
    };
  },

  // Perform daily check-in and credit bonus to balance
  async checkIn(accountId) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'Please log in to check in' };
    }

    // Get current status
    const status = await this.getCheckInStatus(accountId);
    if (!status.success) {
      return status;
    }

    if (!status.data.canCheckIn) {
      return {
        success: false,
        error: 'You have already checked in today. Come back tomorrow!',
      };
    }

    // Calculate reward
    const checkInData = this._getCheckInData(accountId);
    let currentStreak = checkInData.currentStreak || 0;
    let currentDay = checkInData.currentDay || 1;

    // Check if streak is broken
    if (checkInData.lastCheckIn) {
      const lastDate = new Date(checkInData.lastCheckIn);
      const now = new Date();
      const daysDiff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      if (daysDiff > 1) {
        currentStreak = 0;
        currentDay = 1;
      }
    }

    const rewardIndex = Math.min(currentDay - 1, this._checkInRewards.length - 1);
    const reward = this._checkInRewards[rewardIndex];

    // Credit the reward to balance
    const depositResult = await this.deposit(reward, 'daily_bonus', accountId);

    if (!depositResult.success) {
      // Try direct balance update if deposit fails
      const balanceResult = await this.getBalance(accountId);
      if (balanceResult.success) {
        const newBalance = (balanceResult.balance || 0) + reward;
        await this.updateBalance(newBalance, accountId);
      }
    }

    // Update check-in data
    const newCheckedDays = [...(checkInData.checkedDays || [])];
    if (!newCheckedDays.includes(currentDay)) {
      newCheckedDays.push(currentDay);
    }

    // Move to next day (cycle back to 1 after day 7)
    const nextDay = currentDay >= 7 ? 1 : currentDay + 1;
    const newStreak = currentStreak + 1;

    // If completed 7 days, reset for next week
    const finalCheckedDays = currentDay >= 7 ? [] : newCheckedDays;

    this._saveCheckInData(accountId, {
      currentDay: nextDay,
      currentStreak: newStreak,
      checkedDays: finalCheckedDays,
      lastCheckIn: new Date().toISOString(),
    });

    // Record transaction
    await this.recordTransaction({
      type: 'bonus',
      amount: reward,
      description: `Day ${currentDay} check-in bonus`,
      accountId,
    });

    // Get updated balance
    const newBalanceResult = await this.getBalance(accountId);

    return {
      success: true,
      message: `🎉 Day ${currentDay} bonus claimed! +$${reward}`,
      data: {
        reward,
        currentDay: nextDay,
        currentStreak: newStreak,
        checkedDays: finalCheckedDays,
        balance: newBalanceResult.success ? newBalanceResult.balance : null,
      },
    };
  },

  // Alias for backwards compatibility
  async dailyCheckIn(accountId) {
    return this.checkIn(accountId);
  },

  // Daily spin wheel - credit winnings to balance
  async spinWheel(accountId, prizeAmount) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'Please log in to spin' };
    }

    // Check if already spun today
    const lastSpinKey = `team33_lastspin_${accountId}`;
    const lastSpin = localStorage.getItem(lastSpinKey);
    const today = new Date().toDateString();

    if (lastSpin === today) {
      return {
        success: false,
        error: 'You have already used your free spin today!',
      };
    }

    // Credit the prize
    const depositResult = await this.deposit(prizeAmount, 'spin_bonus', accountId);

    if (!depositResult.success) {
      // Try direct balance update
      const balanceResult = await this.getBalance(accountId);
      if (balanceResult.success) {
        const newBalance = (balanceResult.balance || 0) + prizeAmount;
        await this.updateBalance(newBalance, accountId);
      }
    }

    // Mark as spun today
    localStorage.setItem(lastSpinKey, today);

    // Record transaction
    await this.recordTransaction({
      type: 'bonus',
      amount: prizeAmount,
      description: 'Daily spin wheel prize',
      accountId,
    });

    // Get updated balance
    const newBalanceResult = await this.getBalance(accountId);

    const newBalance = newBalanceResult.success ? newBalanceResult.balance : null;
    return {
      success: true,
      message: `🎰 You won $${prizeAmount}!`,
      newBalance: newBalance,
      data: {
        prize: prizeAmount,
        balance: newBalance,
      },
    };
  },

  // Check if user can spin today
  canSpinToday(accountId) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) return false;

    const lastSpinKey = `team33_lastspin_${accountId}`;
    const lastSpin = localStorage.getItem(lastSpinKey);
    const today = new Date().toDateString();

    return lastSpin !== today;
  },

  // Record a transaction to localStorage
  async recordTransaction({ type, amount, description, accountId }) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) return;

    const localWallet = getLocalWallet(accountId);
    if (localWallet) {
      const transaction = {
        id: generateTransactionId(),
        type,
        amount,
        description,
        status: 'completed',
        createdAt: new Date().toISOString(),
      };

      localWallet.transactions = localWallet.transactions || [];
      localWallet.transactions.unshift(transaction);

      // Keep only last 100 transactions
      if (localWallet.transactions.length > 100) {
        localWallet.transactions = localWallet.transactions.slice(0, 100);
      }

      saveLocalWallet(accountId, localWallet);
    }
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
  // IMPORTANT: Always saves to local wallet as backup for ALL accounts
  async updateBalance(newBalance, accountId = null) {
    if (!accountId) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      accountId = user.accountId;
    }

    if (!accountId) {
      return { success: false, error: 'No account ID' };
    }

    // ALWAYS update local wallet as backup (for ALL accounts, not just local)
    // This prevents balance loss when API is unavailable
    let wallet = getLocalWallet(accountId);
    if (!wallet) {
      wallet = { accountId, balance: DEFAULT_BALANCE, currency: 'AUD', transactions: [] };
    }
    wallet.balance = Number(newBalance);
    wallet.updatedAt = new Date().toISOString();
    saveLocalWallet(accountId, wallet);

    // Also update user in localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.accountId === accountId) {
      user.balance = wallet.balance;
      localStorage.setItem('user', JSON.stringify(user));
    }

    return { success: true, balance: wallet.balance };
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
    if (withdrawAmount < 10) {
      return { success: false, error: 'Minimum withdrawal is $10' };
    }
    if (withdrawAmount > 50000) {
      return { success: false, error: 'Maximum withdrawal is $50,000' };
    }

    // Validate bank details - either BSB + Account Number OR PayID required
    const hasBankAccount = bankDetails.bsb && bankDetails.accountNumber;
    const hasPayId = bankDetails.payId;

    if (!hasBankAccount && !hasPayId) {
      return { success: false, error: 'Please provide bank account details (BSB + Account Number) or PayID' };
    }

    try {
      // Call the withdrawal API
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: accountId,
          amount: withdrawAmount,
          bankName: bankDetails.bankName || bankDetails.bank || 'Bank Transfer',
          accountHolderName: bankDetails.accountHolderName || bankDetails.accountName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          bsb: bankDetails.bsb || undefined,
          accountNumber: bankDetails.accountNumber || undefined,
          payId: bankDetails.payId || undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          withdrawId: data.withdrawId,
          status: data.status,
          balanceBefore: data.balanceBefore,
          balanceAfter: data.balanceAfter,
          message: data.message || 'Withdrawal request submitted. Awaiting admin approval.'
        };
      }

      // Handle specific errors
      if (data.message?.includes('Insufficient balance')) {
        return {
          success: false,
          error: data.message,
          currentBalance: parseFloat(data.message.match(/Available: ([\d.]+)/)?.[1] || 0)
        };
      }

      return {
        success: false,
        error: data.message || 'Withdrawal request failed'
      };

    } catch (error) {
      console.error('Withdrawal API error:', error);

      // Fallback to localStorage if API fails
      const transaction = {
        id: generateTransactionId(),
        accountId: accountId,
        username: user.firstName ? `${user.firstName} ${user.lastName}` : user.username || accountId,
        phone: user.phoneNumber || user.phone || '',
        type: 'WITHDRAWAL',
        amount: withdrawAmount,
        bank: bankDetails.bankName || bankDetails.bank || 'N/A',
        bankAccount: bankDetails.accountNumber || '',
        bankName: bankDetails.accountHolderName || bankDetails.accountName || '',
        bsb: bankDetails.bsb || '',
        payId: bankDetails.payId || '',
        paymentMethod: paymentMethod,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: bankDetails.notes || ''
      };

      const pending = getPendingTransactions();
      pending.unshift(transaction);
      savePendingTransactions(pending);

      return {
        success: true,
        transaction,
        message: 'Withdrawal request submitted (offline mode). Awaiting admin approval.'
      };
    }
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
