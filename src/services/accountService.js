/**
 * Account Service - User account management
 * Public API - No authentication required
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
   * Required: firstName, lastName, phoneNumber, password
   */
  async createAccount({ firstName, lastName, phoneNumber, password }) {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          phoneNumber: formattedPhone,
          password,
        }),
      });

      const data = await response.json();

      if (response.status === 201 || response.ok) {
        return {
          success: true,
          account: data,
          accountId: data.accountId,
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
        error: 'Network error. Please try again.',
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
        const error = await response.json();
        return { success: false, error: error.message || 'Account not found' };
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

      const response = await fetch(
        `/api/accounts/phone/${encodeURIComponent(formattedPhone)}`
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
        return { success: false, error: 'Failed to get balance' };
      }

      const data = await response.json();
      return {
        success: true,
        balance: data.balance,
        currency: data.currency || 'AUD',
      };
    } catch (error) {
      console.error('[AccountService] Balance error:', error);
      return { success: false, error: 'Failed to fetch balance' };
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
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to delete' };
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
