

/**
 * API Configuration
 *
 * Environment Variables:
 * ======================
 * VITE_API_KEY - API key for authenticated endpoints (required for production)
 *
 * API Routing:
 * ============
 * All API calls use relative URLs (/api/...) which are proxied:
 * - Development: vite.config.js proxy rules
 * - Production: vercel.json rewrite rules
 *
 * Backend Endpoints (proxied through /api):
 * - Accounts: /api/accounts/* -> k8s-team33-accounts ELB
 * - Deposits: /api/deposits/* -> k8s-team33-accounts ELB
 * - Withdrawals: /api/withdrawals/* -> k8s-team33-accounts ELB
 * - Banks: /api/banks/* -> k8s-team33-accounts ELB
 * - Chat: /api/chat/* -> k8s-team33-accounts ELB
 * - OTP: /api/otp/* -> k8s-team33-accounts ELB
 * - Games: /api/games/* -> api.team33.mx
 */

// API key is NO LONGER USED - Backend only accepts Keycloak JWT tokens
// Kept for backwards compatibility but will be empty
export const API_KEY = '';

// Base URL is empty - all requests use relative URLs that get proxied
const API_BASE_URL = '';

// LocalStorage keys
export const STORAGE_KEYS = {
  USER: 'team33_user',
  TOKEN: 'team33_token',
  CHECKIN: 'team33_checkin',
  TRANSACTIONS: 'team33_transactions',
  SETTINGS: 'team33_settings'
};

// Helper to get stored data
export const getStoredData = (key, defaultValue = null) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
};

// Helper to set stored data
export const setStoredData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};

// Helper to remove stored data
export const removeStoredData = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

// ==================== TOKEN MANAGEMENT ====================
// Access token key (separate from legacy token)
const ACCESS_TOKEN_KEY = 'accessToken';

// Get access token from localStorage
export const getAccessToken = () => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

// Set access token in localStorage
export const setAccessToken = (token) => {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    return true;
  }
  return false;
};

// Clear access token from localStorage
export const clearAccessToken = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
};

// Check if token exists (basic check - doesn't validate expiry)
export const hasAccessToken = () => {
  return !!getAccessToken();
};

// Parse JWT token to get payload (for checking expiry, etc.)
export const parseJwtToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

// Check if token is expired
export const isTokenExpired = (token) => {
  const payload = parseJwtToken(token);
  if (!payload || !payload.exp) return true;
  // exp is in seconds, Date.now() is in milliseconds
  return Date.now() >= payload.exp * 1000;
};

// Get auth token (combines legacy and new token check)
const getToken = () => {
  // First check new accessToken
  const accessToken = getAccessToken();
  if (accessToken && !isTokenExpired(accessToken)) {
    return accessToken;
  }
  // Fall back to legacy token storage
  return getStoredData(STORAGE_KEYS.TOKEN);
};

// ==================== API CLIENT ====================
// API client with auth header support
export const apiClient = {
  async request(endpoint, options = {}) {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || data.error || 'Request failed'
        };
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        data: null,
        message: error.message || 'Network error'
      };
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// Format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

// Format date
export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
};

// Legacy helpers for backwards compatibility
export const createResponse = (data, success = true, message = '') => ({
  success,
  data,
  message,
  timestamp: Date.now()
});

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export const simulateDelay = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
