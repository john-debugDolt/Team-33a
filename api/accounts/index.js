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
    const fetchOptions = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };

    // POST /api/accounts (registration) is PUBLIC - no auth needed
    // Forward user's auth header for other methods
    if (req.method !== 'POST' && req.headers.authorization) {
      fetchOptions.headers['Authorization'] = req.headers.authorization;
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    console.log('Forwarding to backend:', req.method, `${BACKEND_URL}/api/accounts`);
    console.log('Body:', fetchOptions.body);

    const response = await fetch(`${BACKEND_URL}/api/accounts`, fetchOptions);

    const text = await response.text();
    console.log('Backend response:', response.status, text);

    const data = text ? JSON.parse(text) : {};

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Accounts proxy error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      name: error.name,
      code: error.code,
      cause: error.cause?.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
  }
}
