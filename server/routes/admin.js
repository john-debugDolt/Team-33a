import express from 'express';
import { body } from 'express-validator';
import {
  adminLogin,
  getAdminMe,
  getDashboardStats,
  getUsers,
  getUserById,
  updateUser,
  createUser,
  deleteUser,
  getAllTransactions,
  updateTransaction,
  createGame,
  updateGame,
  deleteGame,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getAdminPromotions,
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners
} from '../controllers/adminController.js';
import { protectAdmin, checkPermission } from '../middleware/adminAuth.js';

const router = express.Router();

// Public routes
router.post('/login', [
  body('username').trim().notEmpty(),
  body('password').notEmpty()
], adminLogin);

// Protected routes - require admin authentication
router.use(protectAdmin);

// Admin profile
router.get('/me', getAdminMe);

// Dashboard
router.get('/dashboard', getDashboardStats);

// User management
router.get('/users', checkPermission('manage_users'), getUsers);
router.get('/users/:id', checkPermission('manage_users'), getUserById);
router.post('/users', checkPermission('manage_users'), createUser);
router.put('/users/:id', checkPermission('manage_users'), updateUser);
router.delete('/users/:id', checkPermission('manage_users'), deleteUser);

// Transaction management
router.get('/transactions', checkPermission('manage_transactions'), getAllTransactions);
router.put('/transactions/:id', checkPermission('manage_transactions'), updateTransaction);

// Game management
router.post('/games', checkPermission('manage_games'), createGame);
router.put('/games/:id', checkPermission('manage_games'), updateGame);
router.delete('/games/:id', checkPermission('manage_games'), deleteGame);

// Promotion management
router.get('/promotions', checkPermission('manage_promotions'), getAdminPromotions);
router.post('/promotions', checkPermission('manage_promotions'), createPromotion);
router.put('/promotions/:id', checkPermission('manage_promotions'), updatePromotion);
router.delete('/promotions/:id', checkPermission('manage_promotions'), deletePromotion);

// Admin management
router.get('/admins', getAdmins);
router.post('/admins', createAdmin);
router.put('/admins/:id', updateAdmin);
router.delete('/admins/:id', deleteAdmin);

// Banner management
router.get('/banners', getBanners);
router.post('/banners', createBanner);
router.put('/banners/reorder', reorderBanners);
router.put('/banners/:id', updateBanner);
router.delete('/banners/:id', deleteBanner);

export default router;
