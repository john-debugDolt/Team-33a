// Account Service - User account management via external API with localStorage fallback
const API_KEY = 'team33-admin-secret-key-change-in-prod';
const LOCAL_ACCOUNTS_KEY = 'team33_local_accounts';

// Generate unique Account ID (ACC-XXXXXX format)
const generateAccountId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ACC-${timestamp}${random}`;
};

// Generate unique User ID (UID-XXXXXXXX format)
const generateUserId = () => {
  const num = Math.floor(10000000 + Math.random() * 90000000);
  return `UID-${num}`;
};

class AccountService {
  constructor() {
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    };
  }

  // Get local accounts from localStorage
  getLocalAccounts() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  // Save account to localStorage
  saveLocalAccount(account) {
    const accounts = this.getLocalAccounts();
    accounts.push(account);
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  // Find local account by phone
  findLocalAccountByPhone(phoneNumber) {
    const accounts = this.getLocalAccounts();
    return accounts.find(acc => acc.phoneNumber === phoneNumber);
  }

  // Register a new account
  async register({ password, firstName, lastName, phoneNumber }) {
    try {
      // Try external API first
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          password,
          firstName,
          lastName,
          phoneNumber,
        }),
      });

      const data = await response.json();

      if (response.status === 201 || response.ok) {
        return {
          success: true,
          account: data,
          accountId: data.accountId,
          userId: data.userId || generateUserId(), // Generate userId if API doesn't return one
        };
      }

      // If external API fails with 401 or 404, use localStorage fallback
      if (response.status === 401 || response.status === 404) {
        console.log('External API unavailable (status ' + response.status + '), using localStorage fallback');
        return this.registerLocal({ password, firstName, lastName, phoneNumber });
      }

      return {
        success: false,
        error: data.error || data.message || 'Registration failed',
        field: data.field,
      };
    } catch (error) {
      console.error('Account registration error:', error);
      // Fallback to localStorage on network error
      console.log('Network error, using localStorage fallback');
      return this.registerLocal({ password, firstName, lastName, phoneNumber });
    }
  }

  // Register account locally (fallback)
  registerLocal({ password, firstName, lastName, phoneNumber }) {
    // Check if account already exists
    const existing = this.findLocalAccountByPhone(phoneNumber);
    if (existing) {
      return {
        success: false,
        error: 'An account with this phone number already exists',
      };
    }

    // Generate unique IDs
    const accountId = generateAccountId();
    const userId = generateUserId();

    // Create new local account
    const account = {
      accountId,
      userId,
      phoneNumber,
      firstName,
      lastName,
      password, // In production, this should be hashed
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      isLocal: true,
    };

    this.saveLocalAccount(account);

    return {
      success: true,
      account,
      accountId,
      userId,
      isLocal: true,
    };
  }

  // Get account by ID (with local fallback)
  async getAccount(accountId) {
    // Check local accounts first if it's a local ID
    if (accountId && accountId.startsWith('local_')) {
      const accounts = this.getLocalAccounts();
      const localAccount = accounts.find(acc => acc.accountId === accountId);
      if (localAccount) {
        return { success: true, account: localAccount };
      }
    }

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Account not found' };
      }

      const data = await response.json();
      return {
        success: true,
        account: data,
      };
    } catch (error) {
      console.error('Get account error:', error);
      return {
        success: false,
        error: 'Failed to fetch account details',
      };
    }
  }

  // Get account by phone (for login)
  async getAccountByPhone(phoneNumber) {
    // Check local accounts first
    const localAccount = this.findLocalAccountByPhone(phoneNumber);
    if (localAccount) {
      return { success: true, account: localAccount, isLocal: true };
    }

    // Try external API
    try {
      const response = await fetch(`/api/accounts/phone/${encodeURIComponent(phoneNumber)}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        return { success: false, error: 'Account not found' };
      }

      const data = await response.json();
      return { success: true, account: data };
    } catch (error) {
      return { success: false, error: 'Account not found' };
    }
  }

  // Login with phone and password
  async loginWithPhone(phoneNumber, password) {
    // Check local accounts first
    const localAccount = this.findLocalAccountByPhone(phoneNumber);
    if (localAccount) {
      if (localAccount.password === password) {
        return {
          success: true,
          account: localAccount,
          accountId: localAccount.accountId,
          isLocal: true,
        };
      }
      return { success: false, error: 'Invalid password' };
    }

    // Try external API - check if account exists by phone
    try {
      const encodedPhone = encodeURIComponent(phoneNumber);
      const response = await fetch(`/api/accounts/phone/${encodedPhone}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (response.ok) {
        const account = await response.json();
        // Account exists in backend - OTP will handle verification
        return {
          success: true,
          account: account,
          accountId: account.accountId,
          isExternal: true,
        };
      }

      if (response.status === 404) {
        return { success: false, error: 'Account not found' };
      }

      return { success: false, error: 'Failed to verify account' };
    } catch (error) {
      console.error('Login API error:', error);
      return { success: false, error: 'Connection error. Please try again.' };
    }
  }

  // Get account by email (kept for compatibility)
  async getAccountByEmail(email) {
    try {
      const response = await fetch(`/api/accounts/email/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Account not found' };
      }

      const data = await response.json();
      return {
        success: true,
        account: data,
      };
    } catch (error) {
      console.error('Get account by email error:', error);
      return {
        success: false,
        error: 'Failed to fetch account details',
      };
    }
  }

  // Update account information
  async updateAccount(accountId, updates) {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Update failed' };
      }

      const data = await response.json();
      return {
        success: true,
        account: data,
      };
    } catch (error) {
      console.error('Update account error:', error);
      return {
        success: false,
        error: 'Failed to update account',
      };
    }
  }

  // Deactivate account
  async deactivateAccount(accountId) {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
        headers: this.headers,
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Deactivation failed' };
      }

      const data = await response.json();
      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      console.error('Deactivate account error:', error);
      return {
        success: false,
        error: 'Failed to deactivate account',
      };
    }
  }

  // Validate password requirements
  validatePassword(password) {
    const errors = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain an uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain a lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain a number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Validate age (must be 18+)
  validateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return {
      valid: age >= 18,
      age,
    };
  }
}

export const accountService = new AccountService();
