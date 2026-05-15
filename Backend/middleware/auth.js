const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Vendor = require('../models/Vendor');
const Seller = require('../models/Seller');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

/**
 * Generate JWT Token
 * @param {Object} payload - Token payload (userId, role, etc.)
 * @returns {string} - JWT token
 */
exports.generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verify JWT Token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
exports.verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Protect routes - Require authentication
 * Middleware to check if user is authenticated
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token
      const decoded = exports.verifyToken(token);

      // Attach decoded token to request
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Authorization Middleware
 * Requires authentication and admin role
 */
exports.authorizeAdmin = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token
      const decoded = exports.verifyToken(token);

      // Check if user is admin
      if (decoded.role !== 'admin' && decoded.role !== 'super_admin' && decoded.role !== 'manager') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin role required.',
        });
      }

      // Fetch admin details from database
      const admin = await Admin.findById(decoded.adminId || decoded.userId || decoded.id);

      if (!admin || !admin.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Admin account not found or inactive',
        });
      }

      req.user = decoded;
      req.admin = admin;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor Authorization Middleware
 * Requires authentication and vendor role
 */
exports.authorizeVendor = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token
      const decoded = exports.verifyToken(token);

      // Check if user is vendor
      if (decoded.role !== 'vendor') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Vendor role required.',
        });
      }

      // Attach decoded token to request
      req.user = decoded;

      // Fetch vendor details from database
      const vendor = await Vendor.findById(decoded.vendorId || decoded.userId || decoded.id);

      if (!vendor) {
        return res.status(403).json({
          success: false,
          message: 'Vendor account not found',
        });
      }

      if (!vendor.isActive || vendor.status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Vendor account is inactive or not approved',
        });
      }

      req.vendor = vendor;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Seller Authorization Middleware
 * Requires authentication and seller role
 */
exports.authorizeSeller = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token
      const decoded = exports.verifyToken(token);

      // Check if user is seller
      if (decoded.role !== 'seller') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Seller role required.',
        });
      }

      // Attach decoded token to request
      req.user = decoded;

      // Fetch seller details from database
      const seller = await Seller.findById(decoded.sellerId || decoded.userId || decoded.id);

      if (!seller) {
        return res.status(403).json({
          success: false,
          message: 'Seller account not found',
        });
      }

      if (!seller.isActive || seller.status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Seller account is inactive or not approved',
        });
      }

      req.seller = seller;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * User Authorization Middleware
 * Requires authentication and user role
 */
exports.authorizeUser = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token
      const decoded = exports.verifyToken(token);

      // Check if user is regular user
      if (decoded.role !== 'user') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. User role required.',
        });
      }

      // Attach decoded token to request
      req.user = decoded;

      // Fetch user details from database
      const user = await User.findById(decoded.userId || decoded.id);

      if (!user) {
        return res.status(403).json({
          success: false,
          message: 'User account not found',
        });
      }

      if (!user.isActive || user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'User account is inactive or blocked',
        });
      }

      req.userDetails = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization
 * Check if user has required role
 * @param {...string} roles - Allowed roles
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

