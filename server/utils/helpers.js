import crypto from 'crypto';

// Generate unique ID
export const generateId = () => {
  return crypto.randomUUID();
};

// Standard API response format
export const createResponse = (success, data = null, message = '') => ({
  success,
  data,
  message,
  timestamp: Date.now()
});

// Format currency to USD
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

// Format date
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Generate random string
export const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Calculate pagination
export const getPagination = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

// Check-in rewards schedule
export const CHECKIN_REWARDS = [10, 20, 30, 50, 75, 100, 200];

// VIP Levels
export const VIP_LEVELS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

// Transaction types
export const TRANSACTION_TYPES = ['deposit', 'withdraw', 'bonus', 'bet', 'win', 'transfer'];

// Transaction statuses
export const TRANSACTION_STATUSES = ['completed', 'pending', 'failed'];

// Game types
export const GAME_TYPES = ['slot', 'live-casino', 'sports', 'fishing', 'card-game'];

// Promotion categories
export const PROMOTION_CATEGORIES = ['SLOTS', 'CASINO', 'SPORT', 'VIP', 'UNLIMITED'];
