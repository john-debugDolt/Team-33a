// Vercel Serverless API Proxy for Game Launch
// CommonJS format for Vercel compatibility

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GAME_LAUNCH_API = 'http://k8s-team33-accounts-9a3cb34ef2-792ca1b1aa42bb5e.elb.ap-southeast-2.amazonaws.com/api/games/launch';
  const ACCOUNT_ID = 'ACC284290827402874880';

  try {
    const { gameId } = req.body || {};

    if (!gameId) {
      return res.status(400).json({ error: 'gameId is required' });
    }

    // Forward request to Team33 API
    const response = await fetch(GAME_LAUNCH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId: ACCOUNT_ID,
        gameId: gameId
      })
    });

    const data = await response.json();

    // Return the response
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('Game launch proxy error:', error);
    return res.status(500).json({
      error: 'Failed to connect to game server',
      details: error.message
    });
  }
};
