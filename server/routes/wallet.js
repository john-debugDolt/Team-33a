import express from 'express';
import { body } from 'express-validator';
import {
  getBalance,
  getTransactions,
  deposit,
  withdraw,
  transfer,
  getCheckInStatus,
  checkIn
} from '../controllers/walletController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Balance & Transactions
router.get('/balance', getBalance);
router.get('/transactions', getTransactions);

// Deposit
router.post('/deposit', [
  body('amount')
    .isFloat({ min: 10, max: 10000 })
    .withMessage('Amount must be between $10 and $10,000')
], deposit);

// Withdraw
router.post('/withdraw', [
  body('amount')
    .isFloat({ min: 20 })
    .withMessage('Minimum withdrawal is $20')
], withdraw);

// Transfer
router.post('/transfer', [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Minimum transfer is $1'),
  body('recipientUsername')
    .trim()
    .notEmpty()
    .withMessage('Recipient username is required')
], transfer);

// Check-in
router.get('/checkin', getCheckInStatus);
router.post('/checkin', checkIn);

export default router;
