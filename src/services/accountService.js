/**
 * Account Service - User account management
 * REQUIRES JWT authentication from Keycloak for all endpoints
 *
 * Endpoints:
 * - POST /api/accounts - Create account (REQUIRES JWT)
 * - GET /api/accounts/{accountId} - Get account by ID (REQUIRES JWT)
 * - GET /api/accounts/phone/{phoneNumber} - Get account by phone (REQUIRES JWT)
 * - GET /api/accounts/{accountId}/balance - Get wallet balance (REQUIRES JWT)
 */

import { keycloakService } from './keycloakService';

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
   * Get headers with JWT Bearer token from Keycloak
   * Returns null if token fetch fails (Keycloak down)
   */
  async getAuthHeaders() {
    const authHeader = await keycloakService.getAuthHeader();

    // Check if we got a token
    if (!authHeader.Authorization) {
      console.error('[AccountService] Failed to get JWT - Keycloak may be unavailable');
      return null;
    }

    return {
      'Content-Type': 'application/json',
      ...authHeader,
    };
  }

  /**
   * Create a new account
   * POST /api/accounts
   * REQUIRES: JWT token from Keycloak
   */
  async createAccount({ firstName, lastName, phoneNumber, password }) {
    try {
      // Step 1: Get JWT token from Keycloak
      const headers = await this.getAuthHeaders();

      if (!headers) {
        return {
          success: false,
          error: 'Authentication service unavailable. Please try again later.',
          code: 'TOKEN_UNAVAILABLE',
        };
      }

      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Step 2: Call API with JWT in Authorization header
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          firstName,
          lastName,
          phoneNumber: formattedPhone,
          password,
        }),
      });

      // Handle empty responses (some 401s return no body)
      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (e) {
          data = { message: response.statusText };
        }
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
          error: 'Authentication failed. The service may be temporarily unavailable.',
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
      const headers = await this.getAuthHeaders();

      if (!headers) {
        return { success: false, error: 'Authentication service unavailable' };
      }

      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'GET',
        headers,
      });

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
      const headers = await this.getAuthHeaders();

      if (!headers) {
        return { success: false, error: 'Authentication service unavailable' };
      }

      const formattedPhone = formatPhoneNumber(phoneNumber);

      const response = await fetch(
        `/api/accounts/phone/${encodeURIComponent(formattedPhone)}`,
        {
          method: 'GET',
          headers,
        }
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
      const headers = await this.getAuthHeaders();

      if (!headers) {
        // Return 0 balance instead of crashing
        return { success: false, error: 'Auth unavailable', balance: 0 };
      }

      const response = await fetch(`/api/accounts/${accountId}/balance`, {
        method: 'GET',
        headers,
      });

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
      const headers = await this.getAuthHeaders();

      if (!headers) {
        return { success: false, error: 'Authentication service unavailable' };
      }

      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
        headers,
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
