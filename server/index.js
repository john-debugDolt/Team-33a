import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './config/db.js';

// Route imports
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/games.js';
import walletRoutes from './routes/wallet.js';
import promotionRoutes from './routes/promotions.js';
import adminRoutes from './routes/admin.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/admin', adminRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Team33 Gaming API is running', database: 'JSON Files' });
});

// Public banners endpoint (for main site)
app.get('/api/banners', async (req, res) => {
  try {
    const banners = await db.queryAll('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC');
    res.json({
      success: true,
      data: {
        banners: banners.map(b => ({
          id: b.id,
          name: b.name,
          image: b.image,
          link: b.link || '',
          sortOrder: b.sort_order
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5001;

// Initialize database tables and start server
const startServer = async () => {
  try {
    await db.initDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
