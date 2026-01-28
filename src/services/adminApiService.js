/**
 * Admin API Service
 * Handles authenticated API calls using Keycloak JWT tokens
 */
import { keycloakService } from './keycloakService';

// API base for admin endpoints (proxied through Vite/Vercel)
const ADMIN_API_BASE = '/api/admin';

class AdminApiService {
  /**
   * Get headers with JWT authorization
   */
  async getAuthHeaders() {
    const token = await keycloakService.getValidToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Make authenticated API request
   */
  async request(endpoint, options = {}) {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      // Handle 401 - token expired or invalid
      if (response.status === 401) {
        // Try to refresh token
        const refreshResult = await keycloakService.refreshToken();
        if (refreshResult.success) {
          // Retry request with new token
          const newHeaders = await this.getAuthHeaders();
          const retryResponse = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
            ...options,
            headers: {
              ...newHeaders,
              ...options.headers,
            },
          });
          return this.handleResponse(retryResponse);
        }
        return {
          success: false,
          error: 'Session expired. Please login again.',
          sessionExpired: true,
        };
      }

      return this.handleResponse(response);
    } catch (error) {
      console.error('Admin API error:', error);
      if (error.message === 'Not authenticated') {
        return {
          success: false,
          error: 'Not authenticated. Please login.',
          sessionExpired: true,
        };
      }
      return {
        success: false,
        error: error.message || 'Network error',
      };
    }
  }

  /**
   * Handle API response
   */
  async handleResponse(response) {
    try {
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `Request failed with status ${response.status}`,
          status: response.status,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (e) {
      // Response might not be JSON
      if (response.ok) {
        return { success: true, data: null };
      }
      return {
        success: false,
        error: `Request failed with status ${response.status}`,
        status: response.status,
      };
    }
  }

  // HTTP methods
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ==================== DEPOSITS ====================

  /**
   * Get pending deposits
   */
  async getPendingDeposits() {
    return this.get('/deposits/pending');
  }

  /**
   * Get all deposits with optional filters
   */
  async getDeposits(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.accountId) params.append('accountId', filters.accountId);
    const query = params.toString();
    return this.get(`/deposits${query ? `?${query}` : ''}`);
  }

  /**
   * Approve a deposit
   */
  async approveDeposit(depositId, notes = '') {
    return this.post(`/deposits/${depositId}/approve`, { adminNotes: notes });
  }

  /**
   * Reject a deposit
   */
  async rejectDeposit(depositId, reason) {
    return this.post(`/deposits/${depositId}/reject`, { reason });
  }

  // ==================== WITHDRAWALS ====================

  /**
   * Get pending withdrawals
   */
  async getPendingWithdrawals() {
    return this.get('/withdrawals/pending');
  }

  /**
   * Get all withdrawals with optional filters
   */
  async getWithdrawals(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.accountId) params.append('accountId', filters.accountId);
    const query = params.toString();
    return this.get(`/withdrawals${query ? `?${query}` : ''}`);
  }

  /**
   * Approve a withdrawal
   */
  async approveWithdrawal(withdrawalId, notes = '') {
    return this.post(`/withdrawals/${withdrawalId}/approve`, { adminNotes: notes });
  }

  /**
   * Reject a withdrawal
   */
  async rejectWithdrawal(withdrawalId, reason) {
    return this.post(`/withdrawals/${withdrawalId}/reject`, { reason });
  }

  // ==================== ACCOUNTS ====================

  /**
   * Get all accounts
   */
  async getAccounts() {
    return this.get('/accounts');
  }

  /**
   * Get account by ID
   */
  async getAccount(accountId) {
    return this.get(`/accounts/${accountId}`);
  }

  /**
   * Update account status
   */
  async updateAccountStatus(accountId, status) {
    return this.patch(`/accounts/${accountId}/status`, { status });
  }

  // ==================== BANKS ====================

  /**
   * Get all banks
   */
  async getBanks() {
    return this.get('/banks');
  }

  /**
   * Add new bank
   */
  async addBank(bankData) {
    return this.post('/banks', bankData);
  }

  /**
   * Update bank
   */
  async updateBank(bankId, bankData) {
    return this.put(`/banks/${bankId}`, bankData);
  }

  /**
   * Delete bank
   */
  async deleteBank(bankId) {
    return this.delete(`/banks/${bankId}`);
  }

  // ==================== REPORTS ====================

  /**
   * Get dashboard stats
   */
  async getDashboardStats() {
    return this.get('/reports/dashboard');
  }

  /**
   * Get transaction report
   */
  async getTransactionReport(startDate, endDate) {
    return this.get(`/reports/transactions?startDate=${startDate}&endDate=${endDate}`);
  }
}

export const adminApiService = new AdminApiService();
export default adminApiService;
