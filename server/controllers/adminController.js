import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { generateAdminToken } from '../middleware/adminAuth.js';
import { createResponse, getPagination, generateId } from '../utils/helpers.js';

// Helper formatters
const formatUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  phone: row.phone,
  balance: row.balance,
  availableBalance: row.available_balance,
  pendingBalance: row.pending_balance,
  vipLevel: row.vip_level,
  isActive: row.is_active === 1,
  createdAt: row.created_at,
  lastLogin: row.last_login
});

const formatTransaction = (row) => ({
  id: row.id,
  userId: row.user_id,
  username: row.username,
  type: row.type,
  amount: row.amount,
  status: row.status,
  paymentMethod: row.payment_method,
  description: row.description,
  createdAt: row.created_at
});

const formatGame = (row) => ({
  id: row.id,
  name: row.name,
  provider: row.provider,
  gameType: row.game_type,
  image: row.image,
  rtp: row.rtp,
  minBet: row.min_bet,
  maxBet: row.max_bet,
  volatility: row.volatility,
  isHot: row.is_hot === 1,
  isNew: row.is_new === 1,
  isFeatured: row.is_featured === 1,
  features: JSON.parse(row.features || '[]'),
  rating: row.rating,
  playCount: row.play_count,
  createdAt: row.created_at
});

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
  isFeatured: row.is_featured === 1,
  createdAt: row.created_at
});

// ==================== AUTH ====================

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await db.queryOne('SELECT * FROM admins WHERE username = $1', [username]);

    if (!admin) {
      return res.status(401).json(
        createResponse(false, null, 'Invalid credentials')
      );
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.status(401).json(
        createResponse(false, null, 'Invalid credentials')
      );
    }

    const token = generateAdminToken(admin.id);

    res.json(
      createResponse(true, {
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          permissions: JSON.parse(admin.permissions || '[]')
        },
        token
      }, 'Login successful')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get current admin
// @route   GET /api/admin/me
// @access  Private/Admin
export const getAdminMe = async (req, res) => {
  try {
    res.json(
      createResponse(true, {
        admin: {
          id: req.admin.id,
          username: req.admin.username,
          email: req.admin.email,
          role: req.admin.role,
          permissions: req.admin.permissions
        }
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// ==================== DASHBOARD ====================

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsersResult = await db.queryOne('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.count);

    const activeUsersResult = await db.queryOne('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const activeUsers = parseInt(activeUsersResult.count);

    const totalGamesResult = await db.queryOne('SELECT COUNT(*) as count FROM games');
    const totalGames = parseInt(totalGamesResult.count);

    const totalTransactionsResult = await db.queryOne('SELECT COUNT(*) as count FROM transactions');
    const totalTransactions = parseInt(totalTransactionsResult.count);

    const pendingWithdrawalsResult = await db.queryOne("SELECT COUNT(*) as count FROM transactions WHERE type = 'withdraw' AND status = 'pending'");
    const pendingWithdrawals = parseInt(pendingWithdrawalsResult.count);

    const recentTransactionsData = await db.queryAll(`
      SELECT t.*, u.username
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);
    const recentTransactions = recentTransactionsData.map(formatTransaction);

    const depositStats = await db.queryOne("SELECT SUM(amount) as total FROM transactions WHERE type = 'deposit' AND status = 'completed'");
    const withdrawalStats = await db.queryOne("SELECT SUM(amount) as total FROM transactions WHERE type = 'withdraw' AND status = 'completed'");

    const totalDeposits = depositStats.total || 0;
    const totalWithdrawals = withdrawalStats.total || 0;

    res.json(
      createResponse(true, {
        stats: {
          totalUsers,
          activeUsers,
          totalGames,
          totalTransactions,
          pendingWithdrawals,
          totalDeposits,
          totalWithdrawals,
          netRevenue: totalDeposits - totalWithdrawals
        },
        recentTransactions
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// ==================== USER MANAGEMENT ====================

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    let query = 'SELECT * FROM users WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex + 1})`;
      countQuery += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    if (status === 'active') {
      query += ' AND is_active = 1';
      countQuery += ' AND is_active = 1';
    } else if (status === 'inactive') {
      query += ' AND is_active = 0';
      countQuery += ' AND is_active = 0';
    }

    const countResult = await db.queryOne(countQuery, params);
    const total = parseInt(countResult.count);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, (pageNum - 1) * limitNum);

    const usersData = await db.queryAll(query, params);
    const users = usersData.map(formatUser);

    res.json(
      createResponse(true, {
        users,
        pagination: getPagination(pageNum, limitNum, total)
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get single user
// @route   GET /api/admin/users/:id
// @access  Private/Admin
export const getUserById = async (req, res) => {
  try {
    const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);

    if (!user) {
      return res.status(404).json(
        createResponse(false, null, 'User not found')
      );
    }

    const transactionsData = await db.queryAll(`
      SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
    `, [req.params.id]);
    const transactions = transactionsData.map(t => formatTransaction({ ...t, username: user.username }));

    res.json(
      createResponse(true, { user: formatUser(user), transactions })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
  try {
    const { balance, availableBalance, vipLevel, isActive } = req.body;

    const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);

    if (!user) {
      return res.status(404).json(
        createResponse(false, null, 'User not found')
      );
    }

    let newBalance = user.balance;
    let newAvailable = user.available_balance;
    let newVipLevel = user.vip_level;
    let newIsActive = user.is_active;

    if (balance !== undefined) {
      newBalance = balance;
    }
    if (availableBalance !== undefined) {
      newAvailable = availableBalance;
      newBalance = newAvailable + user.pending_balance;
    }
    if (vipLevel !== undefined) {
      newVipLevel = vipLevel;
    }
    if (isActive !== undefined) {
      newIsActive = isActive ? 1 : 0;
    }

    await db.query(`
      UPDATE users SET balance = $1, available_balance = $2, vip_level = $3, is_active = $4 WHERE id = $5
    `, [newBalance, newAvailable, newVipLevel, newIsActive, req.params.id]);

    const updatedUser = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, { user: formatUser(updatedUser) }, 'User updated successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// ==================== TRANSACTION MANAGEMENT ====================

// @desc    Get all transactions
// @route   GET /api/admin/transactions
// @access  Private/Admin
export const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    let query = `
      SELECT t.*, u.username, u.email
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as count
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (type && type !== 'all') {
      query += ` AND t.type = $${paramIndex}`;
      countQuery += ` AND t.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    if (status && status !== 'all') {
      query += ` AND t.status = $${paramIndex}`;
      countQuery += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countResult = await db.queryOne(countQuery, params);
    const total = parseInt(countResult.count);

    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, (pageNum - 1) * limitNum);

    const transactionsData = await db.queryAll(query, params);
    const transactions = transactionsData.map(formatTransaction);

    res.json(
      createResponse(true, {
        transactions,
        pagination: getPagination(pageNum, limitNum, total)
      })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Update transaction (approve/reject withdrawal)
// @route   PUT /api/admin/transactions/:id
// @access  Private/Admin
export const updateTransaction = async (req, res) => {
  try {
    const { status } = req.body;

    const transaction = await db.queryOne('SELECT * FROM transactions WHERE id = $1', [req.params.id]);

    if (!transaction) {
      return res.status(404).json(
        createResponse(false, null, 'Transaction not found')
      );
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json(
        createResponse(false, null, 'Can only update pending transactions')
      );
    }

    const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [transaction.user_id]);

    if (status === 'completed') {
      if (transaction.type === 'withdraw') {
        const newPending = user.pending_balance - transaction.amount;
        const newBalance = user.available_balance + newPending;
        await db.query('UPDATE users SET pending_balance = $1, balance = $2 WHERE id = $3', [newPending, newBalance, user.id]);
      }
    } else if (status === 'failed') {
      if (transaction.type === 'withdraw') {
        const newPending = user.pending_balance - transaction.amount;
        const newAvailable = user.available_balance + transaction.amount;
        const newBalance = newAvailable + newPending;
        await db.query('UPDATE users SET pending_balance = $1, available_balance = $2, balance = $3 WHERE id = $4', [newPending, newAvailable, newBalance, user.id]);
      }
    }

    await db.query('UPDATE transactions SET status = $1 WHERE id = $2', [status, req.params.id]);

    const updatedTransaction = await db.queryOne('SELECT * FROM transactions WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, { transaction: formatTransaction({ ...updatedTransaction, username: user.username }) }, `Transaction ${status}`)
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// ==================== GAME MANAGEMENT ====================

// @desc    Create game
// @route   POST /api/admin/games
// @access  Private/Admin
export const createGame = async (req, res) => {
  try {
    const {
      name, provider, gameType = 'slot', image, rtp = 96.0,
      minBet = 0.10, maxBet = 100, volatility = 'Medium',
      isHot = false, isNew = false, isFeatured = false, features = []
    } = req.body;

    const gameId = generateId();
    const now = new Date().toISOString();

    await db.query(`
      INSERT INTO games (id, name, provider, game_type, image, rtp, min_bet, max_bet, volatility, is_hot, is_new, is_featured, features, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [gameId, name, provider, gameType, image, rtp, minBet, maxBet, volatility, isHot ? 1 : 0, isNew ? 1 : 0, isFeatured ? 1 : 0, JSON.stringify(features), now]);

    const game = await db.queryOne('SELECT * FROM games WHERE id = $1', [gameId]);

    res.status(201).json(
      createResponse(true, { game: formatGame(game) }, 'Game created successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Update game
// @route   PUT /api/admin/games/:id
// @access  Private/Admin
export const updateGame = async (req, res) => {
  try {
    const game = await db.queryOne('SELECT * FROM games WHERE id = $1', [req.params.id]);

    if (!game) {
      return res.status(404).json(
        createResponse(false, null, 'Game not found')
      );
    }

    const { name, provider, gameType, image, rtp, minBet, maxBet, volatility, isHot, isNew, isFeatured, features } = req.body;

    await db.query(`
      UPDATE games SET
        name = COALESCE($1, name),
        provider = COALESCE($2, provider),
        game_type = COALESCE($3, game_type),
        image = COALESCE($4, image),
        rtp = COALESCE($5, rtp),
        min_bet = COALESCE($6, min_bet),
        max_bet = COALESCE($7, max_bet),
        volatility = COALESCE($8, volatility),
        is_hot = COALESCE($9, is_hot),
        is_new = COALESCE($10, is_new),
        is_featured = COALESCE($11, is_featured),
        features = COALESCE($12, features)
      WHERE id = $13
    `, [
      name || null, provider || null, gameType || null, image || null,
      rtp || null, minBet || null, maxBet || null, volatility || null,
      isHot !== undefined ? (isHot ? 1 : 0) : null,
      isNew !== undefined ? (isNew ? 1 : 0) : null,
      isFeatured !== undefined ? (isFeatured ? 1 : 0) : null,
      features ? JSON.stringify(features) : null,
      req.params.id
    ]);

    const updatedGame = await db.queryOne('SELECT * FROM games WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, { game: formatGame(updatedGame) }, 'Game updated successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Delete game
// @route   DELETE /api/admin/games/:id
// @access  Private/Admin
export const deleteGame = async (req, res) => {
  try {
    const result = await db.query('DELETE FROM games WHERE id = $1', [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json(
        createResponse(false, null, 'Game not found')
      );
    }

    res.json(
      createResponse(true, null, 'Game deleted successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// ==================== PROMOTION MANAGEMENT ====================

// @desc    Create promotion
// @route   POST /api/admin/promotions
// @access  Private/Admin
export const createPromotion = async (req, res) => {
  try {
    const {
      title, subtitle, description, image, category = 'BONUS',
      bonusType, bonusAmount, maxBonus, minDeposit, wageringRequirement,
      validFrom, validUntil, terms = [], isActive = true, isFeatured = false
    } = req.body;

    const promoId = generateId();
    const now = new Date().toISOString();

    await db.query(`
      INSERT INTO promotions (id, title, subtitle, description, image, category, bonus_type, bonus_amount, max_bonus, min_deposit, wagering_requirement, valid_from, valid_until, terms, is_active, is_featured, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [promoId, title, subtitle, description, image, category, bonusType, bonusAmount, maxBonus, minDeposit, wageringRequirement, validFrom, validUntil, JSON.stringify(terms), isActive ? 1 : 0, isFeatured ? 1 : 0, now]);

    const promotion = await db.queryOne('SELECT * FROM promotions WHERE id = $1', [promoId]);

    res.status(201).json(
      createResponse(true, { promotion: formatPromotion(promotion) }, 'Promotion created successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Update promotion
// @route   PUT /api/admin/promotions/:id
// @access  Private/Admin
export const updatePromotion = async (req, res) => {
  try {
    const promotion = await db.queryOne('SELECT * FROM promotions WHERE id = $1', [req.params.id]);

    if (!promotion) {
      return res.status(404).json(
        createResponse(false, null, 'Promotion not found')
      );
    }

    const { title, subtitle, description, image, category, bonusType, bonusAmount, maxBonus, minDeposit, wageringRequirement, validFrom, validUntil, terms, isActive, isFeatured } = req.body;

    await db.query(`
      UPDATE promotions SET
        title = COALESCE($1, title),
        subtitle = COALESCE($2, subtitle),
        description = COALESCE($3, description),
        image = COALESCE($4, image),
        category = COALESCE($5, category),
        bonus_type = COALESCE($6, bonus_type),
        bonus_amount = COALESCE($7, bonus_amount),
        max_bonus = COALESCE($8, max_bonus),
        min_deposit = COALESCE($9, min_deposit),
        wagering_requirement = COALESCE($10, wagering_requirement),
        valid_from = COALESCE($11, valid_from),
        valid_until = COALESCE($12, valid_until),
        terms = COALESCE($13, terms),
        is_active = COALESCE($14, is_active),
        is_featured = COALESCE($15, is_featured)
      WHERE id = $16
    `, [
      title || null, subtitle || null, description || null, image || null,
      category || null, bonusType || null, bonusAmount || null, maxBonus || null,
      minDeposit || null, wageringRequirement || null, validFrom || null, validUntil || null,
      terms ? JSON.stringify(terms) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      isFeatured !== undefined ? (isFeatured ? 1 : 0) : null,
      req.params.id
    ]);

    const updatedPromotion = await db.queryOne('SELECT * FROM promotions WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, { promotion: formatPromotion(updatedPromotion) }, 'Promotion updated successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Delete promotion
// @route   DELETE /api/admin/promotions/:id
// @access  Private/Admin
export const deletePromotion = async (req, res) => {
  try {
    await db.query('UPDATE promotions SET is_active = 0 WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, null, 'Promotion deleted successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Get all promotions (admin view - includes inactive)
// @route   GET /api/admin/promotions
// @access  Private/Admin
export const getAdminPromotions = async (req, res) => {
  try {
    const promotionsData = await db.queryAll('SELECT * FROM promotions ORDER BY created_at DESC');
    const promotions = promotionsData.map(formatPromotion);

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

// ==================== ADMIN MANAGEMENT ====================

const formatAdmin = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  role: row.role,
  permissions: JSON.parse(row.permissions || '[]'),
  createdAt: row.created_at
});

// @desc    Get all admins
// @route   GET /api/admin/admins
// @access  Private/SuperAdmin
export const getAdmins = async (req, res) => {
  try {
    const adminsData = await db.queryAll('SELECT * FROM admins ORDER BY created_at DESC');
    const admins = adminsData.map(formatAdmin);

    res.json(
      createResponse(true, { admins })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Create admin
// @route   POST /api/admin/admins
// @access  Private/SuperAdmin
export const createAdmin = async (req, res) => {
  try {
    const { username, email, password, role = 'admin', permissions = [] } = req.body;

    // Check if username or email already exists
    const existing = await db.queryOne('SELECT * FROM admins WHERE username = $1 OR email = $2', [username, email]);
    if (existing) {
      return res.status(400).json(
        createResponse(false, null, 'Username or email already exists')
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const adminId = generateId();
    const now = new Date().toISOString();

    await db.query(`
      INSERT INTO admins (id, username, email, password_hash, role, permissions, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [adminId, username, email, passwordHash, role, JSON.stringify(permissions), now]);

    const admin = await db.queryOne('SELECT * FROM admins WHERE id = $1', [adminId]);

    res.status(201).json(
      createResponse(true, { admin: formatAdmin(admin) }, 'Admin created successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Update admin
// @route   PUT /api/admin/admins/:id
// @access  Private/SuperAdmin
export const updateAdmin = async (req, res) => {
  try {
    const admin = await db.queryOne('SELECT * FROM admins WHERE id = $1', [req.params.id]);

    if (!admin) {
      return res.status(404).json(
        createResponse(false, null, 'Admin not found')
      );
    }

    const { username, email, password, role, permissions } = req.body;

    let passwordHash = admin.password_hash;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    await db.query(`
      UPDATE admins SET
        username = COALESCE($1, username),
        email = COALESCE($2, email),
        password_hash = $3,
        role = COALESCE($4, role),
        permissions = COALESCE($5, permissions)
      WHERE id = $6
    `, [
      username || null,
      email || null,
      passwordHash,
      role || null,
      permissions ? JSON.stringify(permissions) : null,
      req.params.id
    ]);

    const updatedAdmin = await db.queryOne('SELECT * FROM admins WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, { admin: formatAdmin(updatedAdmin) }, 'Admin updated successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Delete admin
// @route   DELETE /api/admin/admins/:id
// @access  Private/SuperAdmin
export const deleteAdmin = async (req, res) => {
  try {
    const admin = await db.queryOne('SELECT * FROM admins WHERE id = $1', [req.params.id]);

    if (!admin) {
      return res.status(404).json(
        createResponse(false, null, 'Admin not found')
      );
    }

    // Prevent deleting yourself
    if (admin.id === req.admin.id) {
      return res.status(400).json(
        createResponse(false, null, 'Cannot delete your own account')
      );
    }

    await db.query('DELETE FROM admins WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, null, 'Admin deleted successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// ==================== USER MANAGEMENT EXTENDED ====================

// @desc    Create user
// @route   POST /api/admin/users
// @access  Private/Admin
export const createUser = async (req, res) => {
  try {
    const { username, email, password, phone = '', balance = 0, vipLevel = 'Bronze' } = req.body;

    // Check if username or email already exists
    const existing = await db.queryOne('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing) {
      return res.status(400).json(
        createResponse(false, null, 'Username or email already exists')
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = generateId();
    const now = new Date().toISOString();

    await db.query(`
      INSERT INTO users (id, username, email, phone, password_hash, balance, available_balance, vip_level, created_at, last_login)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [userId, username, email, phone, passwordHash, balance, balance, vipLevel, now, now]);

    const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [userId]);

    res.status(201).json(
      createResponse(true, { user: formatUser(user) }, 'User created successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.params.id]);

    if (!user) {
      return res.status(404).json(
        createResponse(false, null, 'User not found')
      );
    }

    // Delete user's transactions first (foreign key)
    await db.query('DELETE FROM transactions WHERE user_id = $1', [req.params.id]);
    await db.query('DELETE FROM checkins WHERE user_id = $1', [req.params.id]);
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, null, 'User deleted successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// ==================== BANNER MANAGEMENT ====================

const formatBanner = (row) => ({
  id: row.id,
  name: row.name,
  image: row.image,
  link: row.link || '',
  sortOrder: row.sort_order,
  isActive: row.is_active === 1,
  createdAt: row.created_at
});

// @desc    Get all banners
// @route   GET /api/admin/banners
// @access  Private/Admin
export const getBanners = async (req, res) => {
  try {
    const bannersData = await db.queryAll('SELECT * FROM banners ORDER BY sort_order ASC');
    const banners = bannersData.map(formatBanner);

    res.json(
      createResponse(true, { banners })
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Create banner
// @route   POST /api/admin/banners
// @access  Private/Admin
export const createBanner = async (req, res) => {
  try {
    const { name, image, link = '', isActive = true } = req.body;

    // Get max sort order
    const maxOrder = await db.queryOne('SELECT MAX(sort_order) as max FROM banners');
    const sortOrder = (maxOrder.max || 0) + 1;

    const bannerId = generateId();
    const now = new Date().toISOString();

    await db.query(`
      INSERT INTO banners (id, name, image, link, sort_order, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [bannerId, name, image, link, sortOrder, isActive ? 1 : 0, now]);

    const banner = await db.queryOne('SELECT * FROM banners WHERE id = $1', [bannerId]);

    res.status(201).json(
      createResponse(true, { banner: formatBanner(banner) }, 'Banner created successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Update banner
// @route   PUT /api/admin/banners/:id
// @access  Private/Admin
export const updateBanner = async (req, res) => {
  try {
    const banner = await db.queryOne('SELECT * FROM banners WHERE id = $1', [req.params.id]);

    if (!banner) {
      return res.status(404).json(
        createResponse(false, null, 'Banner not found')
      );
    }

    const { name, image, link, sortOrder, isActive } = req.body;

    await db.query(`
      UPDATE banners SET
        name = COALESCE($1, name),
        image = COALESCE($2, image),
        link = COALESCE($3, link),
        sort_order = COALESCE($4, sort_order),
        is_active = COALESCE($5, is_active)
      WHERE id = $6
    `, [
      name || null,
      image || null,
      link !== undefined ? link : null,
      sortOrder || null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      req.params.id
    ]);

    const updatedBanner = await db.queryOne('SELECT * FROM banners WHERE id = $1', [req.params.id]);

    res.json(
      createResponse(true, { banner: formatBanner(updatedBanner) }, 'Banner updated successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Delete banner
// @route   DELETE /api/admin/banners/:id
// @access  Private/Admin
export const deleteBanner = async (req, res) => {
  try {
    const result = await db.query('DELETE FROM banners WHERE id = $1', [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json(
        createResponse(false, null, 'Banner not found')
      );
    }

    res.json(
      createResponse(true, null, 'Banner deleted successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Reorder banners
// @route   PUT /api/admin/banners/reorder
// @access  Private/Admin
export const reorderBanners = async (req, res) => {
  try {
    const { bannerIds } = req.body;

    if (!Array.isArray(bannerIds)) {
      return res.status(400).json(
        createResponse(false, null, 'bannerIds must be an array')
      );
    }

    for (let i = 0; i < bannerIds.length; i++) {
      await db.query('UPDATE banners SET sort_order = $1 WHERE id = $2', [i + 1, bannerIds[i]]);
    }

    const bannersData = await db.queryAll('SELECT * FROM banners ORDER BY sort_order ASC');
    const banners = bannersData.map(formatBanner);

    res.json(
      createResponse(true, { banners }, 'Banners reordered successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};
