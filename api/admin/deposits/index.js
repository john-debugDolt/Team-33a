// Vercel Serverless Function - Admin Deposits API (root endpoint)
const BACKEND_URL = 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

export default async function handler(req, res) {
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `${BACKEND_URL}/api/admin/deposits${queryString}`;

  console.log(`[Admin Deposits] ${req.method} -> ${targetUrl}`);

  try {
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Forward API key header for admin authentication
    if (req.headers['x-api-key']) {
      options.headers['X-API-Key'] = req.headers['x-api-key'];
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('[Admin Deposits] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Backend connection failed' });
  }
}

export const config = { api: { bodyParser: true } };
