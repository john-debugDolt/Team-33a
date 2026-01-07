import jwt from 'jsonwebtoken';
import db from '../config/db.js';

// Protect routes - require authentication
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await db.queryOne(`
        SELECT id, username, email, phone, balance, available_balance, pending_balance,
               vip_level, is_active, created_at, last_login
        FROM users WHERE id = $1
      `, [decoded.id]);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated'
        });
      }

      // Convert DB format to expected format
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        balance: user.balance,
        availableBalance: user.available_balance,
        pendingBalance: user.pending_balance,
        vipLevel: user.vip_level,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        lastLogin: user.last_login
      };

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

// Generate JWT token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Optional auth - doesn't fail if no token, just sets req.user if valid
export const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await db.queryOne(`
        SELECT id, username, email, phone, balance, available_balance, pending_balance,
               vip_level, is_active, created_at, last_login
        FROM users WHERE id = $1
      `, [decoded.id]);

      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          balance: user.balance,
          availableBalance: user.available_balance,
          pendingBalance: user.pending_balance,
          vipLevel: user.vip_level,
          isActive: user.is_active === 1,
          createdAt: user.created_at,
          lastLogin: user.last_login
        };
      } else {
        req.user = null;
      }
    } catch (error) {
      req.user = null;
    }
  }

  next();
};
