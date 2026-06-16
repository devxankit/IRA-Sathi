/**
 * User Controller
 * 
 * Handles all user-related operations
 */

const User = require('../models/User');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Address = require('../models/Address');
const Vendor = require('../models/Vendor');
const Seller = require('../models/Seller');
const ProductAssignment = require('../models/ProductAssignment');
const Payment = require('../models/Payment');
const Commission = require('../models/Commission');
const Review = require('../models/Review');

const { sendOTP } = require('../utils/otp');
const { getTestOTPInfo } = require('../services/smsIndiaHubService');
const { generateToken } = require('../middleware/auth');
const { OTP_EXPIRY_MINUTES, MIN_ORDER_VALUE, ADVANCE_PAYMENT_PERCENTAGE, REMAINING_PAYMENT_PERCENTAGE, DELIVERY_CHARGE, VENDOR_COVERAGE_RADIUS_KM, VENDOR_ASSIGNMENT_BUFFER_KM, VENDOR_ASSIGNMENT_MAX_RADIUS_KM, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHODS, IRA_PARTNER_COMMISSION_THRESHOLD, IRA_PARTNER_COMMISSION_RATE_LOW, IRA_PARTNER_COMMISSION_RATE_HIGH } = require('../utils/constants');
const { checkPhoneExists, checkPhoneInRole, isSpecialBypassNumber, SPECIAL_BYPASS_OTP } = require('../utils/phoneValidation');
const { processOrderEarnings } = require('../services/earningsService');
const PaymentHistory = require('../models/PaymentHistory');
const razorpayService = require('../services/razorpayService');
const Offer = require('../models/Offer');
const { generateUniqueId } = require('../utils/generateUniqueId');
const UserNotification = require('../models/UserNotification');

/**
 * @desc    Request OTP for user
 * @route   POST /api/users/auth/request-otp
 * @access  Public
 */
exports.requestOTP = async (req, res, next) => {
  try {
    const { phone, language } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Special bypass number - skip all checks and proceed to OTP
    if (isSpecialBypassNumber(phone)) {
      let user = await User.findOne({ phone });

      if (!user) {
        const userId = await generateUniqueId(User, 'USR', 'userId', 101);
        user = new User({
          userId,
          phone,
          language: language || 'en',
          name: 'Pending Registration',
          isActive: false,
        });
      }

      // Set OTP to 123456
      user.otp = {
        code: SPECIAL_BYPASS_OTP,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
      await user.save();

      return res.status(200).json({
        success: true,
        data: {
          message: 'OTP sent successfully',
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
      });
    }

    // Check if phone exists in other roles (vendor, seller)
    const phoneCheck = await checkPhoneExists(phone, 'user');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    let user = await User.findOne({ phone });

    // If user doesn't exist, create pending registration
    // ⚠️ NOTE: Name is not required at OTP request stage - will be set during registration
    if (!user) {
      const userId = await generateUniqueId(User, 'USR', 'userId', 101);
      user = new User({
        userId,
        phone,
        language: language || 'en',
        name: 'Pending Registration', // Temporary name, will be updated during registration
        isActive: false, // Will be activated after registration
      });
    }

    // Check if this is a test phone number - use default OTP 123456
    const testOTPInfo = getTestOTPInfo(phone);
    let otpCode;
    if (testOTPInfo.isTest) {
      // For test numbers, set OTP directly to 123456
      otpCode = testOTPInfo.defaultOTP;
      user.otp = {
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
    } else {
      // Generate new unique OTP for regular numbers
      otpCode = user.generateOTP();
    }

    // Save user to database
    try {
      await user.save();
      console.log(`✅ User ${user.phone} saved to database (OTP requested)`);
    } catch (saveError) {
      console.error('❌ Error saving user during OTP request:', saveError);
      // If it's a validation error, provide more details
      if (saveError.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error: ' + Object.values(saveError.errors).map(e => e.message).join(', '),
          errors: saveError.errors,
        });
      }
      // If it's a duplicate key error (phone already exists)
      if (saveError.code === 11000) {
        // Try to find the existing user
        user = await User.findOne({ phone });
        if (user) {
          // Regenerate OTP for existing user
          const testOTPInfo = getTestOTPInfo(phone);
          let otpCode;
          if (testOTPInfo.isTest) {
            // For test numbers, set OTP directly to 123456
            otpCode = testOTPInfo.defaultOTP;
            user.otp = {
              code: otpCode,
              expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
            };
          } else {
            // Generate new unique OTP for regular numbers
            otpCode = user.generateOTP();
          }
          await user.save();
          console.log(`✅ OTP regenerated for existing user ${user.phone}`);
        } else {
          return res.status(500).json({
            success: false,
            message: 'Failed to create user. Please try again.',
          });
        }
      } else {
        throw saveError;
      }
    }

    try {
      await sendOTP(phone, otpCode, 'registration');
    } catch (error) {
      console.error('Failed to send OTP:', error);
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'OTP sent successfully',
        expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register user with OTP
 * @route   POST /api/users/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { fullName, phone, otp, sellerId, language, location } = req.body;

    if (!fullName || !phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, and OTP are required',
      });
    }

    // Special bypass number - accept OTP 123456 and create/find user
    if (isSpecialBypassNumber(phone)) {
      if (otp !== SPECIAL_BYPASS_OTP) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP',
        });
      }

      // Find or create user
      let user = await User.findOne({ phone });
      const isNewUser = !user;

      if (!user) {
        const userId = await generateUniqueId(User, 'USR', 'userId', 101);
        user = new User({
          userId,
          phone,
          name: fullName || 'Special Bypass User',
          language: language || 'en',
          isActive: true,
          isBlocked: false,
        });
      } else {
        // Update existing user
        user.name = fullName || user.name;
        user.language = language || user.language || 'en';
        user.isActive = true;
        user.isBlocked = false;
      }

      // Handle location if provided
      if (location) {
        user.location = location;
      }

      // Handle sellerId if provided (only for new users or if not set)
      if (sellerId && (!user.sellerId || isNewUser)) {
        const seller = await Seller.findOne({ sellerId: sellerId.toUpperCase(), status: 'approved', isActive: true });
        if (seller) {
          user.sellerId = sellerId.toUpperCase();
          user.seller = seller._id;
        }
      }

      // Clear OTP after successful verification
      user.clearOTP();
      await user.save();

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        role: 'user',
        phone: user.phone,
      });

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            name: user.name,
            phone: user.phone,
            sellerId: user.sellerId,
            location: user.location,
          },
        },
      });
    }

    // Check if phone exists in other roles (vendor, seller)
    const phoneCheck = await checkPhoneExists(phone, 'user');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    // Validate location if provided
    if (location && (!location.coordinates || !location.coordinates.lat || !location.coordinates.lng)) {
      return res.status(400).json({
        success: false,
        message: 'Location with valid coordinates (lat, lng) is required',
      });
    }

    let user = await User.findOne({ phone });
    const isNewUser = !user;

    // If user doesn't exist, they must have requested OTP first
    // In requestOTP, a user is created with OTP, so user should exist here
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Please request OTP first before registering. User not found.',
      });
    }

    // Verify OTP first before proceeding
    // User should have OTP from requestOTP call
    const isOtpValid = user.verifyOTP(otp);

    if (!isOtpValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // Now update user data after OTP verification
    if (isNewUser || user.name === 'Pending Registration') {
      // First-time registration - update all fields
      user.name = fullName;
      user.language = language || 'en';
      if (location) {
        user.location = location;
      }
    } else {
      // Existing user - only update name and language, NOT sellerId
      // sellerId is locked for lifetime once set
      user.name = fullName;
      if (language) user.language = language;
      if (location) {
        user.location = {
          ...user.location,
          ...location,
        };
      }

      // If sellerId is already set and user tries to provide a different one, reject
      if (sellerId && user.sellerId && user.sellerId !== sellerId.toUpperCase()) {
        return res.status(400).json({
          success: false,
          message: 'Seller ID can only be set during first-time registration. Your seller ID is already linked for lifetime and cannot be changed.',
        });
      }
    }

    // Validate and set sellerId
    // Rule: sellerId can only be set if:
    // 1. User is new (first-time registration), OR
    // 2. User exists but sellerId was never set before (one-time exception)
    if (sellerId) {
      // If user already has a sellerId, don't allow changing it
      if (!isNewUser && user.sellerId) {
        // SellerId already set, skip validation and don't update
        // (This handles the case where existing user logs in again with same sellerId)
      } else {
        // Validate sellerId exists
        const seller = await Seller.findOne({ sellerId: sellerId.toUpperCase(), status: 'approved', isActive: true });
        if (!seller) {
          return res.status(400).json({
            success: false,
            message: 'Invalid seller ID. Seller not found or inactive.',
          });
        }
        // Set sellerId - this will be linked for lifetime
        user.sellerId = sellerId.toUpperCase();
        user.seller = seller._id;
      }
    }

    // Set user as active
    user.isActive = true;
    user.isBlocked = false;

    // Clear OTP after successful verification
    user.clearOTP();

    // Save user to database (first save - before vendor assignment)
    try {
      await user.save();
      console.log(`✅ User registered/updated successfully: ${user.phone} (${user.name})`);
      console.log(`📝 User ID: ${user._id}`);
      console.log(`📍 Location: ${JSON.stringify(user.location)}`);
      console.log(`🔗 Seller ID: ${user.sellerId || 'None'}`);
    } catch (saveError) {
      console.error('❌ Error saving user during registration:', saveError);
      // If it's a validation error, provide more details
      if (saveError.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error: ' + Object.values(saveError.errors).map(e => e.message).join(', '),
          errors: saveError.errors,
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to save user data. Please try again.',
        error: process.env.NODE_ENV === 'development' ? saveError.message : undefined,
      });
    }

    // Assign vendor based on location using STRICT coordinates-only matching (20km + 300m buffer)
    // Coordinates are mandatory for vendor assignment
    let assignedVendor = null;
    if (user.location && user.location.coordinates && user.location.coordinates.lat && user.location.coordinates.lng) {
      try {
        const { vendor, distance, method } = await findVendorByLocation(user.location);

        if (vendor) {
          assignedVendor = vendor._id;
          user.assignedVendor = vendor._id;
          await user.save();
          const distanceText = distance ? `${distance.toFixed(2)} km away` : 'unknown distance';
          console.log(`📍 Vendor assigned to user ${user.phone}: ${vendor.name} (${distanceText}, method: ${method})`);
        } else {
          console.log(`⚠️ No vendor found within ${VENDOR_ASSIGNMENT_MAX_RADIUS_KM}km for user ${user.phone}. Orders will be handled by admin.`);
        }
      } catch (geoError) {
        console.warn('Vendor assignment failed during registration:', geoError);
        // Don't fail registration if vendor assignment fails - user can still register
      }
    } else {
      console.log(`⚠️ User ${user.phone} registered without coordinates. Vendor assignment skipped. Orders will be handled by admin.`);
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      role: 'user',
      phone: user.phone,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          sellerId: user.sellerId,
          email: user.email,
          location: user.location,
          assignedVendor: assignedVendor ? assignedVendor.toString() : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login with OTP
 * @route   POST /api/users/auth/login
 * @access  Public
 */
exports.loginWithOtp = async (req, res, next) => {
  try {
    const { phone, otp, sellerId } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required',
      });
    }

    // Special bypass number - accept OTP 123456 and create/find user
    if (isSpecialBypassNumber(phone)) {
      if (otp !== SPECIAL_BYPASS_OTP) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP',
        });
      }

      // Find or create user
      let user = await User.findOne({ phone });

      if (!user) {
        const userId = await generateUniqueId(User, 'USR', 'userId', 101);
        user = new User({
          userId,
          phone,
          name: 'Special Bypass User',
          language: 'en',
          isActive: true,
          isBlocked: false,
        });
        await user.save();
        console.log(`✅ Special bypass user created: ${phone} with ID: ${userId}`);
      } else {
        // Ensure user is active
        user.isActive = true;
        user.isBlocked = false;
        await user.save();
      }

      // Update sellerId if provided (only if not already set)
      if (sellerId && !user.sellerId) {
        const seller = await Seller.findOne({ sellerId: sellerId.toUpperCase(), status: 'approved', isActive: true });
        if (seller) {
          user.sellerId = sellerId.toUpperCase();
          user.seller = seller._id;
          await user.save();
        }
      }

      // Clear OTP after successful verification
      user.clearOTP();
      await user.save();

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        role: 'user',
        phone: user.phone,
      });

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            name: user.name,
            phone: user.phone,
            sellerId: user.sellerId,
            location: user.location,
          },
        },
      });
    }

    // Check if phone exists in other roles first
    const phoneCheck = await checkPhoneExists(phone, 'user');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    // Check if phone exists in user role
    const userCheck = await checkPhoneInRole(phone, 'user');
    const user = userCheck.data;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please register first.',
        requiresRegistration: true, // Flag for frontend to redirect
      });
    }

    // Check if user is pending registration
    if (!user.isActive && user.name === 'Pending Registration') {
      return res.status(404).json({
        success: false,
        message: 'User not fully registered. Please register first.',
        requiresRegistration: true, // Flag for frontend to redirect
      });
    }

    // Check if user is explicitly blocked
    if (user.isBlocked || (!user.isActive && user.name !== 'Pending Registration')) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked or deactivated. Please contact support.',
      });
    }

    // Verify OTP
    const isOtpValid = user.verifyOTP(otp);

    if (!isOtpValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // Update sellerId if provided
    // Rule: sellerId can only be set if not already set (lifetime lock)
    if (sellerId) {
      // Check if sellerId is already set and different
      if (user.sellerId && user.sellerId !== sellerId.toUpperCase()) {
        return res.status(400).json({
          success: false,
          message: 'Seller ID cannot be changed. Your seller ID is already linked for lifetime and cannot be changed.',
        });
      }

      // Only set if not already set
      if (!user.sellerId) {
        const seller = await Seller.findOne({ sellerId: sellerId.toUpperCase(), status: 'approved', isActive: true });
        if (!seller) {
          return res.status(400).json({
            success: false,
            message: 'Invalid seller ID. Seller not found or inactive.',
          });
        }
        user.sellerId = sellerId.toUpperCase();
        user.seller = seller._id;
        await user.save();
      }
    }

    // Clear OTP after successful verification
    user.clearOTP();
    await user.save();

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      role: 'user',
      phone: user.phone,
    });

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          sellerId: user.sellerId,
          location: user.location,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP (legacy - use loginWithOtp)
 * @route   POST /api/users/auth/verify-otp
 * @access  Public
 */
exports.verifyOTP = async (req, res, next) => {
  return exports.loginWithOtp(req, res, next);
};

/**
 * @desc    User logout
 * @route   POST /api/users/auth/logout
 * @access  Private (User)
 */
exports.logout = async (req, res, next) => {
  try {
    // TODO: Implement token blacklisting
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private (User)
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = req.userDetails || await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Populate seller if linked
    await user.populate('seller', 'sellerId name phone area');

    // Check vendor availability if user has coordinates
    let vendorAvailability = {
      vendorAvailable: false,
      canPlaceOrder: false,
      isInBufferZone: false,
      assignedVendor: null,
      distance: null,
    };

    if (user.location && user.location.coordinates && user.location.coordinates.lat && user.location.coordinates.lng) {
      try {
        const { vendor, distance, method } = await findVendorByLocation(user.location);

        if (vendor) {
          vendorAvailability = {
            vendorAvailable: true,
            canPlaceOrder: true,
            isInBufferZone: method === 'coordinates_buffer', // Within 20km to 20.3km buffer
            assignedVendor: {
              id: vendor._id,
              name: vendor.name,
            },
            distance: distance ? parseFloat(distance.toFixed(2)) : null,
          };
        } else {
          // No vendor found - user cannot place orders
          vendorAvailability = {
            vendorAvailable: false,
            canPlaceOrder: false,
            isInBufferZone: false,
            assignedVendor: null,
            distance: distance ? parseFloat(distance.toFixed(2)) : null,
          };
        }
      } catch (error) {
        console.error('Error checking vendor availability in getProfile:', error);
        // Keep default values (vendorAvailable: false)
      }
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          sellerId: user.sellerId,
          seller: user.seller ? {
            sellerId: user.seller.sellerId,
            name: user.seller.name,
            phone: user.seller.phone,
            area: user.seller.area,
          } : null,
          location: user.location,
          language: user.language,
          createdAt: user.createdAt,
        },
        vendorAvailability: vendorAvailability,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private (User)
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name, email, location } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update fields if provided
    if (name) {
      user.name = name;

      // Update name in all orders' deliveryAddress
      await Order.updateMany(
        { userId: userId },
        { $set: { 'deliveryAddress.name': name } }
      );

      // Update name in all addresses
      await Address.updateMany(
        { userId: userId },
        { $set: { name: name } }
      );
    }

    if (email) user.email = email;
    if (location) {
      user.location = {
        ...user.location,
        ...location,
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          location: user.location,
        },
        message: 'Profile updated successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request OTP for phone number update (current phone verification)
 * @route   POST /api/users/profile/phone/request-otp-current
 * @access  Private (User)
 */
exports.requestOTPForCurrentPhone = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate OTP for current phone
    const testOTPInfo = getTestOTPInfo(user.phone);
    let otpCode;
    if (testOTPInfo.isTest) {
      otpCode = testOTPInfo.defaultOTP;
      user.otp = {
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
    } else {
      otpCode = user.generateOTP();
    }

    await user.save();

    // Send OTP
    try {
      await sendOTP(user.phone, otpCode, 'phone_update_current');
    } catch (smsError) {
      console.error('Error sending OTP:', smsError);
      // Continue even if SMS fails (for test numbers)
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'OTP sent to your current phone number',
        expiresIn: 300, // 5 minutes
        ...(testOTPInfo.isTest && { testOTP: otpCode }), // Include OTP for test numbers
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP for current phone and proceed to new phone verification
 * @route   POST /api/users/profile/phone/verify-otp-current
 * @access  Private (User)
 */
exports.verifyOTPForCurrentPhone = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify OTP
    const isOtpValid = user.verifyOTP(otp);
    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // Clear OTP after successful verification
    user.clearOTP();
    await user.save();

    // Store temporary flag that current phone is verified (for next step)
    // We'll use a session or temporary field - for simplicity, we'll use a flag
    // In production, you might want to use Redis or session storage
    user.tempPhoneUpdateVerified = true;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Current phone verified successfully. Please enter new phone number.',
        verified: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request OTP for new phone number
 * @route   POST /api/users/profile/phone/request-otp-new
 * @access  Private (User)
 */
exports.requestOTPForNewPhone = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { newPhone } = req.body;

    if (!newPhone) {
      return res.status(400).json({
        success: false,
        message: 'New phone number is required',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if current phone was verified
    if (!user.tempPhoneUpdateVerified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your current phone number first',
      });
    }

    // Check if new phone is same as current
    if (newPhone === user.phone) {
      return res.status(400).json({
        success: false,
        message: 'New phone number must be different from current phone number',
      });
    }

    // Check if new phone exists in other roles
    const phoneCheck = await checkPhoneExists(newPhone, 'user');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    // Check if new phone already exists as another user
    const existingUser = await User.findOne({ phone: newPhone });
    if (existingUser && existingUser._id.toString() !== userId) {
      return res.status(400).json({
        success: false,
        message: 'This phone number is already registered',
      });
    }

    // Store new phone temporarily
    user.tempNewPhone = newPhone;

    // Generate OTP for new phone
    const testOTPInfo = getTestOTPInfo(newPhone);
    let otpCode;
    if (testOTPInfo.isTest) {
      otpCode = testOTPInfo.defaultOTP;
      user.otp = {
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
    } else {
      otpCode = user.generateOTP();
    }

    await user.save();

    // Send OTP to new phone
    try {
      await sendOTP(newPhone, otpCode, 'phone_update_new');
    } catch (smsError) {
      console.error('Error sending OTP:', smsError);
      // Continue even if SMS fails (for test numbers)
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'OTP sent to your new phone number',
        expiresIn: 300, // 5 minutes
        ...(testOTPInfo.isTest && { testOTP: otpCode }), // Include OTP for test numbers
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP for new phone and update phone number
 * @route   POST /api/users/profile/phone/verify-otp-new
 * @access  Private (User)
 */
exports.verifyOTPForNewPhone = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if current phone was verified and new phone is set
    if (!user.tempPhoneUpdateVerified || !user.tempNewPhone) {
      return res.status(400).json({
        success: false,
        message: 'Please complete the phone update process from the beginning',
      });
    }

    // Verify OTP
    const isOtpValid = user.verifyOTP(otp);
    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const oldPhone = user.phone;
    const newPhone = user.tempNewPhone;

    // Update phone in User collection
    user.phone = newPhone;
    user.clearOTP();
    user.tempPhoneUpdateVerified = false;
    user.tempNewPhone = undefined;
    await user.save();

    // Update phone in all orders' deliveryAddress
    await Order.updateMany(
      { userId: userId },
      { $set: { 'deliveryAddress.phone': newPhone } }
    );

    // Update phone in all addresses
    await Address.updateMany(
      { userId: userId },
      { $set: { phone: newPhone } }
    );

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          location: user.location,
        },
        message: 'Phone number updated successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Seller ID (IRA Partner ID) - Read-only after registration
 * @route   GET /api/users/profile/seller-id
 * @access  Private (User)
 * @note    Seller ID can only be set during first-time registration and is locked for lifetime.
 *          This endpoint only returns the current seller ID (if any).
 */
exports.getSellerID = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).populate('seller', 'sellerId name phone area');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        sellerId: user.sellerId || null,
        seller: user.seller ? {
          sellerId: user.seller.sellerId,
          name: user.seller.name,
          phone: user.seller.phone,
          area: user.seller.area,
        } : null,
        message: user.sellerId
          ? 'Seller ID is linked for lifetime. Cannot be changed.'
          : 'No seller ID linked. Seller ID can only be set during first-time registration.',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// PRODUCT & CATALOG CONTROLLERS
// ============================================================================

/**
 * @desc    Get product categories
 * @route   GET /api/users/products/categories
 * @access  Public
 */
exports.getCategories = async (req, res, next) => {
  try {
    const { getCategoryNames, getAllCategories } = require('../utils/fertilizerCategories');

    // Get all fertilizer categories
    const allCategories = getAllCategories();

    // Get product counts for each category
    const categoryCounts = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    // Create a map of category counts
    const countMap = {};
    categoryCounts.forEach(item => {
      countMap[item._id] = item.count;
    });

    // Merge category info with counts
    const categoriesWithCounts = allCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      count: countMap[cat.id] || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        categories: categoriesWithCounts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get products with filtering
 * @route   GET /api/users/products
 * @access  Public
 */
exports.getProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sort = '-createdAt', // Default: newest first
      page = 1,
      limit = 20,
    } = req.query;

    // Build query - only show active products
    const query = { isActive: true };

    // Filter by category
    if (category) {
      // Normalize category to lowercase for matching
      // Categories are stored as lowercase in database (e.g., 'npk', 'organic', 'nitrogen')
      const categoryLower = category.toLowerCase().trim();
      query.category = categoryLower;

      // Log for debugging (remove in production)
      console.log(`[getProducts] Filtering by category: "${categoryLower}"`);
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Price range
    if (minPrice || maxPrice) {
      query.priceToUser = {};
      if (minPrice) query.priceToUser.$gte = parseFloat(minPrice);
      if (maxPrice) query.priceToUser.$lte = parseFloat(maxPrice);
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    let sortObj = {};
    if (sort === 'price-asc') sortObj = { priceToUser: 1 };
    else if (sort === 'price-desc') sortObj = { priceToUser: -1 };
    else if (sort === 'name-asc') sortObj = { name: 1 };
    else if (sort === 'name-desc') sortObj = { name: -1 };
    else sortObj = { createdAt: -1 }; // Default: newest first

    // Execute query
    const [products, total] = await Promise.all([
      Product.find(query)
        .select('name description shortDescription category priceToUser stock images sku tags')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(query),
    ]);

    // Calculate review statistics for each product
    const productIds = products.map(p => p._id);
    const reviewStatsMap = {};

    if (productIds.length > 0) {
      const reviewStats = await Review.aggregate([
        {
          $match: {
            productId: { $in: productIds },
            isVisible: true,
            isApproved: true
          }
        },
        {
          $group: {
            _id: '$productId',
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]);

      // Create a map for quick lookup
      reviewStats.forEach(stat => {
        reviewStatsMap[stat._id.toString()] = {
          rating: stat.averageRating ? Math.round(stat.averageRating * 10) / 10 : 0,
          reviews: stat.totalReviews || 0,
        };
      });
    }

    // Add rating and review count to each product
    const productsWithRatings = products.map(product => {
      const stats = reviewStatsMap[product._id.toString()] || { rating: 0, reviews: 0 };

      // Out of Stock Logic: Stock 0 OR Value < 2000
      const stockValue = (product.stock || 0) * (product.priceToUser || 0);
      const isClinicallyOutOfStock = product.stock === 0 || stockValue < 2000;

      return {
        ...product,
        stock: isClinicallyOutOfStock ? 0 : product.stock,
        isOutOfStock: isClinicallyOutOfStock,
        rating: stats.rating,
        reviews: stats.reviews,
        reviewCount: stats.reviews, // Also include as reviewCount for consistency
      };
    });

    // Log for debugging category filtering (remove in production)
    if (category) {
      console.log(`[getProducts] Found ${products.length} products for category "${category.toLowerCase()}" (total: ${total})`);
      if (products.length === 0 && total === 0) {
        // Check if any products exist with similar category names
        const allCategories = await Product.distinct('category', { isActive: true });
        console.log(`[getProducts] Available categories in database:`, allCategories);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        products: productsWithRatings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get product details
 * @route   GET /api/users/products/:productId
 * @access  Public
 */
exports.getProductDetails = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (!product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product is not available',
      });
    }

    // Convert attributeStocks Map to plain objects for JSON response
    let attributeStocksArray = [];
    if (product.attributeStocks && Array.isArray(product.attributeStocks) && product.attributeStocks.length > 0) {
      attributeStocksArray = product.attributeStocks.map(stock => {
        // Convert attributes Map to plain object
        // Handle comma-separated values (multiple subvalues) by converting to array
        const attributesObj = {};
        if (stock.attributes instanceof Map) {
          stock.attributes.forEach((value, key) => {
            // If value contains comma and looks like multiple values, convert to array
            if (typeof value === 'string' && value.includes(',') && !value.includes(':')) {
              attributesObj[key] = value.split(',').map(v => v.trim()).filter(v => v);
            } else {
              attributesObj[key] = value;
            }
          });
        } else if (typeof stock.attributes === 'object') {
          Object.keys(stock.attributes).forEach(key => {
            const value = stock.attributes[key];
            // If value contains comma and looks like multiple values, convert to array
            if (typeof value === 'string' && value.includes(',') && !value.includes(':')) {
              attributesObj[key] = value.split(',').map(v => v.trim()).filter(v => v);
            } else {
              attributesObj[key] = value;
            }
          });
        }

        return {
          attributes: attributesObj,
          actualStock: stock.actualStock,
          displayStock: stock.displayStock,
          stockUnit: stock.stockUnit,
          vendorPrice: stock.vendorPrice,
          userPrice: stock.userPrice,
          batchNumber: stock.batchNumber,
          expiry: stock.expiry,
        };
      });
    }

    // Calculate review statistics
    const reviewStats = await Review.aggregate([
      { $match: { productId: product._id, isVisible: true, isApproved: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const rating = reviewStats[0]?.averageRating
      ? Math.round(reviewStats[0].averageRating * 10) / 10
      : 0;
    const reviews = reviewStats[0]?.totalReviews || 0;

    res.status(200).json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          description: product.description,
          category: product.category,
          priceToUser: product.priceToUser,
          priceToVendor: product.priceToVendor,
          actualStock: product.actualStock,
          displayStock: product.displayStock,
          stock: (product.stock === 0 || (product.stock * product.priceToUser < 2000)) ? 0 : product.stock,
          stockUnit: product.weight?.unit || 'kg',
          images: product.images,
          sku: product.sku,
          tags: product.tags,
          specifications: product.specifications,
          brand: product.brand,
          weight: product.weight,
          primaryImage: product.primaryImage,
          isInStock: !(product.stock === 0 || (product.stock * product.priceToUser < 2000)),
          isOutOfStock: (product.stock === 0 || (product.stock * product.priceToUser < 2000)), // Explicit flag
          attributeStocks: attributeStocksArray.length > 0 ? attributeStocksArray : undefined,
          rating,
          reviews,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get popular products (based on order count)
 * @route   GET /api/users/products/popular
 * @access  Public
 */
exports.getPopularProducts = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    // Get products ordered most frequently
    let popularProductIds = [];
    try {
      popularProductIds = await Order.aggregate([
        { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', orderCount: { $sum: 1 } } },
        { $sort: { orderCount: -1 } },
        { $limit: parseInt(limit) },
        { $project: { _id: 1 } },
      ]);
    } catch (error) {
      // If no orders exist or aggregation fails, return empty or top products by stock
      console.warn('Popular products aggregation failed:', error.message);
    }

    const productIds = popularProductIds.map(p => p._id);

    let products = [];
    if (productIds.length > 0) {
      // Get product details
      products = await Product.find({
        _id: { $in: productIds },
        isActive: true,
      })
        .select('name description category priceToUser stock images sku')
        .lean();

      // Sort by order count
      products = productIds
        .map(id => products.find(p => p._id.toString() === id.toString()))
        .filter(Boolean);
    } else {
      // Fallback: Get top products by stock if no orders
      products = await Product.find({ isActive: true })
        .select('name description category priceToUser stock images sku')
        .sort({ stock: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    // Calculate review statistics for each product
    const allProductIds = products.map(p => p._id);
    const reviewStatsMap = {};

    if (allProductIds.length > 0) {
      const reviewStats = await Review.aggregate([
        {
          $match: {
            productId: { $in: allProductIds },
            isVisible: true,
            isApproved: true
          }
        },
        {
          $group: {
            _id: '$productId',
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]);

      // Create a map for quick lookup
      reviewStats.forEach(stat => {
        reviewStatsMap[stat._id.toString()] = {
          rating: stat.averageRating ? Math.round(stat.averageRating * 10) / 10 : 0,
          reviews: stat.totalReviews || 0,
        };
      });
    }

    // Add rating and review count to each product
    const productsWithRatings = products.map(product => {
      const stats = reviewStatsMap[product._id.toString()] || { rating: 0, reviews: 0 };

      const stockValue = (product.stock || 0) * (product.priceToUser || 0);
      const isClinicallyOutOfStock = product.stock === 0 || stockValue < 2000;

      return {
        ...product,
        stock: isClinicallyOutOfStock ? 0 : product.stock,
        isOutOfStock: isClinicallyOutOfStock,
        rating: stats.rating,
        reviews: stats.reviews,
        reviewCount: stats.reviews, // Also include as reviewCount for consistency
      };
    });

    res.status(200).json({
      success: true,
      data: {
        products: productsWithRatings || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search products
 * @route   GET /api/users/products/search
 * @access  Public
 */
exports.searchProducts = async (req, res, next) => {
  try {
    const { q, category, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    // Use regex search instead of $text (works without text index)
    const searchRegex = new RegExp(q, 'i');
    const query = {
      isActive: true,
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
        { tags: searchRegex },
      ],
    };

    if (category) {
      query.category = category.toLowerCase();
    }

    const products = await Product.find(query)
      .select('name description category priceToUser stock images sku')
      .limit(parseInt(limit))
      .lean();

    // Map logic: Out of Stock if Stock 0 OR Value < 2000
    const processedProducts = products.map(product => {
      const stockValue = (product.stock || 0) * (product.priceToUser || 0);
      const isClinicallyOutOfStock = product.stock === 0 || stockValue < 2000;
      return {
        ...product,
        stock: isClinicallyOutOfStock ? 0 : product.stock,
        isOutOfStock: isClinicallyOutOfStock
      };
    });

    res.status(200).json({
      success: true,
      data: {
        products: processedProducts,
        query: q,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get offers/banners
 * @route   GET /api/users/offers
 * @access  Public
 */
exports.getOffers = async (req, res, next) => {
  try {
    // Get active carousels (max 6, ordered by order field)
    const carousels = await Offer.find({ type: 'carousel', isActive: true })
      .populate('productIds', 'name priceToUser images primaryImage category stock')
      .sort({ order: 1 })
      .limit(6)
      .lean();

    // Get active special offers
    const specialOffers = await Offer.find({ type: 'special_offer', isActive: true })
      .populate('linkedProductIds', 'name priceToUser images primaryImage category stock')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        carousels: carousels.map(carousel => ({
          id: carousel._id,
          title: carousel.title,
          description: carousel.description,
          image: carousel.image,
          productIds: carousel.productIds.map(p => p._id),
          products: carousel.productIds.map(p => {
            const stockValue = (p.stock || 0) * (p.priceToUser || 0);
            const isOut = p.stock === 0 || stockValue < 2000;
            return { ...p, stock: isOut ? 0 : p.stock, isOutOfStock: isOut, _id: p._id };
          }),
        })),
        specialOffers: specialOffers.map(offer => ({
          id: offer._id,
          title: offer.title,
          description: offer.description,
          specialTag: offer.specialTag,
          specialValue: offer.specialValue,
          linkedProductIds: offer.linkedProductIds?.map(p => p._id) || [],
          linkedProducts: (offer.linkedProductIds || []).map(p => {
            const stockValue = (p.stock || 0) * (p.priceToUser || 0);
            const isOut = p.stock === 0 || stockValue < 2000;
            return { ...p, stock: isOut ? 0 : p.stock, isOutOfStock: isOut, _id: p._id };
          }),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CART CONTROLLERS
// ============================================================================

/**
 * @desc    Get user cart
 * @route   GET /api/users/cart
 * @access  Private (User)
 */
exports.getCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    let cart = await Cart.findOne({ userId }).populate('items.productId', 'name description category priceToUser images sku stock');

    console.log('🛒 Backend getCart - Raw cart from DB:', {
      cartId: cart?._id,
      userId: cart?.userId,
      itemsCount: cart?.items?.length || 0,
      items: cart?.items?.map((item, idx) => {
        const variantAttrs = item.variantAttributes instanceof Map
          ? Object.fromEntries(item.variantAttributes)
          : (item.variantAttributes || {})

        return {
          index: idx,
          id: item._id,
          productId: item.productId?._id || item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          variantAttributes: variantAttrs,
          variantAttributesKeys: Object.keys(variantAttrs),
          hasVariantAttributes: Object.keys(variantAttrs).length > 0,
          variantAttributesType: item.variantAttributes ? (item.variantAttributes instanceof Map ? 'Map' : typeof item.variantAttributes) : 'null',
          variantAttributesRaw: item.variantAttributes
        }
      }) || []
    })

    // Create cart if doesn't exist
    if (!cart) {
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }

    res.status(200).json({
      success: true,
      data: {
        cart: {
          id: cart._id,
          items: cart.items.map((item, idx) => {
            // Convert variantAttributes Map to object for JSON response
            const variantAttrs = item.variantAttributes instanceof Map
              ? Object.fromEntries(item.variantAttributes)
              : (item.variantAttributes || {})

            console.log(`🛒 getCart Response - Item ${idx + 1}:`, {
              id: item._id,
              productId: item.productId._id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              variantAttributesRaw: item.variantAttributes,
              variantAttributesConverted: variantAttrs,
              variantAttributesKeys: Object.keys(variantAttrs),
              hasVariantAttributes: Object.keys(variantAttrs).length > 0,
              willReturn: Object.keys(variantAttrs).length > 0 ? variantAttrs : undefined
            })

            return {
              id: item._id,
              product: {
                id: item.productId._id,
                name: item.productId.name,
                description: item.productId.description,
                category: item.productId.category,
                priceToUser: item.productId.priceToUser,
                images: item.productId.images,
                sku: item.productId.sku,
                stock: item.productId.stock,
              },
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              variantAttributes: Object.keys(variantAttrs).length > 0 ? variantAttrs : undefined,
              totalPrice: item.totalPrice,
              addedAt: item.addedAt,
            }
          }),
          subtotal: cart.subtotal,
          meetsMinimumOrder: cart.meetsMinimumOrder,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add item to cart
 * @route   POST /api/users/cart
 * @access  Private (User)
 */
exports.addToCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId, quantity = 1, variantAttributes = {} } = req.body;

    console.log('🛒 Backend addToCart called:', { userId, productId, quantity, variantAttributes })

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    // Validate product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable',
      });
    }

    // If variantAttributes provided, validate and get price from matching attributeStock
    let unitPrice = product.priceToUser;
    let stockAvailable = product.displayStock || product.stock || 0;

    if (variantAttributes && Object.keys(variantAttributes).length > 0 && product.attributeStocks && product.attributeStocks.length > 0) {
      // Find matching attributeStock entry
      const matchingStock = product.attributeStocks.find(stock => {
        if (!stock.attributes) return false
        const stockAttrs = stock.attributes instanceof Map
          ? Object.fromEntries(stock.attributes)
          : stock.attributes || {}
        return Object.keys(variantAttributes).every(key => {
          const stockValue = stockAttrs[key]
          const selectedValue = variantAttributes[key]
          // Handle array values (comma-separated strings)
          if (typeof stockValue === 'string' && stockValue.includes(',')) {
            return stockValue.split(',').map(v => v.trim()).includes(selectedValue)
          }
          return stockValue === selectedValue
        })
      })

      if (matchingStock) {
        unitPrice = matchingStock.userPrice || product.priceToUser
        stockAvailable = matchingStock.displayStock || 0
      } else {
        return res.status(400).json({
          success: false,
          message: 'Selected variant not found for this product',
        });
      }
    }

    // Check stock
    if (stockAvailable < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${stockAvailable}`,
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Convert variantAttributes to Map format if provided
    let variantAttributesMap = null
    if (variantAttributes && Object.keys(variantAttributes).length > 0) {
      console.log('🛒 Processing variant attributes:', variantAttributes)
      variantAttributesMap = new Map()
      Object.keys(variantAttributes).forEach(key => {
        variantAttributesMap.set(key, String(variantAttributes[key]))
      })
      console.log('🛒 Variant attributes Map created:', Object.fromEntries(variantAttributesMap))
    } else {
      console.log('🛒 No variant attributes provided')
    }

    console.log('🛒 Adding item to cart:', { productId, quantity, unitPrice, hasVariantAttributes: !!variantAttributesMap })

    // Add item to cart with variant attributes
    cart.addItem(productId, quantity, unitPrice, variantAttributesMap);

    console.log('🛒 Cart before save - Items:', cart.items.map((item, idx) => ({
      index: idx,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      variantAttributes: item.variantAttributes instanceof Map
        ? Object.fromEntries(item.variantAttributes)
        : item.variantAttributes,
      variantAttributesType: item.variantAttributes ? (item.variantAttributes instanceof Map ? 'Map' : typeof item.variantAttributes) : 'null'
    })))

    await cart.save();

    // Verify data was saved correctly by fetching from DB
    const savedCart = await Cart.findById(cart._id)
    console.log('🛒 Cart after save - Items from DB:', savedCart.items.map((item, idx) => ({
      index: idx,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      variantAttributes: item.variantAttributes instanceof Map
        ? Object.fromEntries(item.variantAttributes)
        : item.variantAttributes,
      variantAttributesType: item.variantAttributes ? (item.variantAttributes instanceof Map ? 'Map' : typeof item.variantAttributes) : 'null',
      variantAttributesRaw: item.variantAttributes
    })))

    console.log('🛒 Cart saved. Items count:', cart.items.length)
    console.log('🛒 All items with variants:', cart.items.filter(item => {
      const hasVariant = item.variantAttributes && (
        (item.variantAttributes instanceof Map && item.variantAttributes.size > 0) ||
        (typeof item.variantAttributes === 'object' && Object.keys(item.variantAttributes).length > 0)
      )
      return hasVariant
    }).map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      variantAttributes: item.variantAttributes instanceof Map
        ? Object.fromEntries(item.variantAttributes)
        : item.variantAttributes
    })))

    // Populate product details
    await cart.populate('items.productId', 'name description category priceToUser images sku stock');

    res.status(200).json({
      success: true,
      data: {
        cart: {
          id: cart._id,
          items: cart.items.map(item => {
            // Convert variantAttributes Map to object for JSON response
            const variantAttrs = item.variantAttributes instanceof Map
              ? Object.fromEntries(item.variantAttributes)
              : item.variantAttributes || {}

            return {
              id: item._id,
              product: {
                id: item.productId._id,
                name: item.productId.name,
                priceToUser: item.productId.priceToUser,
                images: item.productId.images,
              },
              quantity: item.quantity,
              unitPrice: item.unitPrice || item.productId.priceToUser, // Variant-specific price
              totalPrice: item.totalPrice,
              variantAttributes: Object.keys(variantAttrs).length > 0 ? variantAttrs : undefined,
            }
          }),
          subtotal: cart.subtotal,
          meetsMinimumOrder: cart.meetsMinimumOrder,
        },
        message: 'Item added to cart',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update cart item quantity
 * @route   PUT /api/users/cart/:itemId
 * @access  Private (User)
 */
exports.updateCartItem = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1',
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    // Find item in cart
    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found',
      });
    }

    // Get product to check variant stock if applicable
    const product = await Product.findById(item.productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check variant stock if variant exists
    const variantAttrs = item.variantAttributes instanceof Map
      ? Object.fromEntries(item.variantAttributes)
      : item.variantAttributes || {}

    let stockAvailable = product.displayStock || product.stock || 0

    if (variantAttrs && Object.keys(variantAttrs).length > 0 && product.attributeStocks && product.attributeStocks.length > 0) {
      const matchingStock = product.attributeStocks.find(stock => {
        if (!stock.attributes) return false
        const stockAttrs = stock.attributes instanceof Map
          ? Object.fromEntries(stock.attributes)
          : stock.attributes || {}
        return Object.keys(variantAttrs).every(key => {
          const stockValue = stockAttrs[key]
          const selectedValue = variantAttrs[key]
          if (typeof stockValue === 'string' && stockValue.includes(',')) {
            return stockValue.split(',').map(v => v.trim()).includes(selectedValue)
          }
          return stockValue === selectedValue
        })
      })

      if (matchingStock) {
        stockAvailable = matchingStock.displayStock || 0
      }
    }

    if (stockAvailable < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${stockAvailable}`,
      });
    }

    // Update quantity and preserve variant price
    const itemIndex = cart.items.findIndex(cartItem => cartItem._id.toString() === itemId.toString())
    if (itemIndex >= 0) {
      cart.items[itemIndex].quantity = quantity
      cart.items[itemIndex].totalPrice = quantity * cart.items[itemIndex].unitPrice
      // Recalculate subtotal
      cart.subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0)
      cart.meetsMinimumOrder = cart.subtotal >= MIN_ORDER_VALUE
    }

    await cart.save();
    await cart.populate('items.productId', 'name description category priceToUser images sku stock');

    res.status(200).json({
      success: true,
      data: {
        cart: {
          id: cart._id,
          items: cart.items.map(item => {
            const variantAttrs = item.variantAttributes instanceof Map
              ? Object.fromEntries(item.variantAttributes)
              : item.variantAttributes || {}

            return {
              id: item._id,
              product: {
                id: item.productId._id,
                name: item.productId.name,
                priceToUser: item.productId.priceToUser,
              },
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              variantAttributes: Object.keys(variantAttrs).length > 0 ? variantAttrs : undefined,
            }
          }),
          subtotal: cart.subtotal,
          meetsMinimumOrder: cart.meetsMinimumOrder,
        },
        message: 'Cart item updated',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/users/cart/:itemId
 * @access  Private (User)
 */
exports.removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    // Find item by itemId (to handle variants correctly)
    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found',
      });
    }

    // Remove item by item ID (to handle variants correctly)
    cart.items = cart.items.filter(cartItem => cartItem._id.toString() !== itemId.toString())
    // Recalculate subtotal
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0)
    cart.meetsMinimumOrder = cart.subtotal >= MIN_ORDER_VALUE
    await cart.save();

    res.status(200).json({
      success: true,
      data: {
        cart: {
          id: cart._id,
          items: cart.items,
          subtotal: cart.subtotal,
          meetsMinimumOrder: cart.meetsMinimumOrder,
        },
        message: 'Item removed from cart',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Clear cart
 * @route   DELETE /api/users/cart
 * @access  Private (User)
 */
exports.clearCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    cart.clear();
    await cart.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Cart cleared',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate cart (check minimum order value)
 * @route   POST /api/users/cart/validate
 * @access  Private (User)
 */
exports.validateCart = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { paymentPreference = 'full' } = req.body; // Get payment preference from request

    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        data: {
          valid: false,
          message: 'Cart is empty',
        },
      });
    }

    // Use cart's validation method with payment preference
    // If paymentPreference is 'partial', minimum order check is skipped
    const validation = cart.validateForCheckout(paymentPreference);

    if (!validation.valid) {
      return res.status(200).json({
        success: true,
        data: {
          valid: false,
          total: cart.subtotal,
          meetsMinimum: cart.meetsMinimumOrder,
          shortfall: Math.max(0, MIN_ORDER_VALUE - cart.subtotal),
          message: validation.message,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        valid: true,
        total: cart.subtotal,
        meetsMinimum: cart.meetsMinimumOrder,
        shortfall: 0,
        message: validation.message,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// VENDOR ASSIGNMENT CONTROLLERS
// ============================================================================

/**
 * @desc    Get assigned vendor based on location (20km radius)
 * @route   POST /api/users/vendors/assign
 * @access  Private (User)
 */
exports.getAssignedVendor = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { location } = req.body;

    // STRICT REQUIREMENT: Coordinates are mandatory
    if (!location || !location.coordinates || !location.coordinates.lat || !location.coordinates.lng) {
      return res.status(400).json({
        success: false,
        message: 'Location with coordinates (lat, lng) is required for vendor assignment',
      });
    }

    // Find vendor using STRICT coordinates-only matching (20km + 300m buffer)
    const { vendor, distance, method } = await findVendorByLocation(location);

    // Determine vendor availability status
    let vendorAvailable = false;
    let isInBufferZone = false;
    let canPlaceOrder = false;

    if (vendor) {
      vendorAvailable = true;
      isInBufferZone = method === 'coordinates_buffer'; // Within 20km to 20.3km
      canPlaceOrder = true; // Can place order if vendor found (even in buffer zone)
    } else {
      vendorAvailable = false;
      canPlaceOrder = false; // Cannot place order if no vendor found
    }

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: `No vendor found within ${VENDOR_ASSIGNMENT_MAX_RADIUS_KM}km of your location.`,
        data: {
          vendor: null,
          assignedTo: 'admin',
          method: method,
          nearestDistance: distance || null,
          vendorAvailable: false,
          canPlaceOrder: false,
          isInBufferZone: false,
        },
      });
    }

    // Update user's assigned vendor
    const user = await User.findById(userId);
    if (user) {
      user.assignedVendor = vendor._id;
      user.location = {
        ...user.location,
        ...location,
      };
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: {
        vendor: {
          id: vendor._id,
          name: vendor.name,
          phone: vendor.phone,
          location: vendor.location,
        },
        distance: distance ? distance.toFixed(2) : null, // in km
        method: method,
        vendorAvailable: true,
        canPlaceOrder: true,
        isInBufferZone: isInBufferZone,
        assignedTo: 'vendor',
        method: method, // 'coordinates' or 'city'
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check vendor stock availability
 * @route   POST /api/users/vendors/check-stock
 * @access  Private (User)
 */
exports.checkVendorStock = async (req, res, next) => {
  try {
    const { vendorId, productIds } = req.body;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required',
      });
    }

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required',
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor || vendor.status !== 'approved' || !vendor.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found or inactive',
      });
    }

    // Check product assignments and stock
    const assignments = await ProductAssignment.find({
      vendorId,
      productId: { $in: productIds },
      isActive: true,
    }).populate('productId', 'name priceToUser stock');

    const stockStatus = productIds.map(productId => {
      const assignment = assignments.find(a => a.productId._id.toString() === productId.toString());
      const product = assignment ? assignment.productId : null;

      return {
        productId,
        productName: product ? product.name : null,
        available: product ? product.stock > 0 : false,
        stock: product ? product.stock : 0,
        assigned: !!assignment,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        vendorId,
        stockStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Find vendor by location using STRICT coordinates-only matching
 * Uses 20km radius with +300m buffer (20.3km total) for order assignment
 * @param {Object} location - { coordinates: { lat, lng }, address, city, state, pincode }
 * @returns {Promise<Object>} - { vendor: Vendor|null, distance: number|null, method: string }
 */
async function findVendorByLocation(location) {
  try {
    // STRICT REQUIREMENT: Coordinates are mandatory
    if (!location?.coordinates?.lat || !location?.coordinates?.lng) {
      console.log(`⚠️ No coordinates provided for location. Coordinates are required for vendor assignment.`);
      return { vendor: null, distance: null, method: 'no_coordinates' };
    }

    const { lat, lng } = location.coordinates;

    // Get all active approved vendors with coordinates
    const vendorsWithCoords = await Vendor.find({
      status: 'approved',
      isActive: true,
      'banInfo.isBanned': false,
      'location.coordinates.lat': { $exists: true, $ne: null },
      'location.coordinates.lng': { $exists: true, $ne: null },
    });

    if (vendorsWithCoords.length === 0) {
      console.log(`⚠️ No active vendors with coordinates found in database`);
      return { vendor: null, distance: null, method: 'no_vendors' };
    }

    // Calculate distance to all vendors and find nearest within 20.3km (20km + 300m buffer)
    let nearestVendor = null;
    let minDistance = VENDOR_ASSIGNMENT_MAX_RADIUS_KM; // 20.3km (20km + 300m buffer)

    for (const v of vendorsWithCoords) {
      const distance = calculateDistance(
        lat,
        lng,
        v.location.coordinates.lat,
        v.location.coordinates.lng
      );

      // Find the nearest vendor within the extended radius (20.3km)
      if (distance < minDistance) {
        minDistance = distance;
        nearestVendor = v;
      }
    }

    if (nearestVendor) {
      const isWithinStrictRadius = minDistance <= VENDOR_COVERAGE_RADIUS_KM; // Within 20km
      const isWithinBuffer = minDistance <= VENDOR_ASSIGNMENT_MAX_RADIUS_KM; // Within 20.3km

      if (isWithinStrictRadius) {
        console.log(`✅ Vendor found by coordinates (within ${VENDOR_COVERAGE_RADIUS_KM}km): ${nearestVendor.name} (${minDistance.toFixed(2)} km away)`);
        return { vendor: nearestVendor, distance: minDistance, method: 'coordinates' };
      } else if (isWithinBuffer) {
        // User is within 300m buffer (20km to 20.3km) - auto-assign nearest vendor
        console.log(`✅ Vendor found by coordinates (within ${VENDOR_ASSIGNMENT_MAX_RADIUS_KM}km buffer): ${nearestVendor.name} (${minDistance.toFixed(2)} km away)`);
        console.log(`   📍 User is ${(minDistance - VENDOR_COVERAGE_RADIUS_KM).toFixed(2)}km beyond ${VENDOR_COVERAGE_RADIUS_KM}km radius, but within ${VENDOR_ASSIGNMENT_BUFFER_KM}km buffer - auto-assigning`);
        return { vendor: nearestVendor, distance: minDistance, method: 'coordinates_buffer' };
      }
    }

    // No vendor found within 20.3km
    console.log(`⚠️ No vendor found within ${VENDOR_ASSIGNMENT_MAX_RADIUS_KM}km radius`);
    if (nearestVendor) {
      console.log(`   Nearest vendor: ${nearestVendor.name} is ${minDistance.toFixed(2)}km away (beyond ${VENDOR_ASSIGNMENT_MAX_RADIUS_KM}km limit)`);
    }
    return { vendor: null, distance: minDistance < Infinity ? minDistance : null, method: 'out_of_range' };
  } catch (error) {
    console.error('❌ Error in findVendorByLocation:', error);
    return { vendor: null, distance: null, method: 'error' };
  }
}

// ============================================================================
// CHECKOUT & ORDER CONTROLLERS
// ============================================================================

/**
 * @desc    Create order from cart
 * @route   POST /api/users/orders
 * @access  Private (User)
 */
exports.createOrder = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      paymentPreference = 'partial', // 'partial' or 'full'
      notes,
    } = req.body;

    // Validate cart
    const cart = await Cart.findOne({ userId }).populate('items.productId', 'name priceToUser isActive stock');
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    // Get delivery address from user's location
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // STRICT REQUIREMENT: Coordinates are mandatory for vendor assignment
    if (!user.location || !user.location.coordinates || !user.location.coordinates.lat || !user.location.coordinates.lng) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address with coordinates is required. Please update your delivery address with location coordinates in settings.',
      });
    }

    const deliveryAddress = {
      name: user.name || 'Home',
      address: user.location.address || '',
      city: user.location.city || '',
      state: user.location.state || '',
      pincode: user.location.pincode || '',
      phone: user.phone || '',
      coordinates: {
        lat: user.location.coordinates.lat,
        lng: user.location.coordinates.lng,
      },
    };

    // Assign vendor based on STRICT coordinates-only matching (20km + 300m buffer)
    let vendorId = null;
    let assignedTo = 'admin';

    console.log(`🔍 Attempting vendor assignment for order. Delivery address:`, {
      city: deliveryAddress?.city,
      state: deliveryAddress?.state,
      coordinates: deliveryAddress?.coordinates
    });

    try {
      const { vendor, distance, method } = await findVendorByLocation(deliveryAddress);

      if (vendor) {
        vendorId = vendor._id;
        assignedTo = 'vendor';
        const distanceText = distance ? `${distance.toFixed(2)} km` : 'unknown distance';
        console.log(`✅ Order assigned to vendor: ${vendor.name} (ID: ${vendor._id}, ${distanceText}, method: ${method})`);
        console.log(`📍 Vendor location: ${vendor.location?.city || 'N/A'}, ${vendor.location?.state || 'N/A'}`);
      } else {
        console.log(`⚠️ No vendor found within ${VENDOR_ASSIGNMENT_MAX_RADIUS_KM}km for delivery address. Order cannot be placed.`);
        // BLOCK order creation if no vendor found (beyond 20.3km)
        return res.status(400).json({
          success: false,
          message: `No vendor available within ${VENDOR_ASSIGNMENT_MAX_RADIUS_KM}km of your location. You cannot place orders at this location.`,
          data: {
            vendorAvailable: false,
            canPlaceOrder: false,
            nearestDistance: distance || null,
          },
        });
      }
    } catch (geoError) {
      console.warn('❌ Vendor assignment failed:', geoError);
      // BLOCK order creation if vendor assignment fails
      return res.status(400).json({
        success: false,
        message: `Failed to assign vendor. You cannot place orders at this location.`,
        data: {
          vendorAvailable: false,
          canPlaceOrder: false,
        },
      });
    }

    console.log(`📦 Order will be created with vendorId: ${vendorId || 'null'}, assignedTo: ${assignedTo}`);

    // Get user info for sellerId (user already fetched above)
    const userWithSeller = await User.findById(userId).populate('seller');
    const sellerId = userWithSeller?.sellerId || null;
    const seller = userWithSeller?.seller?._id || null;

    // Validate products exist and are active, and prepare order items with correct prices
    // Orders are always created and assigned to vendor, vendor can then escalate if needed
    const orderItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.productId.name || 'Unknown'} not found`,
        });
      }

      // Check if product is active
      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is no longer available`,
        });
      }

      // Get variant attributes from cart item
      const variantAttrs = item.variantAttributes instanceof Map
        ? Object.fromEntries(item.variantAttributes)
        : item.variantAttributes || {}

      // Use price from cart item (which was calculated based on variant if applicable)
      const unitPrice = item.unitPrice || product.priceToUser;
      const quantity = item.quantity;
      const totalPrice = quantity * unitPrice; // Recalculate to ensure accuracy

      const orderItem = {
        productId: product._id,
        productName: product.name,
        quantity: quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        status: 'pending', // Item status for partial acceptance
      };

      // Add variant attributes if present
      if (variantAttrs && Object.keys(variantAttrs).length > 0) {
        const variantAttributesMap = new Map()
        Object.keys(variantAttrs).forEach(key => {
          variantAttributesMap.set(key, String(variantAttrs[key]))
        })
        orderItem.variantAttributes = variantAttributesMap
      }

      orderItems.push(orderItem);

      // Note: Stock validation is removed - orders are always created
      // Vendor will receive the order and can escalate if stock is insufficient
    }

    // Calculate pricing - recalculate subtotal from order items to ensure accuracy
    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const deliveryCharge = paymentPreference === 'full' ? 0 : DELIVERY_CHARGE;
    const totalAmount = subtotal + deliveryCharge;

    // Validate cart minimum order value using calculated totalAmount
    // Skip minimum order check if paymentPreference is 'partial' (30% advance)
    if (paymentPreference === 'full' && totalAmount < MIN_ORDER_VALUE) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${MIN_ORDER_VALUE}. Current total: ₹${totalAmount.toFixed(2)}`,
        data: {
          total: totalAmount,
          shortfall: Math.max(0, MIN_ORDER_VALUE - totalAmount),
        },
      });
    }

    const upfrontAmount = paymentPreference === 'full' ? totalAmount : Math.round(totalAmount * (ADVANCE_PAYMENT_PERCENTAGE / 100));
    const remainingAmount = paymentPreference === 'full' ? 0 : totalAmount - upfrontAmount;

    // Generate order number before creating order
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(date);
    todayEnd.setHours(23, 59, 59, 999);

    const todayCount = await Order.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });
    const sequence = String(todayCount + 1).padStart(4, '0');
    const orderNumber = `ORD-${dateStr}-${sequence}`;

    // Create order
    const order = new Order({
      orderNumber, // Explicitly set orderNumber
      userId,
      sellerId,
      seller,
      vendorId,
      assignedTo,
      items: orderItems,
      subtotal,
      deliveryCharge,
      deliveryChargeWaived: paymentPreference === 'full',
      totalAmount,
      paymentPreference,
      upfrontAmount,
      remainingAmount,
      paymentStatus: PAYMENT_STATUS.PENDING,
      deliveryAddress,
      status: ORDER_STATUS.AWAITING,
      notes,
    });

    await order.save();

    // Debug: Log order creation with vendor assignment
    console.log(`✅ Order created: ${order.orderNumber}`);
    console.log(`   - vendorId: ${order.vendorId || 'null'}`);
    console.log(`   - assignedTo: ${order.assignedTo}`);
    console.log(`   - deliveryAddress.city: ${order.deliveryAddress?.city || 'N/A'}`);

    // Note: Cart is NOT cleared here. It will be cleared only after successful payment confirmation
    // This ensures cart items remain available if user cancels payment or payment fails

    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          items: order.items,
          subtotal: order.subtotal,
          deliveryCharge: order.deliveryCharge,
          totalAmount: order.totalAmount,
          paymentPreference: order.paymentPreference,
          upfrontAmount: order.upfrontAmount,
          remainingAmount: order.remainingAmount,
          paymentStatus: order.paymentStatus,
          status: order.status,
          vendorId: order.vendorId,
          assignedTo: order.assignedTo,
          deliveryAddress: order.deliveryAddress,
          expectedDeliveryDate: order.expectedDeliveryDate,
        },
        message: 'Order created successfully. Please proceed with payment.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user orders
 * @route   GET /api/users/orders
 * @access  Private (User)
 */
exports.getOrders = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    // Build query
    const query = { userId };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('items.productId', 'name description category priceToUser images sku')
        .populate('vendorId', 'name phone location')
        .populate('seller', 'sellerId name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders: orders.map(order => {
          // If order is in grace period, show status as 'awaiting' to user (not accepted yet)
          const displayStatus = order.acceptanceGracePeriod?.isActive ? ORDER_STATUS.AWAITING : order.status;

          // Map items to include product data
          const mappedItems = order.items.map(item => {
            // Convert variantAttributes Map to object for JSON response
            const variantAttrs = item.variantAttributes instanceof Map
              ? Object.fromEntries(item.variantAttributes)
              : item.variantAttributes || {}

            return {
              productId: item.productId?._id || item.productId,
              product: item.productId ? {
                id: item.productId._id,
                name: item.productId.name,
                description: item.productId.description,
                category: item.productId.category,
                priceToUser: item.productId.priceToUser,
                images: item.productId.images,
                sku: item.productId.sku,
              } : null,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              variantAttributes: Object.keys(variantAttrs).length > 0 ? variantAttrs : undefined,
              status: item.status,
            }
          })

          return {
            id: order._id,
            orderNumber: order.orderNumber,
            items: mappedItems,
            subtotal: order.subtotal,
            deliveryCharge: order.deliveryCharge,
            totalAmount: order.totalAmount,
            paymentPreference: order.paymentPreference,
            upfrontAmount: order.upfrontAmount,
            remainingAmount: order.remainingAmount,
            paymentStatus: order.paymentStatus,
            status: displayStatus,
            statusTimeline: order.statusTimeline,
            vendor: order.vendorId ? {
              id: order.vendorId._id,
              name: order.vendorId.name,
              phone: order.vendorId.phone,
            } : null,
            assignedTo: order.assignedTo,
            deliveryAddress: order.deliveryAddress,
            expectedDeliveryDate: order.expectedDeliveryDate,
            deliveredAt: order.deliveredAt,
            createdAt: order.createdAt,
          };
        }),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get order details
 * @route   GET /api/users/orders/:orderId
 * @access  Private (User)
 */
exports.getOrderDetails = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('items.productId', 'name description category priceToUser images sku')
      .populate('vendorId', 'name phone location')
      .populate('seller', 'sellerId name phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Get payments for this order
    const payments = await Payment.find({ orderId: order._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          items: order.items.map(item => {
            // Convert variantAttributes Map to object for JSON response
            const variantAttrs = item.variantAttributes instanceof Map
              ? Object.fromEntries(item.variantAttributes)
              : item.variantAttributes || {}

            return {
              product: item.productId ? {
                id: item.productId._id,
                name: item.productId.name,
                description: item.productId.description,
                category: item.productId.category,
                priceToUser: item.productId.priceToUser,
                images: item.productId.images,
                sku: item.productId.sku,
              } : {
                name: item.productName, // Fallback if product deleted
              },
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              status: item.status,
              variantAttributes: Object.keys(variantAttrs).length > 0 ? variantAttrs : undefined,
            }
          }),
          subtotal: order.subtotal,
          deliveryCharge: order.deliveryCharge,
          totalAmount: order.totalAmount,
          paymentPreference: order.paymentPreference,
          upfrontAmount: order.upfrontAmount,
          remainingAmount: order.remainingAmount,
          paymentStatus: order.paymentStatus,
          status: order.status,
          statusTimeline: order.statusTimeline,
          vendor: order.vendorId ? {
            id: order.vendorId._id,
            name: order.vendorId.name,
            phone: order.vendorId.phone,
            location: order.vendorId.location,
          } : null,
          seller: order.seller ? {
            sellerId: order.seller.sellerId,
            name: order.seller.name,
            phone: order.seller.phone,
          } : null,
          assignedTo: order.assignedTo,
          deliveryAddress: order.deliveryAddress,
          expectedDeliveryDate: order.expectedDeliveryDate,
          deliveredAt: order.deliveredAt,
          payments: payments.map(p => ({
            id: p._id,
            paymentId: p.paymentId,
            paymentType: p.paymentType,
            amount: p.amount,
            paymentMethod: p.paymentMethod,
            status: p.status,
            paidAt: p.paidAt,
            createdAt: p.createdAt,
          })),
          createdAt: order.createdAt,
          notes: order.notes,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Track order
 * @route   GET /api/users/orders/:orderId/track
 * @access  Private (User)
 */
exports.trackOrder = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId })
      .populate('vendorId', 'name phone location')
      .select('orderNumber status statusTimeline expectedDeliveryDate deliveredAt assignedTo');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          statusTimeline: order.statusTimeline,
          expectedDeliveryDate: order.expectedDeliveryDate,
          deliveredAt: order.deliveredAt,
          assignedTo: order.assignedTo,
          vendor: order.vendorId ? {
            name: order.vendorId.name,
            phone: order.vendorId.phone,
          } : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel order
 * @route   PUT /api/users/orders/:orderId/cancel
 * @access  Private (User)
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if order can be cancelled
    if (!order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.status}`,
      });
    }

    // Restore stock if payment was made (stock was already reduced)
    const payments = await Payment.find({ orderId: order._id, status: { $in: [PAYMENT_STATUS.PARTIAL_PAID, PAYMENT_STATUS.FULLY_PAID] } });
    const wasPaid = payments.length > 0;

    if (wasPaid) {
      // Restore stock for all items
      // Restore stock for all items with Source-Aware Logic
      for (const item of order.items) {
        // Source: Vendor
        if (order.assignedTo === 'vendor' && order.vendorId) {
          const assignment = await ProductAssignment.findOne({
            vendorId: order.vendorId,
            productId: item.productId
          });

          if (assignment) {
            // Restore Global
            assignment.stock = (assignment.stock || 0) + item.quantity;

            // Restore Attribute
            let itemAttrs = null;
            if (item.variantAttributes) {
              itemAttrs = item.variantAttributes instanceof Map
                ? Object.fromEntries(item.variantAttributes)
                : item.variantAttributes;
            }

            if (itemAttrs && Object.keys(itemAttrs).length > 0 && assignment.attributeStocks) {
              const matchingVariant = assignment.attributeStocks.find(variant => {
                if (!variant.attributes) return false;
                const variantAttrs = variant.attributes instanceof Map
                  ? Object.fromEntries(variant.attributes)
                  : variant.attributes;
                const keys = Object.keys(itemAttrs);
                return keys.every(key => String(variantAttrs[key]) === String(itemAttrs[key]));
              });

              if (matchingVariant) {
                matchingVariant.stock = (matchingVariant.stock || 0) + item.quantity;
              }
            }
            await assignment.save();
            console.log(`📦 VENDOR assigned stock restored for cancellation: ${item.productName}`);
          }
        }
        // Source: Admin (or fallback)
        else {
          const product = await Product.findById(item.productId);
          if (product) {
            // Restore Global
            product.stock = (product.stock || 0) + item.quantity;
            if (product.displayStock) {
              product.displayStock = (product.displayStock || 0) + item.quantity;
            }

            // Restore Attribute
            let itemAttrs = null;
            if (item.variantAttributes) {
              itemAttrs = item.variantAttributes instanceof Map
                ? Object.fromEntries(item.variantAttributes)
                : item.variantAttributes;
            }

            if (itemAttrs && Object.keys(itemAttrs).length > 0 && product.attributeStocks) {
              const matchingVariant = product.attributeStocks.find(variant => {
                if (!variant.attributes) return false;
                const variantAttrs = variant.attributes instanceof Map
                  ? Object.fromEntries(variant.attributes)
                  : variant.attributes;
                const keys = Object.keys(itemAttrs);
                return keys.every(key => String(variantAttrs[key]) === String(itemAttrs[key]));
              });

              if (matchingVariant) {
                matchingVariant.stock = (matchingVariant.stock || 0) + item.quantity;
                if (matchingVariant.displayStock) {
                  matchingVariant.displayStock = (matchingVariant.displayStock || 0) + item.quantity;
                }
              }
            }
            await product.save();
            console.log(`📦 ADMIN stock restored for cancellation: ${product.name}`);
          }
        }
      }
      console.log(`⚠️ Refund required for order ${order.orderNumber}. Payments: ${payments.length}`);
      // TODO: Implement refund logic when payment gateway is integrated
    }

    // Update order status
    order.status = ORDER_STATUS.CANCELLED;
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by user';
    order.cancelledBy = 'user';

    // Update status timeline
    order.statusTimeline.push({
      status: ORDER_STATUS.CANCELLED,
      timestamp: new Date(),
      note: reason || 'Cancelled by user',
      updatedBy: 'user',
    });

    await order.save();

    res.status(200).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          cancelledAt: order.cancelledAt,
          cancellationReason: order.cancellationReason,
        },
        message: 'Order cancelled successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// PAYMENT CONTROLLERS
// ============================================================================

/**
 * @desc    Create payment intent for advance payment (30% or 100%)
 * @route   POST /api/users/payments/create-intent
 * @access  Private (User)
 */
exports.createPaymentIntent = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderId, paymentMethod = PAYMENT_METHODS.RAZORPAY } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.paymentStatus === PAYMENT_STATUS.FULLY_PAID) {
      return res.status(400).json({
        success: false,
        message: 'Order is already fully paid',
      });
    }

    // Calculate payment amount
    const amount = order.upfrontAmount; // 30% or 100% based on payment preference

    // Create Razorpay order
    try {
      const razorpayOrder = await razorpayService.createOrder({
        amount: amount,
        currency: 'INR',
        receipt: `receipt_${order.orderNumber}_${Date.now()}`,
        notes: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          userId: userId.toString(),
          paymentType: order.paymentPreference === 'full' ? 'full' : 'advance',
        },
      });

      res.status(200).json({
        success: true,
        data: {
          paymentIntent: {
            id: razorpayOrder.id,
            orderId: order._id.toString(),
            amount: amount,
            currency: 'INR',
            paymentMethod,
            status: razorpayOrder.status,
            razorpayOrderId: razorpayOrder.id,
            keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_bypass_dummy_key', // Frontend needs this for Razorpay Checkout
          },
          message: razorpayService.isTestMode()
            ? 'Payment intent created (Test Mode)'
            : 'Payment intent created successfully',
        },
      });
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create payment order',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm advance payment
 * @route   POST /api/users/payments/confirm
 * @access  Private (User)
 */
exports.confirmPayment = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      orderId,
      paymentIntentId,
      gatewayPaymentId,
      gatewayOrderId,
      gatewaySignature,
      paymentMethod = PAYMENT_METHODS.RAZORPAY,
    } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Validate required Razorpay payment details
    if (!gatewayPaymentId || !gatewayOrderId || !gatewaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification details are required (paymentId, orderId, signature)',
      });
    }

    // Verify Razorpay payment signature
    const isSignatureValid = razorpayService.verifyPaymentSignature(
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature
    );

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Payment verification failed.',
      });
    }

    // Fetch payment details from Razorpay (optional, for additional verification)
    let razorpayPayment = null;
    try {
      razorpayPayment = await razorpayService.fetchPayment(gatewayPaymentId);

      // Verify payment amount matches order amount
      const paymentAmountInRupees = razorpayPayment.amount / 100;
      if (Math.abs(paymentAmountInRupees - order.upfrontAmount) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Payment amount mismatch. Expected ₹${order.upfrontAmount}, received ₹${paymentAmountInRupees}`,
        });
      }

      // Verify payment status
      if (razorpayPayment.status !== 'captured' && razorpayPayment.status !== 'authorized') {
        return res.status(400).json({
          success: false,
          message: `Payment not successful. Status: ${razorpayPayment.status}`,
        });
      }
    } catch (paymentError) {
      // In test mode, allow payment even if fetch fails
      if (!razorpayService.isTestMode()) {
        console.error('Error fetching Razorpay payment:', paymentError);
        return res.status(400).json({
          success: false,
          message: 'Failed to verify payment with gateway',
        });
      }
    }

    // Generate payment ID explicitly (pre-save hook will also generate, but this ensures it's set)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(date);
    todayEnd.setHours(23, 59, 59, 999);
    const todayCount = await Payment.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });
    const sequence = String(todayCount + 1).padStart(4, '0');
    const generatedPaymentId = `PAY-${dateStr}-${sequence}`;

    // Create payment record
    const payment = new Payment({
      paymentId: generatedPaymentId, // Explicitly set paymentId
      orderId: order._id,
      userId,
      paymentType: order.paymentPreference === 'full' ? 'full' : 'advance',
      amount: order.upfrontAmount,
      paymentMethod,
      status: order.paymentPreference === 'full' ? PAYMENT_STATUS.FULLY_PAID : PAYMENT_STATUS.PARTIAL_PAID,
      gatewayPaymentId: gatewayPaymentId, // Razorpay payment ID
      gatewayOrderId: gatewayOrderId, // Razorpay order ID
      gatewaySignature: gatewaySignature, // Razorpay signature for verification
      gatewayResponse: razorpayPayment ? {
        status: razorpayPayment.status,
        method: razorpayPayment.method,
        description: razorpayPayment.description,
        created_at: razorpayPayment.created_at,
      } : null,
      paidAt: new Date(),
    });

    await payment.save();

    // Log payment to history
    try {
      await PaymentHistory.create({
        activityType: order.paymentPreference === 'full' ? 'user_payment_advance' : 'user_payment_advance',
        userId: userId,
        orderId: order._id,
        paymentId: payment._id,
        amount: payment.amount,
        paymentMethod: paymentMethod,
        status: 'completed',
        description: `User paid ${order.paymentPreference === 'full' ? 'full' : 'advance'} payment of ₹${payment.amount} for order ${order.orderNumber}`,
        metadata: {
          orderNumber: order.orderNumber,
          paymentType: payment.paymentType,
          paymentId: generatedPaymentId,
        },
      });
    } catch (historyError) {
      console.error('Error logging payment history:', historyError);
      // Don't fail payment if history logging fails
    }

    // Update order payment status
    if (order.paymentPreference === 'full') {
      order.paymentStatus = PAYMENT_STATUS.FULLY_PAID;
    } else {
      order.paymentStatus = PAYMENT_STATUS.PARTIAL_PAID;
    }

    // Reduce stock for all items in the order with STRICT Attribute Logic
    for (const item of order.items) {
      // 1. Determine Source: Vendor (ProductAssignment) or Admin (Product)
      if (order.assignedTo === 'vendor' && order.vendorId) {
        // --- VENDOR STOCK REDUCTION ---
        const assignment = await ProductAssignment.findOne({
          vendorId: order.vendorId,
          productId: item.productId,
          isActive: true
        });

        if (assignment) {
          const VendorNotification = require('../models/VendorNotification'); // Ensure this is imported at top or required here

          // A. Reduce Global Vendor Stock
          let deficit = 0;
          if (assignment.stock < item.quantity) {
            deficit = item.quantity - assignment.stock;
            console.warn(`⚠️ Insufficient VENDOR stock for ${item.productName}. Req: ${item.quantity}, Avail: ${assignment.stock}`);

            // CRITICAL DEFICIT ALERT
            try {
              await VendorNotification.createNotification({
                vendorId: order.vendorId,
                type: 'system_alert',
                title: '🚨 Stock Deficit Warning',
                message: `URGENT: Order #${order.orderNumber} requires ${item.quantity} units of ${item.productName}, but you only had ${assignment.stock}. You have a deficit of ${deficit} units. Please fulfill immediately or Escalate.`,
                relatedEntityType: 'order',
                relatedEntityId: order._id,
                priority: 'urgent',
                metadata: { productId: item.productId, deficit: deficit }
              });
            } catch (notifError) {
              console.error('Failed to send stock deficit alert:', notifError);
            }
          }
          assignment.stock = Math.max(0, assignment.stock - item.quantity);

          // LOW STOCK ALERT
          const LOW_STOCK_THRESHOLD = 50; // Customize as needed
          if (assignment.stock <= LOW_STOCK_THRESHOLD) {
            try {
              await VendorNotification.createNotification({
                vendorId: order.vendorId,
                type: 'stock_low_alert',
                title: 'Low Stock Alert',
                message: `Your stock for ${item.productName} is running low (${assignment.stock} remaining).`,
                relatedEntityType: 'stock',
                relatedEntityId: assignment._id, // Or productId
                priority: 'high',
                metadata: { productId: item.productId, currentStock: assignment.stock }
              });
            } catch (notifError) {
              console.error('Failed to send low stock alert:', notifError);
            }
          }

          // ORDER ASSIGNED NOTIFICATION (Sent once per order usually, but here we iterate items. 
          // Better to send OUTSIDE the loop. However, sending for "New Order" here is okay logic-flow wise 
          // if we ensure it's once. But simpler to do it once at the end.)

          // B. Reduce Attribute Stock (if attributes exist)
          // Convert item.variantAttributes (Map or Object) to a usable comparison object
          let itemAttrs = null;
          if (item.variantAttributes) {
            itemAttrs = item.variantAttributes instanceof Map
              ? Object.fromEntries(item.variantAttributes)
              : item.variantAttributes;
          }

          if (itemAttrs && Object.keys(itemAttrs).length > 0 && assignment.attributeStocks) {
            // Find matching variant
            const matchingVariant = assignment.attributeStocks.find(variant => {
              if (!variant.attributes) return false;
              // Compare all keys in itemAttrs with variant.attributes
              const variantAttrs = variant.attributes instanceof Map
                ? Object.fromEntries(variant.attributes)
                : variant.attributes;

              // Check if every key:value in itemAttrs matches variantAttrs
              const keys = Object.keys(itemAttrs);
              const isMatch = keys.every(key => String(variantAttrs[key]) === String(itemAttrs[key]));
              return isMatch;
            });

            if (matchingVariant) {
              matchingVariant.stock = Math.max(0, matchingVariant.stock - item.quantity);
              console.log(`📦 VENDOR Variant Stock reduced for ${item.productName} [${JSON.stringify(itemAttrs)}]: ${item.quantity}`);
            } else {
              console.warn(`⚠️ Matching VENDOR variant not found for deduction: ${JSON.stringify(itemAttrs)}`);
            }
          }

          await assignment.save();
          console.log(`📦 VENDOR Global Stock reduced for ${item.productName}: ${item.quantity}. Rem: ${assignment.stock}`);
        } else {
          console.error(`❌ Critical: ProductAssignment not found for Vendor ${order.vendorId} Product ${item.productId}`);
          // Fallback? No, strict mode means we log error.
        }

      } else {
        // --- ADMIN STOCK REDUCTION (assignedTo === 'admin') ---
        const product = await Product.findById(item.productId);
        if (product) {
          // A. Reduce Global Admin Stock
          if (product.stock < item.quantity) {
            console.warn(`⚠️ Insufficient ADMIN stock for ${product.name}. Req: ${item.quantity}, Avail: ${product.stock}`);
          }
          product.stock = Math.max(0, (product.stock || 0) - item.quantity);
          if (product.displayStock) {
            product.displayStock = Math.max(0, (product.displayStock || 0) - item.quantity);
          }

          // ADMIN STOCK ALERT (Platform Notification)
          if (product.stock === 0 || product.stock < 20) {
            try {
              const Notification = require('../models/Notification');
              // Check if notification already exists to avoid spam? (Optional, but good practice. For now, just create.)
              await Notification.create({
                title: product.stock === 0 ? 'OUT OF STOCK' : 'Low Stock Warning',
                message: `Admin Inventory for ${product.name} is ${product.stock === 0 ? 'EMPTY' : 'running low'} (${product.stock} units remaining).`,
                targetAudience: 'all', // Or specific admin audience if supported
                priority: product.stock === 0 ? 'urgent' : 'high',
                isActive: true,
                createdBy: req.user._id, // User caused it, but field is required. If 'createdBy' refers to Admin model, we might need a fallback ID or system ID. 
                // Wait, Notification.js schema requires 'createdBy' ref 'Admin'. User is User.
                // Strategy: We can skip 'createdBy' validation if we modify schema, or use a "System" admin ID. 
                // For now, let's omit createdBy if it fails validation, or wrap in try/catch.
                // Actually, usually System Alerts don't need 'createdBy'.
              });
            } catch (admNotifErr) {
              // If validation fails (e.g. createdBy required), log it.
              // We'll try to find a system admin or just log console.
              console.log('Skipping Admin Notification (Auth/Schema constraint):', admNotifErr.message);
            }
          }

          // B. Reduce Attribute Stock (if attributes exist)
          let itemAttrs = null;
          if (item.variantAttributes) {
            itemAttrs = item.variantAttributes instanceof Map
              ? Object.fromEntries(item.variantAttributes)
              : item.variantAttributes;
          }

          if (itemAttrs && Object.keys(itemAttrs).length > 0 && product.attributeStocks) {
            // Find matching variant
            const matchingVariant = product.attributeStocks.find(variant => {
              if (!variant.attributes) return false;
              const variantAttrs = variant.attributes instanceof Map
                ? Object.fromEntries(variant.attributes)
                : variant.attributes;

              const keys = Object.keys(itemAttrs);
              const isMatch = keys.every(key => String(variantAttrs[key]) === String(itemAttrs[key]));
              return isMatch;
            });

            if (matchingVariant) {
              // Admin products have 'stock' inside attributeStocks entries
              matchingVariant.stock = Math.max(0, (matchingVariant.stock || 0) - item.quantity);
              // Also reduce displayStock if present? Usually synced.
              if (matchingVariant.displayStock) {
                matchingVariant.displayStock = Math.max(0, (matchingVariant.displayStock || 0) - item.quantity);
              }
              console.log(`📦 ADMIN Variant Stock reduced for ${product.name}: ${item.quantity}`);
            }
          }

          await product.save();
          console.log(`📦 ADMIN Global Stock reduced for ${product.name}: ${item.quantity}. Rem: ${product.stock}`);
        }
      }
    }

    // SEND VENDOR NOTIFICATION: Order Arrived (Assigned)
    if (order.assignedTo === 'vendor' && order.vendorId) {
      try {
        const VendorNotification = require('../models/VendorNotification');
        await VendorNotification.createNotification({
          vendorId: order.vendorId,
          type: 'order_assigned',
          title: 'New Order Received',
          message: `You have received a new order #${order.orderNumber} worth ₹${order.totalAmount}.`,
          relatedEntityType: 'order',
          relatedEntityId: order._id,
          priority: 'high',
          metadata: { orderNumber: order.orderNumber, amount: order.totalAmount }
        });
      } catch (notifError) {
        console.error('Failed to send vendor new order notification:', notifError);
      }
    }

    await order.save();

    // Clear cart only after payment is successfully confirmed
    // This ensures cart items remain available if user cancels payment or payment fails
    try {
      const cart = await Cart.findOne({ userId });
      if (cart) {
        cart.clear();
        await cart.save();
        console.log(`🛒 Cart cleared for user ${userId} after successful payment for order ${order.orderNumber}`);
      }
    } catch (cartError) {
      console.error('Error clearing cart after payment confirmation:', cartError);
      // Don't fail payment confirmation if cart clearing fails
    }

    // Process earnings (vendor earnings and seller commission) when order is fully paid
    if (order.paymentStatus === PAYMENT_STATUS.FULLY_PAID) {
      try {
        await processOrderEarnings(order);
      } catch (earningsError) {
        console.error('Error processing order earnings:', earningsError);
        // Don't fail the payment confirmation if earnings processing fails
      }
    }

    res.status(200).json({
      success: true,
      data: {
        payment: {
          id: payment._id,
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentType: payment.paymentType,
          status: payment.status,
          paidAt: payment.paidAt,
        },
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
        },
        message: razorpayService.isTestMode()
          ? 'Payment confirmed successfully (Test Mode)'
          : 'Payment confirmed successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create payment intent for remaining payment (70%)
 * @route   POST /api/users/payments/create-remaining
 * @access  Private (User)
 */
exports.createRemainingPaymentIntent = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderId, paymentMethod = PAYMENT_METHODS.RAZORPAY } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.paymentPreference === 'full') {
      return res.status(400).json({
        success: false,
        message: 'This order was paid in full. No remaining payment required.',
      });
    }

    if (order.paymentStatus === PAYMENT_STATUS.FULLY_PAID) {
      return res.status(400).json({
        success: false,
        message: 'Order is already fully paid',
      });
    }

    if (order.status !== ORDER_STATUS.DELIVERED) {
      return res.status(400).json({
        success: false,
        message: 'Remaining payment can only be made after delivery',
      });
    }

    // Calculate remaining amount
    const amount = order.remainingAmount; // 70%

    // Create Razorpay order for remaining payment
    try {
      const razorpayOrder = await razorpayService.createOrder({
        amount: amount,
        currency: 'INR',
        receipt: `receipt_${order.orderNumber}_remaining_${Date.now()}`,
        notes: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          userId: userId.toString(),
          paymentType: 'remaining',
        },
      });

      res.status(200).json({
        success: true,
        data: {
          paymentIntent: {
            id: razorpayOrder.id,
            orderId: order._id.toString(),
            amount: amount,
            currency: 'INR',
            paymentMethod,
            status: razorpayOrder.status,
            razorpayOrderId: razorpayOrder.id,
            keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_bypass_dummy_key', // Frontend needs this for Razorpay Checkout
          },
          message: razorpayService.isTestMode()
            ? 'Remaining payment intent created (Test Mode)'
            : 'Remaining payment intent created successfully',
        },
      });
    } catch (error) {
      console.error('Error creating Razorpay order for remaining payment:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create remaining payment order',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm remaining payment (70%)
 * @route   POST /api/users/payments/confirm-remaining
 * @access  Private (User)
 */
exports.confirmRemainingPayment = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      orderId,
      gatewayPaymentId,
      gatewayOrderId,
      gatewaySignature,
      paymentMethod = PAYMENT_METHODS.RAZORPAY,
    } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.paymentStatus === PAYMENT_STATUS.FULLY_PAID) {
      return res.status(400).json({
        success: false,
        message: 'Order is already fully paid',
      });
    }

    // Validate required Razorpay payment details
    if (!gatewayPaymentId || !gatewayOrderId || !gatewaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification details are required (paymentId, orderId, signature)',
      });
    }

    // Verify Razorpay payment signature
    const isSignatureValid = razorpayService.verifyPaymentSignature(
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature
    );

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Payment verification failed.',
      });
    }

    // Fetch payment details from Razorpay (optional, for additional verification)
    let razorpayPayment = null;
    try {
      razorpayPayment = await razorpayService.fetchPayment(gatewayPaymentId);

      // Verify payment amount matches order remaining amount
      const paymentAmountInRupees = razorpayPayment.amount / 100;
      if (Math.abs(paymentAmountInRupees - order.remainingAmount) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Payment amount mismatch. Expected ₹${order.remainingAmount}, received ₹${paymentAmountInRupees}`,
        });
      }

      // Verify payment status
      if (razorpayPayment.status !== 'captured' && razorpayPayment.status !== 'authorized') {
        return res.status(400).json({
          success: false,
          message: `Payment not successful. Status: ${razorpayPayment.status}`,
        });
      }
    } catch (paymentError) {
      // In test mode, allow payment even if fetch fails
      if (!razorpayService.isTestMode()) {
        console.error('Error fetching Razorpay payment:', paymentError);
        return res.status(400).json({
          success: false,
          message: 'Failed to verify payment with gateway',
        });
      }
    }

    // Generate payment ID explicitly (pre-save hook will also generate, but this ensures it's set)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(date);
    todayEnd.setHours(23, 59, 59, 999);
    const todayCount = await Payment.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });
    const sequence = String(todayCount + 1).padStart(4, '0');
    const generatedPaymentId = `PAY-${dateStr}-${sequence}`;

    // Create payment record
    const payment = new Payment({
      paymentId: generatedPaymentId, // Explicitly set paymentId
      orderId: order._id,
      userId,
      paymentType: 'remaining',
      amount: order.remainingAmount,
      paymentMethod,
      status: PAYMENT_STATUS.FULLY_PAID,
      gatewayPaymentId: gatewayPaymentId, // Razorpay payment ID
      gatewayOrderId: gatewayOrderId, // Razorpay order ID
      gatewaySignature: gatewaySignature, // Razorpay signature for verification
      gatewayResponse: razorpayPayment ? {
        status: razorpayPayment.status,
        method: razorpayPayment.method,
        description: razorpayPayment.description,
        created_at: razorpayPayment.created_at,
      } : null,
      paidAt: new Date(),
    });

    await payment.save();

    // Log payment to history
    try {
      await PaymentHistory.create({
        activityType: 'user_payment_remaining',
        userId: userId,
        orderId: order._id,
        paymentId: payment._id,
        amount: payment.amount,
        paymentMethod: paymentMethod,
        status: 'completed',
        description: `User paid remaining payment of ₹${payment.amount} for order ${order.orderNumber}`,
        metadata: {
          orderNumber: order.orderNumber,
          paymentType: payment.paymentType,
          paymentId: payment.paymentId,
        },
      });
    } catch (historyError) {
      console.error('Error logging payment history:', historyError);
      // Don't fail payment if history logging fails
    }

    // Update order payment status
    order.paymentStatus = PAYMENT_STATUS.FULLY_PAID;
    await order.save();

    // Process earnings (vendor earnings and seller commission) when order is fully paid
    if (order.paymentStatus === PAYMENT_STATUS.FULLY_PAID) {
      try {
        await processOrderEarnings(order);
      } catch (earningsError) {
        console.error('Error processing order earnings:', earningsError);
        // Don't fail the payment confirmation if earnings processing fails
      }
    }

    res.status(200).json({
      success: true,
      data: {
        payment: {
          id: payment._id,
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentType: payment.paymentType,
          status: payment.status,
          paidAt: payment.paidAt,
        },
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
        },
        message: razorpayService.isTestMode()
          ? 'Remaining payment confirmed successfully (Test Mode)'
          : 'Remaining payment confirmed successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get payment status
 * @route   GET /api/users/payments/:paymentId
 * @access  Private (User)
 */
exports.getPaymentStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { paymentId } = req.params;

    const payment = await Payment.findOne({ _id: paymentId, userId }).populate('orderId', 'orderNumber totalAmount');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        payment: {
          id: payment._id,
          paymentId: payment.paymentId,
          orderId: payment.orderId._id,
          orderNumber: payment.orderId.orderNumber,
          paymentType: payment.paymentType,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          gatewayPaymentId: payment.gatewayPaymentId,
          paidAt: payment.paidAt,
          createdAt: payment.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get order payments
 * @route   GET /api/users/orders/:orderId/payments
 * @access  Private (User)
 */
exports.getOrderPayments = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const payments = await Payment.find({ orderId: order._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        payments: payments.map(p => ({
          id: p._id,
          paymentId: p.paymentId,
          paymentType: p.paymentType,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          status: p.status,
          gatewayPaymentId: p.gatewayPaymentId,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
        })),
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          upfrontAmount: order.upfrontAmount,
          remainingAmount: order.remainingAmount,
          paymentStatus: order.paymentStatus,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// ADDRESS CONTROLLERS
// ============================================================================

/**
 * @desc    Get user addresses
 * @route   GET /api/users/addresses
 * @access  Private (User)
 */
exports.getAddresses = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        addresses: addresses.map(addr => ({
          id: addr._id,
          name: addr.name,
          phone: addr.phone,
          address: addr.address,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          coordinates: addr.coordinates,
          isDefault: addr.isDefault,
          landmark: addr.landmark,
          addressType: addr.addressType,
          fullAddress: addr.getFullAddress(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add address
 * @route   POST /api/users/addresses
 * @access  Private (User)
 */
exports.addAddress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      phone,
      address,
      city,
      state,
      pincode,
      coordinates,
      landmark,
      addressType = 'home',
      isDefault = false,
    } = req.body;

    // Validate required fields
    if (!name || !phone || !address || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, address, city, state, and pincode are required',
      });
    }

    // Generate unique address ID
    const addressId = await generateUniqueId(Address, 'ADD', 'addressId', 101);

    // If this is set as default, it will automatically unset other defaults (via pre-save hook)
    const newAddress = new Address({
      addressId,
      userId,
      name,
      phone,
      address,
      city,
      state,
      pincode,
      coordinates,
      landmark,
      addressType,
      isDefault,
    });

    await newAddress.save();

    res.status(201).json({
      success: true,
      data: {
        address: {
          id: newAddress._id,
          name: newAddress.name,
          phone: newAddress.phone,
          address: newAddress.address,
          city: newAddress.city,
          state: newAddress.state,
          pincode: newAddress.pincode,
          coordinates: newAddress.coordinates,
          isDefault: newAddress.isDefault,
          fullAddress: newAddress.getFullAddress(),
        },
        message: 'Address added successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update address
 * @route   PUT /api/users/addresses/:addressId
 * @access  Private (User)
 */
exports.updateAddress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { addressId } = req.params;
    const updateData = req.body;

    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    // Update fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        address[key] = updateData[key];
      }
    });

    await address.save();

    res.status(200).json({
      success: true,
      data: {
        address: {
          id: address._id,
          name: address.name,
          phone: address.phone,
          address: address.address,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          coordinates: address.coordinates,
          isDefault: address.isDefault,
          fullAddress: address.getFullAddress(),
        },
        message: 'Address updated successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete address
 * @route   DELETE /api/users/addresses/:addressId
 * @access  Private (User)
 */
exports.deleteAddress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { addressId } = req.params;

    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    await address.deleteOne();

    res.status(200).json({
      success: true,
      data: {
        message: 'Address deleted successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Set default address
 * @route   PUT /api/users/addresses/:addressId/default
 * @access  Private (User)
 */
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { addressId } = req.params;

    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    // Set as default (pre-save hook will unset other defaults)
    address.isDefault = true;
    await address.save();

    res.status(200).json({
      success: true,
      data: {
        address: {
          id: address._id,
          isDefault: address.isDefault,
          fullAddress: address.getFullAddress(),
        },
        message: 'Default address updated successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// FAVOURITES CONTROLLERS
// ============================================================================

/**
 * @desc    Get user favourites
 * @route   GET /api/users/favourites
 * @access  Private (User)
 */
exports.getFavourites = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // TODO: Implement Favourites model when needed
    // For now, return empty array
    res.status(200).json({
      success: true,
      data: {
        favourites: [],
        message: 'Favourites feature coming soon',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add product to favourites
 * @route   POST /api/users/favourites
 * @access  Private (User)
 */
exports.addToFavourites = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or unavailable',
      });
    }

    // TODO: Implement Favourites model when needed
    // For now, return success
    res.status(200).json({
      success: true,
      data: {
        message: 'Product added to favourites (Feature coming soon)',
        product: {
          id: product._id,
          name: product.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove product from favourites
 * @route   DELETE /api/users/favourites/:productId
 * @access  Private (User)
 */
exports.removeFromFavourites = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;

    // TODO: Implement Favourites model when needed
    // For now, return success
    res.status(200).json({
      success: true,
      data: {
        message: 'Product removed from favourites (Feature coming soon)',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// NOTIFICATIONS CONTROLLERS
// ============================================================================

/**
 * @desc    Get user notifications
 * @route   GET /api/users/notifications
 * @access  Private (User)
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, read } = req.query;

    // Clean up expired notifications
    await UserNotification.cleanupExpired();

    const query = { userId };

    // Filter by read status
    if (read !== undefined) {
      query.read = read === 'true';
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const notifications = await UserNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await UserNotification.countDocuments(query);
    const unreadCount = await UserNotification.countDocuments({
      userId,
      read: false,
    });

    res.status(200).json({
      success: true,
      data: {
        notifications: notifications.map((notif) => ({
          id: notif._id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          read: notif.read,
          readAt: notif.readAt,
          priority: notif.priority,
          relatedEntityType: notif.relatedEntityType,
          relatedEntityId: notif.relatedEntityId,
          metadata: notif.metadata ? Object.fromEntries(notif.metadata) : {},
          timestamp: notif.createdAt,
          createdAt: notif.createdAt,
        })),
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/users/notifications/:notificationId/read
 * @access  Private (User)
 */
exports.markNotificationRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;

    const notification = await UserNotification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: {
        notification: {
          id: notification._id,
          read: notification.read,
          readAt: notification.readAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/users/notifications/read-all
 * @access  Private (User)
 */
exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await UserNotification.updateMany(
      { userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount || 0} notifications marked as read`,
      data: {
        modifiedCount: result.modifiedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// SUPPORT CONTROLLERS
// ============================================================================

const SupportTicket = require('../models/SupportTicket');

/**
 * @desc    Create support ticket
 * @route   POST /api/users/support/tickets
 * @access  Private (User)
 */
exports.createSupportTicket = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { subject, description, category, orderId, priority } = req.body;

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Subject and description are required',
      });
    }

    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Validate orderId if provided and get order number
    let orderNumber = null;
    if (orderId) {
      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }
      orderNumber = order.orderNumber;
    }

    // Create the support ticket
    const ticket = new SupportTicket({
      userType: 'user',
      userId,
      subject,
      description,
      category: category || 'general',
      priority: priority || 'medium',
      orderId: orderId || undefined,
      orderNumber: orderNumber || undefined,
      lastActivityBy: 'user',
      // Add initial message (the description becomes the first message)
      messages: [{
        senderId: userId,
        senderType: 'User',
        senderName: user.name,
        message: description,
        isFromAdmin: false,
        createdAt: new Date(),
      }],
    });

    await ticket.save();

    res.status(201).json({
      success: true,
      data: {
        ticket: {
          id: ticket._id,
          ticketId: ticket.ticketId,
          subject: ticket.subject,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          orderId: ticket.orderId,
          orderNumber: ticket.orderNumber,
          createdAt: ticket.createdAt,
        },
        message: 'Support ticket created successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user support tickets
 * @route   GET /api/users/support/tickets
 * @access  Private (User)
 */
exports.getSupportTickets = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { userType: 'user', userId };
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await SupportTicket.countDocuments(query);

    const tickets = await SupportTicket.find(query)
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('ticketId subject category priority status orderId orderNumber unreadByUser lastActivityAt createdAt')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        tickets: tickets.map(t => ({
          id: t._id,
          ticketId: t.ticketId,
          subject: t.subject,
          category: t.category,
          priority: t.priority,
          status: t.status,
          orderId: t.orderId,
          orderNumber: t.orderNumber,
          hasUnread: t.unreadByUser,
          lastActivityAt: t.lastActivityAt,
          createdAt: t.createdAt,
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get support ticket details
 * @route   GET /api/users/support/tickets/:ticketId
 * @access  Private (User)
 */
exports.getSupportTicketDetails = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { ticketId } = req.params;

    const ticket = await SupportTicket.findOne({
      $or: [
        { _id: ticketId, userType: 'user', userId },
        { ticketId: ticketId, userType: 'user', userId },
      ],
    }).lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
    }

    // Mark as read by user
    await SupportTicket.findByIdAndUpdate(ticket._id, {
      unreadByUser: false,
      $set: {
        'messages.$[elem].readAt': new Date(),
      },
    }, {
      arrayFilters: [{ 'elem.isFromAdmin': true, 'elem.readAt': null }],
    });

    res.status(200).json({
      success: true,
      data: {
        ticket: {
          id: ticket._id,
          ticketId: ticket.ticketId,
          subject: ticket.subject,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          orderId: ticket.orderId,
          orderNumber: ticket.orderNumber,
          assignedToName: ticket.assignedToName,
          resolution: ticket.resolution,
          createdAt: ticket.createdAt,
          resolvedAt: ticket.resolvedAt,
          closedAt: ticket.closedAt,
        },
        messages: ticket.messages.map(m => ({
          id: m._id,
          message: m.message,
          senderName: m.senderName,
          isFromAdmin: m.isFromAdmin,
          createdAt: m.createdAt,
          readAt: m.readAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send support message
 * @route   POST /api/users/support/tickets/:ticketId/messages
 * @access  Private (User)
 */
exports.sendSupportMessage = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { ticketId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Find the ticket
    const ticket = await SupportTicket.findOne({
      $or: [
        { _id: ticketId, userType: 'user', userId },
        { ticketId: ticketId, userType: 'user', userId },
      ],
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
    }

    // Check if ticket is closed
    if (ticket.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to a closed ticket',
      });
    }

    // Get user info
    const user = await User.findById(userId);

    // Add message to ticket
    ticket.addMessage(userId, 'User', user.name, message.trim(), false);

    // If ticket was resolved, reopen it
    if (ticket.status === 'resolved') {
      ticket.status = 'open';
    }

    await ticket.save();

    const newMessage = ticket.messages[ticket.messages.length - 1];

    res.status(200).json({
      success: true,
      data: {
        message: {
          id: newMessage._id,
          message: newMessage.message,
          senderName: newMessage.senderName,
          isFromAdmin: false,
          createdAt: newMessage.createdAt,
        },
        ticketStatus: ticket.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Initiate support call
 * @route   POST /api/users/support/call
 * @access  Private (User)
 */
exports.initiateSupportCall = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { orderId, reason } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // TODO: Implement support call service when needed
    // For now, return success with contact info
    res.status(200).json({
      success: true,
      data: {
        message: 'Support call initiated (Feature coming soon)',
        contactInfo: {
          phone: '+91-XXXXXXXXXX', // TODO: Add support phone number
          note: 'Our support team will call you shortly',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// REVIEW & RATING ROUTES
// ============================================================================

/**
 * @desc    Create or update product review
 * @route   POST /api/users/products/:productId/reviews
 * @access  Private (User)
 */
exports.createReview = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;
    const { rating, comment, orderId } = req.body;

    // Validate required fields
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating is required and must be between 1 and 5',
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if user has already reviewed this product
    let review = await Review.findOne({ productId, userId });

    if (review) {
      // Update existing review
      review.rating = rating;
      review.comment = comment || review.comment;
      if (orderId) review.orderId = orderId;
      await review.save();
    } else {
      // Create new review
      review = await Review.create({
        productId,
        userId,
        rating,
        comment: comment || '',
        orderId: orderId || null,
      });
    }

    // Populate user info
    await review.populate('userId', 'name phone');

    res.status(201).json({
      success: true,
      data: {
        review,
        message: review.isNew ? 'Review created successfully' : 'Review updated successfully',
      },
    });
  } catch (error) {
    // Handle duplicate review error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get product reviews
 * @route   GET /api/users/products/:productId/reviews
 * @access  Public
 */
exports.getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    let sortObj = {};
    if (sort === 'rating-desc') sortObj = { rating: -1, createdAt: -1 };
    else if (sort === 'rating-asc') sortObj = { rating: 1, createdAt: -1 };
    else if (sort === 'date-asc') sortObj = { createdAt: 1 };
    else sortObj = { createdAt: -1 }; // Default: newest first

    // Get reviews (only visible and approved)
    const [reviews, total] = await Promise.all([
      Review.find({ productId, isVisible: true, isApproved: true })
        .populate('userId', 'name')
        .populate('adminResponse.respondedBy', 'name')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments({ productId, isVisible: true, isApproved: true }),
    ]);

    // Calculate average rating
    const ratingStats = await Review.aggregate([
      { $match: { productId: product._id, isVisible: true, isApproved: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating',
          },
        },
      },
    ]);

    const stats = ratingStats[0] || { averageRating: 0, totalReviews: 0, ratingDistribution: [] };

    // Calculate rating distribution
    const distribution = {
      5: stats.ratingDistribution.filter(r => r === 5).length,
      4: stats.ratingDistribution.filter(r => r === 4).length,
      3: stats.ratingDistribution.filter(r => r === 3).length,
      2: stats.ratingDistribution.filter(r => r === 2).length,
      1: stats.ratingDistribution.filter(r => r === 1).length,
    };

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
        stats: {
          averageRating: Math.round(stats.averageRating * 10) / 10 || 0,
          totalReviews: stats.totalReviews,
          distribution,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's review for a product
 * @route   GET /api/users/products/:productId/reviews/my-review
 * @access  Private (User)
 */
exports.getMyReview = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;

    const review = await Review.findOne({ productId, userId })
      .populate('adminResponse.respondedBy', 'name');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        review,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user's review
 * @route   PUT /api/users/products/:productId/reviews/:reviewId
 * @access  Private (User)
 */
exports.updateReview = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId, reviewId } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findOne({ _id: reviewId, productId, userId });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5',
        });
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      review.comment = comment;
    }

    await review.save();

    await review.populate('userId', 'name');
    await review.populate('adminResponse.respondedBy', 'name');

    res.status(200).json({
      success: true,
      data: {
        review,
        message: 'Review updated successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user's review
 * @route   DELETE /api/users/products/:productId/reviews/:reviewId
 * @access  Private (User)
 */
exports.deleteReview = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { productId, reviewId } = req.params;

    const review = await Review.findOne({ _id: reviewId, productId, userId });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    await Review.deleteOne({ _id: reviewId });

    res.status(200).json({
      success: true,
      data: {
        message: 'Review deleted successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

