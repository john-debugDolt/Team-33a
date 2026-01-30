// Vercel Serverless Function - Accounts API
// Simplified - skip Keycloak for now to test backend connectivity

const BACKEND_URL = 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

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
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
      console.log(`[Accounts] Request body:`, JSON.stringify(req.body));
    }

    console.log(`[Accounts] Calling backend without auth...`);
    const response = await fetch(targetUrl, options);
    console.log(`[Accounts] Response status:`, response.status);

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).json({
        success: false,
        error: text || response.statusText,
        status: response.status
      });
    }
  } catch (error) {
    console.error('[Accounts] Error:', error.name, error.message);
    return res.status(500).json({
      success: false,
      error: `Backend connection failed: ${error.name} - ${error.message}`,
      url: targetUrl
    });
  }
}

export const config = { api: { bodyParser: true } };
