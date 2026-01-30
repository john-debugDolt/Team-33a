/**
 * Keycloak Service - Get JWT token for authenticated API calls
 * Uses client credentials grant for service token
 */

const KEYCLOAK_URL = '/auth/keycloak';
const KEYCLOAK_REALM = 'Team33Casino';
const KEYCLOAK_CLIENT_ID = 'Team33admin';
const KEYCLOAK_CLIENT_SECRET = 'lxPLoQaJ7PCYJEJZwRuzelt0RHpKlCH0';

class KeycloakService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get service token using client credentials
   */
  async getServiceToken() {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    try {
      const response = await fetch(
        `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: KEYCLOAK_CLIENT_ID,
            client_secret: KEYCLOAK_CLIENT_SECRET,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('[Keycloak] Token error:', error);
        return null;
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('[Keycloak] Failed to get token:', error);
      return null;
    }
  }

  /**
   * Get authorization header with Bearer token
   */
  async getAuthHeader() {
    const token = await this.getServiceToken();
    if (!token) {
      return {};
    }
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Clear cached token
   */
  clearToken() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }
}

export const keycloakService = new KeycloakService();
export default keycloakService;
