import express from 'express';
import {
  getPromotions,
  getPromotionById,
  getCategories,
  claimPromotion
} from '../controllers/promotionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getPromotions);
router.get('/categories', getCategories);
router.get('/:id', getPromotionById);

// Protected routes
router.post('/:id/claim', protect, claimPromotion);

export default router;
