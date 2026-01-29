// Account Service - User account management via external API
// Uses X-API-Key header for authentication (NOT Keycloak Bearer token)

// API Key for accounts backend (matches api/accounts/index.js)
const API_KEY = 'team33-admin-secret-key-2024';

// Format phone number to international format (Australian +61)
const formatPhoneNumber = (phone) => {
  if (!phone) return phone;
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');

  // Already in international format
  if (cleaned.startsWith('+')) return cleaned;

  // Convert Australian format (0XXX) to +61XXX
  if (cleaned.startsWith('0')) {
    return '+61' + cleaned.substring(1);
  }

  // If just digits without 0, assume needs +61
  if (/^\d+$/.test(cleaned) && cleaned.length >= 9) {
    return '+61' + cleaned;
  }

  return cleaned;
};

// Generate unique User ID (UID-XXXXXXXX format) - fallback if backend doesn't return one
const generateUserId = () => {
  const num = Math.floor(10000000 + Math.random() * 90000000);
  return `UID-${num}`;
};

class AccountService {
  // Get headers with X-API-Key (required for all API calls)
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    };
  }

  // Register a new account (uses X-API-Key authentication)
  // Required fields: email, password, firstName, lastName, phoneNumber, dateOfBirth
  async register({ email, password, firstName, lastName, phoneNumber, dateOfBirth }) {
    try {
      // Format phone to international format
      const formattedPhone = formatPhoneNumber(phoneNumber);

      console.log('[AccountService] Registering with external API...');
      console.log('[AccountService] Endpoint: /api/accounts/register');

      const response = await fetch('/api/accounts/register', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          phoneNumber: formattedPhone,
          dateOfBirth, // Format: YYYY-MM-DD, must be 18+
        }),
      });

      const data = await response.json();
      console.log('[AccountService] Response:', response.status, data);

      if (response.status === 201 || response.ok) {
        return {
          success: true,
          account: data,
          accountId: data.accountId,
          userId: data.userId || generateUserId(),
        };
      }

      // Return error from backend
      return {
        success: false,
        error: data.error || data.message || `Registration failed (${response.status})`,
        field: data.field,
      };
    } catch (error) {
      console.error('Account registration error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  // Get account by ID
  async getAccount(accountId) {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'GET',
        headers: this.getHeaders(),
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
    // Format phone to international format
    const formattedPhone = formatPhoneNumber(phoneNumber);

    try {
      const url = `/api/accounts/phone/${encodeURIComponent(formattedPhone)}`;

      console.log('[AccountService] Getting account by phone from external API...');
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { success: false, error: 'Account not found' };
      }

      const data = await response.json();
      return { success: true, account: data };
    } catch (error) {
      console.error('Get account by phone error:', error);
      return { success: false, error: 'Account not found' };
    }
  }

  // Login with phone - checks if account exists in external API
  async loginWithPhone(phoneNumber) {
    // Format phone to international format
    const formattedPhone = formatPhoneNumber(phoneNumber);

    try {
      const encodedPhone = encodeURIComponent(formattedPhone);
      const url = `/api/accounts/phone/${encodedPhone}`;

      console.log('[AccountService] Login - checking account in external API...');
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
