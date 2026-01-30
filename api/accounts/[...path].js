// Vercel Serverless Function - Accounts API (with path)
// Handles JWT auth via Keycloak for protected endpoints

const BACKEND_URL = 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

// Keycloak configuration
const KEYCLOAK_URL = 'https://k8s-team33-keycloak-320152ed2f-65380cdab2265c8a.elb.ap-southeast-2.amazonaws.com';
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
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  try {
    const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

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
    });

    if (!response.ok) {
      console.error('[Keycloak] Token error:', response.status);
      return null;
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    return cachedToken;
  } catch (error) {
    console.error('[Keycloak] Failed to get token:', error.message);
    return null;
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

  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path || '';
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `${BACKEND_URL}/api/accounts/${apiPath}${queryString}`;

  console.log(`[Accounts] ${req.method} -> ${targetUrl}`);

  try {
    // Get JWT from Keycloak
    const token = await getKeycloakToken();

    if (!token) {
      return res.status(503).json({
        success: false,
        error: 'Authentication service unavailable.'
      });
    }

    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get('content-type');

    console.log(`[Accounts] Response status:`, response.status);

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
