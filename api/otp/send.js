const BACKEND_URL = 'https://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    console.log('OTP send request body:', body);

    const response = await fetch(`${BACKEND_URL}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    });

    const text = await response.text();
    console.log('Backend response:', response.status, text);

    const data = text ? JSON.parse(text) : {};
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('OTP send error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      message: error.message,
      name: error.name,
      code: error.code
    });
  }
}
