// Vercel Serverless Function - Wallets API (with path)
const BACKEND_URL = 'http://k8s-team33-walletse-2b6bcd93c2-52fa21111cb7a7e7.elb.ap-southeast-2.amazonaws.com';

export default async function handler(req, res) {
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path || '';
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `${BACKEND_URL}/api/wallets/${apiPath}${queryString}`;

  console.log(`[Wallets] ${req.method} -> ${targetUrl}`);

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
    console.error('[Wallets] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Backend connection failed' });
  }
}

export const config = { api: { bodyParser: true } };
