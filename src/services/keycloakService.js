/**
 * Keycloak Authentication Service
 * Handles admin/staff authentication via Keycloak OAuth2
 */

// Keycloak configuration from environment variables
const KEYCLOAK_URL_EXTERNAL = import.meta.env.VITE_KEYCLOAK_URL || 'http://k8s-team33-keycloak-320152ed2f-65380cdab2265c8a.elb.ap-southeast-2.amazonaws.com';
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'Team33Casino';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'Team33admin';
const KEYCLOAK_CLIENT_SECRET = import.meta.env.VITE_KEYCLOAK_CLIENT_SECRET || '';

// Use proxy URL in development to avoid CORS issues
const isDev = import.meta.env.DEV;
const KEYCLOAK_URL = isDev ? '/auth/keycloak' : KEYCLOAK_URL_EXTERNAL;

// Storage keys
const ADMIN_TOKEN_KEY = 'team33_admin_token';
const ADMIN_REFRESH_TOKEN_KEY = 'team33_admin_refresh_token';
const ADMIN_USER_KEY = 'team33_admin_user';
const TOKEN_EXPIRY_KEY = 'team33_admin_token_expiry';

// Token endpoint
const getTokenEndpoint = () =>
  `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

// Parse JWT token to extract payload
const parseJwt = (token) => {
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

// Extract user info from token
const extractUserFromToken = (token) => {
  const payload = parseJwt(token);
  if (!payload) return null;

  return {
    id: payload.sub,
    username: payload.preferred_username,
    name: payload.name || payload.preferred_username,
    email: payload.email,
    roles: payload.realm_access?.roles || [],
    isAdmin: payload.realm_access?.roles?.includes('admin') || false,
    isStaff: payload.realm_access?.roles?.includes('staff') || false,
  };
};

class KeycloakService {
  constructor() {
    this.tokenRefreshTimer = null;
  }

  /**
   * Login with username and password (Resource Owner Password Grant)
   */
  async login(username, password) {
    try {
      const response = await fetch(getTokenEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: KEYCLOAK_CLIENT_ID,
          client_secret: KEYCLOAK_CLIENT_SECRET,
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error_description || data.error || 'Login failed',
        };
      }

      // Store tokens
      this.storeTokens(data);

      // Extract user from token
      const user = extractUserFromToken(data.access_token);

      // Store user info
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));

      // Setup auto-refresh
      this.setupTokenRefresh(data.expires_in);

      return {
        success: true,
        user,
        accessToken: data.access_token,
      };
    } catch (error) {
      console.error('Keycloak login error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  /**
   * Store tokens in localStorage
   */
  storeTokens(tokenData) {
    localStorage.setItem(ADMIN_TOKEN_KEY, tokenData.access_token);
    if (tokenData.refresh_token) {
      localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, tokenData.refresh_token);
    }
    // Store expiry time (current time + expires_in seconds)
    const expiryTime = Date.now() + (tokenData.expires_in * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  /**
   * Get stored access token
   */
  getAccessToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  /**
   * Get stored refresh token
   */
  getRefreshToken() {
    return localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
  }

  /**
   * Check if token is expired or about to expire (within 30 seconds)
   */
  isTokenExpired() {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return true;
    return Date.now() > (parseInt(expiry) - 30000);
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    try {
      const response = await fetch(getTokenEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: KEYCLOAK_CLIENT_ID,
          client_secret: KEYCLOAK_CLIENT_SECRET,
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Refresh token expired or invalid - user needs to re-login
        this.logout();
        return {
          success: false,
          error: 'Session expired. Please login again.',
          sessionExpired: true,
        };
      }

      // Store new tokens
      this.storeTokens(data);

      // Update user info
      const user = extractUserFromToken(data.access_token);
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));

      // Setup next refresh
      this.setupTokenRefresh(data.expires_in);

      return {
        success: true,
        accessToken: data.access_token,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        error: 'Failed to refresh session.',
      };
    }
  }

  /**
   * Setup automatic token refresh
   */
  setupTokenRefresh(expiresIn) {
    // Clear existing timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // Refresh 60 seconds before expiry
    const refreshTime = (expiresIn - 60) * 1000;
    if (refreshTime > 0) {
      this.tokenRefreshTimer = setTimeout(() => {
        this.refreshToken();
      }, refreshTime);
    }
  }

  /**
   * Get valid access token (refreshes if needed)
   */
  async getValidToken() {
    if (this.isTokenExpired()) {
      const result = await this.refreshToken();
      if (!result.success) {
        return null;
      }
      return result.accessToken;
    }
    return this.getAccessToken();
  }

  /**
   * Logout - clear all tokens and user data
   */
  logout() {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  /**
   * Get current admin user
   */
  getCurrentUser() {
    try {
      const userJson = localStorage.getItem(ADMIN_USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const token = this.getAccessToken();
    const user = this.getCurrentUser();
    return token && user && !this.isTokenExpired();
  }

  /**
   * Check if user has admin role
   */
  isAdmin() {
    const user = this.getCurrentUser();
    return user?.isAdmin || false;
  }

  /**
   * Check if user has staff role
   */
  isStaff() {
    const user = this.getCurrentUser();
    return user?.isStaff || false;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    const user = this.getCurrentUser();
    return user?.roles?.includes(role) || false;
  }

  /**
   * Initialize service - check for existing session and setup refresh
   */
  async init() {
    const token = this.getAccessToken();
    if (!token) return false;

    if (this.isTokenExpired()) {
      const result = await this.refreshToken();
      return result.success;
    }

    // Token is valid, setup refresh timer
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (expiry) {
      const remainingTime = parseInt(expiry) - Date.now();
      if (remainingTime > 0) {
        this.setupTokenRefresh(remainingTime / 1000);
      }
    }

    return true;
  }
}

export const keycloakService = new KeycloakService();
export default keycloakService;
