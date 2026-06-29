/**
 * Admin Controller
 * 
 * Handles all admin-related operations
 */

const Admin = require('../models/Admin');
// const User = require('../models/User');
const Vendor = require('../models/Vendor');
// const Seller = require('../models/Seller');
const Product = require('../models/Product');
const ProductAssignment = require('../models/ProductAssignment');
const CreditPurchase = require('../models/CreditPurchase');
const Seller = require('../models/Seller');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const VendorEarning = require('../models/VendorEarning');
const BankAccount = require('../models/BankAccount');
const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Commission = require('../models/Commission');
const PaymentHistory = require('../models/PaymentHistory');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const UserNotification = require('../models/UserNotification');
const Offer = require('../models/Offer');
const CreditRepayment = require('../models/CreditRepayment');
const Review = require('../models/Review');
const SellerChangeRequest = require('../models/SellerChangeRequest');
const razorpayService = require('../services/razorpayService');
const { VENDOR_COVERAGE_RADIUS_KM, MIN_VENDOR_PURCHASE, DELIVERY_TIMELINE_HOURS, ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');

const { sendOTP } = require('../utils/otp');
const { getTestOTPInfo } = require('../services/smsIndiaHubService');
const { findPhoneInModel } = require('../utils/phoneNormalize');
const { OTP_EXPIRY_MINUTES } = require('../utils/constants');
const { generateToken } = require('../middleware/auth');
const { isSpecialBypassNumber, SPECIAL_BYPASS_OTP } = require('../utils/phoneValidation');
const { generateUniqueId } = require('../utils/generateUniqueId');
const { createPaymentHistory, createProductAssignment, createNotification, createOffer } = require('../utils/createWithId');

// Auto-finalize expired status update grace periods (runs in background)
async function processExpiredStatusUpdates() {
  try {
    const now = new Date();
    const expiredStatusUpdates = await Order.find({
      'statusUpdateGracePeriod.isActive': true,
      'statusUpdateGracePeriod.expiresAt': { $lte: now },
    });

    if (expiredStatusUpdates.length === 0) {
      return;
    }

    for (const order of expiredStatusUpdates) {
      order.statusUpdateGracePeriod.isActive = false;
      order.statusUpdateGracePeriod.finalizedAt = now;
      order.statusUpdateGracePeriod.previousPaymentStatus = undefined;
      order.statusUpdateGracePeriod.previousRemainingAmount = undefined;

      order.statusTimeline.push({
        status: order.status,
        timestamp: now,
        updatedBy: 'system',
        note: `Status update finalized after 1-hour grace period expired. Status is now locked at ${order.status}.`,
      });

      await order.save();
      console.log(`✅ Order ${order.orderNumber} status update finalized after grace period expired`);
    }
  } catch (error) {
    console.error('Failed to process expired status updates:', error);
  }
}

/**
 * @desc    Admin login (Step 1: Phone only)
 * @route   POST /api/admin/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
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
      return res.status(200).json({
        success: true,
        data: {
          requiresOtp: true,
          message: 'OTP sent to phone',
          phone: phone,
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
      });
    }

    // Find admin by phone - handle both +91 and non-prefix formats
    let admin = await findPhoneInModel(Admin, phone);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Admin account is deactivated',
      });
    }

    // Clear any existing OTP before generating new one
    admin.clearOTP();

    // Generate new unique OTP
    const otpCode = admin.generateOTP();
    await admin.save();

    // Send OTP to phone via SMS
    try {
      await sendOTP(admin.phone, otpCode, 'login');
      console.log(`✅ OTP sent to admin phone: ${admin.phone}`);
    } catch (error) {
      console.error('Failed to send OTP:', error);
      // Continue even if SMS fails - OTP is stored in database and can be retrieved for testing
    }

    res.status(200).json({
      success: true,
      data: {
        requiresOtp: true,
        message: 'OTP sent to phone',
        phone: admin.phone,
        expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request OTP for admin
 * @route   POST /api/admin/auth/request-otp
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
      return res.status(200).json({
        success: true,
        data: {
          message: 'OTP sent successfully',
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
      });
    }

    // Find admin - handle both +91 and non-prefix formats
    let admin = await findPhoneInModel(Admin, phone);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Clear any existing OTP before generating new one
    admin.clearOTP();

    // Check if this is a test phone number - use default OTP 123456
    const testOTPInfo = getTestOTPInfo(admin.phone);
    let otpCode;
    if (testOTPInfo.isTest) {
      // For test numbers, set OTP directly to 123456
      otpCode = testOTPInfo.defaultOTP;
      admin.otp = {
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
    } else {
      // Generate new unique OTP for regular numbers
      otpCode = admin.generateOTP();
    }
    await admin.save();

    // Send OTP to phone via SMS
    try {
      await sendOTP(admin.phone, otpCode, 'login');
      console.log(`✅ OTP sent to admin phone: ${admin.phone}`);
    } catch (error) {
      console.error('Failed to send OTP:', error);
      // Continue even if SMS fails - OTP is stored in database and can be retrieved for testing
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
 * @desc    Verify OTP and complete login
 * @route   POST /api/admin/auth/verify-otp
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

    // Special bypass number - accept OTP 123456 and create/find admin
    if (isSpecialBypassNumber(phone)) {
      if (otp !== SPECIAL_BYPASS_OTP) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP',
        });
      }

      // Find or create admin for special bypass number
      let admin = await findPhoneInModel(Admin, phone);

      if (!admin) {
        // Generate unique admin ID
        const adminId = await generateUniqueId(Admin, 'ADM', 'adminId', 101);
        // Create admin if doesn't exist
        admin = new Admin({
          adminId,
          phone: phone,
          name: 'Special Bypass Admin',
          role: 'admin',
          isActive: true,
        });
        await admin.save();
        console.log(`✅ Special bypass admin created: ${phone} with ID: ${adminId}`);
      }

      admin.lastLogin = new Date();
      await admin.save();

      // Generate JWT token
      const token = generateToken({
        adminId: admin._id,
        phone: admin.phone,
        role: admin.role,
        type: 'admin',
      });

      return res.status(200).json({
        success: true,
        data: {
          token,
          admin: {
            id: admin._id,
            phone: admin.phone,
            name: admin.name,
            role: admin.role,
          },
        },
      });
    }

    // Find admin - handle both +91 and non-prefix formats
    let admin = await findPhoneInModel(Admin, phone);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Verify OTP
    const isOtpValid = admin.verifyOTP(otp);

    if (!isOtpValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // Clear OTP after successful verification
    admin.clearOTP();
    admin.lastLogin = new Date();
    await admin.save();

    // Log successful login
    console.log(`\n✅ Admin logged in: ${admin.phone} (Role: ${admin.role}) at ${new Date().toISOString()}\n`);

    // Generate JWT token
    const token = generateToken({
      adminId: admin._id,
      phone: admin.phone,
      role: admin.role,
      type: 'admin',
    });

    res.status(200).json({
      success: true,
      data: {
        token,
        admin: {
          id: admin._id,
          phone: admin.phone,
          name: admin.name,
          role: admin.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin logout
 * @route   POST /api/admin/auth/logout
 * @access  Private (Admin)
 */
exports.logout = async (req, res, next) => {
  try {
    // TODO: Implement token blacklisting or refresh token invalidation
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin profile
 * @route   GET /api/admin/auth/profile
 * @access  Private (Admin)
 */
exports.getProfile = async (req, res, next) => {
  try {
    // Admin is attached by authorizeAdmin middleware
    const admin = req.admin;

    res.status(200).json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          phone: admin.phone,
          name: admin.name,
          role: admin.role,
          lastLogin: admin.lastLogin,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get dashboard overview
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    // Aggregate counts
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      totalVendors,
      approvedVendors,
      pendingVendors,
      totalSellers,
      approvedSellers,
      pendingSellers,
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      totalPayments,
      pendingPayments,
      completedPayments,
      pendingCreditPurchases,
      pendingWithdrawals,
    ] = await Promise.all([
      // Users
      User.countDocuments(),
      User.countDocuments({ isActive: true, isBlocked: false }),
      User.countDocuments({ isBlocked: true }),

      // Vendors
      Vendor.countDocuments(),
      Vendor.countDocuments({ status: 'approved', isActive: true }),
      Vendor.countDocuments({ status: 'pending' }),

      // Sellers
      Seller.countDocuments(),
      Seller.countDocuments({ status: 'approved', isActive: true }),
      Seller.countDocuments({ status: 'pending' }),

      // Products
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),

      // Orders
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: { $in: ['awaiting', 'processing', 'dispatched'] } }),
      Order.countDocuments({ status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] } }),
      Order.countDocuments({ status: 'cancelled' }),

      // Payments
      Payment.countDocuments(),
      Payment.countDocuments({ status: 'pending' }),
      Payment.countDocuments({ status: 'fully_paid' }),

      // Credit Purchases
      CreditPurchase.countDocuments({ status: 'pending' }),

      // Withdrawal Requests
      WithdrawalRequest.countDocuments({ status: 'pending' }),
    ]);

    // Calculate revenue (from completed orders)
    const revenueStats = await Order.aggregate([
      {
        $match: {
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    // Calculate revenue by time period (last 30 days, last 7 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [revenueLast30Days, revenueLast7Days] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
            paymentStatus: PAYMENT_STATUS.FULLY_PAID,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
            paymentStatus: PAYMENT_STATUS.FULLY_PAID,
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Calculate outstanding vendor credits
    const creditStats = await Vendor.aggregate([
      {
        $match: {
          status: 'approved',
          isActive: true,
          creditUsed: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$creditUsed' },
          totalLimit: { $sum: '$creditPolicy.limit' },
          vendorCount: { $sum: 1 },
        },
      },
    ]);

    // Calculate pending payments amount
    const pendingPaymentStats = await Payment.aggregate([
      {
        $match: {
          status: 'pending',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate pending withdrawals amount
    const pendingWithdrawalStats = await WithdrawalRequest.aggregate([
      {
        $match: {
          status: 'pending',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Extract aggregated data
    const totalRevenue = revenueStats[0]?.totalRevenue || 0;
    const averageOrderValue = revenueStats[0]?.averageOrderValue || 0;
    const revenueLast30DaysAmount = revenueLast30Days[0]?.totalRevenue || 0;
    const revenueLast7DaysAmount = revenueLast7Days[0]?.totalRevenue || 0;
    const totalOutstandingCredits = creditStats[0]?.totalOutstanding || 0;
    const totalCreditLimit = creditStats[0]?.totalLimit || 0;
    const pendingPaymentsAmount = pendingPaymentStats[0]?.totalAmount || 0;
    const pendingWithdrawalsAmount = pendingWithdrawalStats[0]?.totalAmount || 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          // User statistics
          users: {
            total: totalUsers,
            active: activeUsers,
            blocked: blockedUsers,
          },
          // Vendor statistics
          vendors: {
            total: totalVendors,
            approved: approvedVendors,
            pending: pendingVendors,
          },
          // Seller statistics
          sellers: {
            total: totalSellers,
            approved: approvedSellers,
            pending: pendingSellers,
          },
          // Product statistics
          products: {
            total: totalProducts,
            active: activeProducts,
          },
          // Order statistics
          orders: {
            total: totalOrders,
            pending: pendingOrders,
            processing: processingOrders,
            delivered: deliveredOrders,
            cancelled: cancelledOrders,
          },
          // Revenue statistics
          revenue: {
            total: totalRevenue,
            last30Days: revenueLast30DaysAmount,
            last7Days: revenueLast7DaysAmount,
            averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          },
          // Payment statistics
          payments: {
            total: totalPayments,
            pending: pendingPayments,
            completed: completedPayments,
            pendingAmount: pendingPaymentsAmount,
          },
          // Credit statistics
          credits: {
            outstanding: totalOutstandingCredits,
            totalLimit: totalCreditLimit,
            utilization: totalCreditLimit > 0
              ? Math.round((totalOutstandingCredits / totalCreditLimit) * 100 * 100) / 100
              : 0,
            pendingPurchases: pendingCreditPurchases,
          },
          // Withdrawal statistics
          withdrawals: {
            pending: pendingWithdrawals,
            pendingAmount: pendingWithdrawalsAmount,
          },
        },
        summary: {
          totalEntities: totalUsers + totalVendors + totalSellers,
          totalRevenue: totalRevenue,
          pendingActions: pendingOrders + pendingCreditPurchases + pendingWithdrawals,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// PRODUCT MANAGEMENT CONTROLLERS
// ============================================================================

/**
 * @desc    Get all products with filtering and pagination
 * @route   GET /api/admin/products
 * @access  Private (Admin)
 */
exports.getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 500,
      category,
      isActive,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query = {};

    if (category) {
      query.category = category.toLowerCase();
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      // Search by product ID, name, or text search
      query.$or = [
        { productId: { $regex: search, $options: 'i' } }, // Search by unique product ID
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select('-__v');

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        products,
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
 * @desc    Get single product details
 * @route   GET /api/admin/products/:productId
 * @access  Private (Admin)
 */
exports.getProductDetails = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).select('-__v');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Get vendor assignments for this product
    const assignments = await ProductAssignment.find({ productId, isActive: true })
      .populate('vendorId', 'name phone location')
      .select('-__v');

    res.status(200).json({
      success: true,
      data: {
        product,
        assignments,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new product
 * @route   POST /api/admin/products
 * @access  Private (Admin)
 */
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      shortDescription,
      category,
      priceToVendor,
      priceToUser,
      actualStock,
      displayStock,
      stock, // Legacy field support
      stockUnit,
      images, // Array of image objects {url, publicId, isPrimary, order}
      expiry,
      brand,
      weight,
      tags,
      specifications,
      sku,
      batchNumber,
      attributeStocks, // Array of stock entries per attribute combination
    } = req.body;

    // Validate required fields
    if (!name || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description, category',
      });
    }

    // Validate shortDescription - use fallback if not provided
    const shortDescriptionValue = shortDescription?.trim() || description?.substring(0, 150) || name.substring(0, 150);
    if (!shortDescriptionValue || shortDescriptionValue.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Short description is required',
      });
    }

    // Validate stock fields
    const actualStockValue = actualStock !== undefined ? actualStock : (stock !== undefined ? stock : 0);
    const displayStockValue = displayStock !== undefined ? displayStock : (stock !== undefined ? stock : 0);

    if (actualStockValue < 0 || displayStockValue < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock quantities cannot be negative',
      });
    }

    // Validate prices - only required if not using attributeStocks
    // If attributeStocks are provided, prices can be undefined (they're in attributeStocks)
    if (!attributeStocks || !Array.isArray(attributeStocks) || attributeStocks.length === 0) {
      // Main product prices are required when not using attributeStocks
      if (priceToVendor === undefined || priceToUser === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: priceToVendor, priceToUser (required when not using attributeStocks)',
        });
      }

      // Validate prices are not negative
      if (priceToVendor < 0 || priceToUser < 0) {
        return res.status(400).json({
          success: false,
          message: 'Prices cannot be negative',
        });
      }

      // Validate user price is greater than vendor price
      if (priceToUser <= priceToVendor) {
        return res.status(400).json({
          success: false,
          message: 'User price must be greater than vendor price',
        });
      }
    } else {
      // When using attributeStocks, main prices are optional but if provided, must be valid
      if (priceToVendor !== undefined && priceToVendor < 0) {
        return res.status(400).json({
          success: false,
          message: 'Vendor price cannot be negative',
        });
      }
      if (priceToUser !== undefined && priceToUser < 0) {
        return res.status(400).json({
          success: false,
          message: 'User price cannot be negative',
        });
      }
      if (priceToVendor !== undefined && priceToUser !== undefined && priceToUser <= priceToVendor) {
        return res.status(400).json({
          success: false,
          message: 'User price must be greater than vendor price',
        });
      }
    }

    // Validate category against DB categories
    const Category = require('../models/Category');
    const categoryLower = category.toLowerCase();

    // We should fallback to dynamic checking or let frontend ensure it exists
    const categoryExists = await Category.findOne({ id: categoryLower });
    if (!categoryExists) {
      // If DB has no categories, maybe just allow it or auto-create it
      // Let's auto-create it just to be safe, or allow it
      const categoryCount = await Category.countDocuments();
      if (categoryCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Please select or add a valid category.`,
        });
      }
    }

      // Create product
      // Handle prices - if using attributeStocks and main prices are undefined, calculate from attributeStocks or use defaults
      let finalPriceToVendor = priceToVendor !== undefined ? Math.round(parseFloat(priceToVendor) || 0) : undefined;
      let finalPriceToUser = priceToUser !== undefined ? Math.round(parseFloat(priceToUser) || 0) : undefined;

      if ((finalPriceToVendor === undefined || finalPriceToUser === undefined) && attributeStocks && Array.isArray(attributeStocks) && attributeStocks.length > 0) {
        // Calculate weighted average prices from attributeStocks
        let totalStock = 0;
        let weightedVendorPrice = 0;
        let weightedUserPrice = 0;

        attributeStocks.forEach(stock => {
          const stockQty = parseFloat(stock.displayStock) || parseFloat(stock.actualStock) || 0;
          if (stockQty > 0 && stock.vendorPrice !== undefined && stock.userPrice !== undefined) {
            totalStock += stockQty;
            weightedVendorPrice += (parseFloat(stock.vendorPrice) || 0) * stockQty;
            weightedUserPrice += (parseFloat(stock.userPrice) || 0) * stockQty;
          }
        });

        if (totalStock > 0) {
          finalPriceToVendor = Math.round(weightedVendorPrice / totalStock);
          finalPriceToUser = Math.round(weightedUserPrice / totalStock);
        } else {
          // Fallback to first entry's prices
          const firstEntry = attributeStocks[0];
          finalPriceToVendor = Math.round(parseFloat(firstEntry.vendorPrice) || 0);
          finalPriceToUser = Math.round(parseFloat(firstEntry.userPrice) || 0);
        }
      }

      // Ensure prices are always defined (required by schema)
      if (finalPriceToVendor === undefined || finalPriceToVendor < 0) {
        finalPriceToVendor = 0;
      }
      if (finalPriceToUser === undefined || finalPriceToUser < 0) {
        finalPriceToUser = 0;
      }

      const productData = {
        name,
        description,
        shortDescription: shortDescriptionValue.trim(),
        category: categoryLower,
        priceToVendor: finalPriceToVendor,
        priceToUser: finalPriceToUser,
        actualStock: actualStockValue,
        displayStock: displayStockValue,
        stock: displayStockValue, // Legacy field for backward compatibility
      };

      if (images && Array.isArray(images)) {
        // Validate and normalize image objects
        const validImages = images
          .filter(img => img && img.url) // Must have URL
          .map((img, index) => ({
            url: img.url,
            publicId: img.publicId || '',
            isPrimary: index === 0, // First image is primary
            order: index,
          }))
          .slice(0, 4); // Max 4 images

        if (validImages.length > 0) {
          productData.images = validImages;
        }
      }

      if (expiry) productData.expiry = expiry;
      if (brand) productData.brand = brand;
      if (weight) productData.weight = weight;
      if (stockUnit) {
        // Store unit in weight.unit for consistency
        productData.weight = { ...(productData.weight || {}), unit: stockUnit };
      }
      // Handle tags - normalize: trim, lowercase, remove empty strings
      if (tags && Array.isArray(tags)) {
        productData.tags = tags
          .map(tag => String(tag).trim().toLowerCase())
          .filter(tag => tag.length > 0);
      }
      // Handle specifications (attributes) - Mongoose will convert plain object to Map
      if (specifications && typeof specifications === 'object' && !Array.isArray(specifications)) {
        // Filter out empty values and convert to strings
        const cleanSpecs = {};
        Object.keys(specifications).forEach(key => {
          const value = specifications[key];
          if (value !== null && value !== undefined && value !== '') {
            cleanSpecs[key] = String(value);
          }
        });
        if (Object.keys(cleanSpecs).length > 0) {
          productData.specifications = cleanSpecs;
        }
      }
      if (sku) productData.sku = sku.toUpperCase();
      if (batchNumber) productData.batchNumber = batchNumber.trim();

      // Handle attributeStocks array
      if (attributeStocks && Array.isArray(attributeStocks) && attributeStocks.length > 0) {
        // Validate and normalize attributeStocks
        const validAttributeStocks = attributeStocks
          .filter(stock => stock && stock.attributes && Object.keys(stock.attributes).length > 0)
          .map(stock => {
            // Convert attributes object to Map-compatible format
            const attributesMap = {};
            Object.keys(stock.attributes).forEach(key => {
              const value = stock.attributes[key];
              if (value !== null && value !== undefined && value !== '') {
                attributesMap[key] = String(value);
              }
            });

            // Validate prices
            const vendorPriceValue = Math.round(parseFloat(stock.vendorPrice));
            const userPriceValue = Math.round(parseFloat(stock.userPrice));

            if (isNaN(vendorPriceValue) || vendorPriceValue < 0) {
              throw new Error(`Invalid vendor price for attribute stock entry`);
            }
            if (isNaN(userPriceValue) || userPriceValue < 0) {
              throw new Error(`Invalid user price for attribute stock entry`);
            }
            if (userPriceValue <= vendorPriceValue) {
              throw new Error(`User price must be greater than vendor price for attribute stock entry`);
            }

            return {
              attributes: attributesMap,
              actualStock: parseFloat(stock.actualStock) || 0,
              displayStock: parseFloat(stock.displayStock) || 0,
              stockUnit: stock.stockUnit || stockUnit || 'kg',
              vendorPrice: vendorPriceValue,
              userPrice: userPriceValue,
              ...(stock.batchNumber && { batchNumber: String(stock.batchNumber).trim() }),
              ...(stock.expiry && { expiry: stock.expiry }),
            };
          })
          .filter(stock => Object.keys(stock.attributes).length > 0); // Only include entries with at least one attribute

        if (validAttributeStocks.length > 0) {
          productData.attributeStocks = validAttributeStocks;
        }
      }

      // Generate unique product ID
      const productId = await generateUniqueId(Product, 'PRD', 'productId', 101);
      productData.productId = productId;

      const product = await Product.create(productData);

      res.status(201).json({
        success: true,
        data: {
          product,
          message: 'Product created successfully',
        },
      });
    } catch (error) {
      // Handle duplicate SKU
      if (error.code === 11000 && error.keyPattern?.sku) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists',
        });
      }
      next(error);
    }
  };

  /**
   * @desc    Update product
   * @route   PUT /api/admin/products/:productId
   * @access  Private (Admin)
   */
  exports.updateProduct = async (req, res, next) => {
    try {
      const { productId } = req.params;
      const updateData = req.body;

      // Find product
      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      // Normalize and validate category if provided
      if (updateData.category) {
        const Category = require('../models/Category');
        const categoryLower = updateData.category.toLowerCase();

        // Skip validation if category is unchanged (same as what's already on the product)
        if (categoryLower !== product.category) {
          const categoryExists = await Category.findOne({ id: categoryLower });
          if (!categoryExists) {
            const categoryCount = await Category.countDocuments();
            if (categoryCount > 0) {
              return res.status(400).json({
                success: false,
                message: `Invalid category. Please select or add a valid category.`,
              });
            }
          }
        }
        updateData.category = categoryLower;
      }

      // Normalize SKU if provided
      if (updateData.sku) {
        updateData.sku = updateData.sku.toUpperCase();
      }

      // Handle stock fields
      if (updateData.actualStock !== undefined) {
        product.actualStock = updateData.actualStock;
      }
      if (updateData.displayStock !== undefined) {
        product.displayStock = updateData.displayStock;
        product.stock = updateData.displayStock; // Sync legacy field
      }
      // Legacy stock field support
      if (updateData.stock !== undefined && updateData.displayStock === undefined) {
        product.displayStock = updateData.stock;
        product.actualStock = updateData.actualStock !== undefined ? updateData.actualStock : updateData.stock;
        product.stock = updateData.stock;
      }

      // Handle stockUnit
      if (updateData.stockUnit !== undefined) {
        product.weight = product.weight || {};
        product.weight.unit = updateData.stockUnit;
        product.markModified('weight');
      }

      // Handle batchNumber
      if (updateData.batchNumber !== undefined) {
        product.batchNumber = updateData.batchNumber.trim();
      }

      // Handle isActive separately - only update if explicitly provided, otherwise keep current value
      if (updateData.isActive !== undefined) {
        product.isActive = updateData.isActive;
      } else {
        // If isActive is not provided, default to true (active) unless it was explicitly set to false
        // This ensures products don't accidentally become inactive
        if (product.isActive === undefined) {
          product.isActive = true;
        }
      }

      // Handle tags
      if (updateData.tags !== undefined) {
        if (Array.isArray(updateData.tags)) {
          // Normalize tags: trim, lowercase, remove empty strings
          product.tags = updateData.tags
            .map(tag => String(tag).trim().toLowerCase())
            .filter(tag => tag.length > 0);
        } else {
          product.tags = [];
        }
      }

      // Handle specifications (attributes) - Mongoose will convert plain object to Map
      if (updateData.specifications !== undefined) {
        if (updateData.specifications && typeof updateData.specifications === 'object' && !Array.isArray(updateData.specifications)) {
          // Filter out empty values and convert to strings
          const cleanSpecs = {};
          Object.keys(updateData.specifications).forEach(key => {
            const value = updateData.specifications[key];
            if (value !== null && value !== undefined && value !== '') {
              cleanSpecs[key] = String(value);
            }
          });
          // Mongoose will convert plain object to Map automatically
          product.specifications = cleanSpecs;
        } else {
          // Clear specifications if empty or invalid
          product.specifications = {};
        }
      }

      // Handle images separately for validation
      if (updateData.images !== undefined) {
        if (Array.isArray(updateData.images)) {
          // Validate image objects
          const validImages = updateData.images
            .filter(img => img && img.url) // Must have URL
            .map((img, index) => ({
              url: img.url,
              publicId: img.publicId || '',
              isPrimary: index === 0, // First image is primary
              order: index,
            }))
            .slice(0, 4); // Max 4 images

          product.images = validImages;
        } else {
          product.images = [];
        }
      }

      // Handle attributeStocks array
      if (updateData.attributeStocks !== undefined) {
        if (Array.isArray(updateData.attributeStocks) && updateData.attributeStocks.length > 0) {
          // Validate and normalize attributeStocks
          const validAttributeStocks = updateData.attributeStocks
            .filter(stock => stock && stock.attributes && Object.keys(stock.attributes).length > 0)
            .map(stock => {
              // Convert attributes object to Map-compatible format
              const attributesMap = {};
              Object.keys(stock.attributes).forEach(key => {
                const value = stock.attributes[key];
                if (value !== null && value !== undefined && value !== '') {
                  attributesMap[key] = String(value);
                }
              });

              // Validate prices
              const vendorPriceValue = Math.round(parseFloat(stock.vendorPrice));
              const userPriceValue = Math.round(parseFloat(stock.userPrice));

              if (isNaN(vendorPriceValue) || vendorPriceValue < 0) {
                throw new Error(`Invalid vendor price for attribute stock entry`);
              }
              if (isNaN(userPriceValue) || userPriceValue < 0) {
                throw new Error(`Invalid user price for attribute stock entry`);
              }
              if (userPriceValue <= vendorPriceValue) {
                throw new Error(`User price must be greater than vendor price for attribute stock entry`);
              }

              return {
                attributes: attributesMap,
                actualStock: parseFloat(stock.actualStock) || 0,
                displayStock: parseFloat(stock.displayStock) || 0,
                stockUnit: stock.stockUnit || product.weight?.unit || 'kg',
                vendorPrice: vendorPriceValue,
                userPrice: userPriceValue,
                ...(stock.batchNumber && { batchNumber: String(stock.batchNumber).trim() }),
                ...(stock.expiry && { expiry: stock.expiry }),
              };
            })
            .filter(stock => Object.keys(stock.attributes).length > 0); // Only include entries with at least one attribute

          product.attributeStocks = validAttributeStocks;
          product.markModified('attributeStocks');
        } else {
          // Clear attributeStocks if empty array or null
          product.attributeStocks = [];
          product.markModified('attributeStocks');
        }
      }

      // Round prices if updated directly
      if (updateData.priceToVendor !== undefined) {
        updateData.priceToVendor = Math.round(parseFloat(updateData.priceToVendor) || 0);
      }
      if (updateData.priceToUser !== undefined) {
        updateData.priceToUser = Math.round(parseFloat(updateData.priceToUser) || 0);
      }

      // Update other fields (excluding handled fields)
      const excludedFields = ['actualStock', 'displayStock', 'stock', 'stockUnit', 'batchNumber', 'isActive', 'tags', 'specifications', 'images', 'attributeStocks'];
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && !excludedFields.includes(key)) {
          product[key] = updateData[key];
        }
      });

      await product.save();

      res.status(200).json({
        success: true,
        data: {
          product,
          message: 'Product updated successfully',
        },
      });
    } catch (error) {
      // Handle duplicate SKU
      if (error.code === 11000 && error.keyPattern?.sku) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists',
        });
      }
      next(error);
    }
  };

  /**
   * @desc    Delete product
   * @route   DELETE /api/admin/products/:productId
   * @access  Private (Admin)
   */
  exports.deleteProduct = async (req, res, next) => {
    try {
      const { productId } = req.params;

      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      // Check if product has active assignments
      const activeAssignments = await ProductAssignment.countDocuments({
        productId,
        isActive: true,
      });

      if (activeAssignments > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete product. It has ${activeAssignments} active vendor assignment(s). Please remove assignments first or deactivate the product.`,
        });
      }

      // Delete product
      await Product.findByIdAndDelete(productId);

      res.status(200).json({
        success: true,
        message: 'Product deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Assign product to vendor
   * @route   POST /api/admin/products/:productId/assign
   * @access  Private (Admin)
   */
  exports.assignProductToVendor = async (req, res, next) => {
    try {
      const { productId } = req.params;
      const { vendorId, region, notes } = req.body;

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          message: 'Vendor ID is required',
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

      // Check if vendor exists and is approved
      const vendor = await Vendor.findById(vendorId);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      if (vendor.status !== 'approved' || !vendor.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Vendor must be approved and active to receive product assignments',
        });
      }

      // Check if assignment already exists
      const existingAssignment = await ProductAssignment.findOne({
        productId,
        vendorId,
      });

      if (existingAssignment) {
        // Update existing assignment
        existingAssignment.isActive = true;
        if (region) existingAssignment.region = region;
        if (notes) existingAssignment.notes = notes;
        existingAssignment.assignedBy = req.admin._id;
        existingAssignment.assignedAt = new Date();
        await existingAssignment.save();

        return res.status(200).json({
          success: true,
          data: {
            assignment: existingAssignment,
            message: 'Product assignment updated successfully',
          },
        });
      }

      // Create new assignment
      const assignment = await createProductAssignment({
        productId,
        vendorId,
        region,
        notes,
        assignedBy: req.admin._id,
      });

      // TODO: Create Inventory entry for vendor when Inventory model is created

      res.status(201).json({
        success: true,
        data: {
          assignment,
          message: 'Product assigned to vendor successfully',
        },
      });
    } catch (error) {
      // Handle duplicate assignment
      if (error.code === 11000 && error.keyPattern?.productId && error.keyPattern?.vendorId) {
        return res.status(400).json({
          success: false,
          message: 'Product is already assigned to this vendor',
        });
      }
      next(error);
    }
  };

  /**
   * @desc    Toggle product visibility (active/inactive)
   * @route   PUT /api/admin/products/:productId/visibility
   * @access  Private (Admin)
   */
  exports.toggleProductVisibility = async (req, res, next) => {
    try {
      const { productId } = req.params;

      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      // Toggle visibility
      product.isActive = !product.isActive;
      await product.save();

      res.status(200).json({
        success: true,
        data: {
          product,
          message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // VENDOR MANAGEMENT CONTROLLERS
  // ============================================================================

  /**
   * @desc    Get all vendors with filtering and pagination
   * @route   GET /api/admin/vendors
   * @access  Private (Admin)
   */
  exports.getVendors = async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        isActive,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeDeleted = 'false',
      } = req.query;

      // Build query
      const query = {};

      // By default, exclude deleted vendors unless explicitly requested
      if (includeDeleted !== 'true') {
        query.isDeleted = { $ne: true };
      }

      if (status) {
        query.status = status;
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      if (search) {
        query.$or = [
          { vendorId: { $regex: search, $options: 'i' } }, // Search by unique vendor ID
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'location.address': { $regex: search, $options: 'i' } },
        ];
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const vendors = await Vendor.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v -otp')
        .populate('approvedBy', 'name email')
        .populate('deletedBy', 'name email')
        .lean();

      // Manually populate nested banInfo fields if they exist
      const mongoose = require('mongoose');
      const adminIdsToPopulate = new Set();

      vendors.forEach(vendor => {
        if (vendor.banInfo?.bannedBy && mongoose.Types.ObjectId.isValid(vendor.banInfo.bannedBy)) {
          adminIdsToPopulate.add(vendor.banInfo.bannedBy);
        }
        if (vendor.banInfo?.revokedBy && mongoose.Types.ObjectId.isValid(vendor.banInfo.revokedBy)) {
          adminIdsToPopulate.add(vendor.banInfo.revokedBy);
        }
      });

      // Fetch all admins at once for efficiency
      const adminsMap = new Map();
      if (adminIdsToPopulate.size > 0) {
        const adminIdsArray = Array.from(adminIdsToPopulate).map(id => new mongoose.Types.ObjectId(id));
        const admins = await Admin.find({ _id: { $in: adminIdsArray } })
          .select('name phone')
          .lean();
        admins.forEach(admin => {
          adminsMap.set(admin._id.toString(), { name: admin.name, phone: admin.phone });
        });
      }

      // Populate the banInfo fields
      vendors.forEach(vendor => {
        if (vendor.banInfo?.bannedBy) {
          const adminId = vendor.banInfo.bannedBy.toString();
          vendor.banInfo.bannedBy = adminsMap.get(adminId) || null;
        }
        if (vendor.banInfo?.revokedBy) {
          const adminId = vendor.banInfo.revokedBy.toString();
          vendor.banInfo.revokedBy = adminsMap.get(adminId) || null;
        }
      });

      const total = await Vendor.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          vendors,
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
   * @desc    Get single vendor details
   * @route   GET /api/admin/vendors/:vendorId
   * @access  Private (Admin)
   */
  exports.getVendorDetails = async (req, res, next) => {
    try {
      const { vendorId } = req.params;

      const vendor = await Vendor.findById(vendorId)
        .select('-__v -otp')
        .populate('approvedBy', 'name email');

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      // Get vendor's credit purchases
      const purchases = await CreditPurchase.find({ vendorId })
        .populate('items.productId', 'name sku')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('-__v');

      // Get vendor's product assignments
      const assignments = await ProductAssignment.find({ vendorId, isActive: true })
        .populate('productId', 'name sku category')
        .select('-__v');

      // Calculate credit statistics
      const creditRemaining = vendor.creditPolicy.limit - vendor.creditUsed;
      const creditUtilization = vendor.creditPolicy.limit > 0
        ? (vendor.creditUsed / vendor.creditPolicy.limit) * 100
        : 0;

      res.status(200).json({
        success: true,
        data: {
          vendor,
          creditInfo: {
            limit: vendor.creditPolicy.limit,
            used: vendor.creditUsed,
            remaining: creditRemaining,
            utilization: Math.round(creditUtilization * 100) / 100,
            dueDate: vendor.creditPolicy.dueDate,
          },
          escalationInfo: {
            count: vendor.escalationCount || 0,
            history: vendor.escalationHistory || [],
            canBan: (vendor.escalationCount || 0) > 3,
          },
          banInfo: vendor.banInfo || {},
          purchases,
          assignments,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Approve vendor registration
   * @route   POST /api/admin/vendors/:vendorId/approve
   * @access  Private (Admin)
   */
  exports.approveVendor = async (req, res, next) => {
    try {
      const { vendorId } = req.params;

      const vendor = await Vendor.findById(vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      if (vendor.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Vendor is already approved',
        });
      }

      // Check geographic rule: No vendor within 20km radius
      // Using MongoDB geospatial query
      const nearbyVendors = await Vendor.find({
        _id: { $ne: vendorId }, // Exclude current vendor
        status: 'approved',
        isActive: true,
        'location.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [vendor.location.coordinates.lng, vendor.location.coordinates.lat],
            },
            $maxDistance: VENDOR_COVERAGE_RADIUS_KM * 1000, // Convert km to meters
          },
        },
      });

      if (nearbyVendors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot approve vendor. Another approved vendor exists within ${VENDOR_COVERAGE_RADIUS_KM}km radius.`,
          nearbyVendor: {
            id: nearbyVendors[0]._id,
            name: nearbyVendors[0].name,
            distance: 'within 20km',
          },
        });
      }

      // Approve vendor and set default credit policy
      vendor.status = 'approved';
      vendor.isActive = true;
      vendor.approvedAt = new Date();
      vendor.approvedBy = req.admin._id;

      // Set default credit policy (no limit, 30 days repayment, 2% penalty)
      if (!vendor.creditPolicy) {
        vendor.creditPolicy = {
          repaymentDays: 30,
          penaltyRate: 2,
        };
      } else {
        // Ensure defaults if missing
        if (!vendor.creditPolicy.repaymentDays) {
          vendor.creditPolicy.repaymentDays = 30;
        }
        if (vendor.creditPolicy.penaltyRate === undefined || vendor.creditPolicy.penaltyRate === null) {
          vendor.creditPolicy.penaltyRate = 2;
        }
      }

      await vendor.save();

      // TODO: Send notification to vendor (SMS/Email)
      console.log(`✅ Vendor approved: ${vendor.name} (${vendor.phone})`);

      res.status(200).json({
        success: true,
        data: {
          vendor,
          message: 'Vendor approved successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Reject vendor registration
   * @route   POST /api/admin/vendors/:vendorId/reject
   * @access  Private (Admin)
   */
  exports.rejectVendor = async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { reason } = req.body;

      const vendor = await Vendor.findById(vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      if (vendor.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Vendor is already rejected',
        });
      }

      // Reject vendor
      vendor.status = 'rejected';
      vendor.isActive = false;
      await vendor.save();

      // TODO: Send rejection notification to vendor with reason
      console.log(`❌ Vendor rejected: ${vendor.name} (${vendor.phone})${reason ? ` - Reason: ${reason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          vendor,
          message: 'Vendor rejected successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Set/Update vendor credit policy
   * @route   PUT /api/admin/vendors/:vendorId/credit-policy
   * @access  Private (Admin)
   */
  exports.updateVendorCreditPolicy = async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { repaymentDays, penaltyRate } = req.body;

      // Validate vendor ID
      if (!vendorId || !require('mongoose').Types.ObjectId.isValid(vendorId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid vendor ID',
        });
      }

      const vendor = await Vendor.findById(vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      if (vendor.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Can only set credit policy for approved vendors. Current status: ' + vendor.status,
        });
      }

      // Validate input values
      if (repaymentDays !== undefined && (isNaN(repaymentDays) || repaymentDays <= 0)) {
        return res.status(400).json({
          success: false,
          message: 'Repayment days must be a valid number greater than 0',
        });
      }

      if (penaltyRate !== undefined && (isNaN(penaltyRate) || penaltyRate < 0)) {
        return res.status(400).json({
          success: false,
          message: 'Penalty rate must be a valid number greater than or equal to 0',
        });
      }

      // Ensure creditPolicy object exists
      if (!vendor.creditPolicy) {
        vendor.creditPolicy = {
          repaymentDays: 30,
          penaltyRate: 2,
        };
      }

      // Update credit policy (no credit limit)
      if (repaymentDays !== undefined) {
        vendor.creditPolicy.repaymentDays = repaymentDays;
      }
      if (penaltyRate !== undefined) {
        vendor.creditPolicy.penaltyRate = penaltyRate;
      }

      // Calculate due date if repayment days is set
      if (repaymentDays !== undefined && vendor.creditUsed > 0) {
        // Set due date based on repayment days from now
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + repaymentDays);
        vendor.creditPolicy.dueDate = dueDate;
      }

      await vendor.save();

      res.status(200).json({
        success: true,
        data: {
          vendor,
          creditPolicy: vendor.creditPolicy,
          message: 'Credit policy updated successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get all vendor purchase requests (global)
   * @route   GET /api/admin/vendors/purchases
   * @access  Private (Admin)
   */
  exports.getAllVendorPurchases = async (req, res, next) => {
    try {
      const { status, vendorId, page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      // Build query
      const query = {};

      if (status) {
        query.status = status;
      }

      if (vendorId) {
        query.vendorId = vendorId;
      }

      // Search functionality (by vendor name or purchase amount)
      if (search) {
        // If search is provided, we'll need to populate vendor first and filter
        // For now, we can search by amount or use text search if available
        const searchNum = parseFloat(search);
        if (!isNaN(searchNum)) {
          // Search by amount
          query.totalAmount = { $gte: searchNum * 0.9, $lte: searchNum * 1.1 }; // Allow 10% tolerance
        }
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with vendor population
      const purchases = await CreditPurchase.find(query)
        .populate('vendorId', 'name phone email location creditUsed creditLimit creditPolicy')
        .populate('items.productId', 'name sku category priceToVendor')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v');

      // If search was provided and it's a string, filter by vendor name
      let filteredPurchases = purchases;
      if (search && isNaN(parseFloat(search))) {
        filteredPurchases = purchases.filter(purchase => {
          const vendorName = purchase.vendorId?.name || '';
          return vendorName.toLowerCase().includes(search.toLowerCase());
        });
      }

      // Get total count (after search filter if applicable)
      let total = await CreditPurchase.countDocuments(query);
      if (search && isNaN(parseFloat(search))) {
        // Recalculate total for string searches (approximate)
        total = filteredPurchases.length;
      }

      res.status(200).json({
        success: true,
        data: {
          purchases: filteredPurchases,
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
   * @desc    Get vendor purchase requests (vendor-specific)
   * @route   GET /api/admin/vendors/:vendorId/purchases
   * @access  Private (Admin)
   */
  exports.getVendorPurchases = async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { status, page = 1, limit = 20 } = req.query;

      const query = { vendorId };

      if (status) {
        query.status = status;
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const purchases = await CreditPurchase.find(query)
        .populate('items.productId', 'name sku category priceToVendor')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-__v');

      const total = await CreditPurchase.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          purchases,
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
   * @desc    Approve vendor purchase request
   * @route   POST /api/admin/vendors/purchases/:requestId/approve
   * @access  Private (Admin)
   */
  exports.approveVendorPurchase = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { shortDescription } = req.body;

      console.log('=== APPROVE PURCHASE REQUEST ===');
      console.log('Request ID:', requestId);
      console.log('Request Body:', JSON.stringify(req.body, null, 2));
      console.log('Request Body Keys:', Object.keys(req.body || {}));
      console.log('Short Description:', shortDescription);
      console.log('Short Description Type:', typeof shortDescription);
      console.log('Short Description Value:', shortDescription);
      console.log('Is Undefined:', shortDescription === undefined);
      console.log('Is Null:', shortDescription === null);
      console.log('Is Empty String:', shortDescription === '');
      console.log('Trimmed:', shortDescription ? shortDescription.trim() : 'N/A');
      console.log('===============================');

      // Validate shortDescription - it's required
      if (!shortDescription || typeof shortDescription !== 'string' || !shortDescription.trim()) {
        console.log('❌ VALIDATION FAILED');
        console.log('Reason:', {
          isFalsy: !shortDescription,
          isNotString: typeof shortDescription !== 'string',
          isEmptyAfterTrim: shortDescription && !shortDescription.trim()
        });
        return res.status(400).json({
          success: false,
          message: 'Short description is required',
        });
      }

      console.log('✅ VALIDATION PASSED');

      const purchase = await CreditPurchase.findById(requestId)
        .populate('items.productId', 'name sku priceToVendor');

      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Purchase request not found',
        });
      }

      if (purchase.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Purchase request is already ${purchase.status}`,
        });
      }

      const vendor = await Vendor.findById(purchase.vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      // Update vendor credit used (no limit check)
      const newCreditUsed = (vendor.creditUsed || 0) + purchase.totalAmount;

      // Validate and reserve admin stock
      for (const item of purchase.items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: 'One of the requested products no longer exists.',
          });
        }

        // Check if this is a variant product (has attributeCombination)
        const hasVariantAttributes = item.attributeCombination &&
          (item.attributeCombination instanceof Map ? item.attributeCombination.size > 0 : Object.keys(item.attributeCombination || {}).length > 0);

        if (hasVariantAttributes && product.attributeStocks && product.attributeStocks.length > 0) {
          // Handle variant stock reduction
          const attributeCombination = item.attributeCombination instanceof Map
            ? Object.fromEntries(item.attributeCombination)
            : item.attributeCombination || {};

          // Find matching variant in attributeStocks
          const matchingVariantIndex = product.attributeStocks.findIndex((variantStock) => {
            if (!variantStock.attributes) return false;
            const variantAttrs = variantStock.attributes instanceof Map
              ? Object.fromEntries(variantStock.attributes)
              : variantStock.attributes || {};

            // Check if all attributes match
            return Object.keys(attributeCombination).every(key => {
              const variantValue = variantAttrs[key];
              const requestedValue = attributeCombination[key];
              return variantValue === requestedValue;
            });
          });

          if (matchingVariantIndex === -1) {
            return res.status(400).json({
              success: false,
              message: `Variant not found for ${product.name} with the selected attributes.`,
            });
          }

          const variantStock = product.attributeStocks[matchingVariantIndex];
          const variantDisplayStock = variantStock.displayStock || 0;
          const variantActualStock = variantStock.actualStock || 0;

          if (item.quantity > variantDisplayStock) {
            return res.status(400).json({
              success: false,
              message: `Insufficient variant stock for ${product.name}. Available: ${variantDisplayStock}, Requested: ${item.quantity}`,
            });
          }

          // Update variant stock in attributeStocks array
          product.attributeStocks[matchingVariantIndex].displayStock = Math.max(0, variantDisplayStock - item.quantity);
          product.attributeStocks[matchingVariantIndex].actualStock = Math.max(0, variantActualStock - item.quantity);

          // Update product with modified attributeStocks
          await Product.updateOne(
            { _id: item.productId },
            {
              $set: {
                attributeStocks: product.attributeStocks,
              }
            }
          );

          console.log(`✅ Variant stock updated for ${product.name}:`, {
            variant: attributeCombination,
            displayStock: `${variantDisplayStock} → ${product.attributeStocks[matchingVariantIndex].displayStock}`,
            actualStock: `${variantActualStock} → ${product.attributeStocks[matchingVariantIndex].actualStock}`,
          });
        } else {
          // Handle non-variant product stock reduction
          const adminStock = product.displayStock ?? product.stock ?? 0;
          if (item.quantity > adminStock) {
            return res.status(400).json({
              success: false,
              message: `Insufficient admin stock for ${product.name}. Available: ${adminStock}, Requested: ${item.quantity}`,
            });
          }

          // Update stock without triggering full validation
          // Use updateOne to avoid validation errors for existing products
          await Product.updateOne(
            { _id: item.productId },
            {
              $set: {
                displayStock: Math.max(0, adminStock - item.quantity),
                actualStock: Math.max(0, (product.actualStock ?? adminStock) - item.quantity),
              }
            }
          );

          console.log(`✅ Main product stock updated for ${product.name}:`, {
            displayStock: `${adminStock} → ${Math.max(0, adminStock - item.quantity)}`,
            actualStock: `${product.actualStock ?? adminStock} → ${Math.max(0, (product.actualStock ?? adminStock) - item.quantity)}`,
          });
        }

        await ProductAssignment.findOneAndUpdate(
          { productId: item.productId, vendorId: vendor._id },
          {
            $setOnInsert: {
              assignedBy: req.admin._id,
              assignedAt: new Date(),
              stock: 0,
              isActive: true,
              notes: 'Auto-assigned during purchase approval',
            },
          },
          { upsert: true, new: true }
        );
      }

      const expectedDeliveryAt = new Date(Date.now() + (DELIVERY_TIMELINE_HOURS || 24) * 60 * 60 * 1000);

      // Approve purchase
      purchase.status = 'approved';
      purchase.reviewedBy = req.admin._id;
      purchase.reviewedAt = new Date();
      purchase.reviewedAt = new Date();
      purchase.deliveryStatus = 'pending';
      purchase.expectedDeliveryAt = expectedDeliveryAt;
      purchase.deliveryNotes = `Purchase approved. Awaiting stock dispatch.`;
      await purchase.save();

      // Update vendor credit
      vendor.creditUsed = newCreditUsed;
      if (vendor.creditPolicy.dueDate === undefined && vendor.creditPolicy.repaymentDays) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + vendor.creditPolicy.repaymentDays);
        vendor.creditPolicy.dueDate = dueDate;
      }
      await vendor.save();

      // SEND VENDOR NOTIFICATION: Credit Purchase Approved
      try {
        const VendorNotification = require('../models/VendorNotification');
        await VendorNotification.createNotification({
          vendorId: vendor._id,
          type: 'credit_purchase_approved',
          title: 'Stock Purchase Approved',
          message: `Your stock purchase of ₹${purchase.totalAmount} has been approved and is scheduled for delivery.`,
          relatedEntityType: 'credit_purchase',
          relatedEntityId: purchase._id,
          priority: 'normal',
          metadata: { purchaseId: purchase.creditPurchaseId, amount: purchase.totalAmount }
        });
      } catch (notifError) {
        console.error('Failed to send purchase approval notification:', notifError);
      }

      console.log(`✅ Purchase approved: ₹${purchase.totalAmount} for vendor ${vendor.name}`);

      res.status(200).json({
        success: true,
        data: {
          purchase,
          vendor: {
            id: vendor._id,
            name: vendor.name,
            creditUsed: vendor.creditUsed,
          },
          message: 'Purchase request approved successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Reject vendor purchase request
   * @route   POST /api/admin/vendors/purchases/:requestId/reject
   * @access  Private (Admin)
   */
  exports.rejectVendorPurchase = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      const purchase = await CreditPurchase.findById(requestId);

      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Purchase request not found',
        });
      }

      if (purchase.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Purchase request is already ${purchase.status}`,
        });
      }

      // Reject purchase
      purchase.status = 'rejected';
      purchase.reviewedBy = req.admin._id;
      purchase.reviewedAt = new Date();
      if (reason) {
        purchase.rejectionReason = reason;
      }
      await purchase.save();

      // TODO: Send rejection notification to vendor with reason

      console.log(`❌ Purchase rejected: ₹${purchase.totalAmount}${reason ? ` - Reason: ${reason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          purchase,
          message: 'Purchase request rejected successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Mark stock as sent (in transit)
   * @route   POST /api/admin/vendors/purchases/:requestId/send
   * @access  Private (Admin)
   */
  exports.sendVendorPurchaseStock = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { deliveryNotes } = req.body;

      const purchase = await CreditPurchase.findById(requestId);

      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Purchase request not found',
        });
      }

      if (purchase.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: `Stock can only be sent for approved requests. Current status: ${purchase.status}`,
        });
      }

      purchase.deliveryStatus = 'in_transit';
      if (deliveryNotes) {
        purchase.deliveryNotes = deliveryNotes;
      }
      await purchase.save();

      res.status(200).json({
        success: true,
        data: { purchase, message: 'Stock marked as in-transit' },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Confirm delivery and update vendor inventory
   * @route   POST /api/admin/vendors/purchases/:requestId/confirm-delivery
   * @access  Private (Admin)
   */
  exports.confirmVendorPurchaseDelivery = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { deliveryNotes } = req.body;

      const purchase = await CreditPurchase.findById(requestId);

      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Purchase request not found',
        });
      }

      if (purchase.deliveryStatus === 'delivered') {
        return res.status(400).json({
          success: false,
          message: 'Purchase is already marked as delivered',
        });
      }

      // Logic to update vendor inventory (ProductAssignment)
      const ProductAssignment = require('../models/ProductAssignment');

      for (const item of purchase.items) {
        let assignment = await ProductAssignment.findOne({
          vendorId: purchase.vendorId,
          productId: item.productId,
        });

        if (!assignment) {
          assignment = await ProductAssignment.create({
            vendorId: purchase.vendorId,
            productId: item.productId,
            assignedBy: req.admin._id,
            assignedAt: new Date(),
            stock: 0,
            isActive: true,
            notes: 'Auto-created during confirmed stock delivery',
          });
        }

        // Update Global Stock
        assignment.stock += (Number(item.quantity) || 0);

        // Update Attribute Stock if variants exist
        const attributeCombination = item.attributeCombination instanceof Map
          ? Object.fromEntries(item.attributeCombination)
          : item.attributeCombination || {};

        const hasVariants = Object.keys(attributeCombination).length > 0;

        if (hasVariants) {
          if (!assignment.attributeStocks) assignment.attributeStocks = [];

          const matchingVariant = assignment.attributeStocks.find(variant => {
            if (!variant.attributes) return false;
            const variantAttrs = variant.attributes instanceof Map
              ? Object.fromEntries(variant.attributes)
              : variant.attributes;

            return Object.keys(attributeCombination).every(key => String(variantAttrs[key]) === String(attributeCombination[key]));
          });

          if (matchingVariant) {
            matchingVariant.stock = (matchingVariant.stock || 0) + (Number(item.quantity) || 0);
          } else {
            assignment.attributeStocks.push({
              attributes: attributeCombination,
              stock: Number(item.quantity) || 0,
              isActive: true
            });
          }
        }

        await assignment.save();
      }

      purchase.deliveryStatus = 'delivered';
      purchase.deliveredAt = new Date();
      if (deliveryNotes) {
        purchase.deliveryNotes = deliveryNotes;
      }
      await purchase.save();

      res.status(200).json({
        success: true,
        data: { purchase, message: 'Stock delivery confirmed and inventory updated' },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Ban vendor (temporary or permanent) - requires >3 escalations
   * @route   PUT /api/admin/vendors/:vendorId/ban
   * @access  Private (Admin)
   */
  exports.banVendor = async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { banType = 'temporary', banReason, banExpiry } = req.body; // banType: 'temporary' or 'permanent'

      if (!['temporary', 'permanent'].includes(banType)) {
        return res.status(400).json({
          success: false,
          message: "banType must be 'temporary' or 'permanent'",
        });
      }

      const vendor = await Vendor.findById(vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      // Check if vendor is already banned
      if (vendor.banInfo.isBanned) {
        return res.status(400).json({
          success: false,
          message: `Vendor is already banned (${vendor.banInfo.banType}). Please unban first if you want to change the ban type.`,
        });
      }

      // Set ban information
      vendor.banInfo.isBanned = true;
      vendor.banInfo.banType = banType;
      vendor.banInfo.bannedAt = new Date();
      vendor.banInfo.bannedBy = req.admin._id;
      vendor.banInfo.banReason = banReason || 'Banned due to multiple order escalations';

      // Set ban expiry for temporary bans
      if (banType === 'temporary') {
        if (banExpiry) {
          vendor.banInfo.banExpiry = new Date(banExpiry);
        } else {
          // Default: 30 days from now
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          vendor.banInfo.banExpiry = expiryDate;
        }
      } else {
        // Permanent ban - no expiry
        vendor.banInfo.banExpiry = undefined;
      }

      // Update vendor status
      vendor.status = banType === 'temporary' ? 'temporarily_banned' : 'permanently_banned';
      vendor.isActive = false;

      await vendor.save();

      // TODO: Send notification to vendor
      console.log(`🚫 Vendor banned: ${vendor.name} (${vendor.phone}) - Type: ${banType}${banReason ? ` - Reason: ${banReason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          vendor: {
            id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
            status: vendor.status,
            banInfo: vendor.banInfo,
          },
          message: `Vendor ${banType === 'temporary' ? 'temporarily' : 'permanently'} banned successfully`,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Revoke temporary ban
   * @route   PUT /api/admin/vendors/:vendorId/unban
   * @access  Private (Admin)
   */
  exports.unbanVendor = async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { revocationReason } = req.body;

      const vendor = await Vendor.findById(vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      // Check if vendor is banned
      if (!vendor.banInfo.isBanned) {
        return res.status(400).json({
          success: false,
          message: 'Vendor is not currently banned',
        });
      }

      // Can only unban temporary bans (permanent bans require deletion)
      if (vendor.banInfo.banType === 'permanent') {
        return res.status(400).json({
          success: false,
          message: 'Cannot unban a permanently banned vendor. Use delete vendor instead if needed.',
        });
      }

      // Revoke ban
      vendor.banInfo.isBanned = false;
      vendor.banInfo.banType = 'none';
      vendor.banInfo.revokedAt = new Date();
      vendor.banInfo.revokedBy = req.admin._id;
      vendor.banInfo.revocationReason = revocationReason || 'Ban revoked by admin';

      // Update vendor status
      vendor.status = 'approved';
      vendor.isActive = true;

      await vendor.save();

      // TODO: Send notification to vendor
      console.log(`✅ Vendor ban revoked: ${vendor.name} (${vendor.phone})${revocationReason ? ` - Reason: ${revocationReason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          vendor: {
            id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
            status: vendor.status,
            banInfo: vendor.banInfo,
          },
          message: 'Vendor ban revoked successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Permanently delete vendor (soft delete - activities persist) - requires >3 escalations
   * @route   DELETE /api/admin/vendors/:vendorId
   * @access  Private (Admin)
   */
  exports.deleteVendor = async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { deletionReason } = req.body;

      const vendor = await Vendor.findById(vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      // Check if vendor is already deleted
      if (vendor.isDeleted) {
        return res.status(400).json({
          success: false,
          message: 'Vendor is already deleted',
        });
      }

      // Check escalation count (requires >3 escalations)
      if ((vendor.escalationCount || 0) <= 3) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete vendor. Requires more than 3 escalations. Current escalation count: ' + (vendor.escalationCount || 0),
        });
      }

      // Soft delete vendor (activities persist)
      vendor.isDeleted = true;
      vendor.deletedAt = new Date();
      vendor.deletedBy = req.admin._id;
      vendor.deletionReason = deletionReason || 'Deleted due to multiple order escalations';
      vendor.status = 'permanently_banned';
      vendor.isActive = false;

      // Also update ban info if not already set
      if (!vendor.banInfo.isBanned) {
        vendor.banInfo.isBanned = true;
        vendor.banInfo.banType = 'permanent';
        vendor.banInfo.bannedAt = new Date();
        vendor.banInfo.bannedBy = req.admin._id;
        vendor.banInfo.banReason = 'Permanently banned and deleted';
      }

      await vendor.save();

      // TODO: Send notification
      console.log(`🗑️ Vendor deleted: ${vendor.name} (${vendor.phone})${deletionReason ? ` - Reason: ${deletionReason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          vendor: {
            id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
            isDeleted: vendor.isDeleted,
            deletedAt: vendor.deletedAt,
          },
          message: 'Vendor deleted successfully (soft delete - activities persist)',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // SELLER MANAGEMENT CONTROLLERS
  // ============================================================================

  /**
   * @desc    Get all sellers with filtering and pagination
   * @route   GET /api/admin/sellers
   * @access  Private (Admin)
   */
  exports.getSellers = async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        isActive,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build query
      const query = {};

      if (status) {
        query.status = status;
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { sellerId: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { area: { $regex: search, $options: 'i' } },
        ];
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const sellers = await Seller.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v -otp')
        .populate('approvedBy', 'name email');

      const total = await Seller.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          sellers,
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
   * @desc    Get single seller details
   * @route   GET /api/admin/sellers/:sellerId
   * @access  Private (Admin)
   */
  exports.getSellerDetails = async (req, res, next) => {
    try {
      const { sellerId } = req.params;

      const seller = await Seller.findById(sellerId)
        .select('-__v -otp')
        .populate('approvedBy', 'name email')
        .populate('assignedVendor', 'name phone');

      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller not found',
        });
      }

      // Get seller's withdrawal requests
      const withdrawals = await WithdrawalRequest.find({ sellerId })
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('-__v');

      // Get user count (referrals) - TODO: When User model has sellerId field
      // const referralCount = await User.countDocuments({ sellerId: seller.sellerId });

      res.status(200).json({
        success: true,
        data: {
          seller,
          wallet: {
            balance: seller.wallet.balance,
            pending: seller.wallet.pending,
            available: seller.wallet.balance - seller.wallet.pending,
          },
          withdrawals,
          // referralCount, // TODO: Implement when User model is ready
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Create new seller (IRA Partner)
   * @route   POST /api/admin/sellers
   * @access  Private (Admin)
   */
  exports.createSeller = async (req, res, next) => {
    try {
      const {
        name,
        phone,
        email,
        area,
        location,
        assignedVendor,
        monthlyTarget,
        sellerId, // Optional: If not provided, will auto-generate
      } = req.body;

      // Validate required fields
      if (!name || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Name and phone are required',
        });
      }

      // Check if phone already exists
      const existingPhone = await Seller.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered',
        });
      }

      // Generate unique sellerId if not provided
      let generatedSellerId = sellerId;
      if (!generatedSellerId) {
        // Find the highest existing sellerId number
        const lastSeller = await Seller.findOne()
          .sort({ sellerId: -1 })
          .select('sellerId');

        let nextNumber = 1001;
        if (lastSeller && lastSeller.sellerId) {
          const match = lastSeller.sellerId.match(/\d+$/);
          if (match) {
            nextNumber = parseInt(match[0]) + 1;
          }
        }

        // Generate sellerId: IRA-XXXX format
        generatedSellerId = `IRA-${nextNumber}`;
      }

      // Check if sellerId already exists
      const existingSellerId = await Seller.findOne({ sellerId: generatedSellerId.toUpperCase() });
      if (existingSellerId) {
        return res.status(400).json({
          success: false,
          message: `Seller ID ${generatedSellerId} already exists`,
        });
      }

      // Create seller
      const sellerData = {
        sellerId: generatedSellerId.toUpperCase(),
        name,
        phone,
        email: email?.toLowerCase(),
        area,
        monthlyTarget: monthlyTarget || 0,
        status: 'approved', // Auto-approve when created by admin
        isActive: true,
        approvedAt: new Date(),
        approvedBy: req.admin._id,
      };

      if (location) sellerData.location = location;
      if (assignedVendor) sellerData.assignedVendor = assignedVendor;

      const seller = await Seller.create(sellerData);

      // TODO: Send notification to seller

      console.log(`✅ Seller created: ${seller.sellerId} - ${seller.name} (${seller.phone})`);

      res.status(201).json({
        success: true,
        data: {
          seller,
          message: 'Seller created and approved successfully',
        },
      });
    } catch (error) {
      // Handle duplicate sellerId or phone
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `${field === 'sellerId' ? 'Seller ID' : 'Phone number'} already exists`,
        });
      }
      next(error);
    }
  };

  /**
   * @desc    Update seller
   * @route   PUT /api/admin/sellers/:sellerId
   * @access  Private (Admin)
   */
  exports.updateSeller = async (req, res, next) => {
    try {
      const { sellerId } = req.params;
      const updateData = req.body;

      const seller = await Seller.findById(sellerId);

      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller not found',
        });
      }

      // Don't allow updating sellerId
      if (updateData.sellerId) {
        delete updateData.sellerId;
      }

      // Normalize email if provided
      if (updateData.email) {
        updateData.email = updateData.email.toLowerCase();
      }

      // Update seller
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          seller[key] = updateData[key];
        }
      });

      await seller.save();

      res.status(200).json({
        success: true,
        data: {
          seller,
          message: 'Seller updated successfully',
        },
      });
    } catch (error) {
      // Handle duplicate phone or email
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `${field === 'phone' ? 'Phone number' : 'Email'} already exists`,
        });
      }
      next(error);
    }
  };

  /**
   * @desc    Approve seller registration
   * @route   POST /api/admin/sellers/:sellerId/approve
   * @access  Private (Admin)
   */
  exports.approveSeller = async (req, res, next) => {
    try {
      const { sellerId } = req.params;

      const seller = await Seller.findById(sellerId);

      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller not found',
        });
      }

      if (seller.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Seller is already approved',
        });
      }

      // Approve seller
      seller.status = 'approved';
      seller.isActive = true;
      seller.approvedAt = new Date();
      seller.approvedBy = req.admin._id;
      await seller.save();

      // TODO: Send notification to seller (SMS/Email)
      console.log(`✅ Seller approved: ${seller.sellerId} - ${seller.name} (${seller.phone})`);

      res.status(200).json({
        success: true,
        data: {
          seller: {
            id: seller._id,
            sellerId: seller.sellerId,
            name: seller.name,
            phone: seller.phone,
            status: seller.status,
            isActive: seller.isActive,
          },
          message: 'Seller approved successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Reject seller registration
   * @route   POST /api/admin/sellers/:sellerId/reject
   * @access  Private (Admin)
   */
  exports.rejectSeller = async (req, res, next) => {
    try {
      const { sellerId } = req.params;
      const { reason } = req.body;

      const seller = await Seller.findById(sellerId);

      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller not found',
        });
      }

      if (seller.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Seller is already rejected',
        });
      }

      // Reject seller
      seller.status = 'rejected';
      seller.isActive = false;
      if (reason) {
        seller.rejectionReason = reason;
      }
      await seller.save();

      // TODO: Send notification to seller (SMS/Email)
      console.log(`❌ Seller rejected: ${seller.sellerId} - ${seller.name} (${seller.phone})${reason ? ` - Reason: ${reason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          seller: {
            id: seller._id,
            sellerId: seller.sellerId,
            name: seller.name,
            phone: seller.phone,
            status: seller.status,
          },
          message: 'Seller rejected successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Set seller monthly target
   * @route   PUT /api/admin/sellers/:sellerId/target
   * @access  Private (Admin)
   */
  exports.setSellerTarget = async (req, res, next) => {
    try {
      const { sellerId } = req.params;
      const { monthlyTarget } = req.body;

      if (monthlyTarget === undefined || monthlyTarget < 0) {
        return res.status(400).json({
          success: false,
          message: 'Monthly target is required and must be non-negative',
        });
      }

      const seller = await Seller.findById(sellerId);

      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller not found',
        });
      }

      // Update monthly target
      seller.monthlyTarget = monthlyTarget;
      await seller.save();

      res.status(200).json({
        success: true,
        data: {
          seller: {
            id: seller._id,
            sellerId: seller.sellerId,
            name: seller.name,
            monthlyTarget: seller.monthlyTarget,
          },
          message: 'Monthly target updated successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get all seller withdrawal requests (global)
   * @route   GET /api/admin/sellers/withdrawals
   * @access  Private (Admin)
   */
  exports.getAllSellerWithdrawals = async (req, res, next) => {
    try {
      const { status, sellerId, page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      // Build query
      const query = {};

      if (status) {
        query.status = status;
      }

      if (sellerId) {
        query.sellerId = sellerId;
      }

      // Search functionality (by seller name or amount)
      if (search) {
        const searchNum = parseFloat(search);
        if (!isNaN(searchNum)) {
          // Search by amount
          query.amount = { $gte: searchNum * 0.9, $lte: searchNum * 1.1 }; // Allow 10% tolerance
        }
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with seller population
      const withdrawals = await WithdrawalRequest.find(query)
        .populate('sellerId', 'sellerId name phone email wallet')
        .populate('bankAccountId')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v');

      // If search was provided and it's a string, filter by seller name
      let filteredWithdrawals = withdrawals;
      if (search && isNaN(parseFloat(search))) {
        filteredWithdrawals = withdrawals.filter(withdrawal => {
          const sellerName = withdrawal.sellerId?.name || '';
          return sellerName.toLowerCase().includes(search.toLowerCase());
        });
      }

      // Get total count (after search filter if applicable)
      let total = await WithdrawalRequest.countDocuments(query);
      if (search && isNaN(parseFloat(search))) {
        // Recalculate total for string searches (approximate)
        total = filteredWithdrawals.length;
      }

      res.status(200).json({
        success: true,
        data: {
          withdrawals: filteredWithdrawals,
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
   * @desc    Get seller withdrawal requests (seller-specific)
   * @route   GET /api/admin/sellers/:sellerId/withdrawals
   * @access  Private (Admin)
   */
  exports.getSellerWithdrawals = async (req, res, next) => {
    try {
      const { sellerId } = req.params;
      const { status, page = 1, limit = 20 } = req.query;

      const query = { sellerId };

      if (status) {
        query.status = status;
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const withdrawals = await WithdrawalRequest.find(query)
        .populate('sellerId', 'sellerId name phone email wallet')
        .populate('bankAccountId')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-__v');

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

  /**
   * @desc    Create payment intent for seller withdrawal
   * @route   POST /api/admin/sellers/withdrawals/:requestId/payment-intent
   * @access  Private (Admin)
   */
  exports.createSellerWithdrawalPaymentIntent = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { amount } = req.body;

      const withdrawal = await WithdrawalRequest.findById(requestId)
        .populate('sellerId', 'sellerId name phone email wallet')
        .populate('bankAccountId');

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: 'Withdrawal request not found',
        });
      }

      if (withdrawal.userType !== 'seller') {
        return res.status(400).json({
          success: false,
          message: 'This is not a seller withdrawal request',
        });
      }

      if (withdrawal.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Withdrawal request is already ${withdrawal.status}`,
        });
      }

      // Use withdrawal amount if not provided
      const paymentAmount = amount || withdrawal.amount;

      // Ensure seller is populated
      if (!withdrawal.sellerId || !withdrawal.sellerId._id) {
        return res.status(400).json({
          success: false,
          message: 'Seller information not found',
        });
      }

      // Create Razorpay order
      // Receipt must be max 40 characters (Razorpay requirement)
      const receiptPrefix = `swd_${withdrawal._id.toString().slice(-8)}_`;
      const timestamp = Date.now().toString().slice(-8);
      const receipt = (receiptPrefix + timestamp).slice(0, 40); // Ensure max 40 chars

      const razorpayOrder = await razorpayService.createOrder({
        amount: paymentAmount,
        currency: 'INR',
        receipt: receipt,
        notes: {
          withdrawalRequestId: withdrawal._id.toString(),
          sellerId: withdrawal.sellerId._id.toString(),
          sellerIdCode: withdrawal.sellerId.sellerId || 'Unknown Seller',
          type: 'seller_withdrawal',
        },
      });

      // Get Razorpay Key ID
      const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_key';

      res.status(200).json({
        success: true,
        data: {
          paymentIntent: {
            id: razorpayOrder.id,
            amount: paymentAmount,
            currency: 'INR',
            status: razorpayOrder.status,
            razorpayOrderId: razorpayOrder.id,
            keyId: keyId,
            receipt: razorpayOrder.receipt,
            createdAt: new Date(),
            isTestMode: !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET,
          },
          message: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
            ? 'Payment intent created successfully'
            : 'Payment intent created (Test Mode)',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Approve seller withdrawal request
   * @route   POST /api/admin/sellers/withdrawals/:requestId/approve
   * @access  Private (Admin)
   */
  exports.approveSellerWithdrawal = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { paymentReference, paymentMethod, paymentDate, adminRemarks } = req.body;

      const withdrawal = await WithdrawalRequest.findById(requestId)
        .populate('sellerId')
        .populate('bankAccountId');

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: 'Withdrawal request not found',
        });
      }

      if (withdrawal.userType !== 'seller') {
        return res.status(400).json({
          success: false,
          message: 'This is not a seller withdrawal request',
        });
      }

      if (withdrawal.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Withdrawal request is already ${withdrawal.status}`,
        });
      }

      const seller = await Seller.findById(withdrawal.sellerId);

      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller not found',
        });
      }

      // Calculate available balance using wallet.pending (seller-specific)
      // Note: wallet.pending already includes this withdrawal amount, so we add it back for validation
      const availableBalance = seller.wallet.balance - (seller.wallet.pending - withdrawal.amount);

      if (withdrawal.amount > availableBalance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Available: ₹${Math.round(availableBalance * 100) / 100}, Requested: ₹${withdrawal.amount}`,
        });
      }

      // Approve withdrawal
      withdrawal.status = 'approved';
      withdrawal.reviewedBy = req.admin._id;
      withdrawal.reviewedAt = new Date();
      if (paymentReference) withdrawal.paymentReference = paymentReference;
      if (paymentMethod) withdrawal.paymentMethod = paymentMethod;
      if (paymentDate) withdrawal.paymentDate = new Date(paymentDate);
      if (adminRemarks) withdrawal.adminRemarks = adminRemarks;

      // Store payment gateway details if provided
      if (req.body.gatewayPaymentId) withdrawal.gatewayPaymentId = req.body.gatewayPaymentId;
      if (req.body.gatewayOrderId) withdrawal.gatewayOrderId = req.body.gatewayOrderId;
      if (req.body.gatewaySignature) withdrawal.gatewaySignature = req.body.gatewaySignature;

      await withdrawal.save();

      // SEND SELLER NOTIFICATION: Withdrawal Approved
      try {
        const SellerNotification = require('../models/SellerNotification');
        await SellerNotification.createNotification({
          sellerId: seller._id,
          type: 'withdrawal_approved',
          title: 'Withdrawal Approved',
          message: `Your withdrawal request for ₹${withdrawal.amount} has been approved and processed.`,
          relatedEntityType: 'withdrawal',
          relatedEntityId: withdrawal._id,
          priority: 'normal',
          metadata: { amount: withdrawal.amount, paymentMethod: paymentMethod || 'manual' }
        });
      } catch (notifError) {
        console.error('Failed to send seller withdrawal notification:', notifError);
      }

      // Update seller wallet
      seller.wallet.balance -= withdrawal.amount;
      seller.wallet.pending -= withdrawal.amount;
      if (seller.wallet.pending < 0) seller.wallet.pending = 0;
      await seller.save();

      // Log to payment history
      try {
        const bankAccount = withdrawal.bankAccountId;
        await createPaymentHistory({
          activityType: 'seller_withdrawal_approved',
          sellerId: seller._id,
          withdrawalRequestId: withdrawal._id,
          bankAccountId: bankAccount?._id,
          amount: withdrawal.amount,
          status: 'completed',
          paymentMethod: paymentMethod || 'razorpay',
          bankDetails: bankAccount ? {
            accountHolderName: bankAccount.accountHolderName,
            accountNumber: bankAccount.accountNumber,
            ifscCode: bankAccount.ifscCode,
            bankName: bankAccount.bankName,
          } : undefined,
          processedBy: req.admin._id,
          description: `Seller withdrawal of ₹${withdrawal.amount} approved and paid for ${seller.sellerId}`,
          metadata: {
            sellerIdCode: seller.sellerId,
            sellerName: seller.name,
            sellerPhone: seller.phone,
            paymentReference,
            gatewayPaymentId: req.body.gatewayPaymentId,
            gatewayOrderId: req.body.gatewayOrderId,
            adminRemarks,
          },
        });
      } catch (historyError) {
        console.error('Error logging withdrawal history:', historyError);
        // Don't fail approval if history logging fails
      }

      console.log(`✅ Seller withdrawal approved: ₹${withdrawal.amount} for seller ${seller.sellerId} (${seller.phone})`);

      res.status(200).json({
        success: true,
        data: {
          withdrawal,
          seller: {
            id: seller._id,
            sellerId: seller.sellerId,
            name: seller.name,
          },
          message: 'Withdrawal approved successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Reject seller withdrawal request
   * @route   POST /api/admin/sellers/withdrawals/:requestId/reject
   * @access  Private (Admin)
   */
  exports.rejectSellerWithdrawal = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      const withdrawal = await WithdrawalRequest.findById(requestId);

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: 'Withdrawal request not found',
        });
      }

      if (withdrawal.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Withdrawal request is already ${withdrawal.status}`,
        });
      }

      const seller = await Seller.findById(withdrawal.sellerId);

      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller not found',
        });
      }

      // Reject withdrawal
      withdrawal.status = 'rejected';
      withdrawal.reviewedBy = req.admin._id;
      withdrawal.reviewedAt = new Date();
      if (reason) {
        withdrawal.rejectionReason = reason;
      }
      await withdrawal.save();

      // Update seller wallet (remove from pending)
      seller.wallet.pending -= withdrawal.amount;
      if (seller.wallet.pending < 0) seller.wallet.pending = 0;
      await seller.save();

      // Log to payment history
      try {
        await createPaymentHistory({
          activityType: 'seller_withdrawal_rejected',
          sellerId: seller._id,
          withdrawalRequestId: withdrawal._id,
          amount: withdrawal.amount,
          status: 'rejected',
          processedBy: req.admin._id,
          description: `Seller withdrawal of ₹${withdrawal.amount} rejected${reason ? ` - Reason: ${reason}` : ''}`,
          metadata: {
            sellerIdCode: seller.sellerId,
            sellerName: seller.name,
            reason,
          },
        });
      } catch (historyError) {
        console.error('Error logging withdrawal history:', historyError);
        // Don't fail rejection if history logging fails
      }

      // TODO: Send rejection notification to seller with reason

      console.log(`❌ Withdrawal rejected: ₹${withdrawal.amount}${reason ? ` - Reason: ${reason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          withdrawal,
          seller: {
            id: seller._id,
            sellerId: seller.sellerId,
            name: seller.name,
            wallet: {
              balance: seller.wallet.balance,
              pending: seller.wallet.pending,
            },
          },
          message: 'Withdrawal rejected successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // SELLER CHANGE REQUEST CONTROLLERS
  // ============================================================================

  /**
   * @desc    Get all seller change requests
   * @route   GET /api/admin/sellers/change-requests
   * @access  Private (Admin)
   */
  exports.getSellerChangeRequests = async (req, res, next) => {
    try {
      const { status, changeType, page = 1, limit = 20 } = req.query;

      const query = {};

      if (status) {
        query.status = status;
      }

      if (changeType) {
        query.changeType = changeType;
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const changeRequests = await SellerChangeRequest.find(query)
        .populate('sellerId', 'sellerId name phone email area status isActive')
        .populate('reviewedBy', 'name email')
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

  /**
   * @desc    Get seller change request details
   * @route   GET /api/admin/sellers/change-requests/:requestId
   * @access  Private (Admin)
   */
  exports.getSellerChangeRequestDetails = async (req, res, next) => {
    try {
      const { requestId } = req.params;

      const changeRequest = await SellerChangeRequest.findById(requestId)
        .populate('sellerId', 'sellerId name phone email area status isActive')
        .populate('reviewedBy', 'name email')
        .lean();

      if (!changeRequest) {
        return res.status(404).json({
          success: false,
          message: 'Change request not found',
        });
      }

      res.status(200).json({
        success: true,
        data: {
          changeRequest,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Approve seller change request
   * @route   POST /api/admin/sellers/change-requests/:requestId/approve
   * @access  Private (Admin)
   */
  exports.approveSellerChangeRequest = async (req, res, next) => {
    try {
      const { requestId } = req.params;

      const changeRequest = await SellerChangeRequest.findById(requestId)
        .populate('sellerId');

      if (!changeRequest) {
        return res.status(404).json({
          success: false,
          message: 'Change request not found',
        });
      }

      if (changeRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Change request is already ${changeRequest.status}`,
        });
      }

      const seller = changeRequest.sellerId;

      if (!seller) {
        return res.status(404).json({
          success: false,
          message: 'Seller not found',
        });
      }

      // Apply the change based on type
      if (changeRequest.changeType === 'name') {
        seller.name = changeRequest.requestedValue;
      } else if (changeRequest.changeType === 'phone') {
        // Check if phone is already in use by another seller
        const existingSeller = await Seller.findOne({
          phone: changeRequest.requestedValue,
          _id: { $ne: seller._id },
        });

        if (existingSeller) {
          return res.status(400).json({
            success: false,
            message: 'This phone number is already in use by another seller',
          });
        }

        seller.phone = changeRequest.requestedValue;
      }

      await seller.save();

      // Update change request status
      changeRequest.status = 'approved';
      changeRequest.reviewedBy = req.admin._id;
      changeRequest.reviewedAt = new Date();
      await changeRequest.save();

      console.log(`✅ Seller change request approved: ${changeRequest.requestId} - ${changeRequest.changeType} change for seller ${seller.sellerId}`);

      res.status(200).json({
        success: true,
        data: {
          changeRequest,
          seller: {
            id: seller._id,
            sellerId: seller.sellerId,
            name: seller.name,
            phone: seller.phone,
          },
        },
        message: 'Change request approved and applied successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Reject seller change request
   * @route   POST /api/admin/sellers/change-requests/:requestId/reject
   * @access  Private (Admin)
   */
  exports.rejectSellerChangeRequest = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;

      const changeRequest = await SellerChangeRequest.findById(requestId)
        .populate('sellerId', 'sellerId name phone');

      if (!changeRequest) {
        return res.status(404).json({
          success: false,
          message: 'Change request not found',
        });
      }

      if (changeRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Change request is already ${changeRequest.status}`,
        });
      }

      // Reject change request
      changeRequest.status = 'rejected';
      changeRequest.reviewedBy = req.admin._id;
      changeRequest.reviewedAt = new Date();
      if (reason) {
        changeRequest.rejectionReason = reason;
      }
      await changeRequest.save();

      console.log(`❌ Seller change request rejected: ${changeRequest.requestId} - ${changeRequest.changeType} change for seller ${changeRequest.sellerId?.sellerId || 'N/A'}${reason ? ` - Reason: ${reason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          changeRequest,
        },
        message: 'Change request rejected successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // VENDOR WITHDRAWAL MANAGEMENT CONTROLLERS
  // ============================================================================

  /**
   * @desc    Get all vendor withdrawal requests (global)
   * @route   GET /api/admin/vendors/withdrawals
   * @access  Private (Admin)
   */
  exports.getAllVendorWithdrawals = async (req, res, next) => {
    try {
      const { status, vendorId, page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      // Build query
      const query = {
        userType: 'vendor',
      };

      if (status) {
        query.status = status;
      }

      if (vendorId) {
        query.vendorId = vendorId;
      }

      // Search functionality (by vendor name or amount)
      if (search) {
        const searchNum = parseFloat(search);
        if (!isNaN(searchNum)) {
          // Search by amount
          query.amount = { $gte: searchNum * 0.9, $lte: searchNum * 1.1 }; // Allow 10% tolerance
        }
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with vendor population
      const withdrawals = await WithdrawalRequest.find(query)
        .populate('vendorId', 'name phone email')
        .populate('bankAccountId')
        .populate('reviewedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v');

      // If search was provided and it's a string, filter by vendor name
      let filteredWithdrawals = withdrawals;
      if (search && isNaN(parseFloat(search))) {
        filteredWithdrawals = withdrawals.filter(withdrawal => {
          const vendorName = withdrawal.vendorId?.name || '';
          return vendorName.toLowerCase().includes(search.toLowerCase());
        });
      }

      // Get total count (after search filter if applicable)
      let total = await WithdrawalRequest.countDocuments(query);
      if (search && isNaN(parseFloat(search))) {
        total = filteredWithdrawals.length;
      }

      res.status(200).json({
        success: true,
        data: {
          withdrawals: filteredWithdrawals,
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
   * @desc    Create payment intent for vendor withdrawal
   * @route   POST /api/admin/vendors/withdrawals/:requestId/payment-intent
   * @access  Private (Admin)
   */
  exports.createVendorWithdrawalPaymentIntent = async (req, res, next) => {
    try {
      console.log('🔍 [createVendorWithdrawalPaymentIntent] Starting...');
      console.log('🔍 [createVendorWithdrawalPaymentIntent] Request params:', req.params);
      console.log('🔍 [createVendorWithdrawalPaymentIntent] Request body:', req.body);

      const { requestId } = req.params;
      const { amount } = req.body;

      console.log('🔍 [createVendorWithdrawalPaymentIntent] Looking for withdrawal:', requestId);

      const withdrawal = await WithdrawalRequest.findById(requestId)
        .populate('vendorId');

      console.log('🔍 [createVendorWithdrawalPaymentIntent] Withdrawal found:', withdrawal ? 'Yes' : 'No');
      if (withdrawal) {
        console.log('🔍 [createVendorWithdrawalPaymentIntent] Withdrawal status:', withdrawal.status);
        console.log('🔍 [createVendorWithdrawalPaymentIntent] Withdrawal userType:', withdrawal.userType);
        console.log('🔍 [createVendorWithdrawalPaymentIntent] Withdrawal amount:', withdrawal.amount);
        console.log('🔍 [createVendorWithdrawalPaymentIntent] Vendor populated:', withdrawal.vendorId ? 'Yes' : 'No');
        if (withdrawal.vendorId) {
          console.log('🔍 [createVendorWithdrawalPaymentIntent] Vendor ID:', withdrawal.vendorId._id);
          console.log('🔍 [createVendorWithdrawalPaymentIntent] Vendor name:', withdrawal.vendorId.name);
        }
      }

      if (!withdrawal) {
        console.error('❌ [createVendorWithdrawalPaymentIntent] Withdrawal not found');
        return res.status(404).json({
          success: false,
          message: 'Withdrawal request not found',
        });
      }

      if (withdrawal.userType !== 'vendor') {
        console.error('❌ [createVendorWithdrawalPaymentIntent] Invalid userType:', withdrawal.userType);
        return res.status(400).json({
          success: false,
          message: 'This is not a vendor withdrawal request',
        });
      }

      if (withdrawal.status !== 'pending') {
        console.error('❌ [createVendorWithdrawalPaymentIntent] Invalid status:', withdrawal.status);
        return res.status(400).json({
          success: false,
          message: `Withdrawal request is already ${withdrawal.status}`,
        });
      }

      // Use withdrawal amount if not provided
      const paymentAmount = amount || withdrawal.amount;
      console.log('🔍 [createVendorWithdrawalPaymentIntent] Payment amount:', paymentAmount);

      // Ensure vendor is populated
      if (!withdrawal.vendorId || !withdrawal.vendorId._id) {
        console.error('❌ [createVendorWithdrawalPaymentIntent] Vendor information not found');
        console.error('❌ [createVendorWithdrawalPaymentIntent] withdrawal.vendorId:', withdrawal.vendorId);
        return res.status(400).json({
          success: false,
          message: 'Vendor information not found',
        });
      }

      console.log('🔍 [createVendorWithdrawalPaymentIntent] Creating Razorpay order...');
      console.log('🔍 [createVendorWithdrawalPaymentIntent] razorpayService available:', typeof razorpayService !== 'undefined' ? 'Yes' : 'No');
      console.log('🔍 [createVendorWithdrawalPaymentIntent] razorpayService.createOrder:', typeof razorpayService?.createOrder === 'function' ? 'Yes' : 'No');

      // Create Razorpay order
      // Receipt must be max 40 characters (Razorpay requirement)
      const receiptPrefix = `wd_${withdrawal._id.toString().slice(-8)}_`;
      const timestamp = Date.now().toString().slice(-8);
      const receipt = (receiptPrefix + timestamp).slice(0, 40); // Ensure max 40 chars

      console.log('🔍 [createVendorWithdrawalPaymentIntent] Receipt generated:', receipt, 'Length:', receipt.length);

      const razorpayOrder = await razorpayService.createOrder({
        amount: paymentAmount,
        currency: 'INR',
        receipt: receipt,
        notes: {
          withdrawalRequestId: withdrawal._id.toString(),
          vendorId: withdrawal.vendorId._id.toString(),
          vendorName: withdrawal.vendorId.name || 'Unknown Vendor',
          type: 'vendor_withdrawal',
        },
      });

      console.log('✅ [createVendorWithdrawalPaymentIntent] Razorpay order created:', razorpayOrder?.id);

      // Get Razorpay Key ID
      const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_key';
      console.log('🔍 [createVendorWithdrawalPaymentIntent] Razorpay Key ID:', keyId ? 'Present' : 'Missing');

      const response = {
        success: true,
        data: {
          paymentIntent: {
            id: razorpayOrder.id,
            amount: paymentAmount,
            currency: 'INR',
            status: razorpayOrder.status,
            razorpayOrderId: razorpayOrder.id,
            keyId: keyId,
            receipt: razorpayOrder.receipt,
            createdAt: new Date(),
            isTestMode: !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET,
          },
          message: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
            ? 'Payment intent created successfully'
            : 'Payment intent created (Test Mode)',
        },
      };

      console.log('✅ [createVendorWithdrawalPaymentIntent] Sending success response');
      res.status(200).json(response);
    } catch (error) {
      console.error('❌ [createVendorWithdrawalPaymentIntent] Error occurred:');
      console.error('❌ [createVendorWithdrawalPaymentIntent] Error message:', error.message);
      console.error('❌ [createVendorWithdrawalPaymentIntent] Error stack:', error.stack);
      console.error('❌ [createVendorWithdrawalPaymentIntent] Full error:', error);
      next(error);
    }
  };

  /**
   * @desc    Approve vendor withdrawal request
   * @route   POST /api/admin/vendors/withdrawals/:requestId/approve
   * @access  Private (Admin)
   */
  exports.approveVendorWithdrawal = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { paymentReference, paymentMethod, paymentDate, adminRemarks } = req.body;

      const withdrawal = await WithdrawalRequest.findById(requestId)
        .populate('vendorId')
        .populate('bankAccountId');

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: 'Withdrawal request not found',
        });
      }

      if (withdrawal.userType !== 'vendor') {
        return res.status(400).json({
          success: false,
          message: 'This is not a vendor withdrawal request',
        });
      }

      if (withdrawal.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Withdrawal request is already ${withdrawal.status}`,
        });
      }

      const vendor = await Vendor.findById(withdrawal.vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      // Calculate available balance
      const totalEarningsResult = await VendorEarning.aggregate([
        {
          $match: {
            vendorId: vendor._id,
            status: 'processed',
          },
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$earnings' },
          },
        },
      ]);

      const totalEarnings = totalEarningsResult[0]?.totalEarnings || 0;

      const pendingWithdrawals = await WithdrawalRequest.aggregate([
        {
          $match: {
            vendorId: vendor._id,
            status: 'pending',
            _id: { $ne: withdrawal._id },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
          },
        },
      ]);

      const pendingWithdrawalAmount = pendingWithdrawals[0]?.totalAmount || 0;
      const availableBalance = totalEarnings - pendingWithdrawalAmount;

      if (withdrawal.amount > availableBalance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Available: ₹${Math.round(availableBalance * 100) / 100}, Requested: ₹${withdrawal.amount}`,
        });
      }

      // Approve withdrawal
      withdrawal.status = 'approved';
      withdrawal.reviewedBy = req.admin._id;
      withdrawal.reviewedAt = new Date();
      if (paymentReference) withdrawal.paymentReference = paymentReference;
      if (paymentMethod) withdrawal.paymentMethod = paymentMethod;
      if (paymentDate) withdrawal.paymentDate = new Date(paymentDate);
      if (adminRemarks) withdrawal.adminRemarks = adminRemarks;

      // Store payment gateway details if provided
      if (req.body.gatewayPaymentId) withdrawal.gatewayPaymentId = req.body.gatewayPaymentId;
      if (req.body.gatewayOrderId) withdrawal.gatewayOrderId = req.body.gatewayOrderId;
      if (req.body.gatewaySignature) withdrawal.gatewaySignature = req.body.gatewaySignature;

      await withdrawal.save();

      // SEND VENDOR NOTIFICATION: Withdrawal Approved
      try {
        const VendorNotification = require('../models/VendorNotification');
        await VendorNotification.createNotification({
          vendorId: vendor._id,
          type: 'withdrawal_approved',
          title: 'Withdrawal Approved',
          message: `Your withdrawal request for ₹${withdrawal.amount} has been approved and processed.`,
          relatedEntityType: 'withdrawal',
          relatedEntityId: withdrawal._id,
          priority: 'normal',
          metadata: { amount: withdrawal.amount, paymentMethod: paymentMethod || 'manual' }
        });
      } catch (notifError) {
        console.error('Failed to send vendor withdrawal notification:', notifError);
      }

      // Mark vendor earnings as withdrawn (oldest first until withdrawal amount is covered)
      let remainingAmount = withdrawal.amount;
      const earningsToMark = await VendorEarning.find({
        vendorId: vendor._id,
        status: 'processed',
      }).sort({ processedAt: 1 }); // Oldest first

      for (const earning of earningsToMark) {
        if (remainingAmount <= 0) break;

        if (earning.earnings <= remainingAmount) {
          // Mark entire earning as withdrawn
          earning.status = 'withdrawn';
          earning.withdrawnAt = new Date();
          earning.withdrawalRequestId = withdrawal._id;
          remainingAmount -= earning.earnings;
          await earning.save();
        } else {
          // Partial withdrawal - create a new earning record for remaining amount
          const remainingEarning = new VendorEarning({
            vendorId: earning.vendorId,
            orderId: earning.orderId,
            productId: earning.productId,
            productName: earning.productName,
            quantity: earning.quantity,
            userPrice: earning.userPrice,
            vendorPrice: earning.vendorPrice,
            earnings: earning.earnings - remainingAmount,
            status: 'processed',
            processedAt: earning.processedAt,
            notes: `Remaining amount after withdrawal ${withdrawal._id}`,
          });
          await remainingEarning.save();

          // Mark original earning as withdrawn
          earning.earnings = remainingAmount;
          earning.status = 'withdrawn';
          earning.withdrawnAt = new Date();
          earning.withdrawalRequestId = withdrawal._id;
          await earning.save();
          remainingAmount = 0;
        }
      }

      // Log to payment history
      try {
        const bankAccount = withdrawal.bankAccountId;
        await createPaymentHistory({
          activityType: 'vendor_withdrawal_approved',
          vendorId: vendor._id,
          withdrawalRequestId: withdrawal._id,
          bankAccountId: bankAccount?._id,
          amount: withdrawal.amount,
          status: 'completed',
          paymentMethod: paymentMethod || 'razorpay',
          bankDetails: bankAccount ? {
            accountHolderName: bankAccount.accountHolderName,
            accountNumber: bankAccount.accountNumber,
            ifscCode: bankAccount.ifscCode,
            bankName: bankAccount.bankName,
          } : undefined,
          processedBy: req.admin._id,
          description: `Vendor withdrawal of ₹${withdrawal.amount} approved and paid for ${vendor.name}`,
          metadata: {
            vendorName: vendor.name,
            vendorPhone: vendor.phone,
            paymentReference,
            gatewayPaymentId: req.body.gatewayPaymentId,
            gatewayOrderId: req.body.gatewayOrderId,
            adminRemarks,
          },
        });
      } catch (historyError) {
        console.error('Error logging withdrawal history:', historyError);
        // Don't fail approval if history logging fails
      }

      console.log(`✅ Vendor withdrawal approved: ₹${withdrawal.amount} for vendor ${vendor.name} (${vendor.phone})`);

      res.status(200).json({
        success: true,
        data: {
          withdrawal,
          vendor: {
            id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
          },
          message: 'Withdrawal approved successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Reject vendor withdrawal request
   * @route   POST /api/admin/vendors/withdrawals/:requestId/reject
   * @access  Private (Admin)
   */
  exports.rejectVendorWithdrawal = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { reason, adminRemarks } = req.body;

      const withdrawal = await WithdrawalRequest.findById(requestId)
        .populate('vendorId');

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: 'Withdrawal request not found',
        });
      }

      if (withdrawal.userType !== 'vendor') {
        return res.status(400).json({
          success: false,
          message: 'This is not a vendor withdrawal request',
        });
      }

      if (withdrawal.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Withdrawal request is already ${withdrawal.status}`,
        });
      }

      const vendor = await Vendor.findById(withdrawal.vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      // Reject withdrawal
      withdrawal.status = 'rejected';
      withdrawal.reviewedBy = req.admin._id;
      withdrawal.reviewedAt = new Date();
      if (reason) {
        withdrawal.rejectionReason = reason;
      }
      if (adminRemarks) {
        withdrawal.adminRemarks = adminRemarks;
      }
      await withdrawal.save();

      // Log to payment history
      try {
        await createPaymentHistory({
          activityType: 'vendor_withdrawal_rejected',
          vendorId: vendor._id,
          withdrawalRequestId: withdrawal._id,
          amount: withdrawal.amount,
          status: 'rejected',
          processedBy: req.admin._id,
          description: `Vendor withdrawal of ₹${withdrawal.amount} rejected${reason ? ` - Reason: ${reason}` : ''}`,
          metadata: {
            vendorName: vendor.name,
            vendorPhone: vendor.phone,
            reason,
            adminRemarks,
          },
        });
      } catch (historyError) {
        console.error('Error logging withdrawal history:', historyError);
        // Don't fail rejection if history logging fails
      }

      console.log(`❌ Vendor withdrawal rejected: ₹${withdrawal.amount}${reason ? ` - Reason: ${reason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          withdrawal,
          vendor: {
            id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
          },
          message: 'Withdrawal rejected successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Mark vendor withdrawal as completed (after payment processed)
   * @route   PUT /api/admin/vendors/withdrawals/:requestId/complete
   * @access  Private (Admin)
   */
  exports.completeVendorWithdrawal = async (req, res, next) => {
    try {
      const { requestId } = req.params;
      const { paymentReference, paymentMethod, paymentDate } = req.body;

      const withdrawal = await WithdrawalRequest.findById(requestId)
        .populate('vendorId');

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message: 'Withdrawal request not found',
        });
      }

      if (withdrawal.userType !== 'vendor') {
        return res.status(400).json({
          success: false,
          message: 'This is not a vendor withdrawal request',
        });
      }

      if (withdrawal.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: `Withdrawal request must be approved before marking as completed. Current status: ${withdrawal.status}`,
        });
      }

      // Mark as completed
      withdrawal.status = 'completed';
      withdrawal.processedAt = new Date();
      if (paymentReference) withdrawal.paymentReference = paymentReference;
      if (paymentMethod) withdrawal.paymentMethod = paymentMethod;
      if (paymentDate) withdrawal.paymentDate = new Date(paymentDate);
      await withdrawal.save();

      // Log to payment history
      try {
        const vendor = await Vendor.findById(withdrawal.vendorId);
        const bankAccount = await BankAccount.findById(withdrawal.bankAccountId);
        await createPaymentHistory({
          activityType: 'vendor_withdrawal_completed',
          vendorId: withdrawal.vendorId,
          withdrawalRequestId: withdrawal._id,
          bankAccountId: withdrawal.bankAccountId,
          amount: withdrawal.amount,
          status: 'completed',
          paymentMethod: paymentMethod || 'bank_transfer',
          bankDetails: bankAccount ? {
            accountHolderName: bankAccount.accountHolderName,
            accountNumber: bankAccount.accountNumber,
            ifscCode: bankAccount.ifscCode,
            bankName: bankAccount.bankName,
          } : undefined,
          processedBy: req.admin._id,
          description: `Vendor withdrawal of ₹${withdrawal.amount} completed${paymentReference ? ` - Reference: ${paymentReference}` : ''}`,
          metadata: {
            vendorName: vendor?.name,
            paymentReference,
            paymentDate,
          },
        });
      } catch (historyError) {
        console.error('Error logging withdrawal history:', historyError);
        // Don't fail completion if history logging fails
      }

      console.log(`✅ Vendor withdrawal completed: ₹${withdrawal.amount} for vendor ${withdrawal.vendorId?.name}`);

      res.status(200).json({
        success: true,
        data: {
          withdrawal,
          message: 'Withdrawal marked as completed successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get payment history for admin
   * @route   GET /api/admin/payment-history
   * @access  Private (Admin)
   */
  exports.getPaymentHistory = async (req, res, next) => {
    try {
      const {
        activityType,
        userId,
        vendorId,
        sellerId,
        orderId,
        startDate,
        endDate,
        status,
        page = 1,
        limit = 50,
        search,
      } = req.query;

      console.log('🔍 [PaymentHistory] Request params:', {
        activityType,
        userId,
        vendorId,
        sellerId,
        orderId,
        startDate,
        endDate,
        status,
        page,
        limit,
        search,
      });

      const query = {};

      // Filter by activity type
      if (activityType) {
        query.activityType = activityType;
      }

      // Filter by user
      if (userId) {
        query.userId = userId;
      }

      // Filter by vendor
      if (vendorId) {
        query.vendorId = vendorId;
      }

      // Filter by seller
      if (sellerId) {
        query.sellerId = sellerId;
      }

      // Filter by order
      if (orderId) {
        query.orderId = orderId;
      }

      // Filter by status
      if (status) {
        query.status = status;
      }

      // Filter by date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build aggregation pipeline for search
      let pipeline = [{ $match: query }];

      // If search is provided, search in description and metadata
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { description: { $regex: search, $options: 'i' } },
              { 'metadata.vendorName': { $regex: search, $options: 'i' } },
              { 'metadata.sellerName': { $regex: search, $options: 'i' } },
              { 'metadata.orderNumber': { $regex: search, $options: 'i' } },
            ],
          },
        });
      }

      // Add population and sorting
      pipeline.push(
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $lookup: {
            from: 'vendors',
            localField: 'vendorId',
            foreignField: '_id',
            as: 'vendor',
          },
        },
        {
          $lookup: {
            from: 'sellers',
            localField: 'sellerId',
            foreignField: '_id',
            as: 'seller',
          },
        },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'order',
          },
        },
        {
          $project: {
            activityType: 1,
            amount: 1,
            currency: 1,
            status: 1,
            paymentMethod: 1,
            bankDetails: 1,
            description: 1,
            metadata: 1,
            processedBy: 1,
            processedAt: 1,
            createdAt: 1,
            updatedAt: 1,
            userId: 1,
            vendorId: 1,
            sellerId: 1,
            orderId: 1,
            withdrawalRequestId: 1,
            bankAccountId: 1,
            vendorEarningId: 1,
            commissionId: 1,
            user: { $arrayElemAt: ['$user', 0] },
            vendor: { $arrayElemAt: ['$vendor', 0] },
            seller: { $arrayElemAt: ['$seller', 0] },
            order: { $arrayElemAt: ['$order', 0] },
          },
        }
      );

      // Get PaymentHistory records
      console.log('📊 [PaymentHistory] Query:', JSON.stringify(query, null, 2));
      const [history, totalResult] = await Promise.all([
        PaymentHistory.aggregate(pipeline),
        PaymentHistory.countDocuments(query),
      ]);

      console.log(`📊 [PaymentHistory] Found ${history.length} PaymentHistory records, total: ${totalResult}`);

      // Also include Payment records that might not be in PaymentHistory
      // This ensures we show all payments even if PaymentHistory logging failed
      const shouldIncludePayments = !activityType || activityType === 'all' ||
        activityType === 'user_payment_advance' || activityType === 'user_payment_remaining';

      // Also include CreditRepayment records for credit repayments
      const shouldIncludeCreditRepayments = !activityType || activityType === 'all' ||
        activityType === 'vendor_credit_repayment';

      let combinedHistory = history;
      let totalCount = totalResult;

      if (shouldIncludePayments) {
        const paymentQuery = {};

        // Apply date filter to payments
        if (startDate || endDate) {
          paymentQuery.createdAt = {};
          if (startDate) paymentQuery.createdAt.$gte = new Date(startDate);
          if (endDate) paymentQuery.createdAt.$lte = new Date(endDate);
        }

        // Apply status filter - map PaymentHistory status to Payment status
        if (status && status !== 'all') {
          if (status === 'completed') {
            paymentQuery.status = PAYMENT_STATUS.FULLY_PAID;
          } else if (status === 'pending') {
            paymentQuery.status = PAYMENT_STATUS.PARTIAL_PAID;
          } else {
            paymentQuery.status = status;
          }
        }

        // Apply user filter
        if (userId) {
          paymentQuery.userId = userId;
        }

        // Apply order filter
        if (orderId) {
          paymentQuery.orderId = orderId;
        }

        // Filter by payment type if specific activity type is requested
        if (activityType === 'user_payment_advance') {
          paymentQuery.paymentType = { $in: ['advance', 'full'] };
        } else if (activityType === 'user_payment_remaining') {
          paymentQuery.paymentType = 'remaining';
        }

        // Get all payments (we'll merge and paginate after)
        console.log('💳 [PaymentHistory] Payment query:', JSON.stringify(paymentQuery, null, 2));
        const allPayments = await Payment.find(paymentQuery)
          .sort({ createdAt: -1 })
          .populate('userId', 'name phone userId')
          .populate('orderId', 'orderNumber totalAmount')
          .select('-__v');

        console.log(`💳 [PaymentHistory] Found ${allPayments.length} Payment records`);

        // Convert Payment records to PaymentHistory format for consistency
        const paymentHistoryEntries = allPayments.map(payment => {
          // Determine activity type based on payment type
          let activityTypeFromPayment = 'user_payment_advance';
          if (payment.paymentType === 'remaining') {
            activityTypeFromPayment = 'user_payment_remaining';
          } else if (payment.paymentType === 'full') {
            activityTypeFromPayment = 'user_payment_advance';
          }

          return {
            _id: payment._id,
            historyId: payment.paymentId,
            activityType: activityTypeFromPayment,
            userId: payment.userId?._id,
            orderId: payment.orderId?._id,
            paymentId: payment._id,
            amount: payment.amount,
            currency: 'INR',
            status: payment.status === PAYMENT_STATUS.FULLY_PAID ? 'completed' :
              payment.status === PAYMENT_STATUS.PARTIAL_PAID ? 'pending' :
                payment.status,
            paymentMethod: payment.paymentMethod,
            description: `User ${payment.paymentType} payment of ₹${payment.amount}${payment.orderId?.orderNumber ? ` for order ${payment.orderId.orderNumber}` : ''}`,
            metadata: {
              orderNumber: payment.orderId?.orderNumber,
              paymentId: payment.paymentId,
              paymentType: payment.paymentType,
            },
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
            processedAt: payment.paidAt || payment.createdAt,
            user: payment.userId ? {
              _id: payment.userId._id,
              name: payment.userId.name,
              phone: payment.userId.phone,
              userId: payment.userId.userId,
            } : null,
            order: payment.orderId ? {
              _id: payment.orderId._id,
              orderNumber: payment.orderId.orderNumber,
              totalAmount: payment.orderId.totalAmount,
            } : null,
          };
        });

        // Merge PaymentHistory and Payment records, removing duplicates
        // A payment is a duplicate if it has the same paymentId in metadata
        const existingPaymentIds = new Set(
          history
            .filter(h => h.metadata?.paymentId)
            .map(h => h.metadata.paymentId)
        );

        const uniquePaymentEntries = paymentHistoryEntries.filter(
          entry => !existingPaymentIds.has(entry.metadata?.paymentId)
        );

        console.log(`💳 [PaymentHistory] Unique Payment entries after deduplication: ${uniquePaymentEntries.length}`);

        // Combine and sort by date
        combinedHistory = [...history, ...uniquePaymentEntries]
          .sort((a, b) => {
            const dateA = new Date(a.createdAt || a.processedAt || 0);
            const dateB = new Date(b.createdAt || b.processedAt || 0);
            return dateB - dateA;
          });

        // Apply pagination after merging
        const skip = (pageNum - 1) * limitNum;
        combinedHistory = combinedHistory.slice(skip, skip + limitNum);

        // Update total count
        totalCount = history.length + uniquePaymentEntries.length;
      }

      // Include CreditRepayment records
      if (shouldIncludeCreditRepayments) {
        const creditRepaymentQuery = {};

        // Apply date filter
        if (startDate || endDate) {
          creditRepaymentQuery.createdAt = {};
          if (startDate) creditRepaymentQuery.createdAt.$gte = new Date(startDate);
          if (endDate) creditRepaymentQuery.createdAt.$lte = new Date(endDate);
        }

        // Apply status filter
        if (status && status !== 'all') {
          if (status === 'completed') {
            creditRepaymentQuery.status = 'completed';
          } else {
            creditRepaymentQuery.status = status;
          }
        } else {
          // Only show completed repayments by default
          creditRepaymentQuery.status = 'completed';
        }

        // Apply vendor filter
        if (vendorId) {
          creditRepaymentQuery.vendorId = vendorId;
        }

        console.log('💰 [PaymentHistory] CreditRepayment query:', JSON.stringify(creditRepaymentQuery, null, 2));
        const allCreditRepayments = await CreditRepayment.find(creditRepaymentQuery)
          .sort({ createdAt: -1 })
          .populate('vendorId', 'name phone vendorId')
          .select('-__v');

        console.log(`💰 [PaymentHistory] Found ${allCreditRepayments.length} CreditRepayment records`);

        // Convert CreditRepayment records to PaymentHistory format
        const creditRepaymentEntries = allCreditRepayments.map(repayment => {
          return {
            _id: repayment._id,
            historyId: repayment.repaymentId,
            activityType: 'vendor_credit_repayment',
            vendorId: repayment.vendorId?._id,
            amount: repayment.amount,
            currency: 'INR',
            status: repayment.status === 'completed' ? 'completed' : repayment.status,
            paymentMethod: 'razorpay',
            description: `Vendor credit repayment of ₹${repayment.amount}${repayment.penaltyAmount > 0 ? ` (including ₹${repayment.penaltyAmount} penalty)` : ''}`,
            metadata: {
              repaymentId: repayment.repaymentId,
              creditUsedBefore: repayment.creditUsedBefore,
              creditUsedAfter: repayment.creditUsedAfter,
              penaltyAmount: repayment.penaltyAmount,
              razorpayPaymentId: repayment.razorpayPaymentId,
            },
            createdAt: repayment.createdAt,
            updatedAt: repayment.updatedAt,
            processedAt: repayment.paidAt || repayment.createdAt,
            vendor: repayment.vendorId ? {
              _id: repayment.vendorId._id,
              name: repayment.vendorId.name,
              phone: repayment.vendorId.phone,
              vendorId: repayment.vendorId.vendorId,
            } : null,
          };
        });

        // Merge with existing history
        combinedHistory = [...combinedHistory, ...creditRepaymentEntries]
          .sort((a, b) => {
            const dateA = new Date(a.createdAt || a.processedAt || 0);
            const dateB = new Date(b.createdAt || b.processedAt || 0);
            return dateB - dateA;
          });

        // Apply pagination after merging
        const skip = (pageNum - 1) * limitNum;
        combinedHistory = combinedHistory.slice(skip, skip + limitNum);

        // Update total count
        totalCount = combinedHistory.length;
      }

      // Calculate summary statistics
      const summaryPipeline = [
        { $match: query },
        {
          $group: {
            _id: '$activityType',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ];

      const summary = await PaymentHistory.aggregate(summaryPipeline);

      console.log(`✅ [PaymentHistory] Returning ${combinedHistory.length} records, total: ${totalCount}, page: ${pageNum}/${Math.ceil(totalCount / limitNum)}`);

      res.status(200).json({
        success: true,
        data: {
          history: combinedHistory,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
          },
          summary,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get payment history statistics
   * @route   GET /api/admin/payment-history/stats
   * @access  Private (Admin)
   */
  exports.getPaymentHistoryStats = async (req, res, next) => {
    try {
      const { startDate, endDate, status } = req.query;

      console.log('📊 [PaymentHistoryStats] Calculating stats with params:', { startDate, endDate, status });

      const query = {};
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Determine status filter - default to completed/credited/approved if not specified
      let statusFilter = { $in: ['completed', 'credited', 'approved'] };
      if (status && status !== 'all') {
        if (status === 'completed') {
          statusFilter = { $in: ['completed', 'credited', 'approved'] };
        } else if (status === 'pending') {
          statusFilter = { $in: ['pending', 'requested'] };
        } else if (status === 'rejected') {
          statusFilter = 'rejected';
        } else {
          statusFilter = status;
        }
      }

      // Get stats from PaymentHistory - filter by status
      const historyStatsCompleted = await PaymentHistory.aggregate([
        {
          $match: {
            ...query,
            status: statusFilter
          }
        },
        {
          $group: {
            _id: null,
            totalUserPayments: {
              $sum: {
                $cond: [
                  { $in: ['$activityType', ['user_payment_advance', 'user_payment_remaining']] },
                  '$amount',
                  0,
                ],
              },
            },
            totalVendorEarnings: {
              $sum: {
                $cond: [{ $eq: ['$activityType', 'vendor_earning_credited'] }, '$amount', 0],
              },
            },
            totalSellerCommissions: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$activityType', 'seller_commission_credited'] },
                      { $in: ['$status', ['completed', 'credited', 'approved']] }
                    ]
                  },
                  '$amount',
                  0,
                ],
              },
            },
            totalVendorWithdrawals: {
              $sum: {
                $cond: [
                  { $in: ['$activityType', ['vendor_withdrawal_approved', 'vendor_withdrawal_completed']] },
                  '$amount',
                  0,
                ],
              },
            },
            totalSellerWithdrawals: {
              $sum: {
                $cond: [
                  { $in: ['$activityType', ['seller_withdrawal_approved', 'seller_withdrawal_completed']] },
                  '$amount',
                  0,
                ],
              },
            },
          },
        },
      ]);

      // Get total activities count (all statuses)
      const totalActivitiesResult = await PaymentHistory.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalActivities: { $sum: 1 },
          },
        },
      ]);

      // Get Payment records stats - filter by status
      const paymentQuery = {};
      if (startDate || endDate) {
        paymentQuery.createdAt = {};
        if (startDate) paymentQuery.createdAt.$gte = new Date(startDate);
        if (endDate) paymentQuery.createdAt.$lte = new Date(endDate);
      }

      // Map PaymentHistory status to Payment status
      if (status && status !== 'all') {
        if (status === 'completed') {
          paymentQuery.status = PAYMENT_STATUS.FULLY_PAID;
        } else if (status === 'pending') {
          paymentQuery.status = PAYMENT_STATUS.PARTIAL_PAID;
        } else if (status === 'rejected') {
          paymentQuery.status = PAYMENT_STATUS.FAILED;
        }
      } else {
        // Default: only count fully paid payments
        paymentQuery.status = PAYMENT_STATUS.FULLY_PAID;
      }

      // Get Payment IDs that are already in PaymentHistory to avoid double counting
      const existingPaymentIds = await PaymentHistory.distinct('metadata.paymentId', {
        ...query,
        'metadata.paymentId': { $exists: true, $ne: null }
      });

      console.log(`📊 [PaymentHistoryStats] Found ${existingPaymentIds.length} Payment IDs already in PaymentHistory`);

      // Get Payment records that are NOT in PaymentHistory
      // Note: We match by paymentId field (string) against metadata.paymentId from PaymentHistory
      const paymentQueryUnique = {
        ...paymentQuery,
      };

      // Only filter out existing payments if we have any
      if (existingPaymentIds.length > 0) {
        paymentQueryUnique.paymentId = { $nin: existingPaymentIds };
      }

      const paymentStats = await Payment.aggregate([
        { $match: paymentQueryUnique },
        {
          $group: {
            _id: null,
            totalUserPayments: { $sum: '$amount' },
            totalPayments: { $sum: 1 },
          },
        },
      ]);

      // Get CreditRepayment stats - filter by status
      const creditRepaymentQuery = {};
      if (startDate || endDate) {
        creditRepaymentQuery.createdAt = {};
        if (startDate) creditRepaymentQuery.createdAt.$gte = new Date(startDate);
        if (endDate) creditRepaymentQuery.createdAt.$lte = new Date(endDate);
      }

      if (status && status !== 'all') {
        creditRepaymentQuery.status = status === 'completed' ? 'completed' : status;
      } else {
        // Default: only count completed repayments
        creditRepaymentQuery.status = 'completed';
      }

      const creditRepaymentStats = await CreditRepayment.aggregate([
        { $match: creditRepaymentQuery },
        {
          $group: {
            _id: null,
            totalCreditRepayments: { $sum: '$amount' },
            totalRepayments: { $sum: 1 },
          },
        },
      ]);

      // Get Commission records stats - calculate total commissions earned (not withdrawals)
      const commissionQuery = {};
      if (startDate || endDate) {
        commissionQuery.creditedAt = {};
        if (startDate) commissionQuery.creditedAt.$gte = new Date(startDate);
        if (endDate) commissionQuery.creditedAt.$lte = new Date(endDate);
      }

      // Only count credited commissions
      commissionQuery.status = 'credited';

      const commissionStats = await Commission.aggregate([
        { $match: commissionQuery },
        {
          $group: {
            _id: null,
            totalSellerCommissions: { $sum: '$commissionAmount' },
            totalCommissions: { $sum: 1 },
          },
        },
      ]);

      console.log(`💰 [PaymentHistoryStats] Commission query:`, JSON.stringify(commissionQuery, null, 2));
      console.log(`💰 [PaymentHistoryStats] Found ${commissionStats[0]?.totalCommissions || 0} Commission records`);

      const historyResult = historyStatsCompleted[0] || {
        totalUserPayments: 0,
        totalVendorEarnings: 0,
        totalSellerCommissions: 0,
        totalVendorWithdrawals: 0,
        totalSellerWithdrawals: 0,
      };

      const paymentResult = paymentStats[0] || {
        totalUserPayments: 0,
        totalPayments: 0,
      };

      const creditRepaymentResult = creditRepaymentStats[0] || {
        totalCreditRepayments: 0,
        totalRepayments: 0,
      };

      const commissionResult = commissionStats[0] || {
        totalSellerCommissions: 0,
        totalCommissions: 0,
      };

      // Get total activities count including all sources
      // Count PaymentHistory records (already includes most activities)
      const totalActivities = totalActivitiesResult[0]?.totalActivities || 0;

      // Count Payment records that are NOT in PaymentHistory (to avoid double counting)
      const paymentCountQuery = { ...paymentQueryUnique };
      const paymentCount = await Payment.countDocuments(paymentCountQuery);

      // Count Commission records that are NOT in PaymentHistory
      // Check which commission IDs are already in PaymentHistory
      const existingCommissionIds = await PaymentHistory.distinct('commissionId', {
        ...query,
        commissionId: { $exists: true, $ne: null }
      });

      const commissionCountQuery = { ...commissionQuery };
      if (existingCommissionIds.length > 0) {
        commissionCountQuery._id = { $nin: existingCommissionIds };
      }
      const commissionCount = await Commission.countDocuments(commissionCountQuery);

      // Count CreditRepayment records that are NOT in PaymentHistory
      // Check which repayment IDs are already in PaymentHistory
      const existingRepaymentIds = await PaymentHistory.distinct('metadata.repaymentId', {
        ...query,
        'metadata.repaymentId': { $exists: true, $ne: null }
      });

      const creditRepaymentCountQuery = { ...creditRepaymentQuery };
      if (existingRepaymentIds.length > 0) {
        creditRepaymentCountQuery.repaymentId = { $nin: existingRepaymentIds };
      }
      const creditRepaymentCount = await CreditRepayment.countDocuments(creditRepaymentCountQuery);

      console.log(`📊 [PaymentHistoryStats] Activity counts:`, {
        paymentHistory: totalActivities,
        payments: paymentCount,
        commissions: commissionCount,
        creditRepayments: creditRepaymentCount,
        total: totalActivities + paymentCount + commissionCount + creditRepaymentCount,
      });

      // Combine stats - use Commission records directly for seller commissions (more accurate)
      const combinedStats = {
        totalUserPayments: historyResult.totalUserPayments + paymentResult.totalUserPayments,
        totalVendorEarnings: historyResult.totalVendorEarnings,
        totalSellerCommissions: commissionResult.totalSellerCommissions, // Use Commission records directly
        totalVendorWithdrawals: historyResult.totalVendorWithdrawals,
        totalSellerWithdrawals: historyResult.totalSellerWithdrawals,
        totalActivities: totalActivities + paymentCount + commissionCount + creditRepaymentCount,
      };

      console.log('📊 [PaymentHistoryStats] Calculated stats:', {
        historyResult,
        paymentResult,
        creditRepaymentResult,
        totalActivities,
        combinedStats,
      });

      res.status(200).json({
        success: true,
        data: combinedStats,
      });
    } catch (error) {
      console.error('❌ [PaymentHistoryStats] Error:', error);
      next(error);
    }
  };

  /**
   * @desc    Get all withdrawals (vendors + sellers) for admin dashboard
   * @route   GET /api/admin/withdrawals
   * @access  Private (Admin)
   */
  exports.getAllWithdrawals = async (req, res, next) => {
    try {
      const { userType, status, page = 1, limit = 20, search } = req.query;

      const query = {};

      if (userType) {
        query.userType = userType;
      }

      if (status) {
        query.status = status;
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build population based on userType
      let withdrawals = await WithdrawalRequest.find(query)
        .populate('vendorId', 'name phone email')
        .populate('sellerId', 'sellerId name phone email wallet')
        .populate('bankAccountId')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-__v');

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        withdrawals = withdrawals.filter(withdrawal => {
          if (withdrawal.userType === 'vendor') {
            return withdrawal.vendorId?.name?.toLowerCase().includes(searchLower) ||
              withdrawal.vendorId?.phone?.includes(search);
          } else {
            return withdrawal.sellerId?.name?.toLowerCase().includes(searchLower) ||
              withdrawal.sellerId?.sellerId?.toLowerCase().includes(searchLower) ||
              withdrawal.sellerId?.phone?.includes(search);
          }
        });
      }

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
  // USER MANAGEMENT CONTROLLERS
  // ============================================================================

  /**
   * @desc    Get all users with filtering and pagination
   * @route   GET /api/admin/users
   * @access  Private (Admin)
   */
  exports.getUsers = async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        isActive,
        isBlocked,
        sellerId,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build query
      const query = {};

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      if (isBlocked !== undefined) {
        query.isBlocked = isBlocked === 'true';
      }

      if (sellerId) {
        query.sellerId = sellerId;
      }

      if (search) {
        query.$or = [
          { userId: { $regex: search, $options: 'i' } }, // Search by unique user ID
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { sellerId: { $regex: search, $options: 'i' } },
          { 'location.address': { $regex: search, $options: 'i' } },
          { 'location.city': { $regex: search, $options: 'i' } },
        ];
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const users = await User.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v -otp')
        .populate('seller', 'sellerId name')
        .populate('assignedVendor', 'name phone');

      // Fetch order counts and last order date for each user to distinguish active/inactive
      const Order = require('../models/Order');
      const usersWithCounts = await Promise.all(users.map(async (user) => {
        const orderCount = await Order.countDocuments({ userId: user._id });
        const lastOrder = await Order.findOne({ userId: user._id }).sort({ createdAt: -1 }).select('createdAt');

        return {
          ...user.toObject(),
          totalOrders: orderCount,
          orders: orderCount, // Providing both for frontend compatibility
          lastOrderDate: lastOrder ? lastOrder.createdAt : null,
        };
      }));

      const total = await User.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          users: usersWithCounts,
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
   * @desc    Get single user details
   * @route   GET /api/admin/users/:userId
   * @access  Private (Admin)
   */
  exports.getUserDetails = async (req, res, next) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId)
        .select('-__v -otp')
        .populate('seller', 'sellerId name phone email')
        .populate('assignedVendor', 'name phone location');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Get user's orders count and stats
      const Order = require('../models/Order');
      const Payment = require('../models/Payment');

      const ordersCount = await Order.countDocuments({ userId: user._id });
      const totalSpentResult = await Order.aggregate([
        { $match: { userId: user._id, status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] }, paymentStatus: PAYMENT_STATUS.FULLY_PAID } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]);
      const totalSpent = totalSpentResult[0]?.total || 0;

      // Get user's recent orders
      const recentOrders = await Order.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderNumber totalAmount status createdAt paymentStatus')
        .lean();

      // Get user's payments
      const payments = await Payment.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('orderId', 'orderNumber totalAmount')
        .select('-__v');

      res.status(200).json({
        success: true,
        data: {
          user,
          stats: {
            ordersCount,
            totalSpent,
            recentOrders: recentOrders.length,
          },
          recentOrders: recentOrders.map(order => ({
            id: order._id,
            orderNumber: order.orderNumber,
            value: order.totalAmount,
            date: order.createdAt,
            status: order.status,
            paymentStatus: order.paymentStatus,
          })),
          payments: payments.map(payment => ({
            id: payment._id,
            paymentId: payment.paymentId,
            amount: payment.amount,
            date: payment.createdAt,
            description: `Payment for Order ${payment.orderId?.orderNumber || 'N/A'}`,
            status: payment.status === 'fully_paid' ? 'completed' : payment.status,
            orderNumber: payment.orderId?.orderNumber,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Block/Unblock user
   * @route   PUT /api/admin/users/:userId/block
   * @access  Private (Admin)
   */
  exports.blockUser = async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { block = true, reason } = req.body; // block: true to block, false to unblock

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Block/Unblock user
      user.isBlocked = block === true || block === 'true';
      user.isActive = !user.isBlocked; // If blocked, set inactive

      await user.save();

      const action = user.isBlocked ? 'blocked' : 'unblocked';
      console.log(`✅ User ${action}: ${user.name} (${user.phone})${reason ? ` - Reason: ${reason}` : ''}`);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            phone: user.phone,
            isBlocked: user.isBlocked,
            isActive: user.isActive,
          },
          message: `User ${action} successfully`,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // ORDER & PAYMENT MANAGEMENT CONTROLLERS
  // ============================================================================

  /**
   * @desc    Get all orders with filtering and pagination
   * @route   GET /api/admin/orders
   * @access  Private (Admin)
   */
  exports.getOrders = async (req, res, next) => {
    try {
      // Process expired status updates in background (non-blocking)
      processExpiredStatusUpdates().catch(() => { });

      const {
        page = 1,
        limit = 20,
        status,
        paymentStatus,
        vendorId,
        userId,
        assignedTo,
        dateFrom,
        dateTo,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build query
      const query = {};

      if (status) {
        query.status = status;
      }

      if (paymentStatus) {
        query.paymentStatus = paymentStatus;
      }

      if (vendorId) {
        query.vendorId = vendorId;
      }

      if (userId) {
        query.userId = userId;
      }

      if (assignedTo) {
        query.assignedTo = assignedTo;
      }

      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) {
          query.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }

      // Search by order number, user ID/name, or vendor ID/name
      if (search) {
        // First, try to find users and vendors matching the search
        const User = require('../models/User');
        const Vendor = require('../models/Vendor');

        const matchingUsers = await User.find({
          $or: [
            { userId: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
          ],
        }).select('_id').lean();

        const matchingVendors = await Vendor.find({
          $or: [
            { vendorId: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
          ],
        }).select('_id').lean();

        const userIds = matchingUsers.map(u => u._id);
        const vendorIds = matchingVendors.map(v => v._id);

        query.$or = [
          { orderNumber: { $regex: search, $options: 'i' } },
          ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : []),
          ...(vendorIds.length > 0 ? [{ vendorId: { $in: vendorIds } }] : []),
        ];
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const orders = await Order.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'name phone email location')
        .populate('vendorId', 'name phone location')
        .populate('seller', 'sellerId name phone')
        .select('-__v')
        .lean();

      const total = await Order.countDocuments(query);

      // Filter orders in grace period - show as 'pending' to admin (not accepted yet)
      const filteredOrders = orders.map(order => {
        // If order is in grace period, show status as 'pending' instead of actual status
        if (order.acceptanceGracePeriod?.isActive) {
          return {
            ...order,
            status: 'pending', // Show as pending during grace period
          };
        }
        return order;
      });

      res.status(200).json({
        success: true,
        data: {
          orders: filteredOrders,
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
   * @desc    Get single order details
   * @route   GET /api/admin/orders/:orderId
   * @access  Private (Admin)
   */
  exports.getOrderDetails = async (req, res, next) => {
    try {
      const { orderId } = req.params;

      const order = await Order.findById(orderId)
        .populate('userId', 'name phone email location')
        .populate('vendorId', 'name phone location')
        .populate('seller', 'sellerId name phone')
        .populate('items.productId', 'name sku category priceToUser')
        .populate('parentOrderId')
        .populate('childOrderIds')
        .select('-__v');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      // Get order payments
      const payments = await Payment.find({ orderId })
        .sort({ createdAt: -1 })
        .select('-__v');

      // Calculate payment summary
      const totalPaid = payments
        .filter(p => p.status === 'fully_paid' || p.status === 'partial_paid')
        .reduce((sum, p) => sum + p.amount, 0);

      const totalPending = payments
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.amount, 0);

      res.status(200).json({
        success: true,
        data: {
          order,
          payments,
          paymentSummary: {
            totalAmount: order.totalAmount,
            totalPaid,
            totalPending,
            remaining: order.totalAmount - totalPaid,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get all commissions with order and user details
   * @route   GET /api/admin/commissions
   * @access  Private (Admin)
   */
  exports.getCommissions = async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        sellerId,
        userId,
        orderId,
        month,
        year,
        status,
        dateFrom,
        dateTo,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build query
      const query = {};

      if (sellerId) {
        query.sellerId = sellerId;
      }

      if (userId) {
        query.userId = userId;
      }

      if (orderId) {
        query.orderId = orderId;
      }

      if (month) {
        query.month = parseInt(month);
      }

      if (year) {
        query.year = parseInt(year);
      }

      if (status) {
        query.status = status;
      }

      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) {
          query.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }

      // Search by seller ID code or order number
      if (search) {
        query.$or = [
          { sellerIdCode: { $regex: search, $options: 'i' } },
        ];
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with population
      const commissions = await Commission.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('sellerId', 'sellerId name phone email')
        .populate('userId', 'name phone email location')
        .populate('orderId', 'orderNumber totalAmount status paymentStatus createdAt deliveryAddress vendorId assignedTo')
        .select('-__v')
        .lean();

      const total = await Commission.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          commissions,
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
   * @desc    Generate invoice PDF for order
   * @route   GET /api/admin/orders/:orderId/invoice
   * @access  Private (Admin)
   */
  exports.generateInvoice = async (req, res, next) => {
    try {
      const { orderId } = req.params;

      const order = await Order.findById(orderId)
        .populate('userId', 'name phone email location')
        .populate('vendorId', 'name phone location')
        .populate('seller', 'sellerId name phone')
        .populate('items.productId', 'name sku category priceToUser')
        .select('-__v');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      // Get order payments
      const payments = await Payment.find({ orderId })
        .sort({ createdAt: -1 })
        .select('-__v');

      const totalPaid = payments
        .filter(p => p.status === 'fully_paid' || p.status === 'partial_paid')
        .reduce((sum, p) => sum + p.amount, 0);

      // Format date
      const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      };

      // Format currency
      const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(amount || 0);
      };

      // Generate HTML invoice
      const invoiceHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${order.orderNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 40px;
      background: #f5f5f5;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #10b981;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #10b981;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h1 {
      font-size: 32px;
      color: #1f2937;
      margin-bottom: 5px;
    }
    .invoice-title p {
      color: #6b7280;
      font-size: 14px;
    }
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }
    .detail-section h3 {
      color: #374151;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .detail-section p {
      color: #6b7280;
      font-size: 14px;
      margin: 5px 0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .items-table thead {
      background: #f3f4f6;
    }
    .items-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      color: #1f2937;
    }
    .items-table tbody tr:hover {
      background: #f9fafb;
    }
    .text-right {
      text-align: right;
    }
    .totals {
      margin-top: 20px;
      margin-left: auto;
      width: 300px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .total-row:last-child {
      border-bottom: none;
    }
    .total-label {
      font-weight: 600;
      color: #374151;
    }
    .total-amount {
      font-weight: bold;
      color: #1f2937;
    }
    .grand-total {
      background: #10b981;
      color: white;
      padding: 15px;
      border-radius: 5px;
      margin-top: 10px;
    }
    .grand-total .total-label {
      color: white;
      font-size: 18px;
    }
    .grand-total .total-amount {
      color: white;
      font-size: 20px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    .payment-info {
      background: #fef3c7;
      padding: 15px;
      border-radius: 5px;
      margin-top: 20px;
    }
    .payment-info h4 {
      color: #92400e;
      margin-bottom: 8px;
    }
    .payment-info p {
      color: #78350f;
      font-size: 13px;
      margin: 3px 0;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .invoice-container {
        box-shadow: none;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="logo">IRA SATHI</div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <p>Order #${order.orderNumber}</p>
      </div>
    </div>

    <div class="details">
      <div class="detail-section">
        <h3>Bill To</h3>
        <p><strong>${order.userId?.name || 'N/A'}</strong></p>
        <p>${order.deliveryAddress?.phone || order.userId?.phone || 'N/A'}</p>
        <p>${order.deliveryAddress?.address || order.userId?.location || 'N/A'}</p>
        <p>${order.deliveryAddress?.city || ''} ${order.deliveryAddress?.state || ''} - ${order.deliveryAddress?.pincode || ''}</p>
      </div>
      <div class="detail-section">
        <h3>Invoice Details</h3>
        <p><strong>Invoice Date:</strong> ${formatDate(order.createdAt)}</p>
        <p><strong>Order Date:</strong> ${formatDate(order.createdAt)}</p>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Payment Status:</strong> <span style="text-transform: capitalize;">${order.paymentStatus?.replace('_', ' ') || 'Pending'}</span></p>
        ${order.vendorId ? `<p><strong>Vendor:</strong> ${order.vendorId.name || 'N/A'}</p>` : ''}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Quantity</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map((item) => `
          <tr>
            <td>
              <strong>${item.productName || item.productId?.name || 'Product'}</strong>
              ${item.productId?.sku ? `<br><small style="color: #6b7280;">SKU: ${item.productId.sku}</small>` : ''}
            </td>
            <td>${item.quantity}</td>
            <td class="text-right">${formatCurrency(item.unitPrice)}</td>
            <td class="text-right"><strong>${formatCurrency(item.totalPrice)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span class="total-label">Subtotal</span>
        <span class="total-amount">${formatCurrency(order.subtotal)}</span>
      </div>
      ${order.deliveryCharge > 0 ? `
      <div class="total-row">
        <span class="total-label">Delivery Charge</span>
        <span class="total-amount">${formatCurrency(order.deliveryCharge)}</span>
      </div>
      ` : ''}
      <div class="total-row grand-total">
        <span class="total-label">Grand Total</span>
        <span class="total-amount">${formatCurrency(order.totalAmount)}</span>
      </div>
    </div>

    <div class="payment-info">
      <h4>Payment Information</h4>
      <p><strong>Payment Preference:</strong> ${order.paymentPreference === 'partial' ? 'Partial Payment (30% Advance + 70% Remaining)' : 'Full Payment'}</p>
      <p><strong>Upfront Amount:</strong> ${formatCurrency(order.upfrontAmount)}</p>
      ${order.remainingAmount > 0 ? `<p><strong>Remaining Amount:</strong> ${formatCurrency(order.remainingAmount)}</p>` : ''}
      <p><strong>Total Paid:</strong> ${formatCurrency(totalPaid)}</p>
      <p><strong>Balance Due:</strong> ${formatCurrency(order.totalAmount - totalPaid)}</p>
    </div>

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>For any queries, please contact our support team.</p>
      <p style="margin-top: 10px;">Invoice generated on ${formatDate(new Date())}</p>
    </div>
  </div>
</body>
</html>
    `;

      // Set headers for HTML response
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="invoice-${order.orderNumber}.html"`);
      res.send(invoiceHTML);
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get escalated orders (assigned to admin)
   * @route   GET /api/admin/orders/escalated
   * @access  Private (Admin)
   */
  exports.getEscalatedOrders = async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        dateFrom,
        dateTo,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build query for escalated orders (assigned to admin)
      const query = {
        assignedTo: 'admin',
      };

      // Filter by status if provided
      if (status) {
        query.status = status;
      } else {
        // By default, exclude delivered and cancelled escalated orders
        query.status = { $nin: ['delivered', 'cancelled'] };
      }

      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) {
          query.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }

      // Search by order number
      if (search) {
        query.orderNumber = { $regex: search, $options: 'i' };
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const orders = await Order.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'name phone email location')
        .populate('vendorId', 'name phone location')
        .populate('seller', 'sellerId name')
        .populate('items.productId', 'name sku category')
        .select('-__v')
        .lean();

      const total = await Order.countDocuments(query);

      // Transform orders for frontend
      const transformedOrders = orders.map(order => {
        const vendor = order.vendorId || order.escalation?.originalVendorId;
        const user = order.userId;

        // Get escalation details
        const escalation = order.escalation || {};
        const escalationEntry = order.statusTimeline?.find(
          entry => entry.status === 'rejected' && entry.updatedBy === 'vendor'
        );

        return {
          id: order._id.toString(),
          orderNumber: order.orderNumber,
          vendor: vendor?.name || 'N/A',
          vendorId: vendor?._id?.toString() || null,
          vendorPhone: vendor?.phone || null,
          vendorLocation: vendor?.location ? `${vendor.location.city || ''}, ${vendor.location.state || ''}`.trim() : null,
          value: order.totalAmount || 0,
          orderValue: order.totalAmount || 0,
          escalatedAt: escalation.escalatedAt || escalationEntry?.timestamp || order.createdAt,
          escalatedBy: escalation.escalatedBy || 'vendor',
          escalationReason: escalation.escalationReason || 'Not provided',
          escalationType: escalation.escalationType || 'full',
          escalatedItems: escalation.escalatedItems || [],
          isReverted: !!escalation.revertedAt,
          revertedAt: escalation.revertedAt || null,
          revertReason: escalation.revertReason || null,
          status: order.status || 'rejected',
          items: order.items?.map(item => ({
            id: item.productId?._id?.toString() || item._id?.toString(),
            name: item.productId?.name || item.productName,
            quantity: item.quantity,
            price: item.unitPrice,
            totalPrice: item.totalPrice,
          })) || [],
          userId: user?._id?.toString(),
          userName: user?.name,
          userPhone: user?.phone || null,
          userLocation: user?.location ? `${user.location.city || ''}, ${user.location.state || ''}`.trim() : null,
          deliveryAddress: order.deliveryAddress,
          notes: order.notes,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          orders: transformedOrders,
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
   * @desc    Fulfill escalated order from warehouse
   * @route   POST /api/admin/orders/:orderId/fulfill
   * @access  Private (Admin)
   */
  exports.fulfillOrderFromWarehouse = async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const { note, deliveryDate, trackingNumber } = req.body;

      const order = await Order.findById(orderId)
        .populate('userId', 'name phone email')
        .populate('items.productId', 'name sku');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      // Check if order is assigned to admin (escalated)
      if (order.assignedTo !== 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Order is not escalated to admin. Only escalated orders can be fulfilled from warehouse.',
        });
      }

      // Check if order can be fulfilled
      if (order.status === 'delivered' || order.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: `Cannot fulfill order with status: ${order.status}`,
        });
      }

      // Update order status to accepted (admin is handling fulfillment)
      // Status flow: awaiting -> accepted -> dispatched -> delivered -> fully_paid (if partial payment)
      const previousStatus = order.status;
      order.status = 'accepted'; // Changed from 'processing' to 'accepted' to match status flow
      order.assignedTo = 'admin'; // Keep assigned to admin

      // Add admin fulfillment notes
      if (note) {
        order.notes = `${order.notes || ''}\n[Admin Warehouse Fulfillment] ${note}`.trim();
      }

      // Set delivery date if provided
      if (deliveryDate) {
        order.expectedDeliveryDate = new Date(deliveryDate);
      } else {
        // Default: set delivery date to 4 hours from now
        order.expectedDeliveryDate = new Date(Date.now() + 4 * 60 * 60 * 1000);
      }

      // Add tracking number if provided
      if (trackingNumber) {
        order.trackingNumber = trackingNumber;
      }

      // Update status timeline
      order.statusTimeline.push({
        status: 'accepted',
        timestamp: new Date(),
        updatedBy: 'admin',
        note: `Order fulfilled from warehouse by admin. Status set to Accepted.${note ? ` Note: ${note}` : ''}`,
      });

      // DEDUCT STOCK FROM ADMIN INVENTORY
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          // Deduct Global Stock
          product.stock = Math.max(0, (product.stock || 0) - item.quantity);
          if (product.displayStock) {
            product.displayStock = Math.max(0, (product.displayStock || 0) - item.quantity);
          }

          // Deduct Attribute Stock
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
              matchingVariant.stock = Math.max(0, (matchingVariant.stock || 0) - item.quantity);
              if (matchingVariant.displayStock) {
                matchingVariant.displayStock = Math.max(0, (matchingVariant.displayStock || 0) - item.quantity);
              }
              console.log(`📦 ADMIN Variant Stock reduced for ${product.name}: ${item.quantity}`);
            }
          }
          await product.save();
          console.log(`📦 ADMIN Global Stock reduced for ${product.name}: ${item.quantity}`);
        }
      }

      await order.save();

      // SEND VENDOR NOTIFICATION: Escalation Accepted
      if (order.escalation && order.escalation.originalVendorId) {
        try {
          const VendorNotification = require('../models/VendorNotification');
          await VendorNotification.createNotification({
            vendorId: order.escalation.originalVendorId,
            type: 'order_status_changed',
            title: 'Escalation Accepted',
            message: `Your escalated order #${order.orderNumber} has been accepted by Admin and will be fulfilled from the warehouse.`,
            relatedEntityType: 'order',
            relatedEntityId: order._id,
            priority: 'normal',
            metadata: { orderNumber: order.orderNumber, status: 'accepted' }
          });
        } catch (notifError) {
          console.error('Failed to send escalation accepted notification:', notifError);
        }
      }

      console.log(`✅ Escalated order ${order.orderNumber} fulfilled from warehouse by admin. Previous status: ${previousStatus}`);

      res.status(200).json({
        success: true,
        data: {
          order: {
            id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            assignedTo: order.assignedTo,
            expectedDeliveryDate: order.expectedDeliveryDate,
            trackingNumber: order.trackingNumber,
          },
          message: 'Order fulfilled from warehouse successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Revert escalation back to vendor
   * @route   POST /api/admin/orders/:orderId/revert-escalation
   * @access  Private (Admin)
   */
  exports.revertEscalation = async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Revert reason is required',
        });
      }

      const order = await Order.findById(orderId)
        .populate('userId', 'name phone email location')
        .populate('escalation.originalVendorId', 'name phone location');

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      // Check if order is escalated
      if (!order.escalation?.isEscalated || order.assignedTo !== 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Order is not escalated to admin',
        });
      }

      // Check if order can be reverted (not delivered or cancelled)
      if (order.status === 'delivered' || order.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: `Cannot revert order with status: ${order.status}`,
        });
      }

      // Get original vendor
      const originalVendor = order.escalation.originalVendorId;
      if (!originalVendor) {
        return res.status(400).json({
          success: false,
          message: 'Original vendor not found. Cannot revert escalation.',
        });
      }

      // Revert escalation - assign back to vendor
      // Handle case where vendorId might already be set (no error if same)
      if (order.vendorId && order.vendorId.toString() !== originalVendor._id.toString()) {
        // If vendorId exists but is different, update it
        order.vendorId = originalVendor._id;
      } else if (!order.vendorId) {
        // If vendorId doesn't exist, set it
        order.vendorId = originalVendor._id;
      }
      // If vendorId is already the same, no need to change it

      order.assignedTo = 'vendor';
      order.status = 'pending'; // Reset to pending for vendor to handle

      // Update escalation tracking
      order.escalation.revertedAt = new Date();
      order.escalation.revertedBy = req.admin._id;
      order.escalation.revertReason = reason;

      // Add notes
      order.notes = `${order.notes || ''}\n[Admin Revert] Order reverted back to vendor ${originalVendor.name}. Reason: ${reason}`.trim();

      // Update status timeline
      order.statusTimeline.push({
        status: 'pending',
        timestamp: new Date(),
        updatedBy: 'admin',
        note: `Escalation reverted back to vendor ${originalVendor.name}. Reason: ${reason}`,
      });

      await order.save();

      // TODO: Send notification to vendor

      console.log(`✅ Escalation reverted for order ${order.orderNumber} back to vendor ${originalVendor.name}`);

      res.status(200).json({
        success: true,
        data: {
          order: {
            id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            assignedTo: order.assignedTo,
            vendorId: order.vendorId,
            vendor: {
              id: originalVendor._id,
              name: originalVendor.name,
              phone: originalVendor.phone,
              location: originalVendor.location,
            },
          },
          message: 'Escalation reverted successfully. Order assigned back to vendor.',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Reassign order to different vendor
   * @route   PUT /api/admin/orders/:orderId/reassign
   * @access  Private (Admin)
   */
  exports.reassignOrder = async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const { vendorId, reason } = req.body;

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          message: 'Vendor ID is required',
        });
      }

      const order = await Order.findById(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      // Check if order can be reassigned
      if (order.status === 'delivered' || order.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: `Cannot reassign order with status: ${order.status}`,
        });
      }

      // Check if new vendor exists and is approved
      const newVendor = await Vendor.findById(vendorId);
      if (!newVendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      if (newVendor.status !== 'approved' || !newVendor.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Vendor must be approved and active',
        });
      }

      // Check if vendor is same
      if (order.vendorId && order.vendorId.toString() === vendorId) {
        return res.status(400).json({
          success: false,
          message: 'Order is already assigned to this vendor',
        });
      }

      const oldVendorId = order.vendorId;

      // Reassign order
      order.vendorId = vendorId;
      order.assignedTo = 'vendor';

      // Add note to order if reason provided
      if (reason) {
        order.notes = `${order.notes || ''}\n[Reassigned by Admin] ${reason}`.trim();
      }

      // Update status timeline
      order.statusTimeline.push({
        status: order.status,
        timestamp: new Date(),
        updatedBy: 'admin',
        note: `Order reassigned to vendor: ${newVendor.name}${reason ? ` - Reason: ${reason}` : ''}`,
      });

      await order.save();

      // TODO: Send notifications
      // - Notify old vendor (if exists)
      // - Notify new vendor
      // - Notify user

      console.log(`✅ Order ${order.orderNumber} reassigned from vendor ${oldVendorId} to ${vendorId}`);

      res.status(200).json({
        success: true,
        data: {
          order,
          oldVendorId,
          newVendor: {
            id: newVendor._id,
            name: newVendor.name,
            phone: newVendor.phone,
          },
          message: 'Order reassigned successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Update order status (for admin-fulfilled orders)
   * @route   PUT /api/admin/orders/:orderId/status
   * @access  Private (Admin)
   */
  exports.updateOrderStatus = async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const { status, notes, isRevert, finalizeGracePeriod } = req.body;

      // If finalizing grace period, status is not required
      if (!finalizeGracePeriod && !status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required',
        });
      }

      // Valid status transitions for admin (only validate if status is provided)
      if (status) {
        const validStatuses = ['awaiting', 'accepted', 'processing', 'dispatched', 'delivered', 'fully_paid'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
          });
        }
      }

      const order = await Order.findById(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
        });
      }

      // Admin can update status for any order (vendor-assigned or admin-assigned)
      // No restriction needed

      const normalizeStatusValue = (value) => {
        if (!value) {
          return ORDER_STATUS.AWAITING;
        }
        const normalized = value.toString().toLowerCase();
        if (normalized === ORDER_STATUS.PENDING) {
          return ORDER_STATUS.AWAITING;
        }
        if (normalized === ORDER_STATUS.PROCESSING) {
          return ORDER_STATUS.ACCEPTED;
        }
        return normalized;
      };

      const paymentPreference = order.paymentPreference || 'partial';
      const normalizedCurrentStatus = normalizeStatusValue(order.status);
      const normalizedNewStatus = status === ORDER_STATUS.FULLY_PAID
        ? ORDER_STATUS.FULLY_PAID
        : normalizeStatusValue(status);

      const statusFlow = paymentPreference === 'partial'
        ? [ORDER_STATUS.AWAITING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.DISPATCHED, ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID]
        : [ORDER_STATUS.AWAITING, ORDER_STATUS.ACCEPTED, ORDER_STATUS.DISPATCHED, ORDER_STATUS.DELIVERED];

      const finalStageStatus = paymentPreference === 'partial'
        ? ORDER_STATUS.FULLY_PAID
        : ORDER_STATUS.DELIVERED;

      // Check if there's an active status update grace period that hasn't expired
      const now = new Date();
      const hasActiveGracePeriod = order.statusUpdateGracePeriod?.isActive &&
        order.statusUpdateGracePeriod.expiresAt > now;

      // Allow finalizing grace period without status change
      if (finalizeGracePeriod === true && hasActiveGracePeriod) {
        order.statusUpdateGracePeriod.isActive = false;
        order.statusUpdateGracePeriod.finalizedAt = now;
        await order.save();
        return res.status(200).json({
          success: true,
          data: {
            order: {
              id: order._id,
              orderNumber: order.orderNumber,
              status: order.status,
              paymentStatus: order.paymentStatus,
              statusUpdateGracePeriod: order.statusUpdateGracePeriod,
            },
            message: 'Status update grace period finalized successfully.',
          },
        });
      }

      if (hasActiveGracePeriod) {
        // During grace period, only allow reverting to previous status
        const isReverting = order.statusUpdateGracePeriod.previousStatus === status;

        if (!isReverting) {
          return res.status(400).json({
            success: false,
            message: `Cannot update status. Previous status update is still in grace period. Please wait for it to finalize (expires in ${Math.ceil((order.statusUpdateGracePeriod.expiresAt - now) / 1000 / 60)} minutes) or revert to previous status.`,
          });
        }
      } else if (order.statusUpdateGracePeriod?.isActive && order.statusUpdateGracePeriod.expiresAt <= now) {
        // Grace period expired, finalize it
        order.statusUpdateGracePeriod.isActive = false;
        order.statusUpdateGracePeriod.finalizedAt = now;
        order.statusUpdateGracePeriod.previousPaymentStatus = undefined;
        order.statusUpdateGracePeriod.previousRemainingAmount = undefined;
      }

      if (!hasActiveGracePeriod && normalizedCurrentStatus === finalStageStatus) {
        return res.status(400).json({
          success: false,
          message: 'Order has already completed its workflow. Further updates are not allowed.',
        });
      }

      if (normalizedNewStatus === ORDER_STATUS.FULLY_PAID) {
        if (paymentPreference !== 'partial') {
          return res.status(400).json({
            success: false,
            message: 'Fully paid status is only applicable for partial payment orders.',
          });
        }
        if (normalizedCurrentStatus !== ORDER_STATUS.DELIVERED) {
          return res.status(400).json({
            success: false,
            message: 'Order must be delivered before marking as fully paid.',
          });
        }
      }

      // If reverting to previous status during grace period, allow it
      // Also check if isRevert flag is explicitly set
      const isReverting = (hasActiveGracePeriod &&
        order.statusUpdateGracePeriod.previousStatus === normalizedNewStatus) ||
        (isRevert === true);

      const currentIndex = statusFlow.indexOf(normalizedCurrentStatus);
      const newIndex = statusFlow.indexOf(normalizedNewStatus);

      if (newIndex === -1 && normalizedNewStatus !== ORDER_STATUS.FULLY_PAID && !isReverting) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status. ${status} is not part of the workflow for this payment preference.`,
        });
      }

      if (!isReverting && normalizedNewStatus !== ORDER_STATUS.FULLY_PAID && newIndex !== -1 && newIndex <= currentIndex) {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from ${order.status} to ${status}. Invalid transition.`,
        });
      }

      // Store previous status for grace period (only if not reverting)
      const previousStatus = normalizeStatusValue(order.status);
      const isStatusChange = normalizedNewStatus !== previousStatus;

      const startGracePeriod = (extra = {}) => {
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
        order.statusUpdateGracePeriod = {
          isActive: true,
          previousStatus,
          updatedAt: now,
          expiresAt,
          updatedBy: 'admin',
          previousPaymentStatus: undefined,
          previousRemainingAmount: undefined,
          ...extra,
        };
      };

      const finalizeStatusUpdateGracePeriod = () => {
        order.statusUpdateGracePeriod.isActive = false;
        order.statusUpdateGracePeriod.finalizedAt = now;
      };

      if (normalizedNewStatus === ORDER_STATUS.FULLY_PAID) {
        const previousPaymentStatus = order.paymentStatus;
        const previousRemainingAmount = order.remainingAmount;

        order.status = ORDER_STATUS.FULLY_PAID;
        order.paymentStatus = PAYMENT_STATUS.FULLY_PAID;
        order.remainingAmount = 0;

        // For fully_paid status, no grace period - finalize immediately
        if (!isReverting && isStatusChange) {
          // Finalize any existing grace period if present
          if (order.statusUpdateGracePeriod?.isActive) {
            finalizeStatusUpdateGracePeriod();
          }
          // Don't start a new grace period for fully_paid
          // Status is immediately finalized
        } else if (isReverting && order.statusUpdateGracePeriod?.isActive) {
          order.paymentStatus = order.statusUpdateGracePeriod.previousPaymentStatus || previousPaymentStatus;
          if (typeof order.statusUpdateGracePeriod.previousRemainingAmount === 'number') {
            order.remainingAmount = order.statusUpdateGracePeriod.previousRemainingAmount;
          }
          finalizeStatusUpdateGracePeriod();
        } else if (order.statusUpdateGracePeriod?.isActive) {
          // If there's an active grace period, finalize it
          finalizeStatusUpdateGracePeriod();
        }
      } else {
        order.status = normalizedNewStatus;

        if (isStatusChange && !isReverting) {
          startGracePeriod();
        } else if (isReverting && order.statusUpdateGracePeriod?.isActive) {
          if (order.statusUpdateGracePeriod.previousPaymentStatus) {
            order.paymentStatus = order.statusUpdateGracePeriod.previousPaymentStatus;
          }
          if (typeof order.statusUpdateGracePeriod.previousRemainingAmount === 'number') {
            order.remainingAmount = order.statusUpdateGracePeriod.previousRemainingAmount;
          }
          finalizeStatusUpdateGracePeriod();
        }
      }

      // Update delivery date if delivered
      if (normalizedNewStatus === ORDER_STATUS.DELIVERED && !order.deliveredAt) {
        order.deliveredAt = new Date();
      }

      // Add notes if provided
      if (notes) {
        order.notes = `${order.notes || ''}\n[Admin Status Update] ${notes}`.trim();
      }

      const timelineStatus = order.status;
      const timelineNote = isReverting
        ? (notes ? `Status reverted to ${timelineStatus} from ${previousStatus}. Note: ${notes}` : `Status reverted to ${timelineStatus} from ${previousStatus}`)
        : (notes ? `Status updated from ${previousStatus} to ${timelineStatus}. Note: ${notes}` : `Status updated from ${previousStatus} to ${timelineStatus}`);

      order.statusTimeline.push({
        status: timelineStatus,
        timestamp: now,
        updatedBy: 'admin',
        note: timelineNote,
      });

      await order.save();

      // Send notification to user about order status change
      try {
        if (order.userId && isStatusChange && !isReverting) {
          await UserNotification.createOrderStatusNotification(
            order.userId,
            order,
            normalizedNewStatus
          );
          console.log(`📱 User notification sent for order ${order.orderNumber} status: ${normalizedNewStatus}`);
        }
      } catch (notifError) {
        // Don't fail the request if notification fails
        console.error('Failed to send user notification:', notifError);
      }

      // For fully_paid status, no grace period message
      const hasGracePeriod = isStatusChange && normalizedNewStatus !== ORDER_STATUS.FULLY_PAID && order.statusUpdateGracePeriod?.isActive;

      const message = isReverting
        ? `Order status reverted to ${timelineStatus}`
        : normalizedNewStatus === ORDER_STATUS.FULLY_PAID
          ? `Order status updated to ${timelineStatus}. Payment completed.`
          : isStatusChange
            ? `Order status updated to ${timelineStatus}. You have 1 hour to revert this change.`
            : `Order status updated to ${timelineStatus} successfully`;

      console.log(`✅ Order ${order.orderNumber} status updated to ${status} by admin${hasGracePeriod ? ' (grace period active)' : normalizedNewStatus === ORDER_STATUS.FULLY_PAID ? ' (no grace period - immediately finalized)' : ''}`);

      res.status(200).json({
        success: true,
        data: {
          order: {
            id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            statusUpdateGracePeriod: order.statusUpdateGracePeriod,
          },
          message,
          gracePeriod: hasGracePeriod ? {
            isActive: true,
            expiresAt: order.statusUpdateGracePeriod.expiresAt,
            previousStatus: order.statusUpdateGracePeriod.previousStatus,
          } : null,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get all payments with filtering and pagination
   * @route   GET /api/admin/payments
   * @access  Private (Admin)
   */
  exports.getPayments = async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        paymentMethod,
        paymentType,
        userId,
        orderId,
        dateFrom,
        dateTo,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      // Build query
      const query = {};

      if (status) {
        query.status = status;
      }

      if (paymentMethod) {
        query.paymentMethod = paymentMethod;
      }

      if (paymentType) {
        query.paymentType = paymentType;
      }

      if (userId) {
        query.userId = userId;
      }

      if (orderId) {
        query.orderId = orderId;
      }

      // Date range filter
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) {
          query.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }

      // Search by payment ID or gateway payment ID
      if (search) {
        query.$or = [
          { paymentId: { $regex: search, $options: 'i' } },
          { gatewayPaymentId: { $regex: search, $options: 'i' } },
        ];
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const payments = await Payment.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('orderId', 'orderNumber totalAmount status')
        .populate('userId', 'name phone email')
        .select('-__v -gatewayResponse')
        .lean();

      const total = await Payment.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          payments,
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
  // FINANCE & CREDIT MANAGEMENT CONTROLLERS
  // ============================================================================

  /**
   * @desc    Get all vendor credits summary
   * @route   GET /api/admin/finance/credits
   * @access  Private (Admin)
   */
  exports.getCredits = async (req, res, next) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      // Build query for vendors with credit
      const query = {
        status: 'approved',
        isActive: true,
        creditUsed: { $gt: 0 }, // Only vendors with outstanding credit
      };

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get vendors with credit details
      const vendors = await Vendor.find(query)
        .sort({ creditUsed: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('name phone creditLimit creditUsed creditPolicy location')
        .lean();

      // Calculate credit information for each vendor
      const creditDetails = vendors.map(vendor => {
        const remaining = vendor.creditPolicy.limit - vendor.creditUsed;
        const utilization = vendor.creditPolicy.limit > 0
          ? (vendor.creditUsed / vendor.creditPolicy.limit) * 100
          : 0;

        // Check if overdue
        const now = new Date();
        const dueDate = vendor.creditPolicy.dueDate;
        const isOverdue = dueDate && now > dueDate;
        const daysOverdue = isOverdue && dueDate
          ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24))
          : 0;

        // Calculate penalty if overdue
        let penalty = 0;
        if (isOverdue && vendor.creditPolicy.penaltyRate > 0) {
          const dailyPenaltyRate = vendor.creditPolicy.penaltyRate / 100;
          penalty = vendor.creditUsed * dailyPenaltyRate * daysOverdue;
        }

        // Determine status
        let creditStatus = 'active';
        if (isOverdue) {
          creditStatus = daysOverdue <= 7 ? 'dueSoon' : 'overdue';
        } else if (dueDate) {
          const daysUntilDue = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));
          if (daysUntilDue <= 7) {
            creditStatus = 'dueSoon';
          }
        }

        return {
          vendorId: vendor._id,
          vendorName: vendor.name,
          vendorPhone: vendor.phone,
          location: vendor.location,
          creditLimit: vendor.creditPolicy.limit,
          creditUsed: vendor.creditUsed,
          creditRemaining: remaining,
          creditUtilization: Math.round(utilization * 100) / 100,
          dueDate: vendor.creditPolicy.dueDate,
          isOverdue,
          daysOverdue,
          penalty,
          penaltyRate: vendor.creditPolicy.penaltyRate,
          status: creditStatus,
        };
      });

      // Aggregate totals
      const totalOutstanding = vendors.reduce((sum, v) => sum + v.creditUsed, 0);
      const totalLimit = vendors.reduce((sum, v) => sum + v.creditPolicy.limit, 0);
      const overdueCount = creditDetails.filter(c => c.isOverdue).length;
      const dueSoonCount = creditDetails.filter(c => c.status === 'dueSoon' && !c.isOverdue).length;
      const totalPenalty = creditDetails.reduce((sum, c) => sum + c.penalty, 0);

      const total = await Vendor.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          credits: creditDetails,
          summary: {
            totalVendors: total,
            totalOutstanding,
            totalLimit,
            totalRemaining: totalLimit - totalOutstanding,
            totalUtilization: totalLimit > 0
              ? Math.round((totalOutstanding / totalLimit) * 100 * 100) / 100
              : 0,
            overdueCount,
            dueSoonCount,
            totalPenalty: Math.round(totalPenalty * 100) / 100,
          },
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
   * @desc    Get vendor credit history
   * @route   GET /api/admin/finance/vendors/:vendorId/history
   * @access  Private (Admin)
   */
  exports.getVendorCreditHistory = async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { page = 1, limit = 20, startDate, endDate } = req.query;

      const vendor = await Vendor.findById(vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      // Build query for credit purchases and payments
      const query = { vendorId };

      // Date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          const toDate = new Date(endDate);
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get credit purchases
      const creditPurchases = await CreditPurchase.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('items.productId', 'name sku')
        .select('-__v');

      // Get payments related to this vendor (through orders)
      const vendorOrders = await Order.find({ vendorId }).select('_id orderNumber');
      const orderIds = vendorOrders.map(o => o._id);

      const payments = await Payment.find({ orderId: { $in: orderIds } })
        .sort({ createdAt: -1 })
        .populate('orderId', 'orderNumber totalAmount')
        .select('-__v')
        .limit(limitNum);

      const totalPurchases = await CreditPurchase.countDocuments(query);

      // Transform credit purchases to history format
      const history = [
        ...creditPurchases.map(purchase => ({
          id: purchase._id,
          type: 'credit_purchase',
          amount: purchase.totalAmount,
          date: purchase.createdAt,
          description: `Credit purchase - ${purchase.items.length} item(s)`,
          status: purchase.status,
          products: purchase.items.map(item => ({
            name: item.productId?.name || item.productName,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
        })),
        ...payments.map(payment => ({
          id: payment._id,
          type: 'repayment',
          amount: payment.amount,
          date: payment.createdAt,
          description: `Repayment for Order ${payment.orderId?.orderNumber || 'N/A'}`,
          status: payment.status === 'fully_paid' ? 'completed' : payment.status,
          orderNumber: payment.orderId?.orderNumber,
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      res.status(200).json({
        success: true,
        data: {
          vendor: {
            id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
            creditLimit: vendor.creditPolicy.limit,
            creditUsed: vendor.creditUsed,
            creditRemaining: vendor.creditPolicy.limit - vendor.creditUsed,
          },
          history: history.slice(0, limitNum),
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalPurchases / limitNum),
            totalItems: history.length,
            itemsPerPage: limitNum,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get financial parameters
   * @route   GET /api/admin/finance/parameters
   * @access  Private (Admin)
   */
  exports.getFinancialParameters = async (req, res, next) => {
    try {
      const { ADVANCE_PAYMENT_PERCENTAGE, MIN_ORDER_VALUE, MIN_VENDOR_PURCHASE } = require('../utils/constants');

      // Try to get from database, fallback to constants
      const financialParams = await Settings.getSetting('FINANCIAL_PARAMETERS', {
        userAdvancePaymentPercent: ADVANCE_PAYMENT_PERCENTAGE,
        minimumUserOrder: MIN_ORDER_VALUE,
        minimumVendorPurchase: MIN_VENDOR_PURCHASE,
      });

      res.status(200).json({
        success: true,
        data: {
          userAdvancePaymentPercent: financialParams.userAdvancePaymentPercent || ADVANCE_PAYMENT_PERCENTAGE,
          minimumUserOrder: financialParams.minimumUserOrder || MIN_ORDER_VALUE,
          minimumVendorPurchase: financialParams.minimumVendorPurchase || MIN_VENDOR_PURCHASE,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Update financial parameters
   * @route   PUT /api/admin/finance/parameters
   * @access  Private (Admin)
   */
  exports.updateFinancialParameters = async (req, res, next) => {
    try {
      const { userAdvancePaymentPercent, minimumUserOrder, minimumVendorPurchase } = req.body;
      const adminId = req.admin?.id || req.user?.id; // Get admin ID from auth middleware

      // Validation
      if (userAdvancePaymentPercent !== undefined) {
        if (typeof userAdvancePaymentPercent !== 'number' || userAdvancePaymentPercent < 0 || userAdvancePaymentPercent > 100) {
          return res.status(400).json({
            success: false,
            message: 'Advance payment percentage must be a number between 0 and 100.',
          });
        }
      }

      if (minimumUserOrder !== undefined) {
        if (typeof minimumUserOrder !== 'number' || minimumUserOrder < 0) {
          return res.status(400).json({
            success: false,
            message: 'Minimum order value must be a positive number.',
          });
        }
      }

      if (minimumVendorPurchase !== undefined) {
        if (typeof minimumVendorPurchase !== 'number' || minimumVendorPurchase < 0) {
          return res.status(400).json({
            success: false,
            message: 'Minimum vendor purchase must be a positive number.',
          });
        }
      }

      // Get current values from database or constants
      const { ADVANCE_PAYMENT_PERCENTAGE, MIN_ORDER_VALUE, MIN_VENDOR_PURCHASE } = require('../utils/constants');
      const currentParams = await Settings.getSetting('FINANCIAL_PARAMETERS', {
        userAdvancePaymentPercent: ADVANCE_PAYMENT_PERCENTAGE,
        minimumUserOrder: MIN_ORDER_VALUE,
        minimumVendorPurchase: MIN_VENDOR_PURCHASE,
      });

      // Update only provided values
      const updatedParams = {
        userAdvancePaymentPercent: userAdvancePaymentPercent !== undefined ? userAdvancePaymentPercent : currentParams.userAdvancePaymentPercent,
        minimumUserOrder: minimumUserOrder !== undefined ? minimumUserOrder : currentParams.minimumUserOrder,
        minimumVendorPurchase: minimumVendorPurchase !== undefined ? minimumVendorPurchase : currentParams.minimumVendorPurchase,
      };

      // Save to database
      await Settings.setSetting(
        'FINANCIAL_PARAMETERS',
        updatedParams,
        'Financial parameters: Advance payment %, Minimum order value, Minimum vendor purchase',
        adminId
      );

      res.status(200).json({
        success: true,
        message: 'Financial parameters updated successfully.',
        data: updatedParams,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get credit recovery status
   * @route   GET /api/admin/finance/recovery
   * @access  Private (Admin)
   */
  exports.getRecoveryStatus = async (req, res, next) => {
    try {
      const { period = '30' } = req.query; // days

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));

      // Get all vendors with credit
      const vendorsWithCredit = await Vendor.find({
        status: 'approved',
        isActive: true,
        creditUsed: { $gt: 0 },
      }).select('creditUsed creditPolicy approvedAt');

      // Calculate recovery statistics
      const totalOutstanding = vendorsWithCredit.reduce((sum, v) => sum + v.creditUsed, 0);

      // Get completed credit purchases (for recovery tracking)
      const completedPurchases = await CreditPurchase.find({
        status: 'approved',
        createdAt: { $gte: daysAgo },
      }).select('totalAmount createdAt');

      // Calculate recovered amount (simplified - assumes payments reduce credit)
      // In production, this would track actual repayments
      const recoveredAmount = completedPurchases.length > 0
        ? completedPurchases.reduce((sum, p) => sum + p.totalAmount, 0)
        : 0;

      // Calculate overdue vendors
      const now = new Date();
      const overdueVendors = vendorsWithCredit.filter(vendor => {
        if (!vendor.creditPolicy.dueDate) return false;
        return now > vendor.creditPolicy.dueDate;
      });

      const overdueAmount = overdueVendors.reduce((sum, v) => sum + v.creditUsed, 0);

      // Calculate recovery rate (percentage)
      const totalCreditEver = totalOutstanding + recoveredAmount;
      const recoveryRate = totalCreditEver > 0
        ? (recoveredAmount / totalCreditEver) * 100
        : 0;

      // Calculate average recovery time (simplified)
      const averageRecoveryDays = completedPurchases.length > 0
        ? completedPurchases.reduce((sum, p) => {
          const daysSince = Math.floor((now - p.createdAt) / (1000 * 60 * 60 * 24));
          return sum + daysSince;
        }, 0) / completedPurchases.length
        : 0;

      res.status(200).json({
        success: true,
        data: {
          period: parseInt(period),
          recovery: {
            totalOutstanding,
            overdueAmount,
            recoveredAmount,
            pendingAmount: totalOutstanding - recoveredAmount,
            recoveryRate: Math.round(recoveryRate * 100) / 100,
          },
          statistics: {
            totalVendorsWithCredit: vendorsWithCredit.length,
            overdueVendors: overdueVendors.length,
            completedPurchases: completedPurchases.length,
            averageRecoveryDays: Math.round(averageRecoveryDays * 100) / 100,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // ANALYTICS & REPORTING CONTROLLERS
  // ============================================================================

  /**
   * @desc    Get analytics data
   * @route   GET /api/admin/analytics
   * @access  Private (Admin)
   */
  exports.getAnalytics = async (req, res, next) => {
    try {
      const { period = '30' } = req.query; // days

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(period));

      // Revenue trends
      const revenueTrends = await Order.aggregate([
        {
          $match: {
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
            revenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      // Order trends
      const orderTrends = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: daysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
            delivered: {
              $sum: {
                $cond: [
                  { $in: ['$status', [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID]] },
                  1,
                  0,
                ],
              },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      // Top vendors by revenue
      const topVendors = await Order.aggregate([
        {
          $match: {
            status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
            paymentStatus: PAYMENT_STATUS.FULLY_PAID,
            createdAt: { $gte: daysAgo },
            vendorId: { $ne: null },
          },
        },
        {
          $group: {
            _id: '$vendorId',
            revenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
          },
        },
        {
          $sort: { revenue: -1 },
        },
        {
          $limit: 10,
        },
        {
          $lookup: {
            from: 'vendors',
            localField: '_id',
            foreignField: '_id',
            as: 'vendor',
          },
        },
        {
          $unwind: '$vendor',
        },
        {
          $project: {
            vendorId: '$vendor._id',
            vendorName: '$vendor.name',
            vendorPhone: '$vendor.phone',
            revenue: 1,
            orderCount: 1,
          },
        },
      ]);

      // Top sellers by referrals/revenue
      const topSellers = await Order.aggregate([
        {
          $match: {
            status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
            paymentStatus: PAYMENT_STATUS.FULLY_PAID,
            createdAt: { $gte: daysAgo },
            sellerId: { $ne: null },
          },
        },
        {
          $group: {
            _id: '$sellerId',
            revenue: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        {
          $project: {
            revenue: 1,
            orderCount: 1,
            referralCount: { $size: '$uniqueUsers' },
          },
        },
        {
          $sort: { revenue: -1 },
        },
        {
          $limit: 10,
        },
      ]);

      // Product performance
      const topProducts = await Order.aggregate([
        {
          $match: {
            status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
            paymentStatus: PAYMENT_STATUS.FULLY_PAID,
            createdAt: { $gte: daysAgo },
          },
        },
        {
          $unwind: '$items',
        },
        {
          $group: {
            _id: '$items.productId',
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.totalPrice' },
            orderCount: { $sum: 1 },
          },
        },
        {
          $sort: { totalRevenue: -1 },
        },
        {
          $limit: 10,
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        {
          $unwind: '$product',
        },
        {
          $project: {
            productId: '$product._id',
            productName: '$product.name',
            productSku: '$product.sku',
            category: '$product.category',
            totalQuantity: 1,
            totalRevenue: 1,
            orderCount: 1,
          },
        },
      ]);

      res.status(200).json({
        success: true,
        data: {
          period: parseInt(period),
          analytics: {
            revenueTrends,
            orderTrends,
            topVendors,
            topSellers,
            topProducts,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Generate reports
   * @route   GET /api/admin/reports
   * @access  Private (Admin)
   */
  exports.generateReports = async (req, res, next) => {
    try {
      const { type = 'summary', period = 'monthly', format = 'json' } = req.query;

      // Calculate date range based on period
      const now = new Date();
      let startDate = new Date();
      let periodLabel = '';

      switch (period) {
        case 'daily':
          startDate.setDate(now.getDate() - 1);
          periodLabel = 'Last 24 Hours';
          break;
        case 'weekly':
          startDate.setDate(now.getDate() - 7);
          periodLabel = 'Last 7 Days';
          break;
        case 'monthly':
          startDate.setMonth(now.getMonth() - 1);
          periodLabel = 'Last 30 Days';
          break;
        case 'yearly':
          startDate.setFullYear(now.getFullYear() - 1);
          periodLabel = 'Last Year';
          break;
        default:
          startDate.setMonth(now.getMonth() - 1);
          periodLabel = 'Last 30 Days';
      }

      // Generate report data based on type
      let reportData = {};

      if (type === 'summary' || type === 'full') {
        // Order summary
        const orderSummary = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
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

        // Revenue summary
        const revenueSummary = await Order.aggregate([
          {
            $match: {
              status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
              paymentStatus: PAYMENT_STATUS.FULLY_PAID,
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$totalAmount' },
              orderCount: { $sum: 1 },
              averageOrderValue: { $avg: '$totalAmount' },
            },
          },
        ]);

        // User registration summary
        const userSummary = await User.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ]);

        reportData = {
          period: periodLabel,
          startDate,
          endDate: now,
          orderSummary,
          revenueSummary: revenueSummary[0] || {},
          userSummary,
        };
      }

      // For now, return JSON format
      // TODO: Add CSV/PDF export functionality when needed
      if (format === 'csv' || format === 'pdf') {
        return res.status(501).json({
          success: false,
          message: 'CSV/PDF export functionality will be implemented later',
        });
      }

      res.status(200).json({
        success: true,
        data: {
          report: reportData,
          generatedAt: new Date(),
          format,
          type,
          period,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // OPERATIONS & LOGISTICS CONTROLLERS
  // ============================================================================

  /**
   * @desc    Get logistics settings
   * @route   GET /api/admin/operations/logistics-settings
   * @access  Private (Admin)
   */
  exports.getLogisticsSettings = async (req, res, next) => {
    try {
      const { DELIVERY_TIMELINE_HOURS } = require('../utils/constants');

      // Try to get from database, fallback to constants
      const logisticsSettings = await Settings.getSetting('LOGISTICS_SETTINGS', {
        defaultDeliveryTime: DELIVERY_TIMELINE_HOURS === 3 ? '3h' : DELIVERY_TIMELINE_HOURS === 4 ? '4h' : '1d',
        availableDeliveryOptions: ['3h', '4h', '1d'],
        enableExpressDelivery: true,
        enableStandardDelivery: true,
        enableNextDayDelivery: true,
        deliveryTimelineHours: DELIVERY_TIMELINE_HOURS,
      });

      res.status(200).json({
        success: true,
        data: logisticsSettings,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Update logistics settings
   * @route   PUT /api/admin/operations/logistics-settings
   * @access  Private (Admin)
   */
  exports.updateLogisticsSettings = async (req, res, next) => {
    try {
      const { defaultDeliveryTime, availableDeliveryOptions, enableExpressDelivery, enableStandardDelivery, enableNextDayDelivery } = req.body;
      const adminId = req.admin?.id || req.user?.id;

      // Validation
      if (defaultDeliveryTime && !['3h', '4h', '1d'].includes(defaultDeliveryTime)) {
        return res.status(400).json({
          success: false,
          message: 'Default delivery time must be one of: 3h, 4h, 1d',
        });
      }

      // Get current settings
      const { DELIVERY_TIMELINE_HOURS } = require('../utils/constants');
      const currentSettings = await Settings.getSetting('LOGISTICS_SETTINGS', {
        defaultDeliveryTime: DELIVERY_TIMELINE_HOURS === 3 ? '3h' : DELIVERY_TIMELINE_HOURS === 4 ? '4h' : '1d',
        availableDeliveryOptions: ['3h', '4h', '1d'],
        enableExpressDelivery: true,
        enableStandardDelivery: true,
        enableNextDayDelivery: true,
      });

      // Update only provided values
      const updatedSettings = {
        defaultDeliveryTime: defaultDeliveryTime !== undefined ? defaultDeliveryTime : currentSettings.defaultDeliveryTime,
        availableDeliveryOptions: availableDeliveryOptions !== undefined ? availableDeliveryOptions : currentSettings.availableDeliveryOptions,
        enableExpressDelivery: enableExpressDelivery !== undefined ? enableExpressDelivery : currentSettings.enableExpressDelivery,
        enableStandardDelivery: enableStandardDelivery !== undefined ? enableStandardDelivery : currentSettings.enableStandardDelivery,
        enableNextDayDelivery: enableNextDayDelivery !== undefined ? enableNextDayDelivery : currentSettings.enableNextDayDelivery,
      };

      // Save to database
      await Settings.setSetting(
        'LOGISTICS_SETTINGS',
        updatedSettings,
        'Logistics settings: Delivery times and options',
        adminId
      );

      res.status(200).json({
        success: true,
        message: 'Logistics settings updated successfully',
        data: updatedSettings,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get all platform notifications
   * @route   GET /api/admin/operations/notifications
   * @access  Private (Admin)
   */
  exports.getNotifications = async (req, res, next) => {
    try {
      const { page = 1, limit = 50, targetAudience, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      // Build query
      const query = {};
      if (targetAudience) query.targetAudience = targetAudience;
      if (isActive !== undefined) query.isActive = isActive === 'true';

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Get notifications
      const notifications = await Notification.find(query)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v');

      const total = await Notification.countDocuments(query);

      res.status(200).json({
        success: true,
        data: {
          notifications,
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
   * @desc    Create platform notification
   * @route   POST /api/admin/operations/notifications
   * @access  Private (Admin)
   * 
   * Supports:
   * - targetMode: 'all' (broadcast to all in targetAudience) or 'specific' (specific recipients)
   * - targetRecipients: Array of vendor/seller/user IDs when targetMode is 'specific'
   */
  exports.createNotification = async (req, res, next) => {
    try {
      const {
        title,
        message,
        targetAudience,
        targetMode = 'all',
        targetRecipients = [],
        priority,
        isActive,
        actionUrl,
        actionText,
        startDate,
        endDate
      } = req.body;
      const adminId = req.admin?.id || req.user?.id;

      // Validation
      if (!title || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Notification title is required',
        });
      }
      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Notification message is required',
        });
      }

      // For specific targeting, validate recipients
      if (targetMode === 'specific' && (!targetRecipients || targetRecipients.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'At least one recipient is required when targeting specific users',
        });
      }

      // Create platform notification record
      const notification = await createNotification({
        title: title.trim(),
        message: message.trim(),
        targetAudience: targetAudience || 'all',
        targetMode: targetMode || 'all',
        targetRecipients: targetMode === 'specific' ? targetRecipients : [],
        priority: priority || 'normal',
        isActive: isActive !== undefined ? isActive : true,
        actionUrl,
        actionText,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        createdBy: adminId,
      });

      await notification.save();

      // Create individual notifications for recipients
      let recipientCount = 0;

      if (isActive !== false) {
        const notificationData = {
          title: title.trim(),
          message: message.trim(),
          type: 'admin_announcement',
          priority: priority || 'normal',
          relatedEntityType: 'none',
        };

        if (targetMode === 'specific' && targetRecipients.length > 0) {
          // Target specific recipients
          if (targetAudience === 'vendors') {
            const VendorNotification = require('../models/VendorNotification');
            for (const vendorId of targetRecipients) {
              try {
                await VendorNotification.createNotification({
                  vendorId,
                  ...notificationData,
                });
                recipientCount++;
              } catch (err) {
                console.error(`Failed to create vendor notification for ${vendorId}:`, err);
              }
            }
          } else if (targetAudience === 'sellers') {
            const SellerNotification = require('../models/SellerNotification');
            for (const sellerId of targetRecipients) {
              try {
                await SellerNotification.createNotification({
                  sellerId,
                  ...notificationData,
                });
                recipientCount++;
              } catch (err) {
                console.error(`Failed to create seller notification for ${sellerId}:`, err);
              }
            }
          } else if (targetAudience === 'users') {
            for (const userId of targetRecipients) {
              try {
                await UserNotification.createNotification({
                  userId,
                  ...notificationData,
                });
                recipientCount++;
              } catch (err) {
                console.error(`Failed to create user notification for ${userId}:`, err);
              }
            }
          }
        } else if (targetMode === 'all') {
          // Broadcast to all recipients in the target audience
          if (targetAudience === 'vendors' || targetAudience === 'all') {
            const VendorNotification = require('../models/VendorNotification');
            const vendors = await Vendor.find({ isActive: true, verification: { $ne: 'rejected' } }).select('_id');
            for (const vendor of vendors) {
              try {
                await VendorNotification.createNotification({
                  vendorId: vendor._id,
                  ...notificationData,
                });
                recipientCount++;
              } catch (err) {
                console.error(`Failed to create vendor notification:`, err);
              }
            }
          }
          if (targetAudience === 'sellers' || targetAudience === 'all') {
            const SellerNotification = require('../models/SellerNotification');
            const sellers = await Seller.find({ status: { $ne: 'rejected' } }).select('_id');
            for (const seller of sellers) {
              try {
                await SellerNotification.createNotification({
                  sellerId: seller._id,
                  ...notificationData,
                });
                recipientCount++;
              } catch (err) {
                console.error(`Failed to create seller notification:`, err);
              }
            }
          }
          if (targetAudience === 'users' || targetAudience === 'all') {
            const users = await User.find({ isBlocked: { $ne: true } }).select('_id');
            for (const user of users) {
              try {
                await UserNotification.createNotification({
                  userId: user._id,
                  ...notificationData,
                });
                recipientCount++;
              } catch (err) {
                console.error(`Failed to create user notification:`, err);
              }
            }
          }
        }

        // Update recipient count
        notification.recipientCount = recipientCount;
        await notification.save();
      }

      // Populate createdBy
      await notification.populate('createdBy', 'name email');

      res.status(201).json({
        success: true,
        message: `Notification created successfully. Sent to ${recipientCount} recipient(s).`,
        data: {
          notification,
          recipientCount,
        },
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: Object.values(error.errors).map(e => e.message).join(', '),
        });
      }
      next(error);
    }
  };


  /**
   * @desc    Update platform notification
   * @route   PUT /api/admin/operations/notifications/:notificationId
   * @access  Private (Admin)
   */
  exports.updateNotification = async (req, res, next) => {
    try {
      const { notificationId } = req.params;
      const { title, message, targetAudience, priority, isActive, actionUrl, actionText, startDate, endDate } = req.body;
      const adminId = req.admin?.id || req.user?.id;

      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      // Update fields
      if (title !== undefined) notification.title = title.trim();
      if (message !== undefined) notification.message = message.trim();
      if (targetAudience !== undefined) notification.targetAudience = targetAudience;
      if (priority !== undefined) notification.priority = priority;
      if (isActive !== undefined) notification.isActive = isActive;
      if (actionUrl !== undefined) notification.actionUrl = actionUrl;
      if (actionText !== undefined) notification.actionText = actionText;
      if (startDate !== undefined) notification.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) notification.endDate = endDate ? new Date(endDate) : null;
      notification.updatedBy = adminId;

      await notification.save();

      // Populate fields
      await notification.populate('createdBy', 'name email');
      await notification.populate('updatedBy', 'name email');

      res.status(200).json({
        success: true,
        message: 'Notification updated successfully',
        data: {
          notification,
        },
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: Object.values(error.errors).map(e => e.message).join(', '),
        });
      }
      next(error);
    }
  };

  /**
   * @desc    Delete platform notification
   * @route   DELETE /api/admin/operations/notifications/:notificationId
   * @access  Private (Admin)
   */
  exports.deleteNotification = async (req, res, next) => {
    try {
      const { notificationId } = req.params;

      const notification = await Notification.findById(notificationId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found',
        });
      }

      await Notification.findByIdAndDelete(notificationId);

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // OFFERS MANAGEMENT
  // ============================================================================

  /**
   * @desc    Get all offers (for admin)
   * @route   GET /api/admin/offers
   * @access  Private (Admin)
   */
  exports.getOffers = async (req, res, next) => {
    try {
      const { type, isActive } = req.query;

      const query = {};
      if (type) {
        query.type = type;
      }
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const offers = await Offer.find(query)
        .populate('productIds', 'name priceToUser images primaryImage')
        .populate('linkedProductIds', 'name priceToUser images primaryImage')
        .sort({ order: 1, createdAt: -1 });

      res.status(200).json({
        success: true,
        data: {
          offers,
          carouselCount: await Offer.countDocuments({ type: 'carousel', isActive: true }),
          maxCarousels: 6,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get single offer
   * @route   GET /api/admin/offers/:id
   * @access  Private (Admin)
   */
  exports.getOffer = async (req, res, next) => {
    try {
      const { id } = req.params;

      const offer = await Offer.findById(id)
        .populate('productIds', 'name priceToUser images primaryImage')
        .populate('linkedProductIds', 'name priceToUser images primaryImage');

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found',
        });
      }

      res.status(200).json({
        success: true,
        data: { offer },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Create offer
   * @route   POST /api/admin/offers
   * @access  Private (Admin)
   */
  exports.createOffer = async (req, res, next) => {
    try {
      const adminId = req.admin.id;
      const { type, title, description, image, productIds, specialTag, specialValue, linkedProductIds, order } = req.body;

      // Validate required fields based on type
      if (!type || !['carousel', 'special_offer'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid offer type. Must be "carousel" or "special_offer"',
        });
      }

      if (type === 'carousel') {
        if (!image) {
          return res.status(400).json({
            success: false,
            message: 'Image is required for carousel offers',
          });
        }

        // Check carousel limit (max 6)
        const carouselCount = await Offer.countDocuments({ type: 'carousel', isActive: true });
        if (carouselCount >= 6) {
          return res.status(400).json({
            success: false,
            message: 'Maximum 6 active carousels allowed. Please delete or deactivate an existing carousel first.',
          });
        }

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'At least one product must be linked to carousel',
          });
        }
      }

      if (type === 'special_offer') {
        if (!specialTag || !specialValue) {
          return res.status(400).json({
            success: false,
            message: 'Special tag and special value are required for special offers',
          });
        }
      }

      // Validate product IDs if provided
      if (productIds && productIds.length > 0) {
        const validProducts = await Product.countDocuments({ _id: { $in: productIds } });
        if (validProducts !== productIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more product IDs are invalid',
          });
        }
      }

      if (linkedProductIds && linkedProductIds.length > 0) {
        const validLinkedProducts = await Product.countDocuments({ _id: { $in: linkedProductIds } });
        if (validLinkedProducts !== linkedProductIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more linked product IDs are invalid',
          });
        }
      }

      // Determine order for carousel
      let offerOrder = order;
      if (type === 'carousel' && offerOrder === undefined) {
        const maxOrder = await Offer.findOne({ type: 'carousel' })
          .sort({ order: -1 })
          .select('order');
        offerOrder = maxOrder ? maxOrder.order + 1 : 0;
      }

      const offer = await createOffer({
        type,
        title,
        description,
        image: type === 'carousel' ? image : undefined,
        productIds: type === 'carousel' ? productIds : undefined,
        specialTag: type === 'special_offer' ? specialTag : undefined,
        specialValue: type === 'special_offer' ? specialValue : undefined,
        linkedProductIds: type === 'special_offer' ? (linkedProductIds || []) : undefined,
        order: type === 'carousel' ? offerOrder : undefined,
        createdBy: adminId,
        updatedBy: adminId,
      });

      const populatedOffer = await Offer.findById(offer._id)
        .populate('productIds', 'name priceToUser images primaryImage')
        .populate('linkedProductIds', 'name priceToUser images primaryImage');

      res.status(201).json({
        success: true,
        data: { offer: populatedOffer },
        message: 'Offer created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Update offer
   * @route   PUT /api/admin/offers/:id
   * @access  Private (Admin)
   */
  exports.updateOffer = async (req, res, next) => {
    try {
      const adminId = req.admin.id;
      const { id } = req.params;
      const { title, description, image, productIds, specialTag, specialValue, linkedProductIds, isActive, order } = req.body;

      const offer = await Offer.findById(id);
      if (!offer) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found',
        });
      }

      // Validate product IDs if provided
      if (productIds && Array.isArray(productIds) && productIds.length > 0) {
        const validProducts = await Product.countDocuments({ _id: { $in: productIds } });
        if (validProducts !== productIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more product IDs are invalid',
          });
        }
      }

      if (linkedProductIds && Array.isArray(linkedProductIds) && linkedProductIds.length > 0) {
        const validLinkedProducts = await Product.countDocuments({ _id: { $in: linkedProductIds } });
        if (validLinkedProducts !== linkedProductIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more linked product IDs are invalid',
          });
        }
      }

      // Check carousel limit if activating a carousel
      if (offer.type === 'carousel' && isActive === true && !offer.isActive) {
        const carouselCount = await Offer.countDocuments({ type: 'carousel', isActive: true });
        if (carouselCount >= 6) {
          return res.status(400).json({
            success: false,
            message: 'Maximum 6 active carousels allowed. Please delete or deactivate an existing carousel first.',
          });
        }
      }

      // Update fields
      if (title !== undefined) offer.title = title;
      if (description !== undefined) offer.description = description;
      if (offer.type === 'carousel' && image !== undefined) offer.image = image;
      if (offer.type === 'carousel' && productIds !== undefined) offer.productIds = productIds;
      if (offer.type === 'carousel' && order !== undefined) offer.order = order;
      if (offer.type === 'special_offer' && specialTag !== undefined) offer.specialTag = specialTag;
      if (offer.type === 'special_offer' && specialValue !== undefined) offer.specialValue = specialValue;
      if (offer.type === 'special_offer' && linkedProductIds !== undefined) offer.linkedProductIds = linkedProductIds;
      if (isActive !== undefined) offer.isActive = isActive;
      offer.updatedBy = adminId;

      await offer.save();

      const populatedOffer = await Offer.findById(offer._id)
        .populate('productIds', 'name priceToUser images primaryImage')
        .populate('linkedProductIds', 'name priceToUser images primaryImage');

      res.status(200).json({
        success: true,
        data: { offer: populatedOffer },
        message: 'Offer updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Delete offer
   * @route   DELETE /api/admin/offers/:id
   * @access  Private (Admin)
   */
  exports.deleteOffer = async (req, res, next) => {
    try {
      const { id } = req.params;

      const offer = await Offer.findById(id);
      if (!offer) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found',
        });
      }

      await Offer.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Offer deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get all vendor credit repayments
   * @route   GET /api/admin/finance/repayments
   * @access  Private (Admin)
   */
  exports.getRepayments = async (req, res, next) => {
    try {
      const { page = 1, limit = 20, status, vendorId, startDate, endDate } = req.query;

      // Build query
      const query = {};

      if (status) {
        query.status = status;
      }

      if (vendorId) {
        query.vendorId = vendorId;
      }

      // Date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          const toDate = new Date(endDate);
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get repayments with vendor and bank account details
      const repayments = await CreditRepayment.find(query)
        .populate('vendorId', 'name phone location')
        .populate('bankAccountId', 'accountHolderName bankName accountNumber ifscCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-gatewayResponse -__v')
        .lean();

      const total = await CreditRepayment.countDocuments(query);

      // Calculate summary statistics
      const summary = await CreditRepayment.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalPenalty: { $sum: '$penaltyAmount' },
            totalPaid: { $sum: '$totalAmount' },
          },
        },
      ]);

      const allStatusSummary = await CreditRepayment.aggregate([
        {
          $match: query,
        },
        {
          $group: {
            _id: null,
            totalCompleted: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            totalPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            totalFailed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            totalRepaid: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
            totalPenaltyPaid: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$penaltyAmount', 0] } },
          },
        },
      ]);

      res.status(200).json({
        success: true,
        data: {
          repayments,
          summary: allStatusSummary[0] || {
            totalCompleted: 0,
            totalPending: 0,
            totalFailed: 0,
            totalRepaid: 0,
            totalPenaltyPaid: 0,
          },
          statusBreakdown: summary,
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
   * @desc    Get repayment details
   * @route   GET /api/admin/finance/repayments/:repaymentId
   * @access  Private (Admin)
   */
  exports.getRepaymentDetails = async (req, res, next) => {
    try {
      const { repaymentId } = req.params;

      const repayment = await CreditRepayment.findById(repaymentId)
        .populate('vendorId', 'name phone email location creditLimit creditUsed creditPolicy')
        .populate('bankAccountId', 'accountHolderName bankName accountNumber ifscCode branchName')
        .populate('reviewedBy', 'name email')
        .select('-gatewayResponse -__v')
        .lean();

      if (!repayment) {
        return res.status(404).json({
          success: false,
          message: 'Repayment not found',
        });
      }

      res.status(200).json({
        success: true,
        data: {
          repayment,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get vendor repayments
   * @route   GET /api/admin/finance/vendors/:vendorId/repayments
   * @access  Private (Admin)
   */
  exports.getVendorRepayments = async (req, res, next) => {
    try {
      const { vendorId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      const vendor = await Vendor.findById(vendorId);

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found',
        });
      }

      const query = {
        vendorId: vendor._id,
      };

      if (status) {
        query.status = status;
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const repayments = await CreditRepayment.find(query)
        .populate('bankAccountId', 'accountHolderName bankName accountNumber ifscCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-gatewayResponse -__v')
        .lean();

      const total = await CreditRepayment.countDocuments(query);

      // Calculate vendor repayment summary
      const summary = await CreditRepayment.aggregate([
        {
          $match: {
            vendorId: vendor._id,
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            totalRepaid: { $sum: '$amount' },
            totalPenaltyPaid: { $sum: '$penaltyAmount' },
            count: { $sum: 1 },
          },
        },
      ]);

      res.status(200).json({
        success: true,
        data: {
          vendor: {
            id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
            creditUsed: vendor.creditUsed,
            creditLimit: vendor.creditPolicy?.limit || 0,
          },
          repayments,
          summary: summary[0] || {
            totalRepaid: 0,
            totalPenaltyPaid: 0,
            count: 0,
          },
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
  // REVIEW MANAGEMENT ROUTES
  // ============================================================================

  /**
   * @desc    Get all product reviews with filtering
   * @route   GET /api/admin/reviews
   * @access  Private (Admin)
   */
  exports.getReviews = async (req, res, next) => {
    try {
      const {
        productId,
        userId,
        rating,
        hasResponse,
        isApproved,
        isVisible,
        page = 1,
        limit = 20,
        sort = '-createdAt',
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query = {};
      if (productId) {
        // Mongoose will automatically convert string IDs to ObjectId
        query.productId = productId;
      }
      if (userId) {
        // Mongoose will automatically convert string IDs to ObjectId
        query.userId = userId;
      }
      if (rating) query.rating = parseInt(rating);
      if (hasResponse === 'true') query['adminResponse.response'] = { $exists: true, $ne: '' };
      if (hasResponse === 'false') query.$or = [{ 'adminResponse.response': { $exists: false } }, { 'adminResponse.response': '' }];
      // Only add isApproved filter if explicitly set (don't filter by default)
      if (isApproved !== undefined && isApproved !== '') {
        query.isApproved = isApproved === 'true';
      }
      // Only add isVisible filter if explicitly set (don't filter by default)
      if (isVisible !== undefined && isVisible !== '') {
        query.isVisible = isVisible === 'true';
      }

      // Build sort object
      let sortObj = {};
      if (sort === 'rating-desc') sortObj = { rating: -1, createdAt: -1 };
      else if (sort === 'rating-asc') sortObj = { rating: 1, createdAt: -1 };
      else if (sort === 'date-asc') sortObj = { createdAt: 1 };
      else sortObj = { createdAt: -1 }; // Default: newest first

      // Get reviews
      const [reviews, total] = await Promise.all([
        Review.find(query)
          .populate('productId', 'name')
          .populate('userId', 'name phone')
          .populate('adminResponse.respondedBy', 'name')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Review.countDocuments(query),
      ]);

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
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Get review details
   * @route   GET /api/admin/reviews/:reviewId
   * @access  Private (Admin)
   */
  exports.getReviewDetails = async (req, res, next) => {
    try {
      const { reviewId } = req.params;

      const review = await Review.findById(reviewId)
        .populate('productId', 'name')
        .populate('userId', 'name phone')
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
   * @desc    Respond to a review
   * @route   POST /api/admin/reviews/:reviewId/respond
   * @access  Private (Admin)
   */
  exports.respondToReview = async (req, res, next) => {
    try {
      const { reviewId } = req.params;
      const { response } = req.body;
      const adminId = req.admin._id;

      if (!response || response.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Response text is required',
        });
      }

      const review = await Review.findById(reviewId);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
        });
      }

      // Update admin response
      review.adminResponse = {
        response: response.trim(),
        respondedBy: adminId,
        respondedAt: new Date(),
      };

      await review.save();

      await review.populate('productId', 'name');
      await review.populate('userId', 'name phone');
      await review.populate('adminResponse.respondedBy', 'name');

      res.status(200).json({
        success: true,
        data: {
          review,
          message: 'Response added successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Update admin response to a review
   * @route   PUT /api/admin/reviews/:reviewId/respond
   * @access  Private (Admin)
   */
  exports.updateReviewResponse = async (req, res, next) => {
    try {
      const { reviewId } = req.params;
      const { response } = req.body;
      const adminId = req.admin._id;

      if (!response || response.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Response text is required',
        });
      }

      const review = await Review.findById(reviewId);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
        });
      }

      // Update admin response
      review.adminResponse = {
        response: response.trim(),
        respondedBy: adminId,
        respondedAt: new Date(),
      };

      await review.save();

      await review.populate('productId', 'name');
      await review.populate('userId', 'name phone');
      await review.populate('adminResponse.respondedBy', 'name');

      res.status(200).json({
        success: true,
        data: {
          review,
          message: 'Response updated successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Delete admin response
   * @route   DELETE /api/admin/reviews/:reviewId/respond
   * @access  Private (Admin)
   */
  exports.deleteReviewResponse = async (req, res, next) => {
    try {
      const { reviewId } = req.params;

      const review = await Review.findById(reviewId);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
        });
      }

      // Remove admin response
      review.adminResponse = undefined;
      await review.save();

      await review.populate('productId', 'name');
      await review.populate('userId', 'name phone');

      res.status(200).json({
        success: true,
        data: {
          review,
          message: 'Response deleted successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Moderate review (approve/reject, hide/show)
   * @route   PUT /api/admin/reviews/:reviewId/moderate
   * @access  Private (Admin)
   */
  exports.moderateReview = async (req, res, next) => {
    try {
      const { reviewId } = req.params;
      const { isApproved, isVisible } = req.body;

      const review = await Review.findById(reviewId);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
        });
      }

      if (isApproved !== undefined) {
        review.isApproved = isApproved;
      }

      if (isVisible !== undefined) {
        review.isVisible = isVisible;
      }

      await review.save();

      await review.populate('productId', 'name');
      await review.populate('userId', 'name phone');
      await review.populate('adminResponse.respondedBy', 'name');

      res.status(200).json({
        success: true,
        data: {
          review,
          message: 'Review moderated successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Delete review
   * @route   DELETE /api/admin/reviews/:reviewId
   * @access  Private (Admin)
   */
  exports.deleteReview = async (req, res, next) => {
    try {
      const { reviewId } = req.params;

      const review = await Review.findById(reviewId);

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

  // ============================================================================
  // SUPPORT TICKET MANAGEMENT
  // ============================================================================

  const SupportTicket = require('../models/SupportTicket');

  /**
   * @desc    Get all support tickets
   * @route   GET /api/admin/support/tickets
   * @access  Private (Admin)
   */
  exports.getSupportTickets = async (req, res, next) => {
    try {
      const { status, userType, priority, unread, page = 1, limit = 20, search } = req.query;

      const query = {};

      if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        query.status = status;
      }
      if (userType && ['user', 'seller'].includes(userType)) {
        query.userType = userType;
      }
      if (priority && ['low', 'medium', 'high'].includes(priority)) {
        query.priority = priority;
      }
      if (unread === 'true') {
        query.unreadByAdmin = true;
      }
      if (search) {
        query.$or = [
          { ticketId: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await SupportTicket.countDocuments(query);

      const tickets = await SupportTicket.find(query)
        .sort({ unreadByAdmin: -1, priority: -1, lastActivityAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name phone userId')
        .populate('sellerId', 'name phone sellerId')
        .populate('assignedTo', 'name')
        .select('ticketId subject category priority status userType unreadByAdmin lastActivityAt createdAt')
        .lean();

      // Get stats
      const stats = await SupportTicket.getStats();
      const unreadCount = await SupportTicket.countDocuments({ unreadByAdmin: true, status: { $nin: ['closed'] } });

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
            userType: t.userType,
            user: t.userType === 'user'
              ? { name: t.userId?.name, phone: t.userId?.phone, id: t.userId?.userId }
              : { name: t.sellerId?.name, phone: t.sellerId?.phone, id: t.sellerId?.sellerId },
            assignedTo: t.assignedTo?.name || null,
            unread: t.unreadByAdmin,
            lastActivityAt: t.lastActivityAt,
            createdAt: t.createdAt,
          })),
          stats,
          unreadCount,
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
   * @route   GET /api/admin/support/tickets/:ticketId
   * @access  Private (Admin)
   */
  exports.getSupportTicketDetails = async (req, res, next) => {
    try {
      const { ticketId } = req.params;

      const ticket = await SupportTicket.findOne({
        $or: [{ _id: ticketId }, { ticketId: ticketId }],
      })
        .populate('userId', 'name phone email userId location')
        .populate('sellerId', 'name phone email sellerId area')
        .populate('orderId', 'orderNumber totalAmount status')
        .populate('assignedTo', 'name')
        .populate('resolvedBy', 'name')
        .populate('closedBy', 'name')
        .lean();

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Support ticket not found',
        });
      }

      // Mark as read by admin
      await SupportTicket.findByIdAndUpdate(ticket._id, {
        unreadByAdmin: false,
        $set: {
          'messages.$[elem].readAt': new Date(),
        },
      }, {
        arrayFilters: [{ 'elem.isFromAdmin': false, 'elem.readAt': null }],
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
            userType: ticket.userType,
            user: ticket.userType === 'user' ? ticket.userId : ticket.sellerId,
            order: ticket.orderId,
            orderNumber: ticket.orderNumber,
            assignedTo: ticket.assignedTo?.name,
            resolution: ticket.resolution,
            createdAt: ticket.createdAt,
            resolvedAt: ticket.resolvedAt,
            resolvedBy: ticket.resolvedBy?.name,
            closedAt: ticket.closedAt,
            closedBy: ticket.closedBy?.name,
            lastActivityAt: ticket.lastActivityAt,
          },
          messages: ticket.messages.map(m => ({
            id: m._id,
            message: m.message,
            senderName: m.senderName,
            senderType: m.senderType,
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
   * @desc    Reply to support ticket
   * @route   POST /api/admin/support/tickets/:ticketId/reply
   * @access  Private (Admin)
   */
  exports.replyToSupportTicket = async (req, res, next) => {
    try {
      const admin = req.admin;
      const { ticketId } = req.params;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Message is required',
        });
      }

      const ticket = await SupportTicket.findOne({
        $or: [{ _id: ticketId }, { ticketId: ticketId }],
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Support ticket not found',
        });
      }

      if (ticket.status === 'closed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot reply to a closed ticket',
        });
      }

      // Add message
      ticket.addMessage(admin._id, 'Admin', admin.name, message.trim(), true);

      // Update status to in_progress if it was open
      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }

      // Assign to admin if not already assigned
      if (!ticket.assignedTo) {
        ticket.assignedTo = admin._id;
        ticket.assignedToName = admin.name;
        ticket.assignedAt = new Date();
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
            isFromAdmin: true,
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
   * @desc    Update support ticket status
   * @route   PUT /api/admin/support/tickets/:ticketId/status
   * @access  Private (Admin)
   */
  exports.updateSupportTicketStatus = async (req, res, next) => {
    try {
      const admin = req.admin;
      const { ticketId } = req.params;
      const { status, resolution, priority } = req.body;

      const ticket = await SupportTicket.findOne({
        $or: [{ _id: ticketId }, { ticketId: ticketId }],
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Support ticket not found',
        });
      }

      // Update priority if provided
      if (priority && ['low', 'medium', 'high'].includes(priority)) {
        ticket.priority = priority;
      }

      // Update status if provided
      if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        ticket.status = status;

        if (status === 'resolved') {
          ticket.resolvedAt = new Date();
          ticket.resolvedBy = admin._id;
          if (resolution) {
            ticket.resolution = resolution;
          }
        } else if (status === 'closed') {
          ticket.closedAt = new Date();
          ticket.closedBy = admin._id;
          if (!ticket.resolvedAt) {
            ticket.resolvedAt = new Date();
            ticket.resolvedBy = admin._id;
          }
          if (resolution) {
            ticket.resolution = resolution;
          }
        }
      }

      // Assign if not already assigned
      if (!ticket.assignedTo) {
        ticket.assignedTo = admin._id;
        ticket.assignedToName = admin.name;
        ticket.assignedAt = new Date();
      }

      ticket.lastActivityAt = new Date();
      ticket.lastActivityBy = 'admin';

      await ticket.save();

      res.status(200).json({
        success: true,
        data: {
          ticket: {
            id: ticket._id,
            ticketId: ticket.ticketId,
            status: ticket.status,
            priority: ticket.priority,
            resolution: ticket.resolution,
            resolvedAt: ticket.resolvedAt,
            closedAt: ticket.closedAt,
          },
          message: 'Ticket updated successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @desc    Assign support ticket to admin
   * @route   PUT /api/admin/support/tickets/:ticketId/assign
   * @access  Private (Admin)
   */
  exports.assignSupportTicket = async (req, res, next) => {
    try {
      const admin = req.admin;
      const { ticketId } = req.params;

      const ticket = await SupportTicket.findOne({
        $or: [{ _id: ticketId }, { ticketId: ticketId }],
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: 'Support ticket not found',
        });
      }

      ticket.assignedTo = admin._id;
      ticket.assignedToName = admin.name;
      ticket.assignedAt = new Date();

      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }

      await ticket.save();

      res.status(200).json({
        success: true,
        data: {
          ticket: {
            id: ticket._id,
            ticketId: ticket.ticketId,
            assignedTo: admin.name,
            status: ticket.status,
          },
          message: 'Ticket assigned successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  };

