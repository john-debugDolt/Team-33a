const BACKEND_URL = 'https://api.team33.mx';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone } = req.query;

    const response = await fetch(`${BACKEND_URL}/api/otp/status/${encodeURIComponent(phone)}`, {
      method: 'GET',
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('OTP status error:', error);
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
