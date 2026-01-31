// Vercel Serverless Function - Accounts API Proxy (catch-all)
const BACKEND_URL = 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get the path from the URL
  const path = req.query.path ? req.query.path.join('/') : '';
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `${BACKEND_URL}/api/accounts/${path}${queryString}`;

  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Forward Authorization header if present
    if (req.headers.authorization) {
      options.headers['Authorization'] = req.headers.authorization;
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const data = await response.json().catch(() => ({}));

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[Accounts API] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export const config = { api: { bodyParser: true } };
