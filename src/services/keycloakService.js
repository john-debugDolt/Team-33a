/**
 * Keycloak Authentication Service
 * Handles OAuth2 login with Resource Owner Password Credentials (ROPC) flow
 */

const KEYCLOAK_BASE_URL = '/auth/keycloak';
const REALM = 'Team33Casino';
const CLIENT_ID = 'Team33admin';
const CLIENT_SECRET = 'lxPLoQaJ7PCYJEJZwRuzelt0RHpKlCH0';

export const keycloakService = {
  /**
   * Login with phone number and password
   * @param {string} phone - Phone number in E.164 format
   * @param {string} password - User password
   */
  async login(phone, password) {
    const tokenUrl = `${KEYCLOAK_BASE_URL}/realms/${REALM}/protocol/openid-connect/token`;

    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: phone,
      password: password,
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error_description || data.error || 'Invalid phone number or password',
        };
      }

      // Store tokens
      if (data.access_token) {
        localStorage.setItem('accessToken', data.access_token);
      }
      if (data.refresh_token) {
        localStorage.setItem('refreshToken', data.refresh_token);
      }

      return {
        success: true,
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        },
      };
    } catch (error) {
      console.error('[Keycloak] Login error:', error);
      return {
        success: false,
        error: 'Network error during login',
      };
    }
  },

  /**
   * Logout - clears tokens
   */
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('accountId');
    return { success: true };
  },

  /**
   * Get access token
   */
  getAccessToken() {
    return localStorage.getItem('accessToken');
  },

  /**
   * Check if authenticated
   */
  isAuthenticated() {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() < payload.exp * 1000;
    } catch {
      return false;
    }
  },
};

export default keycloakService;
