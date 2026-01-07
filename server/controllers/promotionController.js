import db from '../config/db.js';
import { createResponse } from '../utils/helpers.js';

// Helper to format promotion from DB row
const formatPromotion = (row) => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle,
  description: row.description,
  image: row.image,
  category: row.category,
  bonusType: row.bonus_type,
  bonusAmount: row.bonus_amount,
  maxBonus: row.max_bonus,
  minDeposit: row.min_deposit,
  wageringRequirement: row.wagering_requirement,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  terms: JSON.parse(row.terms || '[]'),
  isActive: row.is_active === 1,
  createdAt: row.created_at
});

// @desc    Get all promotions
// @route   GET /api/promotions
// @access  Public
export const getPromotions = async (req, res) => {
  try {
    const { category } = req.query;

    let query = 'SELECT * FROM promotions WHERE is_active = 1';
    const params = [];
    let paramIndex = 1;

    if (category && category !== 'ALL') {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Only show valid promotions (within date range)
    const now = new Date().toISOString();
    query += ` AND valid_from <= $${paramIndex} AND valid_until >= $${paramIndex + 1}`;
    params.push(now, now);

    query += ' ORDER BY created_at DESC';

    const result = await db.queryAll(query, params);
    const promotions = result.map(formatPromotion);

    res.json(
      createResponse(true, { promotions })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get single promotion
// @route   GET /api/promotions/:id
// @access  Public
export const getPromotionById = async (req, res) => {
  try {
    const promotion = await db.queryOne('SELECT * FROM promotions WHERE id = $1', [req.params.id]);

    if (!promotion) {
      return res.status(404).json(
        createResponse(false, null, 'Promotion not found')
      );
    }

    res.json(
      createResponse(true, { promotion: formatPromotion(promotion) })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get promotion categories
// @route   GET /api/promotions/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const categories = [
      { id: 'ALL', name: 'All', icon: '🎁' },
      { id: 'SLOTS', name: 'Slots', icon: '🎰' },
      { id: 'CASINO', name: 'Casino', icon: '🃏' },
      { id: 'SPORT', name: 'Sport', icon: '⚽' },
      { id: 'VIP', name: 'VIP', icon: '👑' },
      { id: 'UNLIMITED', name: 'Unlimited', icon: '♾️' }
    ];

    res.json(
      createResponse(true, { categories })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Claim promotion (mock)
// @route   POST /api/promotions/:id/claim
// @access  Private
export const claimPromotion = async (req, res) => {
  try {
    const promotion = await db.queryOne('SELECT * FROM promotions WHERE id = $1', [req.params.id]);

    if (!promotion) {
      return res.status(404).json(
        createResponse(false, null, 'Promotion not found')
      );
    }

    if (!promotion.is_active) {
      return res.status(400).json(
        createResponse(false, null, 'This promotion is no longer active')
      );
    }

    const now = new Date();
    const validFrom = new Date(promotion.valid_from);
    const validUntil = new Date(promotion.valid_until);

    if (now < validFrom || now > validUntil) {
      return res.status(400).json(
        createResponse(false, null, 'This promotion has expired')
      );
    }

    // Mock: Just return success
    // In real implementation, you would apply the bonus based on user's deposit
    res.json(
      createResponse(true, {
        promotion: {
          id: promotion.id,
          title: promotion.title,
          bonusAmount: promotion.bonus_amount
        }
      }, `Successfully claimed ${promotion.title}! The bonus will be applied to your next qualifying deposit.`)
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};
