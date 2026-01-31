/**
 * Account Service - User account management
 * JWT auth is handled by the Vercel serverless proxy (server-side)
 *
 * Endpoints:
 * - POST /api/accounts - Create account
 * - GET /api/accounts/{accountId} - Get account by ID
 * - GET /api/accounts/phone/{phoneNumber} - Get account by phone
 * - GET /api/accounts/{accountId}/balance - Get wallet balance
 */

// Format phone number to E.164 format (+61...)
const formatPhoneNumber = (phone) => {
  if (!phone) return phone;
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    return '+61' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('61')) {
    return '+61' + cleaned;
  }
  return '+' + cleaned;
};

class AccountService {
  /**
   * Create a new account
   * POST /api/accounts
   */
  async createAccount({ firstName, lastName, phoneNumber, password, email }) {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      // Generate email from phone if not provided
      const userEmail = email || `${formattedPhone.replace('+', '')}@team33.mx`;

      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          phoneNumber: formattedPhone,
          password,
          email: userEmail,
        }),
      });

      // Handle empty or non-JSON responses
      let data = {};
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          data = await response.json();
        }
      } catch (e) {
        // Empty response body
      }

      if (response.status === 201 || response.ok) {
        return {
          success: true,
          account: data,
          accountId: data.accountId,
        };
      }

      // Handle specific error codes
      if (response.status === 401) {
        return {
          success: false,
          error: 'Authentication failed. Please try again.',
          code: 'UNAUTHORIZED',
        };
      }

      if (response.status === 409) {
        return {
          success: false,
          error: 'An account with this phone number already exists.',
          code: 'DUPLICATE',
        };
      }

      if (response.status === 503) {
        return {
          success: false,
          error: data.error || 'Service temporarily unavailable. Please try again later.',
          code: 'SERVICE_UNAVAILABLE',
        };
      }

      return {
        success: false,
        error: data.message || data.error || 'Failed to create account',
      };
    } catch (error) {
      console.error('[AccountService] Create error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  /**
   * Get account by ID
   * GET /api/accounts/{accountId}
   */
  async getAccount(accountId) {
    try {
      const response = await fetch(`/api/accounts/${accountId}`);

      if (!response.ok) {
        return { success: false, error: 'Account not found' };
      }

      const data = await response.json();
      return { success: true, account: data };
    } catch (error) {
      console.error('[AccountService] Get error:', error);
      return { success: false, error: 'Failed to fetch account' };
    }
  }

  /**
   * Get account by phone number
   * GET /api/accounts/phone/{phoneNumber}
   */
  async getAccountByPhone(phoneNumber) {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Don't URL-encode the phone - backend expects raw +61... format
      const response = await fetch(
        `/api/accounts/phone/${formattedPhone}`
      );

      if (!response.ok) {
        return { success: false, error: 'Account not found' };
      }

      const data = await response.json();
      return { success: true, account: data };
    } catch (error) {
      console.error('[AccountService] Get by phone error:', error);
      return { success: false, error: 'Failed to fetch account' };
    }
  }

  /**
   * Get wallet balance
   * GET /api/accounts/{accountId}/balance
   */
  async getBalance(accountId) {
    try {
      const response = await fetch(`/api/accounts/${accountId}/balance`);

      if (!response.ok) {
        return { success: false, error: 'Failed to get balance', balance: 0 };
      }

      const data = await response.json();
      return {
        success: true,
        balance: data.balance ?? 0,
        currency: data.currency || 'AUD',
      };
    } catch (error) {
      console.error('[AccountService] Balance error:', error);
      return { success: false, error: 'Failed to fetch balance', balance: 0 };
    }
  }

  /**
   * Delete account
   * DELETE /api/accounts/{accountId}
   */
  async deleteAccount(accountId) {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        return { success: false, error: 'Failed to delete account' };
      }

      return { success: true };
    } catch (error) {
      console.error('[AccountService] Delete error:', error);
      return { success: false, error: 'Failed to delete account' };
    }
  }
}

export const accountService = new AccountService();
export default accountService;
