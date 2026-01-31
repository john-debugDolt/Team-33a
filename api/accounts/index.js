// Vercel Serverless Function - Accounts API Proxy
const BACKEND_URL = 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = `${BACKEND_URL}/api/accounts`;

  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Handle request body
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.body && typeof req.body === 'object') {
        options.body = JSON.stringify(req.body);
      } else if (typeof req.body === 'string') {
        options.body = req.body;
      }
    }

    const response = await fetch(targetUrl, options);

    // Get response text first
    const text = await response.text();

    // Try to parse as JSON
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

export const config = { api: { bodyParser: true } };
