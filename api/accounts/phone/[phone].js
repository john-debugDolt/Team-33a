const BACKEND_URL = 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';
const KEYCLOAK_URL = 'http://k8s-team33-keycloak-320152ed2f-65380cdab2265c8a.elb.ap-southeast-2.amazonaws.com';
const KEYCLOAK_REALM = 'Team33Casino';
const KEYCLOAK_CLIENT_ID = 'Team33admin';
const KEYCLOAK_CLIENT_SECRET = 'lxPLoQaJ7PCYJEJZwRuzelt0RHpKlCH0';

// Token cache
let cachedToken = null;
let tokenExpiry = null;

async function getKeycloakToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  try {
    const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: KEYCLOAK_CLIENT_ID,
        client_secret: KEYCLOAK_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      console.error('[API Proxy] Keycloak token error:', response.status);
      return null;
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
    return cachedToken;
  } catch (error) {
    console.error('[API Proxy] Failed to get Keycloak token:', error.message);
    return null;
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.query;

  // URL decode the phone number
  const decodedPhone = decodeURIComponent(phone);
  const targetUrl = `${BACKEND_URL}/api/accounts/phone/${encodeURIComponent(decodedPhone)}`;

  try {
    // Get JWT token from Keycloak
    const token = await getKeycloakToken();

    const fetchOptions = {
      method: 'GET',
      headers: {},
    };

    // Add JWT token if available
    if (token) {
      fetchOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(targetUrl, fetchOptions);

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Forward the response
    res.status(response.status);

    if (typeof data === 'object') {
      return res.json(data);
    } else {
      return res.send(data);
    }
  } catch (error) {
    console.error('[API Proxy] Phone lookup error:', error);
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
