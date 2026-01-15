import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const BACKEND_URL = 'http://k8s-team33-accounts-4f99fe8193-a4c5da018f68b390.elb.ap-southeast-2.amazonaws.com';

// API Proxy
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  secure: false,
  onProxyReq: (proxyReq, req) => {
    if (req.headers['x-api-key']) {
      proxyReq.setHeader('X-API-Key', req.headers['x-api-key']);
    }
  }
}));

// Serve static files
app.use(express.static(join(__dirname, 'dist')));

// Admin panel routes
app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'admin.html'));
});
app.get('/admin/(.*)', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'admin.html'));
});

// SPA fallback - catch all other routes
app.use((req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
