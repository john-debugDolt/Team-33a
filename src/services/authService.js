import {
  STORAGE_KEYS,
  getStoredData,
  setStoredData,
  removeStoredData,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  isTokenExpired,
  parseJwtToken
} from './api';
import { keycloakService } from './keycloakService';

/**
 * Auth Service - Handles authentication state and token management
 *
 * Token-based authentication:
 * - accessToken is stored in localStorage
 * - Token is attached to all API requests
 * - Session is validated using token, not localStorage user data
 */
export const authService = {
  /**
   * Set auth token after login
   */
  setAuthToken(token) {
    setAccessToken(token);
  },

  /**
   * Clear auth token on logout
   */
  clearAuthToken() {
    clearAccessToken();
  },

  /**
   * Get current auth token
   */
  getAuthToken() {
    return getAccessToken();
  },

  /**
   * Check if user has valid token
   */
  hasValidToken() {
    const token = getAccessToken();
    if (!token) return false;
    return !isTokenExpired(token);
  },

  /**
   * Get user info from token
   */
  getUserFromToken() {
    const token = getAccessToken();
    if (!token) return null;
    return parseJwtToken(token);
  },

  /**
   * Login - primarily handled by accountService.loginWithPhone()
   * This is a fallback that checks localStorage for demo users
   */
  async login(username, password) {
    // Check localStorage for demo/legacy users
    const storedUser = getStoredData(STORAGE_KEYS.USER);
    if (storedUser && (storedUser.username === username || storedUser.email === username)) {
      return {
        success: true,
        data: { user: storedUser },
        message: 'Login successful'
      };
    }

    return {
      success: false,
      data: null,
      message: 'Account not found. Please register first.'
    };
  },

  /**
   * Signup - primarily handled by accountService.register()
   * This provides localStorage fallback
   */
  async signup(userData) {
    const { username, email, phone, password, confirmPassword } = userData;

    // Client-side validation
    if (password !== confirmPassword) {
      return { success: false, data: null, message: 'Passwords do not match' };
    }

    // Create local user for demo purposes
    const user = {
      id: `local_${Date.now()}`,
      username,
      email,
      phone,
      createdAt: new Date().toISOString(),
      balance: 0
    };

    setStoredData(STORAGE_KEYS.USER, user);

    return {
      success: true,
      data: { user },
      message: 'Account created successfully'
    };
  },

  /**
   * Logout - clears all auth-related localStorage including token
   */
  async logout() {
    // Clear Keycloak tokens first
    keycloakService.logout();
    // Clear access token
    clearAccessToken();
    // Clear legacy token storage
    removeStoredData(STORAGE_KEYS.USER);
    removeStoredData(STORAGE_KEYS.TOKEN);
    removeStoredData(STORAGE_KEYS.CHECKIN);
    removeStoredData(STORAGE_KEYS.TRANSACTIONS);
    // Clear external API user data
    localStorage.removeItem('user');
    localStorage.removeItem('accountId');
    localStorage.removeItem('userId');
    localStorage.removeItem('walletId');
    return { success: true, data: null, message: 'Logged out successfully' };
  },

  /**
   * Get current user from localStorage
   */
  async getCurrentUser() {
    // Check for external API user first
    const externalUser = localStorage.getItem('user');
    const accountId = localStorage.getItem('accountId');

    if (externalUser && accountId) {
      try {
        const user = JSON.parse(externalUser);
        return { success: true, data: { user } };
      } catch (e) {
        // Invalid JSON, continue to check legacy storage
      }
    }

    // Check legacy storage
    const storedUser = getStoredData(STORAGE_KEYS.USER);
    if (storedUser) {
      return { success: true, data: { user: storedUser } };
    }

    return { success: false, data: null, message: 'Not authenticated' };
  },

  /**
   * Forgot password - not implemented in current backend
   */
  async forgotPassword(email) {
    return {
      success: false,
      message: 'Password reset is not available. Please contact support.'
    };
  },

  /**
   * Update profile - updates localStorage user data
   */
  async updateProfile(updates) {
    const storedUser = getStoredData(STORAGE_KEYS.USER);
    if (!storedUser) {
      return { success: false, message: 'Not authenticated' };
    }

    const updatedUser = { ...storedUser, ...updates };
    setStoredData(STORAGE_KEYS.USER, updatedUser);

    return { success: true, data: updatedUser };
  },

  /**
   * Change password - not implemented in current backend
   */
  async changePassword(currentPassword, newPassword) {
    return {
      success: false,
      message: 'Password change is not available. Please contact support.'
    };
  }
};

export default authService;
