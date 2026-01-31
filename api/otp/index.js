// eslint-disable-next-line no-unused-vars
const PROTOCOL = 'http'; // DO NOT CHANGE - backend only supports HTTP
const HOST = 'k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';
const BACKEND_URL = PROTOCOL + '://' + HOST;

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = BACKEND_URL + '/api/otp';

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (req.method === 'POST') {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    res.status(response.status);
    if (typeof data === 'object') {
      return res.json(data);
    }
    return res.send(data);
  } catch (error) {
    console.error('OTP Proxy error:', error);
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
