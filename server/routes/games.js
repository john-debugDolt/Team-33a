import express from 'express';
import {
  getGames,
  getGameById,
  getFeaturedGames,
  getHotGames,
  getNewGames,
  getProviders,
  incrementPlayCount
} from '../controllers/gameController.js';

const router = express.Router();

// Public routes
router.get('/', getGames);
router.get('/featured', getFeaturedGames);
router.get('/hot', getHotGames);
router.get('/new', getNewGames);
router.get('/providers', getProviders);
router.get('/:id', getGameById);
router.post('/:id/play', incrementPlayCount);

export default router;
