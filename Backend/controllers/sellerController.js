/**
 * Seller (IRA Partner) Controller
 * 
 * Handles all seller-related operations
 */

const Seller = require('../models/Seller');
const User = require('../models/User');
const Order = require('../models/Order');
const Commission = require('../models/Commission');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const BankAccount = require('../models/BankAccount');
const PaymentHistory = require('../models/PaymentHistory');
const SellerChangeRequest = require('../models/SellerChangeRequest');

const { sendOTP } = require('../utils/otp');
const { getTestOTPInfo } = require('../services/smsIndiaHubService');
const { generateToken } = require('../middleware/auth');
const { OTP_EXPIRY_MINUTES, IRA_PARTNER_COMMISSION_THRESHOLD, IRA_PARTNER_COMMISSION_RATE_LOW, IRA_PARTNER_COMMISSION_RATE_HIGH, ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { checkPhoneExists, checkPhoneInRole, isSpecialBypassNumber, SPECIAL_BYPASS_OTP } = require('../utils/phoneValidation');
const { generateUniqueId } = require('../utils/generateUniqueId');
const { createPaymentHistory, createBankAccount } = require('../utils/createWithId');
const adminTaskController = require('./adminTaskController');

/**
 * @desc    Seller registration
 * @route   POST /api/sellers/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { name, phone, area, location } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone are required',
      });
    }

    // Special bypass number - skip all validation and checks, proceed to OTP
    if (isSpecialBypassNumber(phone)) {
      // Find or create seller
      let seller = await Seller.findOne({ phone });

      if (!seller) {
        // Generate unique sellerId
        const lastSeller = await Seller.findOne()
          .sort({ sellerId: -1 })
          .select('sellerId');

        let nextNumber = 101;
        if (lastSeller && lastSeller.sellerId) {
          const match = lastSeller.sellerId.match(/\d+$/);
          if (match) {
            const lastNum = parseInt(match[0]);
            if (lastSeller.sellerId.startsWith('SLR-')) {
              nextNumber = lastNum + 1;
            }
          }
        }

        seller = new Seller({
          sellerId: `SLR-${nextNumber}`,
          name: name || 'Special Bypass Seller',
          phone: phone,
          area: area || '',
          status: 'pending',
        });

        if (location) {
          seller.location = {
            address: location.address || '',
            city: location.city || '',
            state: location.state || '',
            pincode: location.pincode || '',
          };
        }
      }

      // Set OTP to 123456
      seller.otp = {
        code: SPECIAL_BYPASS_OTP,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
      await seller.save();

      return res.status(201).json({
        success: true,
        data: {
          message: 'Registration request submitted. OTP sent to phone.',
          sellerId: seller.sellerId,
          sellerIdCode: seller.sellerId,
          requiresApproval: true,
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
      });
    }

    // Check if phone exists in other roles (user, vendor)
    const phoneCheck = await checkPhoneExists(phone, 'seller');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    // Check if seller already exists in seller collection
    const existingSeller = await Seller.findOne({ phone });

    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'Seller with this phone number already exists. Please login instead.',
      });
    }

    // Generate unique sellerId in SLR-XXX format
    const lastSeller = await Seller.findOne()
      .sort({ sellerId: -1 })
      .select('sellerId');

    let nextNumber = 101;
    if (lastSeller && lastSeller.sellerId) {
      // Extract number from SLR-XXX or IRA-XXXX format
      const match = lastSeller.sellerId.match(/\d+$/);
      if (match) {
        const lastNum = parseInt(match[0]);
        // If last was IRA-XXXX format, start from 101
        // If last was SLR-XXX format, increment
        if (lastSeller.sellerId.startsWith('SLR-')) {
          nextNumber = lastNum + 1;
        } else {
          // If last was IRA-XXXX, find highest SLR number or start from 101
          const lastSLRSeller = await Seller.findOne({ sellerId: /^SLR-/ })
            .sort({ sellerId: -1 })
            .select('sellerId');
          if (lastSLRSeller && lastSLRSeller.sellerId) {
            const slrMatch = lastSLRSeller.sellerId.match(/\d+$/);
            if (slrMatch) {
              nextNumber = parseInt(slrMatch[0]) + 1;
            }
          }
        }
      }
    }

    const generatedSellerId = `SLR-${nextNumber}`;

    // Check if generated sellerId already exists (shouldn't happen, but safety check)
    const existingSellerId = await Seller.findOne({ sellerId: generatedSellerId });
    if (existingSellerId) {
      // Find next available number
      let found = false;
      let attempt = nextNumber + 1;
      while (!found && attempt < 10000) {
        const testId = `SLR-${attempt}`;
        const exists = await Seller.findOne({ sellerId: testId });
        if (!exists) {
          nextNumber = attempt;
          found = true;
        } else {
          attempt++;
        }
      }
    }

    const finalSellerId = `SLR-${nextNumber}`;

    // Create seller (requires admin approval)
    const sellerData = {
      sellerId: finalSellerId,
      name,
      phone,
      area: area || '',
      status: 'pending', // Requires admin approval
    };

    // Add location if provided
    if (location) {
      sellerData.location = {
        address: location.address || '',
        city: location.city || '',
        state: location.state || '',
        pincode: location.pincode || '',
      };
    }

    const seller = new Seller(sellerData);

    // Clear any existing OTP before generating new one
    seller.clearOTP();

    // Check if this is a test phone number - use default OTP 123456
    const testOTPInfo = getTestOTPInfo(phone);
    let otpCode;
    if (testOTPInfo.isTest) {
      // For test numbers, set OTP directly to 123456
      otpCode = testOTPInfo.defaultOTP;
      seller.otp = {
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
    } else {
      // Generate new unique OTP for regular numbers
      otpCode = seller.generateOTP();
    }
    await seller.save();

    // Send OTP via SMS
    try {
      await sendOTP(phone, otpCode, 'registration');
    } catch (error) {
      console.error('Failed to send OTP:', error);
    }

    res.status(201).json({
      success: true,
      data: {
        message: 'Registration request submitted. OTP sent to phone.',
        sellerId: seller.sellerId, // Return the generated sellerId
        sellerIdCode: seller.sellerId,
        requiresApproval: true,
        expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
      },
    });

    // Create Admin TODO Task
    try {
      await adminTaskController.createTaskInternal({
        title: 'New IRA Partner Application',
        description: `A new IRA Partner "${name}" (${phone}) has registered and is waiting for approval in ${area || 'unspecified area'}.`,
        category: 'seller',
        priority: 'high',
        link: '/sellers',
        relatedId: seller._id,
        metadata: {
          sellerName: name,
          phone: phone,
          area: area
        }
      });
    } catch (taskError) {
      console.error('Failed to create admin task:', taskError);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request OTP for seller
 * @route   POST /api/sellers/auth/request-otp
 * @access  Public
 */
exports.requestOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Special bypass number - skip all checks and proceed to OTP
    if (isSpecialBypassNumber(phone)) {
      // Find or create seller
      let seller = await Seller.findOne({ phone });

      if (!seller) {
        // Generate unique sellerId
        const lastSeller = await Seller.findOne()
          .sort({ sellerId: -1 })
          .select('sellerId');

        let nextNumber = 101;
        if (lastSeller && lastSeller.sellerId) {
          const match = lastSeller.sellerId.match(/\d+$/);
          if (match) {
            const lastNum = parseInt(match[0]);
            if (lastSeller.sellerId.startsWith('SLR-')) {
              nextNumber = lastNum + 1;
            }
          }
        }

        seller = new Seller({
          sellerId: `SLR-${nextNumber}`,
          phone: phone,
          name: 'Special Bypass Seller', // Placeholder name
          status: 'pending',
        });
      }

      // Set OTP to 123456
      seller.otp = {
        code: SPECIAL_BYPASS_OTP,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
      await seller.save();

      return res.status(200).json({
        success: true,
        data: {
          message: 'OTP sent successfully',
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
      });
    }

    // Check if phone exists in other roles (user, vendor)
    const phoneCheck = await checkPhoneExists(phone, 'seller');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    let seller = await Seller.findOne({ phone });

    // If seller doesn't exist, create pending registration with sellerId
    if (!seller) {
      // Generate unique sellerId in SLR-XXX format
      const lastSeller = await Seller.findOne()
        .sort({ sellerId: -1 })
        .select('sellerId');

      let nextNumber = 101;
      if (lastSeller && lastSeller.sellerId) {
        const match = lastSeller.sellerId.match(/\d+$/);
        if (match) {
          const lastNum = parseInt(match[0]);
          if (lastSeller.sellerId.startsWith('SLR-')) {
            nextNumber = lastNum + 1;
          } else {
            const lastSLRSeller = await Seller.findOne({ sellerId: /^SLR-/ })
              .sort({ sellerId: -1 })
              .select('sellerId');
            if (lastSLRSeller && lastSLRSeller.sellerId) {
              const slrMatch = lastSLRSeller.sellerId.match(/\d+$/);
              if (slrMatch) {
                nextNumber = parseInt(slrMatch[0]) + 1;
              }
            }
          }
        }
      }

      const generatedSellerId = `SLR-${nextNumber}`;
      seller = new Seller({
        sellerId: generatedSellerId,
        phone,
        name: 'New Seller', // Placeholder name to satisfy model requirement
        status: 'pending',
      });
    }

    // Clear any existing OTP before generating new one
    seller.clearOTP();

    // Check if this is a test phone number - use default OTP 123456
    const testOTPInfo = getTestOTPInfo(phone);
    let otpCode;
    if (testOTPInfo.isTest) {
      // For test numbers, set OTP directly to 123456
      otpCode = testOTPInfo.defaultOTP;
      seller.otp = {
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
    } else {
      // Generate new unique OTP for regular numbers
      otpCode = seller.generateOTP();
    }
    await seller.save();

    // Send OTP via SMS
    try {
      await sendOTP(phone, otpCode, 'login');
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
 * @desc    Verify OTP and complete login/registration
 * @route   POST /api/sellers/auth/verify-otp
 * @access  Public
 */
exports.verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required',
      });
    }

    // Special bypass number - accept OTP 123456 and create/find seller
    if (isSpecialBypassNumber(phone)) {
      if (otp !== SPECIAL_BYPASS_OTP) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP',
        });
      }

      // Find or create seller
      let seller = await Seller.findOne({ phone });

      if (!seller) {
        // Generate unique sellerId
        const lastSeller = await Seller.findOne()
          .sort({ sellerId: -1 })
          .select('sellerId');

        let nextNumber = 101;
        if (lastSeller && lastSeller.sellerId) {
          const match = lastSeller.sellerId.match(/\d+$/);
          if (match) {
            const lastNum = parseInt(match[0]);
            if (lastSeller.sellerId.startsWith('SLR-')) {
              nextNumber = lastNum + 1;
            }
          }
        }

        seller = new Seller({
          sellerId: `SLR-${nextNumber}`,
          phone: phone,
          name: 'Special Bypass Seller',
          status: 'pending',
        });
        await seller.save();
        console.log(`✅ Special bypass seller created: ${phone}`);
      }

      // Clear OTP after successful verification
      seller.clearOTP();
      await seller.save();

      // Generate JWT token
      const token = generateToken({
        sellerId: seller._id,
        phone: seller.phone,
        sellerIdCode: seller.sellerId,
        role: 'seller',
        type: 'seller',
      });

      return res.status(200).json({
        success: true,
        data: {
          token,
          seller: {
            id: seller._id,
            sellerId: seller.sellerId,
            name: seller.name,
            phone: seller.phone,
            area: seller.area,
            status: seller.status,
            isActive: seller.isActive,
          },
        },
      });
    }

    // Check if phone exists in other roles first
    const phoneCheck = await checkPhoneExists(phone, 'seller');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    // Check if phone exists in seller role
    const sellerCheck = await checkPhoneInRole(phone, 'seller');
    let seller = sellerCheck.data;

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found. Please register first.',
        requiresRegistration: true, // Flag for frontend to redirect
      });
    }

    // Verify OTP
    const isOtpValid = seller.verifyOTP(otp);

    if (!isOtpValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // If seller doesn't have sellerId yet (registration completion), generate it
    if (!seller.sellerId) {
      const lastSeller = await Seller.findOne()
        .sort({ sellerId: -1 })
        .select('sellerId');

      let nextNumber = 101;
      if (lastSeller && lastSeller.sellerId) {
        const match = lastSeller.sellerId.match(/\d+$/);
        if (match) {
          const lastNum = parseInt(match[0]);
          if (lastSeller.sellerId.startsWith('SLR-')) {
            nextNumber = lastNum + 1;
          } else {
            const lastSLRSeller = await Seller.findOne({ sellerId: /^SLR-/ })
              .sort({ sellerId: -1 })
              .select('sellerId');
            if (lastSLRSeller && lastSLRSeller.sellerId) {
              const slrMatch = lastSLRSeller.sellerId.match(/\d+$/);
              if (slrMatch) {
                nextNumber = parseInt(slrMatch[0]) + 1;
              }
            }
          }
        }
      }

      const generatedSellerId = `SLR-${nextNumber}`;
      seller.sellerId = generatedSellerId;
      await seller.save();
      console.log(`✅ Seller ID generated: ${generatedSellerId} for seller ${seller.name} (${seller.phone})`);
    }

    // If seller is pending (just registered), return success with pending status
    if (seller.status === 'pending' || !seller.isActive) {
      return res.status(200).json({
        success: true,
        data: {
          seller: {
            id: seller._id,
            sellerId: seller.sellerId,
            name: seller.name,
            phone: seller.phone,
            area: seller.area,
            status: seller.status,
            isActive: seller.isActive,
          },
          requiresApproval: true,
          message: 'Registration successful. Your account is pending admin approval.',
        },
      });
    }

    // If seller is rejected or suspended, return error
    if (seller.status === 'rejected' || seller.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: `Seller account is ${seller.status}. Please contact admin.`,
        sellerId: seller.sellerId,
      });
    }

    // Clear OTP after successful verification
    seller.clearOTP();
    await seller.save();

    // Generate JWT token
    const token = generateToken({
      sellerId: seller._id,
      phone: seller.phone,
      sellerIdCode: seller.sellerId,
      role: 'seller',
      type: 'seller',
    });

    // Enhanced console logging
    const timestamp = new Date().toISOString();
    console.log('\n' + '='.repeat(60));
    console.log('🔐 SELLER OTP VERIFIED');
    console.log('='.repeat(60));
    console.log(`📱 Phone: ${phone}`);
    console.log(`🆔 Seller ID: ${seller.sellerId}`);
    console.log(`👤 Name: ${seller.name}`);
    console.log(`✅ Status: ${seller.status}`);
    console.log(`⏰ Logged In At: ${timestamp}`);
    console.log('='.repeat(60) + '\n');

    res.status(200).json({
      success: true,
      data: {
        token,
        seller: {
          id: seller._id,
          sellerId: seller.sellerId,
          name: seller.name,
          phone: seller.phone,
          area: seller.area,
          status: seller.status,
          isActive: seller.isActive,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Seller logout
 * @route   POST /api/sellers/auth/logout
 * @access  Private (Seller)
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
 * @desc    Get seller profile
 * @route   GET /api/sellers/auth/profile
 * @access  Private (Seller)
 */
exports.getProfile = async (req, res, next) => {
  try {
    // Seller is attached by authorizeSeller middleware
    const seller = req.seller;

    res.status(200).json({
      success: true,
      data: {
        seller: {
          id: seller._id,
          sellerId: seller.sellerId,
          name: seller.name,
          phone: seller.phone,
          email: seller.email,
          area: seller.area,
          location: seller.location,
          monthlyTarget: seller.monthlyTarget,
          wallet: {
            balance: seller.wallet.balance,
            pending: seller.wallet.pending,
            available: seller.wallet.balance - seller.wallet.pending,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update seller profile
 * @route   PUT /api/sellers/profile
 * @access  Private (Seller)
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { name, phone, email, area, location } = req.body;

    // Update allowed fields
    if (name !== undefined) seller.name = name;
    if (phone !== undefined) {
      // Check if phone is already taken by another seller
      const existingSeller = await Seller.findOne({ phone, _id: { $ne: seller._id } });
      if (existingSeller) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already in use by another seller',
        });
      }
      seller.phone = phone;
    }
    if (email !== undefined) seller.email = email;
    if (area !== undefined) seller.area = area;
    if (location !== undefined) seller.location = location;

    await seller.save();

    res.status(200).json({
      success: true,
      data: {
        seller: {
          id: seller._id,
          sellerId: seller.sellerId,
          name: seller.name,
          phone: seller.phone,
          email: seller.email,
          area: seller.area,
          location: seller.location,
        },
        message: 'Profile updated successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change seller password
 * @route   PUT /api/sellers/password
 * @access  Private (Seller)
 */
exports.changePassword = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    // Sellers use OTP-based auth, so password might not exist
    // If password doesn't exist, we can't verify current password
    if (!seller.password) {
      return res.status(400).json({
        success: false,
        message: 'Password not set. Please use OTP-based authentication.',
      });
    }

    // For now, since sellers use OTP, we'll just return a message
    // If password functionality is needed, implement bcrypt comparison here
    res.status(501).json({
      success: false,
      message: 'Password change not supported. Sellers use OTP-based authentication.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get dashboard overview
 * @route   GET /api/sellers/dashboard
 * @access  Private (Seller)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const seller = req.seller;

    // Get total referrals count
    const totalReferrals = await User.countDocuments({ sellerId: seller.sellerId });

    // Get current month's sales (completed orders)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const currentMonthSales = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: currentMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const totalSales = currentMonthSales[0]?.totalSales || 0;
    const orderCount = currentMonthSales[0]?.orderCount || 0;

    // Calculate target progress
    const targetProgress = seller.monthlyTarget > 0
      ? (totalSales / seller.monthlyTarget) * 100
      : 0;

    // Get wallet summary
    const walletBalance = seller.wallet.balance;
    const pendingWithdrawals = seller.wallet.pending;
    const availableBalance = walletBalance - pendingWithdrawals;

    // Get pending withdrawal requests count
    const pendingWithdrawalCount = await WithdrawalRequest.countDocuments({
      sellerId: seller._id,
      status: 'pending',
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalReferrals,
          currentMonthSales: totalSales,
          currentMonthOrders: orderCount,
          monthlyTarget: seller.monthlyTarget,
          targetProgress: Math.round(targetProgress * 100) / 100,
          wallet: {
            balance: walletBalance,
            pending: pendingWithdrawals,
            available: availableBalance,
            pendingWithdrawalCount,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get overview data (referrals, sales, target)
 * @route   GET /api/sellers/dashboard/overview
 * @access  Private (Seller)
 */
exports.getOverview = async (req, res, next) => {
  try {
    const seller = req.seller;

    // Get referrals count
    const totalReferrals = await User.countDocuments({ sellerId: seller.sellerId });

    // Get current month's sales
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const salesData = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: currentMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    const totalSales = salesData[0]?.totalSales || 0;
    const orderCount = salesData[0]?.orderCount || 0;
    const averageOrderValue = salesData[0]?.averageOrderValue || 0;

    // Calculate target progress
    const targetProgress = seller.monthlyTarget > 0
      ? (totalSales / seller.monthlyTarget) * 100
      : 0;

    // Get active referrals (users who made purchases this month)
    const activeReferrals = await Order.distinct('userId', {
      sellerId: seller.sellerId,
      status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
      paymentStatus: PAYMENT_STATUS.FULLY_PAID,
      createdAt: { $gte: currentMonthStart },
    });

    res.status(200).json({
      success: true,
      data: {
        referrals: {
          total: totalReferrals,
          active: activeReferrals.length,
        },
        sales: {
          currentMonth: totalSales,
          orderCount,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        },
        target: {
          monthlyTarget: seller.monthlyTarget,
          achieved: totalSales,
          progress: Math.round(targetProgress * 100) / 100,
          remaining: seller.monthlyTarget - totalSales,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get wallet data
 * @route   GET /api/sellers/dashboard/wallet
 * @access  Private (Seller)
 */
exports.getWallet = async (req, res, next) => {
  try {
    const seller = req.seller;

    // Get pending withdrawal requests
    const pendingWithdrawals = await WithdrawalRequest.find({
      sellerId: seller._id,
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .select('amount status createdAt')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        wallet: {
          balance: seller.wallet.balance,
          pending: seller.wallet.pending,
          available: seller.wallet.balance - seller.wallet.pending,
        },
        pendingWithdrawals,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get referrals data (dashboard)
 * @route   GET /api/sellers/dashboard/referrals
 * @access  Private (Seller)
 */
exports.getReferrals = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { limit = 10 } = req.query;

    // Get recent referrals (users linked to seller)
    const referrals = await User.find({ sellerId: seller.sellerId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('name phone email createdAt location')
      .lean();

    // Get current month purchases per referral
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const referralStats = await Promise.all(
      referrals.map(async (referral) => {
        // Get current month purchases for this user
        const userPurchases = await Order.aggregate([
          {
            $match: {
              userId: referral._id,
              sellerId: seller.sellerId,
              status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
              paymentStatus: PAYMENT_STATUS.FULLY_PAID,
              createdAt: { $gte: currentMonthStart },
            },
          },
          {
            $group: {
              _id: null,
              totalPurchases: { $sum: '$totalAmount' },
              orderCount: { $sum: 1 },
            },
          },
        ]);

        const monthlyPurchases = userPurchases[0]?.totalPurchases || 0;
        const orderCount = userPurchases[0]?.orderCount || 0;

        // Determine commission rate based on monthly purchases
        // 3% if >= 50000, 2% if < 50000
        const commissionRate = monthlyPurchases < IRA_PARTNER_COMMISSION_THRESHOLD
          ? IRA_PARTNER_COMMISSION_RATE_LOW
          : IRA_PARTNER_COMMISSION_RATE_HIGH;

        // Calculate commission (simplified - actual calculation happens on order completion)
        const estimatedCommission = monthlyPurchases * (commissionRate / 100);

        return {
          ...referral,
          monthlyPurchases,
          orderCount,
          commissionRate,
          estimatedCommission: Math.round(estimatedCommission * 100) / 100,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        referrals: referralStats,
        totalReferrals: await User.countDocuments({ sellerId: seller.sellerId }),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get performance data
 * @route   GET /api/sellers/dashboard/performance
 * @access  Private (Seller)
 */
exports.getPerformance = async (req, res, next) => {
  try {
    const seller = req.seller;

    // Get current month's performance
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const performanceData = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: currentMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    const totalSales = performanceData[0]?.totalSales || 0;
    const orderCount = performanceData[0]?.orderCount || 0;
    const averageOrderValue = performanceData[0]?.averageOrderValue || 0;

    // Get active users count
    const activeUsers = await Order.distinct('userId', {
      sellerId: seller.sellerId,
      status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
      paymentStatus: PAYMENT_STATUS.FULLY_PAID,
      createdAt: { $gte: currentMonthStart },
    });

    // Calculate target progress
    const targetProgress = seller.monthlyTarget > 0
      ? (totalSales / seller.monthlyTarget) * 100
      : 0;

    res.status(200).json({
      success: true,
      data: {
        currentMonth: {
          sales: totalSales,
          orders: orderCount,
          activeUsers: activeUsers.length,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        },
        target: {
          monthlyTarget: seller.monthlyTarget,
          achieved: totalSales,
          progress: Math.round(targetProgress * 100) / 100,
          remaining: seller.monthlyTarget - totalSales,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// WALLET & COMMISSION CONTROLLERS
// ============================================================================

/**
 * @desc    Get wallet details
 * @route   GET /api/sellers/wallet
 * @access  Private (Seller)
 */
exports.getWalletDetails = async (req, res, next) => {
  try {
    const seller = req.seller;

    // Get recent commissions (transactions)
    const recentCommissions = await Commission.find({ sellerId: seller._id })
      .populate('userId', 'name phone')
      .populate('orderId', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('-__v')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        wallet: {
          balance: seller.wallet.balance,
          pending: seller.wallet.pending,
          available: seller.wallet.balance - seller.wallet.pending,
        },
        recentCommissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get wallet transaction history
 * @route   GET /api/sellers/wallet/transactions
 * @access  Private (Seller)
 */
exports.getWalletTransactions = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { page = 1, limit = 20, month, year } = req.query;

    // Build query
    const query = { sellerId: seller._id };

    if (month && year) {
      query.month = parseInt(month);
      query.year = parseInt(year);
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get commissions grouped by user and month
    const transactions = await Commission.find(query)
      .populate('userId', 'name phone')
      .populate('orderId', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v')
      .lean();

    // Group commissions by user and month for summary
    const commissionSummary = await Commission.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            userId: '$userId',
            month: '$month',
            year: '$year',
          },
          totalCommission: { $sum: '$commissionAmount' },
          orderCount: { $sum: 1 },
          cumulativePurchases: { $max: '$newCumulativePurchaseAmount' },
          commissionRate: { $max: '$commissionRate' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          userId: '$user._id',
          userName: '$user.name',
          userPhone: '$user.phone',
          month: '$_id.month',
          year: '$_id.year',
          totalCommission: 1,
          orderCount: 1,
          cumulativePurchases: 1,
          commissionRate: 1,
        },
      },
      {
        $sort: { year: -1, month: -1 },
      },
    ]);

    const total = await Commission.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        commissionSummary,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request withdrawal from wallet
 * @route   POST /api/sellers/wallet/withdraw
 * @access  Private (Seller)
 */
exports.requestWithdrawal = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { amount, bankAccountId } = req.body;

    console.log(`🔍 [requestWithdrawal] Seller: ${seller.sellerId}, Amount: ${amount}, BankAccountId: ${bankAccountId}`);
    console.log(`🔍 [requestWithdrawal] Wallet Balance: ${seller.wallet.balance}, Wallet Pending: ${seller.wallet.pending}`);

    if (!amount || amount < 500) {
      console.log(`❌ [requestWithdrawal] Invalid amount: ${amount}`);
      return res.status(400).json({
        success: false,
        message: 'Valid withdrawal amount is required (minimum ₹500)',
      });
    }

    // Check if seller has a pending withdrawal request
    const existingPending = await WithdrawalRequest.findOne({
      sellerId: seller._id,
      status: 'pending',
    });

    if (existingPending) {
      console.log(`❌ [requestWithdrawal] Already has pending withdrawal: ${existingPending._id}`);
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request. Please wait for admin approval.',
      });
    }

    // Calculate available balance (seller-specific)
    // Sync wallet.pending with actual pending withdrawals to ensure accuracy
    const actualPendingWithdrawals = await WithdrawalRequest.aggregate([
      {
        $match: {
          sellerId: seller._id,
          status: 'pending',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const actualPendingAmount = actualPendingWithdrawals[0]?.totalAmount || 0;

    // Sync wallet.pending if it's out of sync (for data consistency)
    if (Math.abs(seller.wallet.pending - actualPendingAmount) > 0.01) {
      seller.wallet.pending = actualPendingAmount;
      await seller.save();
    }

    const availableBalance = seller.wallet.balance - seller.wallet.pending;
    console.log(`🔍 [requestWithdrawal] Available Balance: ${availableBalance}, Requested: ${amount}`);

    if (amount > availableBalance) {
      console.log(`❌ [requestWithdrawal] Insufficient balance. Available: ${availableBalance}, Requested: ${amount}`);
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${Math.round(availableBalance * 100) / 100}, Requested: ₹${amount}`,
      });
    }

    // Verify bank account if provided
    let bankAccount = null;
    if (bankAccountId) {
      bankAccount = await BankAccount.findOne({
        _id: bankAccountId,
        userId: seller._id,
        userType: 'seller',
      });

      if (!bankAccount) {
        console.log(`❌ [requestWithdrawal] Bank account not found: ${bankAccountId} for seller: ${seller._id}`);
        return res.status(400).json({
          success: false,
          message: 'Bank account not found',
        });
      }
    } else {
      // Get primary bank account
      bankAccount = await BankAccount.findOne({
        userId: seller._id,
        userType: 'seller',
        isPrimary: true,
      });

      if (!bankAccount) {
        console.log(`❌ [requestWithdrawal] No primary bank account found for seller: ${seller.sellerId}`);
        return res.status(400).json({
          success: false,
          message: 'Please add a bank account before requesting withdrawal',
        });
      }
    }

    // Generate unique withdrawal ID
    const withdrawalId = await generateUniqueId(WithdrawalRequest, 'WDR', 'withdrawalId', 101);

    // Create withdrawal request
    const withdrawal = await WithdrawalRequest.create({
      withdrawalId,
      userType: 'seller',
      sellerId: seller._id,
      amount,
      availableBalance,
      bankAccountId: bankAccount._id,
      status: 'pending',
    });

    // Update seller wallet pending amount (seller-specific)
    seller.wallet.pending += amount;
    await seller.save();

    // Log to payment history
    try {
      await PaymentHistory.create({
        activityType: 'seller_withdrawal_requested',
        sellerId: seller._id,
        withdrawalRequestId: withdrawal._id,
        bankAccountId: bankAccount._id,
        amount,
        status: 'pending',
        bankDetails: {
          accountHolderName: bankAccount.accountHolderName,
          accountNumber: bankAccount.accountNumber,
          ifscCode: bankAccount.ifscCode,
          bankName: bankAccount.bankName,
        },
        description: `Seller ${seller.sellerId} requested withdrawal of ₹${amount}`,
        metadata: {
          sellerIdCode: seller.sellerId,
          sellerName: seller.name,
          sellerPhone: seller.phone,
          availableBalance,
        },
      });
    } catch (historyError) {
      console.error('Error logging withdrawal history:', historyError);
      // Don't fail withdrawal if history logging fails
    }

    console.log(`✅ Withdrawal requested: ₹${amount} by seller ${seller.sellerId} (${seller.phone})`);

    res.status(201).json({
      success: true,
      data: {
        withdrawal,
      },
      message: 'Withdrawal request submitted successfully. Awaiting admin approval.',
    });

    // Create Admin TODO Task
    try {
      await adminTaskController.createTaskInternal({
        title: 'New IRA Partner Withdrawal Request',
        description: `IRA Partner "${seller.name}" (${seller.phone}) requested withdrawal of ₹${amount.toLocaleString('en-IN')}.`,
        category: 'finance',
        priority: 'high',
        link: '/sellers/withdrawals',
        relatedId: withdrawal._id,
        metadata: {
          sellerName: seller.name,
          amount: amount,
          withdrawalId: withdrawal.withdrawalId
        }
      });
    } catch (taskError) {
      console.error('Failed to create admin task:', taskError);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get withdrawal requests
 * @route   GET /api/sellers/wallet/withdrawals
 * @access  Private (Seller)
 */
exports.getWithdrawals = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { sellerId: seller._id };

    if (status) {
      query.status = status;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const withdrawals = await WithdrawalRequest.find(query)
      .populate('bankAccountId')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v')
      .lean();

    const total = await WithdrawalRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// REFERRALS & COMMISSIONS CONTROLLERS
// ============================================================================

/**
 * @desc    Get referral details (specific user)
 * @route   GET /api/sellers/referrals/:referralId
 * @access  Private (Seller)
 */
exports.getReferralDetails = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { referralId } = req.params;

    // Find user (must be linked to this seller)
    const user = await User.findOne({
      _id: referralId,
      sellerId: seller.sellerId,
    }).select('name phone email createdAt location');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Referral not found or not linked to your seller ID',
      });
    }

    // Get current month's purchases
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get user's orders for current month
    const currentMonthOrders = await Order.find({
      userId: user._id,
      sellerId: seller.sellerId,
      status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
      paymentStatus: PAYMENT_STATUS.FULLY_PAID,
      createdAt: { $gte: currentMonthStart },
    })
      .sort({ createdAt: -1 })
      .select('orderNumber totalAmount createdAt items')
      .lean();

    // Calculate monthly purchase total
    const monthlyPurchaseTotal = currentMonthOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );

    // Determine commission rate based on monthly purchases
    // 3% if >= 50000, 2% if < 50000
    const commissionRate = monthlyPurchaseTotal < IRA_PARTNER_COMMISSION_THRESHOLD
      ? IRA_PARTNER_COMMISSION_RATE_LOW
      : IRA_PARTNER_COMMISSION_RATE_HIGH;

    // Get commissions for this user this month
    const currentMonthCommissions = await Commission.find({
      sellerId: seller._id,
      userId: user._id,
      month: currentMonth,
      year: currentYear,
    })
      .populate('orderId', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .select('-__v')
      .lean();

    const totalCommissionEarned = currentMonthCommissions.reduce(
      (sum, comm) => sum + comm.commissionAmount,
      0
    );

    // Get all-time stats
    const allTimeStats = await Order.aggregate([
      {
        $match: {
          userId: user._id,
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
        },
      },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        referral: user,
        currentMonth: {
          month: currentMonth,
          year: currentYear,
          purchaseTotal: monthlyPurchaseTotal,
          orderCount: currentMonthOrders.length,
          orders: currentMonthOrders,
          commissionRate,
          commissionEarned: totalCommissionEarned,
          commissions: currentMonthCommissions,
        },
        allTime: {
          totalPurchases: allTimeStats[0]?.totalPurchases || 0,
          orderCount: allTimeStats[0]?.orderCount || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get referral statistics
 * @route   GET /api/sellers/referrals/stats
 * @access  Private (Seller)
 */
exports.getReferralStats = async (req, res, next) => {
  try {
    const seller = req.seller;

    // Get current month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all referrals
    const totalReferrals = await User.countDocuments({ sellerId: seller.sellerId });

    // Get active referrals (made purchases this month)
    const activeReferrals = await Order.distinct('userId', {
      sellerId: seller.sellerId,
      status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
      paymentStatus: PAYMENT_STATUS.FULLY_PAID,
      createdAt: { $gte: currentMonthStart },
    });

    // Calculate per-user monthly purchases
    const userMonthlyPurchases = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: currentMonthStart },
        },
      },
      {
        $group: {
          _id: '$userId',
          totalPurchases: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          userId: '$user._id',
          userName: '$user.name',
          userPhone: '$user.phone',
          totalPurchases: 1,
          orderCount: 1,
          commissionRate: {
            $cond: [
              { $lte: ['$totalPurchases', IRA_PARTNER_COMMISSION_THRESHOLD] },
              IRA_PARTNER_COMMISSION_RATE_LOW,
              IRA_PARTNER_COMMISSION_RATE_HIGH,
            ],
          },
          estimatedCommission: {
            $multiply: [
              '$totalPurchases',
              {
                $divide: [
                  {
                    $cond: [
                      { $lte: ['$totalPurchases', IRA_PARTNER_COMMISSION_THRESHOLD] },
                      IRA_PARTNER_COMMISSION_RATE_LOW,
                      IRA_PARTNER_COMMISSION_RATE_HIGH,
                    ],
                  },
                  100,
                ],
              },
            ],
          },
        },
      },
      {
        $sort: { totalPurchases: -1 },
      },
    ]);

    // Calculate total commission
    const totalCommission = userMonthlyPurchases.reduce(
      (sum, user) => sum + user.estimatedCommission,
      0
    );

    // Calculate total sales
    const totalSales = userMonthlyPurchases.reduce(
      (sum, user) => sum + user.totalPurchases,
      0
    );

    // Count referrals by commission tier
    const lowTierReferrals = userMonthlyPurchases.filter(
      u => u.totalPurchases <= IRA_PARTNER_COMMISSION_THRESHOLD
    ).length;
    const highTierReferrals = userMonthlyPurchases.filter(
      u => u.totalPurchases > IRA_PARTNER_COMMISSION_THRESHOLD
    ).length;

    res.status(200).json({
      success: true,
      data: {
        period: {
          month: currentMonth,
          year: currentYear,
        },
        referrals: {
          total: totalReferrals,
          active: activeReferrals.length,
          lowTier: lowTierReferrals,
          highTier: highTierReferrals,
        },
        sales: {
          total: totalSales,
          averagePerUser: activeReferrals.length > 0
            ? Math.round((totalSales / activeReferrals.length) * 100) / 100
            : 0,
        },
        commissions: {
          total: Math.round(totalCommission * 100) / 100,
          averagePerUser: activeReferrals.length > 0
            ? Math.round((totalCommission / activeReferrals.length) * 100) / 100
            : 0,
        },
        userPurchases: userMonthlyPurchases,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// TARGET & PERFORMANCE CONTROLLERS
// ============================================================================

/**
 * @desc    Get monthly target and progress
 * @route   GET /api/sellers/target
 * @access  Private (Seller)
 */
exports.getTarget = async (req, res, next) => {
  try {
    const seller = req.seller;

    // Get current month's sales
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const salesData = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: currentMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          achieved: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const achieved = salesData[0]?.achieved || 0;
    const orderCount = salesData[0]?.orderCount || 0;
    const monthlyTarget = seller.monthlyTarget || 0;

    // Calculate progress
    const progress = monthlyTarget > 0
      ? (achieved / monthlyTarget) * 100
      : 0;

    // Calculate days remaining in month
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = Math.ceil((lastDayOfMonth - now) / (1000 * 60 * 60 * 24));

    // Calculate required daily sales to meet target
    const remainingToTarget = monthlyTarget - achieved;
    const requiredDailySales = daysRemaining > 0 && remainingToTarget > 0
      ? remainingToTarget / daysRemaining
      : 0;

    res.status(200).json({
      success: true,
      data: {
        target: {
          monthlyTarget,
          achieved,
          remaining: remainingToTarget,
          progress: Math.round(progress * 100) / 100,
          orderCount,
        },
        timeline: {
          currentDate: now,
          monthStart: currentMonthStart,
          monthEnd: lastDayOfMonth,
          daysRemaining,
          requiredDailySales: Math.round(requiredDailySales * 100) / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get performance analytics
 * @route   GET /api/sellers/performance
 * @access  Private (Seller)
 */
exports.getPerformanceAnalytics = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { period = '30' } = req.query; // days

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // Get sales trends
    const salesTrends = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          sales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get order status breakdown
    const orderStatusBreakdown = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          createdAt: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]);

    // Get top performing referrals
    const topReferrals = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: '$userId',
          totalPurchases: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalPurchases: -1 },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          userId: '$user._id',
          userName: '$user.name',
          userPhone: '$user.phone',
          totalPurchases: 1,
          orderCount: 1,
        },
      },
    ]);

    // Calculate conversion metrics
    const totalReferrals = await User.countDocuments({ sellerId: seller.sellerId });
    const activeReferrals = await Order.distinct('userId', {
      sellerId: seller.sellerId,
      status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
      paymentStatus: PAYMENT_STATUS.FULLY_PAID,
      createdAt: { $gte: daysAgo },
    });

    const conversionRate = totalReferrals > 0
      ? (activeReferrals.length / totalReferrals) * 100
      : 0;

    res.status(200).json({
      success: true,
      data: {
        period: parseInt(period),
        analytics: {
          salesTrends,
          orderStatusBreakdown,
          topReferrals,
          metrics: {
            totalReferrals,
            activeReferrals: activeReferrals.length,
            conversionRate: Math.round(conversionRate * 100) / 100,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DASHBOARD HELPER ENDPOINTS
// ============================================================================

/**
 * @desc    Get dashboard highlights/metrics
 * @route   GET /api/sellers/dashboard/highlights
 * @access  Private (Seller)
 */
exports.getDashboardHighlights = async (req, res, next) => {
  try {
    const seller = req.seller;
    const totalReferrals = await User.countDocuments({ sellerId: seller.sellerId });
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const currentMonthSales = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: currentMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const totalSales = currentMonthSales[0]?.totalSales || 0;
    const orderCount = currentMonthSales[0]?.orderCount || 0;
    const targetProgress = seller.monthlyTarget > 0
      ? (totalSales / seller.monthlyTarget) * 100
      : 0;

    res.status(200).json({
      success: true,
      data: {
        highlights: [
          {
            id: 'referrals',
            label: 'Total Referrals',
            value: totalReferrals,
            trend: 'up',
          },
          {
            id: 'sales',
            label: 'Monthly Sales',
            value: `₹${totalSales.toLocaleString('en-IN')}`,
            trend: totalSales > 0 ? 'up' : 'neutral',
          },
          {
            id: 'orders',
            label: 'Orders This Month',
            value: orderCount,
            trend: orderCount > 0 ? 'up' : 'neutral',
          },
          {
            id: 'target',
            label: 'Target Progress',
            value: `${Math.round(targetProgress)}%`,
            trend: targetProgress >= 100 ? 'up' : targetProgress >= 50 ? 'neutral' : 'down',
          },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get recent activity feed
 * @route   GET /api/sellers/dashboard/activity
 * @access  Private (Seller)
 */
exports.getRecentActivity = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit);

    const recentCommissions = await Commission.find({ sellerId: seller._id })
      .sort({ createdAt: -1 })
      .limit(limitNum * 2)
      .populate('userId', 'name phone')
      .populate('orderId', 'orderNumber totalAmount')
      .lean();

    const recentOrders = await Order.find({ sellerId: seller.sellerId })
      .sort({ createdAt: -1 })
      .limit(limitNum * 2)
      .populate('userId', 'name phone')
      .select('orderNumber totalAmount status createdAt')
      .lean();

    // Fetch recent approved/completed withdrawals
    const recentWithdrawals = await WithdrawalRequest.find({
      sellerId: seller._id,
      status: { $in: ['approved', 'completed'] },
    })
      .sort({ reviewedAt: -1, createdAt: -1 })
      .limit(limitNum * 2)
      .populate('bankAccountId', 'bankName accountNumber')
      .lean();

    const activities = [
      ...recentCommissions.map(commission => ({
        id: commission._id,
        type: 'commission',
        title: 'Commission Earned',
        message: `You earned ₹${commission.commissionAmount} for order #${commission.orderId?.orderNumber || 'N/A'}`,
        amount: commission.commissionAmount,
        timestamp: commission.createdAt,
        userName: commission.userId?.name || 'User',
        user: commission.userId?.name || 'User',
        orderId: commission.orderId?._id,
        orderNumber: commission.orderId?.orderNumber,
      })),
      ...recentOrders.map(order => ({
        id: order._id,
        type: 'order',
        title: 'Order Placed',
        message: `Order #${order.orderNumber} placed by referral`,
        amount: order.totalAmount,
        status: order.status,
        timestamp: order.createdAt,
        userName: order.userId?.name || 'User',
        user: order.userId?.name || 'User',
        orderId: order._id,
        orderNumber: order.orderNumber,
      })),
      ...recentWithdrawals.map(withdrawal => ({
        id: withdrawal._id,
        type: 'withdrawal',
        title: withdrawal.status === 'completed' ? 'Withdrawal Completed' : 'Withdrawal Approved',
        message: `Withdrawal of ₹${withdrawal.amount} ${withdrawal.status === 'completed' ? 'completed' : 'approved'}`,
        amount: -withdrawal.amount, // Negative amount for withdrawal
        timestamp: withdrawal.reviewedAt || withdrawal.createdAt,
        status: withdrawal.status,
        withdrawalId: withdrawal._id,
        bankName: withdrawal.bankAccountId?.bankName || 'Bank',
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limitNum);

    res.status(200).json({
      success: true,
      data: {
        activities,
        total: activities.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// WALLET ENDPOINTS
// ============================================================================

/**
 * @desc    Get withdrawal request details
 * @route   GET /api/sellers/wallet/withdrawals/:requestId
 * @access  Private (Seller)
 */
exports.getWithdrawalDetails = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { requestId } = req.params;

    const withdrawal = await WithdrawalRequest.findOne({
      _id: requestId,
      sellerId: seller._id,
    })
      .populate('reviewedBy', 'name email')
      .lean();

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        withdrawal,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// TARGET & PERFORMANCE ENDPOINTS
// ============================================================================

/**
 * @desc    Get target history
 * @route   GET /api/sellers/targets/history
 * @access  Private (Seller)
 */
exports.getTargetHistory = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { year, limit = 12 } = req.query;
    const limitNum = parseInt(limit);
    const now = new Date();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const targetsHistory = [];
    for (let i = 0; i < limitNum; i++) {
      const date = new Date(targetYear, now.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      const salesData = await Order.aggregate([
        {
          $match: {
            sellerId: seller.sellerId,
            status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
            paymentStatus: PAYMENT_STATUS.FULLY_PAID,
            createdAt: { $gte: monthStart, $lte: monthEnd },
          },
        },
        {
          $group: {
            _id: null,
            achieved: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
          },
        },
      ]);

      const achieved = salesData[0]?.achieved || 0;
      const orderCount = salesData[0]?.orderCount || 0;
      const progress = seller.monthlyTarget > 0
        ? (achieved / seller.monthlyTarget) * 100
        : 0;

      targetsHistory.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        monthName: date.toLocaleString('default', { month: 'long' }),
        target: seller.monthlyTarget,
        achieved,
        orderCount,
        progress: Math.round(progress * 100) / 100,
        status: achieved >= seller.monthlyTarget ? 'achieved' : 'pending',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        targets: targetsHistory,
        total: targetsHistory.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get target achievement incentives
 * @route   GET /api/sellers/targets/incentives
 * @access  Private (Seller)
 */
exports.getTargetIncentives = async (req, res, next) => {
  try {
    const seller = req.seller;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const currentMonthSales = await Order.aggregate([
      {
        $match: {
          sellerId: seller.sellerId,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: currentMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
        },
      },
    ]);

    const achieved = currentMonthSales[0]?.totalSales || 0;
    const targetAchieved = achieved >= seller.monthlyTarget;

    const incentives = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthSales = await Order.aggregate([
        {
          $match: {
            sellerId: seller.sellerId,
            status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
            paymentStatus: PAYMENT_STATUS.FULLY_PAID,
            createdAt: { $gte: monthStart, $lte: monthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalAmount' },
          },
        },
      ]);

      const monthAchieved = monthSales[0]?.totalSales || 0;
      if (monthAchieved >= seller.monthlyTarget) {
        incentives.push({
          month: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
          achieved: monthAchieved,
          target: seller.monthlyTarget,
          status: 'achieved',
          reward: 'Target achievement bonus',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        incentives,
        currentMonth: {
          achieved,
          target: seller.monthlyTarget,
          status: targetAchieved ? 'achieved' : 'pending',
        },
        totalEarned: incentives.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// ANNOUNCEMENTS & NOTIFICATIONS ENDPOINTS (Placeholders - TODO: Implement models)
// ============================================================================

exports.getAnnouncements = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { announcements: [], total: 0 },
    });
  } catch (error) {
    next(error);
  }
};

exports.markAnnouncementRead = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Announcement marked as read',
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllAnnouncementsRead = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'All announcements marked as read',
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { notifications: [], unreadCount: 0 },
    });
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotificationPreferences = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        preferences: {
          sms: true,
          email: true,
          push: true,
          announcements: true,
          commission: true,
          target: true,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateNotificationPreferences = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { preferences: req.body, message: 'Preferences updated successfully' },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// SHARING ENDPOINTS
// ============================================================================

exports.getShareLink = async (req, res, next) => {
  try {
    const seller = req.seller;
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?sellerId=${seller.sellerId}`;
    const shareText = `Join IRA SATHI using my Seller ID: ${seller.sellerId}. Register at: ${shareUrl}`;

    res.status(200).json({
      success: true,
      data: {
        sellerId: seller.sellerId,
        shareText,
        shareUrl,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.trackShareAction = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { platform, recipient } = req.body;
    console.log(`Seller ${seller.sellerId} shared via ${platform} to ${recipient}`);
    res.status(200).json({
      success: true,
      message: 'Share tracked successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// SUPPORT ENDPOINTS
// ============================================================================

const SupportTicket = require('../models/SupportTicket');

/**
 * @desc    Create support ticket (Report Issue)
 * @route   POST /api/sellers/support/report
 * @access  Private (Seller)
 */
exports.reportIssue = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { subject, description, category, priority } = req.body;

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'Subject and description are required',
      });
    }

    // Create the support ticket
    const ticket = new SupportTicket({
      userType: 'seller',
      sellerId: seller._id,
      subject,
      description,
      category: category || 'general',
      priority: priority || 'medium',
      lastActivityBy: 'seller',
      // Add initial message (the description becomes the first message)
      messages: [{
        senderId: seller._id,
        senderType: 'Seller',
        senderName: seller.name,
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
 * @desc    Get seller support tickets
 * @route   GET /api/sellers/support/tickets
 * @access  Private (Seller)
 */
exports.getSupportTickets = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { userType: 'seller', sellerId: seller._id };
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await SupportTicket.countDocuments(query);

    const tickets = await SupportTicket.find(query)
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('ticketId subject category priority status unreadByUser lastActivityAt createdAt')
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
 * @route   GET /api/sellers/support/tickets/:ticketId
 * @access  Private (Seller)
 */
exports.getSupportTicketDetails = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { ticketId } = req.params;

    const ticket = await SupportTicket.findOne({
      $or: [
        { _id: ticketId, userType: 'seller', sellerId: seller._id },
        { ticketId: ticketId, userType: 'seller', sellerId: seller._id },
      ],
    }).lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found',
      });
    }

    // Mark as read by seller
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
 * @route   POST /api/sellers/support/tickets/:ticketId/messages
 * @access  Private (Seller)
 */
exports.sendSupportMessage = async (req, res, next) => {
  try {
    const seller = req.seller;
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
        { _id: ticketId, userType: 'seller', sellerId: seller._id },
        { ticketId: ticketId, userType: 'seller', sellerId: seller._id },
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

    // Add message to ticket
    ticket.addMessage(seller._id, 'Seller', seller.name, message.trim(), false);

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

// ============================================================================
// BANK ACCOUNT CONTROLLERS
// ============================================================================

/**
 * @desc    Add bank account
 * @route   POST /api/sellers/bank-accounts
 * @access  Private (Seller)
 */
exports.addBankAccount = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { accountHolderName, accountNumber, ifscCode, bankName, branchName, isPrimary = false } = req.body;

    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({
        success: false,
        message: 'Account holder name, account number, IFSC code, and bank name are required',
      });
    }

    const bankAccount = await createBankAccount({
      userId: seller._id,
      userType: 'seller',
      accountHolderName,
      accountNumber,
      ifscCode: ifscCode.toUpperCase(),
      bankName,
      branchName,
      isPrimary,
    });

    res.status(201).json({
      success: true,
      data: {
        bankAccount,
      },
      message: 'Bank account added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get seller bank accounts
 * @route   GET /api/sellers/bank-accounts
 * @access  Private (Seller)
 */
exports.getBankAccounts = async (req, res, next) => {
  try {
    const seller = req.seller;

    const bankAccounts = await BankAccount.find({
      userId: seller._id,
      userType: 'seller',
    }).sort({ isPrimary: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        bankAccounts,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update bank account
 * @route   PUT /api/sellers/bank-accounts/:accountId
 * @access  Private (Seller)
 */
exports.updateBankAccount = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { accountId } = req.params;
    const { accountHolderName, accountNumber, ifscCode, bankName, branchName, isPrimary } = req.body;

    const bankAccount = await BankAccount.findOne({
      _id: accountId,
      userId: seller._id,
      userType: 'seller',
    });

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found',
      });
    }

    if (accountHolderName) bankAccount.accountHolderName = accountHolderName;
    if (accountNumber) bankAccount.accountNumber = accountNumber;
    if (ifscCode) bankAccount.ifscCode = ifscCode.toUpperCase();
    if (bankName) bankAccount.bankName = bankName;
    if (branchName !== undefined) bankAccount.branchName = branchName;
    if (isPrimary !== undefined) bankAccount.isPrimary = isPrimary;

    await bankAccount.save();

    res.status(200).json({
      success: true,
      data: {
        bankAccount,
      },
      message: 'Bank account updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete bank account
 * @route   DELETE /api/sellers/bank-accounts/:accountId
 * @access  Private (Seller)
 */
exports.deleteBankAccount = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { accountId } = req.params;

    const bankAccount = await BankAccount.findOne({
      _id: accountId,
      userId: seller._id,
      userType: 'seller',
    });

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found',
      });
    }

    await BankAccount.deleteOne({ _id: accountId });

    res.status(200).json({
      success: true,
      message: 'Bank account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// PROFILE CHANGE REQUEST CONTROLLERS
// ============================================================================

/**
 * @desc    Request name change
 * @route   POST /api/sellers/profile/request-name-change
 * @access  Private (Seller)
 */
exports.requestNameChange = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { requestedName, description } = req.body;

    if (!requestedName || !requestedName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Requested name is required',
      });
    }

    // Check if there's already a pending name change request
    const existingRequest = await SellerChangeRequest.findOne({
      sellerId: seller._id,
      changeType: 'name',
      status: 'pending',
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending name change request. Please wait for admin approval.',
      });
    }

    // Generate unique request ID
    const requestId = await generateUniqueId(SellerChangeRequest, 'SCR', 'requestId', 101);

    // Create change request
    const changeRequest = await SellerChangeRequest.create({
      requestId,
      sellerId: seller._id,
      sellerIdCode: seller.sellerId,
      changeType: 'name',
      currentValue: seller.name,
      requestedValue: requestedName.trim(),
      description: description || '',
      status: 'pending',
    });

    console.log(`📝 Name change request created: ${requestId} for seller ${seller.sellerId}`);

    res.status(201).json({
      success: true,
      data: {
        changeRequest,
      },
      message: 'Name change request submitted successfully. Awaiting admin approval.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request phone change
 * @route   POST /api/sellers/profile/request-phone-change
 * @access  Private (Seller)
 */
exports.requestPhoneChange = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { requestedPhone, description } = req.body;

    // Debug logging
    console.log('📞 Phone change request received:', {
      sellerId: seller?._id,
      requestedPhone,
      body: req.body,
    });

    if (!requestedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Requested phone number is required',
      });
    }

    const trimmedPhone = String(requestedPhone).trim();
    if (!trimmedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Requested phone number cannot be empty',
      });
    }

    // Validate phone format
    const phoneRegex = /^[+]?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      return res.status(400).json({
        success: false,
        message: `Please provide a valid phone number. Format: 10-15 digits, optionally starting with +. Received: ${trimmedPhone}`,
      });
    }

    // Check if phone is already in use by another seller
    const existingSeller = await Seller.findOne({
      phone: trimmedPhone,
      _id: { $ne: seller._id },
    });

    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'This phone number is already in use by another seller',
      });
    }

    // Check if there's already a pending phone change request
    const existingRequest = await SellerChangeRequest.findOne({
      sellerId: seller._id,
      changeType: 'phone',
      status: 'pending',
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending phone change request. Please wait for admin approval.',
      });
    }

    // Generate unique request ID
    const requestId = await generateUniqueId(SellerChangeRequest, 'SCR', 'requestId', 101);

    // Create change request
    const changeRequest = await SellerChangeRequest.create({
      requestId,
      sellerId: seller._id,
      sellerIdCode: seller.sellerId,
      changeType: 'phone',
      currentValue: seller.phone,
      requestedValue: trimmedPhone,
      description: description || '',
      status: 'pending',
    });

    console.log(`📝 Phone change request created: ${requestId} for seller ${seller.sellerId}`);

    res.status(201).json({
      success: true,
      data: {
        changeRequest,
      },
      message: 'Phone change request submitted successfully. Awaiting admin approval.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get change requests
 * @route   GET /api/sellers/profile/change-requests
 * @access  Private (Seller)
 */
exports.getChangeRequests = async (req, res, next) => {
  try {
    const seller = req.seller;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { sellerId: seller._id };

    if (status) {
      query.status = status;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const changeRequests = await SellerChangeRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v')
      .lean();

    const total = await SellerChangeRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        changeRequests,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

