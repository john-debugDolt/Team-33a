import jwt from 'jsonwebtoken';
import db from '../config/db.js';

// Protect admin routes
export const protectAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get admin from token
      const admin = await db.queryOne(`
        SELECT id, username, email, role, permissions, created_at
        FROM admins WHERE id = $1
      `, [decoded.id]);

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Admin not found'
        });
      }

      // Parse permissions JSON
      req.admin = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: JSON.parse(admin.permissions || '[]'),
        createdAt: admin.created_at,
        isActive: true,
        hasPermission: function(perm) {
          return this.role === 'superadmin' || this.permissions.includes(perm);
        }
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

// Generate admin JWT token
export const generateAdminToken = (id) => {
  return jwt.sign({ id, isAdmin: true }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Check permission middleware
export const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (!req.admin.hasPermission(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied: ${permission} required`
      });
    }

    next();
  };
};

// Superadmin only middleware
export const superadminOnly = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Superadmin access required'
    });
  }
  next();
};
