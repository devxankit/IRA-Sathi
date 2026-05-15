/**
 * Workflow Security Middleware
 * 
 * Ensures critical business rules are enforced:
 * 1. Only one vendor per 20km radius
 * 2. Role immutability (roles cannot be changed after registration)
 * 3. Transaction safety for concurrent operations
 */

const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const { VENDOR_COVERAGE_RADIUS_KM } = require('../utils/constants');

/**
 * Verify vendor location doesn't conflict with existing vendors (20km rule)
 * This is used during registration to prevent multiple vendors in same area
 */
exports.verifyVendorLocation = async (req, res, next) => {
  try {
    const { location } = req.body;

    if (!location || !location.coordinates || !location.coordinates.lat || !location.coordinates.lng) {
      return res.status(400).json({
        success: false,
        message: 'Valid location coordinates are required',
      });
    }

    // Use MongoDB session for transaction safety (prevents race conditions)
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Check if another vendor exists within 20km using geospatial query
        const nearbyVendors = await Vendor.find({
          status: { $in: ['pending', 'approved'] }, // Check both pending and approved
          'location.coordinates': {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [location.coordinates.lng, location.coordinates.lat],
              },
              $maxDistance: VENDOR_COVERAGE_RADIUS_KM * 1000, // Convert km to meters
            },
          },
        }).session(session).limit(1);

        if (nearbyVendors.length > 0) {
          const nearbyVendor = nearbyVendors[0];
          throw new Error(`VENDOR_EXISTS: Another vendor already exists within ${VENDOR_COVERAGE_RADIUS_KM}km radius`);
        }
      });

      // If transaction succeeds, continue
      next();
    } catch (error) {
      if (error.message.startsWith('VENDOR_EXISTS:')) {
        return res.status(400).json({
          success: false,
          message: error.message.replace('VENDOR_EXISTS: ', ''),
          businessRule: `Only one vendor is allowed per ${VENDOR_COVERAGE_RADIUS_KM}km radius. Please choose a different location.`,
        });
      }
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Ensure role cannot be changed after registration
 * This middleware prevents role modification in update endpoints
 */
exports.preventRoleChange = (req, res, next) => {
  // If request tries to change role, reject it
  if (req.body.role !== undefined) {
    return res.status(403).json({
      success: false,
      message: 'Role cannot be changed. Roles are set at registration and are immutable.',
      securityRule: 'User roles are non-customizable and cannot be modified after account creation.',
    });
  }
  next();
};

/**
 * Verify user has only one role (non-customizable)
 * This ensures token payload has exactly one role
 */
exports.verifySingleRole = (req, res, next) => {
  if (req.user && req.user.role) {
    const allowedRoles = ['admin', 'vendor', 'seller', 'user'];
    const userRole = req.user.role;
    
    // Ensure role is valid
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid role detected',
        securityError: 'User has an invalid or unrecognized role',
      });
    }

    // Role is valid and single (JWT tokens can only have one role field)
    next();
  } else {
    return res.status(401).json({
      success: false,
      message: 'Role information missing from authentication token',
    });
  }
};

/**
 * Transaction wrapper for critical operations
 * Ensures atomicity for operations like order creation, vendor registration
 */
exports.withTransaction = (handler) => {
  return async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Attach session to request for use in handler
      req.dbSession = session;
      
      // Execute handler
      await handler(req, res, next);
      
      // If response hasn't been sent yet, commit transaction
      if (!res.headersSent) {
        await session.commitTransaction();
      }
    } catch (error) {
      // Rollback on error
      await session.abortTransaction();
      next(error);
    } finally {
      await session.endSession();
    }
  };
};

module.exports = exports;

