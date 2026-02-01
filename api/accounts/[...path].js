const BACKEND_URL = 'https://api.team33.mx';

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const pathSegments = req.query.path || [];
    const subPath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
    const targetUrl = `${BACKEND_URL}/api/accounts/${subPath}`;

    const fetchOptions = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };

    // Forward user's auth header if present
    if (req.headers.authorization) {
      fetchOptions.headers['Authorization'] = req.headers.authorization;
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Accounts proxy error:', error);
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
