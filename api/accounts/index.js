// Vercel Serverless Function - Accounts API (root endpoint)
const BACKEND_URL = 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';
const DEFAULT_API_KEY = 'team33-admin-secret-key-2024';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `${BACKEND_URL}/api/accounts${queryString}`;

  console.log(`[Accounts] ${req.method} -> ${targetUrl}`);
  console.log(`[Accounts] Body:`, JSON.stringify(req.body));

  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': req.headers['x-api-key'] || DEFAULT_API_KEY,
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
    }

    console.log(`[Accounts] Sending request...`);
    const response = await fetch(targetUrl, options);
    console.log(`[Accounts] Response status:`, response.status);

    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log(`[Accounts] Response data:`, JSON.stringify(data));
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      console.log(`[Accounts] Response text:`, text);
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('[Accounts] Error:', error.message, error.stack);
    return res.status(500).json({
      success: false,
      error: `Backend connection failed: ${error.message}`
    });
  }
}

export const config = { api: { bodyParser: true } };
