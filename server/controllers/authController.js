import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { generateToken } from '../middleware/auth.js';
import { createResponse, generateId } from '../utils/helpers.js';

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    // Check if user exists
    const existingUser = await db.queryOne(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser) {
      return res.status(400).json(
        createResponse(false, null, 'User already exists with that email or username')
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user with welcome bonus
    const welcomeBonus = 100;
    const userId = generateId();
    const now = new Date().toISOString();

    await db.query(
      `INSERT INTO users (id, username, email, phone, password_hash, balance, available_balance, pending_balance, vip_level, created_at, last_login)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [userId, username, email, phone || '', passwordHash, welcomeBonus, welcomeBonus, 0, 'Bronze', now, now]
    );

    // Create welcome bonus transaction
    await db.query(
      `INSERT INTO transactions (id, user_id, type, amount, status, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [generateId(), userId, 'bonus', welcomeBonus, 'completed', 'Welcome Bonus', now]
    );

    // Generate token
    const token = generateToken(userId);

    res.status(201).json(
      createResponse(true, {
        user: {
          id: userId,
          username,
          email,
          phone: phone || '',
          balance: welcomeBonus,
          availableBalance: welcomeBonus,
          pendingBalance: 0,
          vipLevel: 'Bronze',
          createdAt: now
        },
        token
      }, 'Registration successful! Welcome bonus of $100 has been credited.')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check for user
    const user = await db.queryOne(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (!user) {
      return res.status(401).json(
        createResponse(false, null, 'Invalid credentials')
      );
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json(
        createResponse(false, null, 'Invalid credentials')
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json(
        createResponse(false, null, 'Account has been deactivated. Please contact support.')
      );
    }

    // Update last login
    const now = new Date().toISOString();
    await db.query('UPDATE users SET last_login = $1 WHERE id = $2', [now, user.id]);

    // Generate token
    const token = generateToken(user.id);

    res.json(
      createResponse(true, {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          balance: user.balance,
          availableBalance: user.available_balance,
          pendingBalance: user.pending_balance,
          vipLevel: user.vip_level,
          createdAt: user.created_at,
          lastLogin: now
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

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    res.json(
      createResponse(true, {
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          phone: req.user.phone,
          balance: req.user.balance,
          availableBalance: req.user.availableBalance,
          pendingBalance: req.user.pendingBalance,
          vipLevel: req.user.vipLevel,
          createdAt: req.user.createdAt,
          lastLogin: req.user.lastLogin
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

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { username, email, phone } = req.body;

    // Check if new username/email is taken by another user
    if (username && username !== req.user.username) {
      const existingUser = await db.queryOne(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, req.user.id]
      );
      if (existingUser) {
        return res.status(400).json(
          createResponse(false, null, 'Username already taken')
        );
      }
    }

    if (email && email !== req.user.email) {
      const existingUser = await db.queryOne(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.user.id]
      );
      if (existingUser) {
        return res.status(400).json(
          createResponse(false, null, 'Email already taken')
        );
      }
    }

    // Update user
    await db.query(
      `UPDATE users SET
        username = COALESCE($1, username),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone)
       WHERE id = $4`,
      [username || null, email || null, phone, req.user.id]
    );

    // Get updated user
    const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);

    res.json(
      createResponse(true, {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          balance: user.balance,
          availableBalance: user.available_balance,
          pendingBalance: user.pending_balance,
          vipLevel: user.vip_level
        }
      }, 'Profile updated successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await db.queryOne('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json(
        createResponse(false, null, 'Current password is incorrect')
      );
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);

    res.json(
      createResponse(true, null, 'Password changed successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};

// @desc    Forgot password (mock - just returns success)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // In a real app, you would send an email here
    // For now, just return success regardless
    res.json(
      createResponse(true, null, 'If an account exists with that email, you will receive a password reset link.')
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(
      createResponse(false, null, error.message)
    );
  }
};
