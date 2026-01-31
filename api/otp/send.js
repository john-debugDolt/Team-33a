const BACKEND_URL = 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

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
    // Debug: Log what we receive
    console.log('Request body type:', typeof req.body);
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);

    // Handle body - ensure it's properly formatted
    let body;
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (req.body && Object.keys(req.body).length > 0) {
      body = JSON.stringify(req.body);
    } else {
      // Body is empty - return error with debug info
      return res.status(400).json({
        error: 'Empty request body',
        debug: {
          bodyType: typeof req.body,
          body: req.body,
          contentType: req.headers['content-type']
        }
      });
    }

    console.log('Forwarding body:', body);

    const response = await fetch(`${BACKEND_URL}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    });

    const data = await response.json();
    console.log('Backend response:', response.status, data);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('OTP send error:', error);
    return res.status(500).json({ error: 'Failed to send OTP', message: error.message });
  }
}
