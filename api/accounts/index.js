// Vercel Serverless Function - Accounts API
// Handles JWT auth via Keycloak for protected endpoints

const BACKEND_URL = 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

// Keycloak configuration (using HTTP - ELB doesn't have SSL)
const KEYCLOAK_URL = 'http://k8s-team33-keycloak-320152ed2f-65380cdab2265c8a.elb.ap-southeast-2.amazonaws.com';
const KEYCLOAK_REALM = 'Team33Casino';
const KEYCLOAK_CLIENT_ID = 'Team33admin';
const KEYCLOAK_CLIENT_SECRET = 'lxPLoQaJ7PCYJEJZwRuzelt0RHpKlCH0';

// Token cache
let cachedToken = null;
let tokenExpiry = null;

/**
 * Get JWT from Keycloak using client credentials
 */
async function getKeycloakToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
  console.log('[Keycloak] Fetching token from:', tokenUrl);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(tokenUrl, {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Keycloak] Token error:', response.status, errorText);
      return { error: `Keycloak returned ${response.status}`, status: response.status };
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
    console.log('[Keycloak] Token obtained, expires in:', data.expires_in, 'seconds');

    return cachedToken;
  } catch (error) {
    console.error('[Keycloak] Failed to get token:', error.name, error.message);
    if (error.name === 'AbortError') {
      return { error: 'Keycloak request timed out after 10s' };
    }
    return { error: `Keycloak connection failed: ${error.message}` };
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `${BACKEND_URL}/api/accounts${queryString}`;

  console.log(`[Accounts] ${req.method} -> ${targetUrl}`);

  try {
    // Try to get JWT from Keycloak
    const tokenResult = await getKeycloakToken();
    let token = null;

    // Check if we got a valid token
    if (tokenResult && typeof tokenResult === 'string') {
      token = tokenResult;
      console.log('[Accounts] Using JWT token');
    } else {
      // Keycloak failed - try without auth (backend may accept it)
      console.log('[Accounts] Keycloak failed, trying without auth:', tokenResult?.error);
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add auth header only if we have a token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method: req.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
      console.log(`[Accounts] Request body:`, JSON.stringify(req.body));
    }

    const response = await fetch(targetUrl, options);
    console.log(`[Accounts] Response status:`, response.status);

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text || response.statusText);
    }
  } catch (error) {
    console.error('[Accounts] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: `Backend connection failed: ${error.message}`
    });
  }
}

export const config = { api: { bodyParser: true } };
