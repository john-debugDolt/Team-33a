/**
 * Keycloak Authentication Service
 * Handles admin/staff authentication via Keycloak OAuth2
 */

// Keycloak configuration from environment variables
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'Team33Casino';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'Team33admin';
const KEYCLOAK_CLIENT_SECRET = import.meta.env.VITE_KEYCLOAK_CLIENT_SECRET || 'lxPLoQaJ7PCYJEJZwRuzelt0RHpKlCH0';

// ALWAYS use proxy URL to avoid CORS and mixed-content issues
// Dev: Vite proxy handles it, Prod: Vercel rewrites handle it
const KEYCLOAK_URL = '/auth/keycloak';

// Storage keys - use standard keys so all services can access the token
const TOKEN_KEY = 'team33_token';
const ACCESS_TOKEN_KEY = 'accessToken'; // Key used by all frontend services
const REFRESH_TOKEN_KEY = 'team33_refresh_token';
const USER_KEY = 'team33_admin_user';
const TOKEN_EXPIRY_KEY = 'team33_token_expiry';

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
   * Get token using client credentials (for service-to-service auth)
   * Call this after OTP verification to get a JWT for API calls
   */
  async getServiceToken() {
    console.log('[Keycloak] Getting service token via client credentials...');

    // Add timeout to prevent app from hanging if Keycloak is unreachable
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(getTokenEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: KEYCLOAK_CLIENT_ID,
          client_secret: KEYCLOAK_CLIENT_SECRET,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();
      console.log('[Keycloak] Response status:', response.status);

      if (!response.ok) {
        console.error('[Keycloak] Token error:', data);
        return {
          success: false,
          error: data.error_description || data.error || 'Failed to get token',
        };
      }

      console.log('[Keycloak] Token received, expires in:', data.expires_in);

      // Store token
      this.storeTokens(data);

      // Setup auto-refresh
      this.setupTokenRefresh(data.expires_in);

      return {
        success: true,
        accessToken: data.access_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('[Keycloak] Request timeout - server not responding');
        return {
          success: false,
          error: 'Keycloak server timeout. App will work in offline mode.',
        };
      }
      console.error('[Keycloak] Network error:', error);
      return {
        success: false,
        error: `Network error: ${error.message}`,
      };
    }
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
      localStorage.setItem(USER_KEY, JSON.stringify(user));

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
    localStorage.setItem(TOKEN_KEY, tokenData.access_token);
    // Also store in accessToken key for all frontend services
    localStorage.setItem(ACCESS_TOKEN_KEY, tokenData.access_token);
    if (tokenData.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokenData.refresh_token);
    }
    // Store expiry time (current time + expires_in seconds)
    const expiryTime = Date.now() + (tokenData.expires_in * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  /**
   * Get stored access token
   */
  getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Get stored refresh token
   */
  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
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
      localStorage.setItem(USER_KEY, JSON.stringify(user));

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
   * Get valid access token (refreshes if needed, or gets service token)
   */
  async getValidToken() {
    // If token exists and not expired, use it
    if (!this.isTokenExpired()) {
      return this.getAccessToken();
    }

    // Try to refresh using refresh token
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      const result = await this.refreshToken();
      if (result.success) {
        return result.accessToken;
      }
    }

    // No refresh token or refresh failed - get new service token
    console.log('[Keycloak] Getting new service token...');
    const serviceResult = await this.getServiceToken();
    if (serviceResult.success) {
      return serviceResult.accessToken;
    }

    return null;
  }

  /**
   * Logout - clear all tokens and user data
   */
  logout() {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  /**
   * Get current admin user
   */
  getCurrentUser() {
    try {
      const userJson = localStorage.getItem(USER_KEY);
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
   * Initialize service - ensure we have a valid token
   */
  async init() {
    console.log('[Keycloak] Initializing...');

    const token = this.getAccessToken();

    // If no token or expired, get a new one
    if (!token || this.isTokenExpired()) {
      console.log('[Keycloak] No valid token, getting new service token...');
      const result = await this.getServiceToken();
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

    console.log('[Keycloak] Using existing valid token');
    return true;
  }
}

export const keycloakService = new KeycloakService();
export default keycloakService;
