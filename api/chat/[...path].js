// Vercel Serverless Function to proxy chat API requests
// This bypasses CORS by making server-to-server requests

const CHAT_API_URL = 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

export default async function handler(req, res) {
  // Get the path after /api/chat/
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path || '';

  // Build the target URL
  const targetUrl = `${CHAT_API_URL}/api/chat/${apiPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

  console.log(`Proxying ${req.method} request to: ${targetUrl}`);

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Include body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    // Forward the status code and response
    res.status(response.status).json(data);

  } catch (error) {
    console.error('Chat proxy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to chat server',
      details: error.message,
    });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
