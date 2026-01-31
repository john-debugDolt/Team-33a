import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

const BACKEND_URL = 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';
const GAMES_URL = 'https://api.team33.mx';

// Proxy API routes
const apiProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  onProxyRes: (proxyRes) => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
  }
});

const gamesProxy = createProxyMiddleware({
  target: GAMES_URL,
  changeOrigin: true,
});

// API routes
app.use('/api/games', gamesProxy);
app.use('/api', apiProxy);

// Serve static files
app.use(express.static('dist'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
