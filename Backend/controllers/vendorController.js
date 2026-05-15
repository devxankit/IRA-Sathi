/**
 * Vendor Controller
 * 
 * Handles all vendor-related operations
 */

const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ProductAssignment = require('../models/ProductAssignment');
const CreditPurchase = require('../models/CreditPurchase');
const VendorEarning = require('../models/VendorEarning');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const BankAccount = require('../models/BankAccount');
const PaymentHistory = require('../models/PaymentHistory');
const CreditRepayment = require('../models/CreditRepayment');
const VendorNotification = require('../models/VendorNotification');
const UserNotification = require('../models/UserNotification');
const razorpayService = require('../services/razorpayService');

const { sendOTP } = require('../utils/otp');
const { getTestOTPInfo } = require('../services/smsIndiaHubService');
const { generateToken } = require('../middleware/auth');
const { OTP_EXPIRY_MINUTES, MIN_VENDOR_PURCHASE, MAX_VENDOR_PURCHASE, VENDOR_COVERAGE_RADIUS_KM, DELIVERY_TIMELINE_HOURS, ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { checkPhoneExists, checkPhoneInRole, isSpecialBypassNumber, SPECIAL_BYPASS_OTP } = require('../utils/phoneValidation');
const { generateUniqueId } = require('../utils/generateUniqueId');
const { createPaymentHistory, createBankAccount } = require('../utils/createWithId');
const adminTaskController = require('./adminTaskController');

const DELIVERY_WINDOW_HOURS = DELIVERY_TIMELINE_HOURS || 24;
const DELIVERY_WINDOW_MS = DELIVERY_WINDOW_HOURS * 60 * 60 * 1000;

async function processPendingDeliveries(vendorId) {
  try {
    const now = new Date();
    const pendingPurchases = await CreditPurchase.find({
      vendorId,
      status: 'approved',
      deliveryStatus: { $in: ['scheduled', 'in_transit'] },
      expectedDeliveryAt: { $lte: now },
    });

    if (!pendingPurchases.length) {
      return;
    }

    for (const purchase of pendingPurchases) {
      for (const item of purchase.items) {
        let assignment = await ProductAssignment.findOne({
          vendorId,
          productId: item.productId,
        });

        if (!assignment) {
          if (!purchase.reviewedBy) {
            console.warn(`⚠️ Unable to auto-create assignment for vendor ${vendorId}. Missing reviewer on purchase ${purchase._id}.`);
            continue;
          }
          assignment = await ProductAssignment.create({
            vendorId,
            productId: item.productId,
            assignedBy: purchase.reviewedBy,
            assignedAt: new Date(),
            stock: 0,
            isActive: true,
            notes: 'Auto-created during approved stock transfer',
          });
        }

        // Update Global Stock
        assignment.stock += item.quantity;

        // Update Attribute Stock
        const hasVariantAttributes = item.attributeCombination &&
          (item.attributeCombination instanceof Map ? item.attributeCombination.size > 0 : Object.keys(item.attributeCombination || {}).length > 0);

        if (hasVariantAttributes) {
          const attributeCombination = item.attributeCombination instanceof Map
            ? Object.fromEntries(item.attributeCombination)
            : item.attributeCombination || {};

          // Initialize attributeStocks if needed
          if (!assignment.attributeStocks) assignment.attributeStocks = [];

          // Find matching variant
          const matchingVariant = assignment.attributeStocks.find(variant => {
            if (!variant.attributes) return false;
            const variantAttrs = variant.attributes instanceof Map
              ? Object.fromEntries(variant.attributes)
              : variant.attributes;

            const keys = Object.keys(attributeCombination);
            return keys.every(key => String(variantAttrs[key]) === String(attributeCombination[key]));
          });

          if (matchingVariant) {
            matchingVariant.stock = (matchingVariant.stock || 0) + item.quantity;
            console.log(`📦 Stock Delivery: Updated existing variant stock for ${item.productName}`);
          } else {
            // Create new variant entry
            assignment.attributeStocks.push({
              attributes: attributeCombination,
              stock: item.quantity,
              isActive: true
            });
            console.log(`📦 Stock Delivery: Created new variant entry for ${item.productName}`);
          }
        } else {
          console.log(`📦 Stock Delivery: Added global stock for ${item.productName}`);
        }

        await assignment.save();
      }

      purchase.deliveryStatus = 'delivered';
      purchase.deliveredAt = now;
      purchase.deliveryNotes = 'Stock delivered and added to your inventory.';
      await purchase.save();
    }
  } catch (error) {
    console.error(`Failed to process pending deliveries for vendor ${vendorId}:`, error);
  }
}

/**
 * Helper: Deduct stock from vendor inventory for an order
 * @param {Object} order - The order document
 * @param {String} vendorId - Vendor ID
 */
async function deductStockFromInventory(order, vendorId) {
  try {
    if (order.stockDeducted) {
      console.log(`ℹ️ Stock already deducted for order ${order.orderNumber}`);
      return true;
    }

    const ProductAssignment = require('../models/ProductAssignment');

    for (const item of order.items) {
      const assignment = await ProductAssignment.findOne({
        vendorId,
        productId: item.productId,
      });

      if (assignment) {
        // Deduct Global Stock
        assignment.stock = Math.max(0, (assignment.stock || 0) - item.quantity);

        // Deduct Attribute Stock if variant
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
            matchingVariant.stock = Math.max(0, (matchingVariant.stock || 0) - item.quantity);
            console.log(`📦 Vendor Variant Stock reduced for ${item.productName}: ${item.quantity}`);
          }
        }

        await assignment.save();
        console.log(`📦 Vendor Global Stock reduced for ${item.productName}: ${item.quantity}`);
      } else {
        console.warn(`⚠️ No product assignment found for product ${item.productName} and vendor ${vendorId}. Cannot deduct stock.`);
      }
    }

    order.stockDeducted = true;
    await order.save();
    return true;
  } catch (error) {
    console.error(`❌ Failed to deduct stock for order ${order.orderNumber}:`, error);
    return false;
  }
}

/**
 * @desc    Vendor registration
 * @route   POST /api/vendors/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, location, aadhaarCard, panCard } = req.body;

    if (!name || !phone || !location) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, and location are required',
      });
    }

    // Special bypass number - skip all validation and checks, proceed to OTP
    if (isSpecialBypassNumber(phone)) {
      // Create vendor with minimal data, set OTP to 123456
      let vendor = await Vendor.findOne({ phone });

      if (!vendor) {
        const vendorId = await generateUniqueId(Vendor, 'VND', 'vendorId', 101);
        vendor = new Vendor({
          vendorId,
          name: name || 'Special Bypass Vendor',
          phone: phone,
          email: email || undefined,
          location: location || {
            address: '',
            city: '',
            state: '',
            pincode: '',
          },
          status: 'pending',
          aadhaarCard: aadhaarCard || { url: '', format: 'jpg' },
          panCard: panCard || { url: '', format: 'jpg' },
        });
      }

      // Set OTP to 123456
      vendor.otp = {
        code: SPECIAL_BYPASS_OTP,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
      await vendor.save();

      return res.status(201).json({
        success: true,
        data: {
          message: 'Registration request submitted. OTP sent to phone.',
          requiresApproval: true,
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
      });
    }

    // Validate documents - must be uploaded
    if (!aadhaarCard || !aadhaarCard.url) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar card image is required. Please upload an image file (max 2MB).',
      });
    }

    if (!panCard || !panCard.url) {
      return res.status(400).json({
        success: false,
        message: 'PAN card image is required. Please upload an image file (max 2MB).',
      });
    }

    // Validate document formats - must be images only (no PDF)
    const imageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const aadhaarFormat = aadhaarCard.format?.toLowerCase();
    const panFormat = panCard.format?.toLowerCase();

    if (!aadhaarFormat || !imageFormats.includes(aadhaarFormat)) {
      return res.status(400).json({
        success: false,
        message: 'Aadhaar card must be an image file (JPG, PNG, GIF, etc.). PDF files are not accepted.',
      });
    }

    if (!panFormat || !imageFormats.includes(panFormat)) {
      return res.status(400).json({
        success: false,
        message: 'PAN card must be an image file (JPG, PNG, GIF, etc.). PDF files are not accepted.',
      });
    }

    // Validate document sizes - must be less than 2MB
    const maxSize = 2000000; // 2MB in bytes
    if (aadhaarCard.size && aadhaarCard.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `Aadhaar card image size (${(aadhaarCard.size / 1024 / 1024).toFixed(2)}MB) exceeds 2MB limit. Please upload a smaller image.`,
      });
    }

    if (panCard.size && panCard.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `PAN card image size (${(panCard.size / 1024 / 1024).toFixed(2)}MB) exceeds 2MB limit. Please upload a smaller image.`,
      });
    }

    // Check if phone exists in other roles (user, seller)
    const phoneCheck = await checkPhoneExists(phone, 'vendor');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ phone });

    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: 'Vendor with this phone number already exists',
      });
    }

    // CRITICAL: Verify region uniqueness - Only 1 vendor allowed per region (city + state)
    // First check: Region-based check (city + state) - STRICT REGION RULE
    if (location.city && location.state) {
      const cityNormalized = location.city.trim().toLowerCase();
      const stateNormalized = location.state.trim().toLowerCase();

      console.log(`🔍 Checking for existing vendor in region: ${location.city}, ${location.state}`);

      // Check if another vendor exists in the same region (city + state)
      const existingVendorInRegion = await Vendor.findOne({
        phone: { $ne: phone }, // Exclude current vendor if exists
        status: { $in: ['pending', 'approved'] }, // Check both pending and approved
        isActive: true,
        'banInfo.isBanned': false,
        'location.city': { $regex: new RegExp(`^${cityNormalized}$`, 'i') },
        'location.state': { $regex: new RegExp(`^${stateNormalized}$`, 'i') },
      });

      if (existingVendorInRegion) {
        console.log(`❌ Vendor registration blocked: Another vendor exists in ${location.city}, ${location.state}`);
        console.log(`   Existing vendor: ${existingVendorInRegion.name} (${existingVendorInRegion.phone})`);
        return res.status(400).json({
          success: false,
          message: `A vendor already exists in ${location.city}, ${location.state}. Only one vendor is allowed per region.`,
          existingVendor: {
            id: existingVendorInRegion._id,
            name: existingVendorInRegion.name,
            phone: existingVendorInRegion.phone,
            status: existingVendorInRegion.status,
            location: {
              city: existingVendorInRegion.location.city,
              state: existingVendorInRegion.location.state,
            },
          },
          businessRule: 'Only one vendor is allowed per region (city + state). Please choose a different region.',
        });
      }

      console.log(`✅ No existing vendor found in region: ${location.city}, ${location.state}`);
    }

    // CRITICAL: Verify 20km radius rule - Only 1 vendor allowed per 20km radius (for coordinates-based check)
    // Use transaction to prevent race conditions during concurrent registrations
    if (location.coordinates && location.coordinates.lat && location.coordinates.lng) {
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // Check if another approved vendor exists within 20km
          // Using MongoDB geospatial query with 2dsphere index
          const nearbyVendors = await Vendor.find({
            phone: { $ne: phone }, // Exclude current vendor if exists
            status: 'approved', // Only check approved vendors
            isActive: true, // Only check active vendors
            'banInfo.isBanned': false, // Exclude banned vendors
            'location.coordinates': {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [location.coordinates.lng, location.coordinates.lat],
                },
                $maxDistance: VENDOR_COVERAGE_RADIUS_KM * 1000, // Convert km to meters (20000 meters)
              },
            },
          }).session(session).limit(1);

          if (nearbyVendors.length > 0) {
            const nearbyVendor = nearbyVendors[0];
            throw new Error(`VENDOR_EXISTS: Another vendor already exists within ${VENDOR_COVERAGE_RADIUS_KM}km radius`);
          }
        });
      } catch (error) {
        await session.endSession();
        if (error.message.startsWith('VENDOR_EXISTS:')) {
          // Get vendor details for error message (outside transaction)
          const nearbyVendor = await Vendor.findOne({
            phone: { $ne: phone },
            status: 'approved',
            isActive: true,
            'banInfo.isBanned': false,
            'location.coordinates': {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [location.coordinates.lng, location.coordinates.lat],
                },
                $maxDistance: VENDOR_COVERAGE_RADIUS_KM * 1000,
              },
            },
          }).limit(1);

          return res.status(400).json({
            success: false,
            message: error.message.replace('VENDOR_EXISTS: ', ''),
            nearbyVendor: nearbyVendor ? {
              id: nearbyVendor._id,
              name: nearbyVendor.name,
              phone: nearbyVendor.phone,
              status: nearbyVendor.status,
              location: nearbyVendor.location,
            } : null,
            businessRule: `Only one vendor is allowed per ${VENDOR_COVERAGE_RADIUS_KM}km radius. Please choose a different location.`,
          });
        }
        throw error;
      } finally {
        await session.endSession();
      }
    }

    // Generate unique vendor ID
    const vendorId = await generateUniqueId(Vendor, 'VND', 'vendorId', 101);

    // Create vendor - Status set to pending (requires admin approval)
    const vendor = new Vendor({
      vendorId,
      name,
      email: email || undefined,
      phone,
      location: {
        address: location.address,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        coordinates: {
          lat: location.coordinates?.lat || 0,
          lng: location.coordinates?.lng || 0,
        },
        coverageRadius: VENDOR_COVERAGE_RADIUS_KM,
      },
      aadhaarCard: aadhaarCard ? {
        url: aadhaarCard.url,
        publicId: aadhaarCard.publicId,
        format: aadhaarCard.format,
        size: aadhaarCard.size,
        uploadedAt: new Date(),
      } : undefined,
      panCard: panCard ? {
        url: panCard.url,
        publicId: panCard.publicId,
        format: panCard.format,
        size: panCard.size,
        uploadedAt: new Date(),
      } : undefined,
      status: 'pending', // Requires admin approval
      isActive: false, // Inactive until approved
    });

    // Clear any existing OTP before generating new one
    vendor.clearOTP();

    // Check if this is a test phone number - use default OTP 123456
    const testOTPInfo = getTestOTPInfo(phone);
    let otpCode;
    if (testOTPInfo.isTest) {
      // For test numbers, set OTP directly to 123456
      otpCode = testOTPInfo.defaultOTP;
      vendor.otp = {
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
    } else {
      // Generate new unique OTP for regular numbers
      otpCode = vendor.generateOTP();
    }
    await vendor.save();

    // Send OTP via SMS
    try {
      await sendOTP(phone, otpCode, 'registration');
    } catch (error) {
      console.error('Failed to send OTP:', error);
    }
    res.status(201).json({
      success: true,
      data: {
        message: 'Registration successful. OTP sent to phone.',
        vendorId: vendor._id,
        expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
      },
    });

    // Create Admin TODO Task
    try {
      await adminTaskController.createTaskInternal({
        title: 'New Vendor Application',
        description: `A new vendor "${name}" (${phone}) has registered and is waiting for approval in ${location.city}, ${location.state}.`,
        category: 'vendor',
        priority: 'high',
        link: '/vendors',
        relatedId: vendor._id,
        metadata: {
          vendorName: name,
          phone: phone,
          city: location.city
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
 * @desc    Request OTP for vendor
 * @route   POST /api/vendors/auth/request-otp
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
      // Find or create vendor
      let vendor = await Vendor.findOne({ phone });

      if (!vendor) {
        const vendorId = await generateUniqueId(Vendor, 'VND', 'vendorId', 101);
        vendor = new Vendor({
          vendorId,
          phone: phone,
          name: 'Special Bypass Vendor',
          status: 'pending',
          location: {
            address: '',
            city: '',
            state: '',
            pincode: '',
          },
        });
      }

      // Set OTP to 123456
      vendor.otp = {
        code: SPECIAL_BYPASS_OTP,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
      await vendor.save();

      return res.status(200).json({
        success: true,
        data: {
          message: 'OTP sent successfully',
          expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
        },
      });
    }

    // Check if phone exists in other roles (user, seller)
    const phoneCheck = await checkPhoneExists(phone, 'vendor');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    // Check if vendor exists - requestOTP is only for existing vendors
    const vendorCheck = await checkPhoneInRole(phone, 'vendor');
    const vendor = vendorCheck.data;

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found. Please register first.',
        requiresRegistration: true,
      });
    }

    // Check vendor status before sending OTP
    if (vendor.status === 'rejected') {
      return res.status(403).json({
        success: false,
        status: 'rejected',
        message: 'Your vendor profile was rejected by the admin. You cannot access the dashboard.',
      });
    }

    // Allow OTP for pending and approved vendors (status check will happen in verifyOTP)
    // Clear any existing OTP before generating new one
    vendor.clearOTP();

    // Check if this is a test phone number - use default OTP 123456
    const testOTPInfo = getTestOTPInfo(phone);
    let otpCode;
    if (testOTPInfo.isTest) {
      // For test numbers, set OTP directly to 123456
      otpCode = testOTPInfo.defaultOTP;
      vendor.otp = {
        code: otpCode,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      };
    } else {
      // Generate new unique OTP for regular numbers
      otpCode = vendor.generateOTP();
    }
    await vendor.save();

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
 * @route   POST /api/vendors/auth/verify-otp
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

    // Special bypass number - accept OTP 123456 and create/find vendor
    if (isSpecialBypassNumber(phone)) {
      if (otp !== SPECIAL_BYPASS_OTP) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP',
        });
      }

      // Find or create vendor
      let vendor = await Vendor.findOne({ phone });

      if (!vendor) {
        const vendorId = await generateUniqueId(Vendor, 'VND', 'vendorId', 101);
        vendor = new Vendor({
          vendorId,
          phone: phone,
          name: 'Special Bypass Vendor',
          status: 'pending',
          location: {
            address: '',
            city: '',
            state: '',
            pincode: '',
          },
        });
        await vendor.save();
        console.log(`✅ Special bypass vendor created: ${phone} with ID: ${vendorId}`);
      }

      vendor.lastLogin = new Date();
      await vendor.save();

      // Generate JWT token
      const token = generateToken({
        vendorId: vendor._id,
        phone: vendor.phone,
        role: 'vendor',
        type: 'vendor',
      });

      return res.status(200).json({
        success: true,
        data: {
          token,
          status: vendor.status,
          vendor: {
            id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
            status: vendor.status,
            isActive: vendor.isActive,
            location: vendor.location,
          },
        },
      });
    }

    // Check if phone exists in other roles first
    const phoneCheck = await checkPhoneExists(phone, 'vendor');
    if (phoneCheck.exists) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.message,
      });
    }

    // Check if phone exists in vendor role
    const vendorCheck = await checkPhoneInRole(phone, 'vendor');
    const vendor = vendorCheck.data;

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found. Please register first.',
        requiresRegistration: true, // Flag for frontend to redirect
      });
    }

    // Verify OTP
    const isOtpValid = vendor.verifyOTP(otp);

    if (!isOtpValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    // Check if vendor is banned
    if (vendor.banInfo?.isBanned) {
      const banType = vendor.banInfo.banType || 'temporary'
      const banReason = vendor.banInfo.banReason || 'Account banned by admin'
      return res.status(403).json({
        success: false,
        message: `Vendor account is ${banType === 'permanent' ? 'permanently' : 'temporarily'} banned. ${banReason}. Please contact admin.`,
        banInfo: vendor.banInfo,
      });
    }

    // Check vendor status - Handle pending, rejected, and approved statuses
    if (vendor.status === 'pending') {
      // Clear OTP after successful verification
      vendor.clearOTP();
      await vendor.save();

      return res.status(200).json({
        success: true,
        data: {
          status: 'pending',
          message: 'Registration successful. Waiting for admin approval.',
          vendor: {
            id: vendor._id,
            name: vendor.name,
            phone: vendor.phone,
            status: vendor.status,
            isActive: vendor.isActive,
            location: vendor.location,
          },
        },
      });
    }

    if (vendor.status === 'rejected') {
      // Clear OTP after verification
      vendor.clearOTP();
      await vendor.save();

      return res.status(403).json({
        success: false,
        status: 'rejected',
        message: 'Your vendor profile was rejected by the admin. You cannot access the dashboard.',
        vendor: {
          id: vendor._id,
          name: vendor.name,
          phone: vendor.phone,
          status: vendor.status,
        },
      });
    }

    // Check if vendor is approved and active
    if (vendor.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Vendor account status is ${vendor.status}. Please contact admin.`,
        status: vendor.status,
      });
    }

    if (!vendor.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Vendor account is inactive. Please contact admin.',
      });
    }

    // Vendor is approved and active - proceed with login
    // Clear OTP after successful verification
    vendor.clearOTP();
    vendor.lastLogin = new Date();
    await vendor.save();

    // Generate JWT token
    const token = generateToken({
      vendorId: vendor._id,
      phone: vendor.phone,
      role: 'vendor',
      type: 'vendor',
    });

    // Enhanced console logging
    const timestamp = new Date().toISOString();
    console.log('\n' + '='.repeat(60));
    console.log('🔐 VENDOR OTP VERIFIED');
    console.log('='.repeat(60));
    console.log(`📱 Phone: ${phone}`);
    console.log(`👤 Name: ${vendor.name}`);
    console.log(`✅ Status: ${vendor.status}`);
    console.log(`⏰ Logged In At: ${timestamp}`);
    console.log('='.repeat(60) + '\n');

    res.status(200).json({
      success: true,
      data: {
        token,
        status: 'approved',
        vendor: {
          id: vendor._id,
          name: vendor.name,
          phone: vendor.phone,
          status: vendor.status,
          isActive: vendor.isActive,
          location: vendor.location,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Vendor logout
 * @route   POST /api/vendors/auth/logout
 * @access  Private (Vendor)
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
 * @desc    Get vendor profile
 * @route   GET /api/vendors/auth/profile
 * @access  Private (Vendor)
 */
exports.getProfile = async (req, res, next) => {
  try {
    // Vendor is attached by authorizeVendor middleware
    const vendor = req.vendor;

    res.status(200).json({
      success: true,
      data: {
        vendor: {
          id: vendor._id,
          name: vendor.name,
          phone: vendor.phone,
          email: vendor.email,
          location: vendor.location,
          status: vendor.status,
          isActive: vendor.isActive,
          credit: {
            limit: vendor.creditPolicy.limit,
            used: vendor.creditUsed,
            remaining: vendor.creditPolicy.limit - vendor.creditUsed,
            dueDate: vendor.creditPolicy.dueDate,
            penaltyRate: vendor.creditPolicy.penaltyRate,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get dashboard overview
 * @route   GET /api/vendors/dashboard
 * @access  Private (Vendor)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    // Get pending orders count
    const pendingOrders = await Order.countDocuments({
      vendorId: vendor._id,
      status: 'pending',
    });

    // Get orders awaiting confirmation
    const awaitingOrders = await Order.countDocuments({
      vendorId: vendor._id,
      status: 'awaiting',
    });

    // Get processing orders
    const processingOrders = await Order.countDocuments({
      vendorId: vendor._id,
      status: 'processing',
    });

    // Get assigned products (inventory)
    const assignedProducts = await ProductAssignment.find({
      vendorId: vendor._id,
      isActive: true,
    }).populate('productId', 'name sku category priceToUser imageUrl');

    // Get low stock items (we'll need to check if ProductAssignment has stock info)
    // For now, we'll use assigned products count as a placeholder
    const totalProducts = assignedProducts.length;
    const lowStockProducts = assignedProducts.filter(p => {
      // If ProductAssignment has stock tracking, check here
      // For now, we'll return empty array as placeholder
      return false;
    });

    // Credit information
    const creditLimit = vendor.creditLimit || vendor.creditPolicy?.limit || 0;
    const creditUsed = vendor.creditUsed || 0;
    const creditRemaining = Math.max(0, creditLimit - creditUsed);
    const creditUtilization = creditLimit > 0
      ? (creditUsed / creditLimit) * 100
      : 0;

    // Check if credit is overdue
    const now = new Date();
    const isOverdue = vendor.creditPolicy.dueDate && now > vendor.creditPolicy.dueDate;
    const daysOverdue = isOverdue && vendor.creditPolicy.dueDate
      ? Math.floor((now - vendor.creditPolicy.dueDate) / (1000 * 60 * 60 * 24))
      : 0;

    // Calculate penalty if overdue
    let penalty = 0;
    if (isOverdue && vendor.creditPolicy.penaltyRate > 0) {
      const dailyPenaltyRate = vendor.creditPolicy.penaltyRate / 100;
      penalty = creditUsed * dailyPenaltyRate * daysOverdue;
    }

    // Get recent orders
    const recentOrders = await Order.find({
      vendorId: vendor._id,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name phone')
      .select('orderNumber status totalAmount paymentStatus createdAt')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        overview: {
          orders: {
            pending: pendingOrders,
            awaiting: awaitingOrders,
            processing: processingOrders,
            total: pendingOrders + awaitingOrders + processingOrders,
          },
          inventory: {
            totalProducts,
            lowStockCount: lowStockProducts.length,
            lowStockItems: lowStockProducts,
          },
          credit: {
            limit: creditLimit,
            used: creditUsed,
            remaining: creditRemaining,
            utilization: Math.round(creditUtilization * 100) / 100,
            dueDate: vendor.creditPolicy.dueDate,
            isOverdue,
            daysOverdue,
            penalty: Math.round(penalty * 100) / 100,
            penaltyRate: vendor.creditPolicy.penaltyRate,
          },
          recentOrders,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// ORDER MANAGEMENT CONTROLLERS
// ============================================================================

// Auto-confirm expired acceptances (runs in background)
async function processExpiredAcceptances(vendorId) {
  try {
    const now = new Date();
    const expiredOrders = await Order.find({
      vendorId,
      'acceptanceGracePeriod.isActive': true,
      'acceptanceGracePeriod.expiresAt': { $lte: now },
    });

    if (expiredOrders.length === 0) {
      return;
    }

    for (const order of expiredOrders) {
      const previousStatus = order.acceptanceGracePeriod?.previousStatus || ORDER_STATUS.AWAITING;

      order.acceptanceGracePeriod.isActive = false;
      order.acceptanceGracePeriod.confirmedAt = now;
      order.status = ORDER_STATUS.ACCEPTED;
      order.assignedTo = 'vendor';

      order.statusTimeline.push({
        status: ORDER_STATUS.ACCEPTED,
        timestamp: now,
        updatedBy: 'system',
        note: `Order acceptance auto-confirmed after 1-hour grace period expired (previous status: ${previousStatus}).`,
      });

      await order.save();

      // Deduct stock from inventory
      await deductStockFromInventory(order, vendorId);

      console.log(`✅ Order ${order.orderNumber} auto-confirmed after grace period expired`);
    }
  } catch (error) {
    console.error(`Failed to process expired acceptances for vendor ${vendorId}:`, error);
  }
}

// Auto-finalize expired status update grace periods (runs in background)
async function processExpiredStatusUpdates(vendorId) {
  try {
    const now = new Date();
    const expiredStatusUpdates = await Order.find({
      vendorId: vendorId,
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
    console.error(`Failed to process expired status updates for vendor ${vendorId}:`, error);
  }
}

/**
 * @desc    Get all orders with filtering
 * @route   GET /api/vendors/orders
 * @access  Private (Vendor)
 */
exports.getOrders = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    // Process expired acceptances and status updates in background (non-blocking)
    processExpiredAcceptances(vendor._id).catch(() => { });
    processExpiredStatusUpdates(vendor._id).catch(() => { });
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      escalated,
    } = req.query;

    // Build query - orders assigned to this vendor
    // Primary condition: vendorId must match
    const vendorIdForQuery = vendor._id;

    // Build the query - start simple and add conditions
    const query = {
      vendorId: vendorIdForQuery,
    };

    // Handle escalated filter
    if (escalated === 'true' || escalated === true) {
      // For escalated orders, show only orders that:
      // 1. Are escalated (assignedTo: 'admin' OR escalation.isEscalated: true OR status: 'rejected')
      // 2. AND (status: 'awaiting' OR (status: 'accepted' AND assignedTo: 'admin'))
      // This includes: Escalated && Awaiting (waiting for admin acceptance)
      //              AND Escalated && Accepted (admin accepted to fulfill from warehouse)
      query.$and = [
        {
          $or: [
            { assignedTo: 'admin' },
            { 'escalation.isEscalated': true },
            { status: 'rejected' }
          ]
        },
        {
          $or: [
            // Escalated && Awaiting (not yet accepted by admin)
            {
              $and: [
                { status: 'awaiting' },
                {
                  $or: [
                    { assignedTo: 'admin' },
                    { 'escalation.isEscalated': true }
                  ]
                }
              ]
            },
            // Escalated && Accepted (admin accepted to fulfill from warehouse)
            {
              $and: [
                { status: 'accepted' },
                { assignedTo: 'admin' }
              ]
            }
          ]
        }
      ];
    } else {
      // For normal orders (including "All Orders"), include:
      // 1. Orders assigned to vendor (or not set for compatibility)
      // 2. Escalated orders (so they appear in "All Orders" view as well)
      query.$or = [
        { assignedTo: 'vendor' },
        { assignedTo: { $exists: false } },
        { assignedTo: null },
        // Include escalated orders in "All Orders"
        { assignedTo: 'admin' },
        { 'escalation.isEscalated': true },
        { status: 'rejected' }
      ];
    }

    // Debug logging
    console.log(`🔍 Vendor ${vendor.name} fetching orders`);
    console.log(`   Vendor ID: ${vendorIdForQuery}`);
    console.log(`   Vendor ID (string): ${vendorIdForQuery.toString()}`);
    console.log(`📍 Vendor location: ${vendor.location?.city || 'No city'}, ${vendor.location?.state || 'No state'}`);
    console.log(`📋 Base Query structure:`, {
      vendorId: vendorIdForQuery.toString(),
      $or: query.$or
    });

    // Apply status filter if provided (but ignore if it's the string "undefined")
    if (status && status !== 'undefined' && status !== 'null') {
      // Special handling for "delivered" filter: include both delivered and fully_paid orders
      if (status === 'delivered') {
        // Use $in operator to match either 'delivered' or 'fully_paid' status
        query.status = { $in: ['delivered', 'fully_paid'] };
      } else {
        query.status = status;
      }
      console.log(`📋 Query with status filter '${status}':`, {
        vendorId: query.vendorId.toString(),
        $or: query.$or,
        status: query.status
      });
    } else if (status === 'undefined' || status === 'null') {
      console.log(`⚠️ Ignoring invalid status filter: '${status}'`);
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
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
      .populate('seller', 'sellerId name')
      .populate('items.productId', 'name sku category')
      .select('-__v')
      .lean();

    const total = await Order.countDocuments(query);

    // Debug logging - Always log for troubleshooting
    console.log(`📦 Vendor ${vendor.name} (${vendor._id}) orders query result: ${orders.length} orders found (total: ${total})`);
    console.log(`📋 Final Query:`, JSON.stringify(query, null, 2));

    // Check if there are any orders with this vendorId at all (regardless of assignedTo)
    const allOrdersForVendor = await Order.find({ vendorId: vendor._id }).countDocuments();
    console.log(`   Total orders with vendorId ${vendor._id.toString()}: ${allOrdersForVendor}`);

    if (allOrdersForVendor > 0 && orders.length === 0) {
      // There are orders for this vendor but they don't match the query
      // Get sample orders to see what's in the database
      const sampleOrders = await Order.find({ vendorId: vendor._id })
        .limit(5)
        .select('orderNumber vendorId assignedTo status createdAt')
        .lean();
      console.log(`   ⚠️ Found ${allOrdersForVendor} orders with vendorId, but none match query. Sample orders:`);
      sampleOrders.forEach((o, idx) => {
        console.log(`      [${idx + 1}] Order ${o.orderNumber}:`);
        console.log(`          - vendorId: ${o.vendorId?.toString() || 'null'} (type: ${o.vendorId?.constructor?.name || 'unknown'})`);
        console.log(`          - assignedTo: ${o.assignedTo || 'NOT SET'} (type: ${typeof o.assignedTo})`);
        console.log(`          - status: ${o.status || 'NOT SET'}`);
        console.log(`          - createdAt: ${o.createdAt || 'NOT SET'}`);
        console.log(`          - vendorId match: ${o.vendorId?.toString() === vendor._id.toString() ? 'YES' : 'NO'}`);
      });

      // Check if any orders have assignedTo set to something other than 'vendor'
      const ordersWithDifferentAssignedTo = await Order.find({
        vendorId: vendor._id,
        assignedTo: { $ne: 'vendor', $exists: true }
      }).countDocuments();
      console.log(`   Orders with vendorId but assignedTo != 'vendor': ${ordersWithDifferentAssignedTo}`);

      const ordersWithoutAssignedTo = await Order.find({
        vendorId: vendor._id,
        assignedTo: { $exists: false }
      }).countDocuments();
      console.log(`   Orders with vendorId but assignedTo not set: ${ordersWithoutAssignedTo}`);

      // Try a simpler query to see if we can find the orders
      const simpleQueryOrders = await Order.find({ vendorId: vendor._id })
        .limit(3)
        .select('orderNumber vendorId assignedTo status')
        .lean();
      console.log(`   Simple query (vendorId only) found ${simpleQueryOrders.length} orders`);
    }

    res.status(200).json({
      success: true,
      data: {
        orders,
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
 * @desc    Get order details
 * @route   GET /api/vendors/orders/:orderId
 * @access  Private (Vendor)
 */
exports.getOrderDetails = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { orderId } = req.params;

    // Process expired acceptances in background (non-blocking)
    processExpiredAcceptances(vendor._id).catch(() => { });

    const order = await Order.findOne({
      _id: orderId,
      vendorId: vendor._id,
    })
      .populate('userId', 'name phone email location')
      .populate('seller', 'sellerId name')
      .populate('items.productId', 'name sku category priceToUser imageUrl')
      .select('-__v');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you',
      });
    }

    // Enrich order items with vendor stock info
    const orderObject = order.toObject({ virtuals: true });
    const productIds = orderObject.items
      .map((item) => {
        if (!item.productId) return null;
        return item.productId._id ? item.productId._id.toString() : item.productId.toString();
      })
      .filter(Boolean);

    let assignmentMap = {};
    if (productIds.length > 0) {
      const assignments = await ProductAssignment.find({
        vendorId: vendor._id,
        productId: { $in: productIds },
      })
        .select('productId stock updatedAt lastRestockedAt')
        .lean();

      assignmentMap = assignments.reduce((acc, assignment) => {
        acc[assignment.productId.toString()] = assignment;
        return acc;
      }, {});
    }

    orderObject.items = orderObject.items.map((item) => {
      const productId = item.productId?._id
        ? item.productId._id.toString()
        : item.productId?.toString();
      const assignment = productId ? assignmentMap[productId] : null;
      const vendorStock = assignment?.stock ?? assignment?.vendorStock ?? 0;

      // Convert variantAttributes Map to object for JSON response
      const variantAttrs = item.variantAttributes instanceof Map
        ? Object.fromEntries(item.variantAttributes)
        : item.variantAttributes || {}

      return {
        ...item,
        vendorStock,
        vendorStockUpdatedAt: assignment?.updatedAt || assignment?.lastRestockedAt || null,
        variantAttributes: Object.keys(variantAttrs).length > 0 ? variantAttrs : undefined,
      };
    });

    // Get order payments
    const Payment = require('../models/Payment');
    const payments = await Payment.find({ orderId })
      .sort({ createdAt: -1 })
      .select('-__v')
      .lean();

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
        order: orderObject,
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
 * @desc    Accept order (full availability)
 * @route   POST /api/vendors/orders/:orderId/accept
 * @access  Private (Vendor)
 */
exports.acceptOrder = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { orderId } = req.params;
    const { notes } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      vendorId: vendor._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you',
      });
    }

    const currentStatus = order.status || ORDER_STATUS.AWAITING;
    const canAcceptStatuses = [ORDER_STATUS.AWAITING, ORDER_STATUS.PENDING];

    if (!canAcceptStatuses.includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be accepted. Current status: ${order.status}`,
      });
    }

    // Check if order is already in grace period
    if (order.acceptanceGracePeriod?.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Order acceptance is already in progress. Please confirm or cancel the acceptance.',
      });
    }

    // Start grace period - don't immediately accept
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    const normalizedPreviousStatus = currentStatus === ORDER_STATUS.PENDING ? ORDER_STATUS.AWAITING : currentStatus;

    order.acceptanceGracePeriod = {
      isActive: true,
      acceptedAt: now,
      expiresAt: expiresAt,
      previousStatus: normalizedPreviousStatus,
    };
    order.status = ORDER_STATUS.ACCEPTED;
    order.assignedTo = 'vendor';

    // Add note if provided
    if (notes) {
      order.notes = `${order.notes || ''}\n[Vendor Initial Acceptance] ${notes}`.trim();
    }

    // Update status timeline
    order.statusTimeline.push({
      status: ORDER_STATUS.ACCEPTED,
      timestamp: now,
      updatedBy: 'vendor',
      note: 'Order acceptance initiated. Vendor has 1 hour to confirm or revert to awaiting.',
    });

    await order.save();

    console.log(`⏳ Order ${order.orderNumber} acceptance grace period started by vendor ${vendor.name}. Expires at: ${expiresAt}`);

    res.status(200).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          acceptanceGracePeriod: order.acceptanceGracePeriod,
        },
        message: 'Order acceptance initiated. You have 1 hour to confirm or escalate. Order will auto-confirm after 1 hour if no action is taken.',
        gracePeriodExpiresAt: expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm order acceptance (finalize after grace period)
 * @route   POST /api/vendors/orders/:orderId/confirm-acceptance
 * @access  Private (Vendor)
 */
exports.confirmOrderAcceptance = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { orderId } = req.params;
    const { notes } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      vendorId: vendor._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you',
      });
    }

    // Check if order is in grace period
    if (!order.acceptanceGracePeriod?.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Order is not in acceptance grace period. Cannot confirm.',
      });
    }

    // Check if grace period has expired
    const now = new Date();
    if (order.acceptanceGracePeriod.expiresAt < now) {
      return res.status(400).json({
        success: false,
        message: 'Grace period has expired. Order should be auto-confirmed.',
      });
    }

    // Finalize acceptance
    const confirmedAt = new Date();
    order.acceptanceGracePeriod.isActive = false;
    order.acceptanceGracePeriod.confirmedAt = confirmedAt;
    order.status = ORDER_STATUS.ACCEPTED;
    order.assignedTo = 'vendor';

    // Add note if provided
    if (notes) {
      order.notes = `${order.notes || ''}\n[Vendor Confirmed Acceptance] ${notes}`.trim();
    }

    // Update status timeline
    order.statusTimeline.push({
      status: ORDER_STATUS.ACCEPTED,
      timestamp: confirmedAt,
      updatedBy: 'vendor',
      note: 'Order acceptance confirmed by vendor. Ready for dispatch workflow.',
    });

    await order.save();

    // Deduct stock from inventory
    await deductStockFromInventory(order, vendor._id);

    console.log(`✅ Order ${order.orderNumber} acceptance confirmed by vendor ${vendor.name}`);

    res.status(200).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          stockDeducted: order.stockDeducted
        },
        message: 'Order acceptance confirmed successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel order acceptance during grace period (allows escalation)
 * @route   POST /api/vendors/orders/:orderId/cancel-acceptance
 * @access  Private (Vendor)
 */
exports.cancelOrderAcceptance = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: orderId,
      vendorId: vendor._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you',
      });
    }

    // Check if order is in grace period
    if (!order.acceptanceGracePeriod?.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Order is not in acceptance grace period. Cannot cancel.',
      });
    }

    // Cancel acceptance - reset to pending
    const cancelledAt = new Date();
    order.acceptanceGracePeriod.isActive = false;
    order.acceptanceGracePeriod.cancelledAt = cancelledAt;
    const previousStatus = order.acceptanceGracePeriod?.previousStatus || ORDER_STATUS.AWAITING;
    order.status = previousStatus;
    // Keep assignedTo as 'vendor' so vendor can still escalate

    // Add note
    const cancelReason = reason || 'Vendor cancelled acceptance during grace period';
    order.notes = `${order.notes || ''}\n[Vendor Cancelled Acceptance] ${cancelReason}`.trim();

    // Update status timeline
    order.statusTimeline.push({
      status: previousStatus,
      timestamp: cancelledAt,
      updatedBy: 'vendor',
      note: `Order acceptance cancelled by vendor. Reason: ${cancelReason}`,
    });

    await order.save();

    console.log(`⚠️ Order ${order.orderNumber} acceptance cancelled by vendor ${vendor.name}. Reason: ${cancelReason}`);

    res.status(200).json({
      success: true,
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
        },
        message: 'Order acceptance cancelled. You can now escalate the order if needed.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Auto-confirm orders after grace period expires
 * @desc    This should be called periodically (e.g., every 5 minutes via cron job)
 * @access  Internal
 */
exports.autoConfirmExpiredAcceptances = async () => {
  try {
    const now = new Date();
    const expiredOrders = await Order.find({
      'acceptanceGracePeriod.isActive': true,
      'acceptanceGracePeriod.expiresAt': { $lte: now },
    });

    if (expiredOrders.length === 0) {
      return { confirmed: 0 };
    }

    let confirmedCount = 0;
    for (const order of expiredOrders) {
      const previousStatus = order.acceptanceGracePeriod?.previousStatus || ORDER_STATUS.AWAITING;
      order.acceptanceGracePeriod.isActive = false;
      order.acceptanceGracePeriod.confirmedAt = now;
      order.status = ORDER_STATUS.ACCEPTED;
      order.assignedTo = 'vendor';

      order.statusTimeline.push({
        status: ORDER_STATUS.ACCEPTED,
        timestamp: now,
        updatedBy: 'system',
        note: `Order acceptance auto-confirmed after 1-hour grace period expired (previous status: ${previousStatus}).`,
      });

      await order.save();

      // Deduct stock from inventory
      if (order.vendorId) {
        await deductStockFromInventory(order, order.vendorId);
      }

      confirmedCount++;
      console.log(`✅ Order ${order.orderNumber} auto-confirmed after grace period expired`);
    }

    return { confirmed: confirmedCount };
  } catch (error) {
    console.error('Error auto-confirming expired acceptances:', error);
    throw error;
  }
};

/**
 * @desc    Reject order (escalate to Admin)
 * @route   POST /api/vendors/orders/:orderId/reject
 * @access  Private (Vendor)
 */
exports.rejectOrder = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { orderId } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      vendorId: vendor._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you',
      });
    }

    // Allow rejection if order is pending/awaiting OR in grace period
    const isInGracePeriod = order.acceptanceGracePeriod?.isActive;
    const canRejectStatuses = ['pending', 'awaiting'];
    if (!canRejectStatuses.includes(order.status) && !isInGracePeriod) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be rejected. Current status: ${order.status}`,
      });
    }

    // If in grace period, cancel the acceptance first
    if (isInGracePeriod) {
      order.acceptanceGracePeriod.isActive = false;
      order.acceptanceGracePeriod.cancelledAt = new Date();
    }

    // Reject order - escalate to admin
    order.assignedTo = 'admin'; // Escalate to admin
    order.status = 'rejected'; // Mark as rejected by vendor

    // Track escalation details
    order.escalation = {
      isEscalated: true,
      escalatedAt: new Date(),
      escalatedBy: 'vendor',
      escalationReason: reason,
      escalationType: 'full',
      escalatedItems: order.items.map(item => {
        // Convert variantAttributes Map to object
        const variantAttrs = item.variantAttributes instanceof Map
          ? Object.fromEntries(item.variantAttributes)
          : item.variantAttributes || {}

        return {
          itemId: item._id,
          productId: item.productId,
          productName: item.productName,
          requestedQuantity: item.quantity,
          availableQuantity: 0, // Will be calculated if needed
          escalatedQuantity: item.quantity,
          reason: reason,
          // Preserve variant attributes
          variantAttributes: Object.keys(variantAttrs).length > 0 ? variantAttrs : undefined,
        }
      }),
      originalVendorId: order.vendorId, // Keep reference to original vendor
    };

    // Keep vendorId for reference but mark as escalated
    // Don't remove vendorId so we can track which vendor escalated

    // Add rejection details
    order.notes = `${order.notes || ''}\n[Vendor Escalation] Reason: ${reason}${notes ? ` | Notes: ${notes}` : ''}`.trim();

    // Update status timeline
    order.statusTimeline.push({
      status: 'rejected',
      timestamp: new Date(),
      updatedBy: 'vendor',
      note: `Order escalated to admin by vendor. Reason: ${reason}`,
    });

    // RESTORE STOCK (Since vendor is strictly rejecting it, we give it back to them digitally,
    // and let Admin take the hit when Admin fulfills it later)
    for (const item of order.items) {
      if (order.vendorId) {
        const assignment = await ProductAssignment.findOne({
          vendorId: order.vendorId,
          productId: item.productId,
          isActive: true
        });

        if (assignment) {
          // Restore Global Stock
          assignment.stock = (assignment.stock || 0) + item.quantity;

          // Restore Attribute Stock
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
              console.log(`📦 VENDOR Stock RESTORED (Variant) for ${item.productName}: ${item.quantity}`);
            }
          }
          await assignment.save();
          console.log(`📦 VENDOR Stock RESTORED (Global) for ${item.productName}: ${item.quantity}`);
        }
      }
    }

    await order.save();

    // TODO: Send notification to admin and user

    console.log(`⚠️ Order ${order.orderNumber} rejected by vendor ${vendor.name}. Reason: ${reason}`);

    res.status(200).json({
      success: true,
      data: {
        order,
        message: 'Order rejected and escalated to admin',
      },
    });

    // Create Admin TODO Task
    try {
      await adminTaskController.createTaskInternal({
        title: 'Order Escalated: Rejection',
        description: `Order #${order.orderNumber} was rejected by vendor "${vendor.name}". Reason: ${reason}. Admin needs to fulfill from warehouse or reassign.`,
        category: 'order',
        priority: 'high',
        link: `/orders/${order._id}`,
        relatedId: order._id,
        metadata: {
          orderNumber: order.orderNumber,
          vendorName: vendor.name,
          reason: reason
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
 * @desc    Partially accept order (splits order)
 * @route   POST /api/vendors/orders/:orderId/accept-partial
 * @access  Private (Vendor)
 */
exports.acceptOrderPartially = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { orderId } = req.params;
    const { acceptedItems, rejectedItems, notes } = req.body;

    if (!acceptedItems || !Array.isArray(acceptedItems) || acceptedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one accepted item is required',
      });
    }

    if (!rejectedItems || !Array.isArray(rejectedItems) || rejectedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one rejected item is required for partial acceptance',
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      vendorId: vendor._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you',
      });
    }

    // Allow partial acceptance if order is pending or awaiting
    const canPartiallyAcceptStatuses = ['pending', 'awaiting'];
    if (!canPartiallyAcceptStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be partially accepted. Current status: ${order.status}`,
      });
    }

    // Get original order items for calculations
    const originalItems = order.items.map(item => item.toObject ? item.toObject() : item);

    // Calculate accepted order total
    const acceptedTotal = originalItems
      .filter(item => acceptedItems.some(ai => ai.itemId && ai.itemId.toString() === item._id.toString()))
      .reduce((sum, item) => {
        const acceptedItem = acceptedItems.find(ai => ai.itemId && ai.itemId.toString() === item._id.toString());
        const quantity = acceptedItem.quantity || item.quantity;
        return sum + (item.unitPrice * quantity);
      }, 0);

    // Calculate rejected order total
    const rejectedTotal = originalItems
      .filter(item => rejectedItems.some(ri => ri.itemId && ri.itemId.toString() === item._id.toString()))
      .reduce((sum, item) => {
        const rejectedItem = rejectedItems.find(ri => ri.itemId && ri.itemId.toString() === item._id.toString());
        const quantity = rejectedItem.quantity || item.quantity;
        return sum + (item.unitPrice * quantity);
      }, 0);

    // Create vendor order (accepted items)
    const vendorOrderItems = originalItems
      .filter(item => acceptedItems.some(ai => ai.itemId && ai.itemId.toString() === item._id.toString()))
      .map(item => {
        const acceptedItem = acceptedItems.find(ai => ai.itemId && ai.itemId.toString() === item._id.toString());
        const itemPayload = {
          productId: item.productId,
          productName: item.productName,
          quantity: acceptedItem.quantity || item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * (acceptedItem.quantity || item.quantity),
        };
        // Preserve variant attributes if present
        if (item.variantAttributes) {
          itemPayload.variantAttributes = item.variantAttributes
        } else if (item.attributeCombination || item.attributes) {
          // Fallback for legacy data
          itemPayload.attributeCombination = item.attributeCombination || item.attributes;
        }
        return itemPayload;
      });

    order.items = vendorOrderItems;
    order.totalAmount = acceptedTotal;
    order.status = 'partially_accepted';
    order.assignedTo = 'vendor';

    if (notes) {
      order.notes = `${order.notes || ''}\n[Vendor Partial Acceptance] ${notes}`.trim();
    }

    // Update status timeline
    order.statusTimeline.push({
      status: 'partially_accepted',
      timestamp: new Date(),
      updatedBy: 'vendor',
      note: 'Order partially accepted. Some items escalated to admin.',
    });

    await order.save();

    // Deduct stock from inventory for the accepted portion
    await deductStockFromInventory(order, vendor._id);

    // Save vendor order first to get original items
    const originalOrder = await Order.findById(orderId).lean();

    // Create admin order (rejected items) - escalated order
    const adminOrderItems = originalOrder.items
      .filter(item => rejectedItems.some(ri => ri.itemId && ri.itemId.toString() === item._id.toString()))
      .map(item => {
        const rejectedItem = rejectedItems.find(ri => ri.itemId && ri.itemId.toString() === item._id.toString());
        const itemPayload = {
          productId: item.productId,
          productName: item.productName,
          quantity: rejectedItem.quantity || item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * (rejectedItem.quantity || item.quantity),
        };
        // Preserve variant attributes if present
        if (item.variantAttributes) {
          itemPayload.variantAttributes = item.variantAttributes
        } else if (item.attributeCombination || item.attributes) {
          // Fallback for legacy data
          itemPayload.attributeCombination = item.attributeCombination || item.attributes;
        }
        return itemPayload;
      });

    // Get escalation details
    const escalatedItemsDetails = originalOrder.items
      .filter(item => rejectedItems.some(ri => ri.itemId && ri.itemId.toString() === item._id.toString()))
      .map(item => {
        const rejectedItem = rejectedItems.find(ri => ri.itemId && ri.itemId.toString() === item._id.toString());
        const escalationItem = {
          itemId: item._id,
          productId: item.productId,
          productName: item.productName,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          escalatedQuantity: rejectedItem.quantity || item.quantity,
          reason: rejectedItem.reason || notes || 'Item not available',
        };
        // Preserve variant attributes if present
        if (item.variantAttributes) {
          const variantAttrs = item.variantAttributes instanceof Map
            ? Object.fromEntries(item.variantAttributes)
            : item.variantAttributes
          if (Object.keys(variantAttrs).length > 0) {
            const variantAttributesMap = new Map()
            Object.keys(variantAttrs).forEach(key => {
              variantAttributesMap.set(key, String(variantAttrs[key]))
            })
            escalationItem.variantAttributes = variantAttributesMap
          }
        } else if (item.attributeCombination || item.attributes) {
          // Fallback for legacy data
          escalationItem.attributeCombination = item.attributeCombination || item.attributes;
        }
        return escalationItem;
      });

    // Generate new order number for admin order
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(date);
    todayEnd.setHours(23, 59, 59, 999);
    const todayCount = await Order.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });
    const sequence = String(todayCount + 1).padStart(4, '0');
    const orderNumber = `ORD-${dateStr}-${sequence}`;

    const adminOrder = await Order.create({
      orderNumber,
      userId: order.userId,
      sellerId: order.sellerId,
      seller: order.seller,
      vendorId: null, // Not assigned to any vendor
      assignedTo: 'admin',
      items: adminOrderItems,
      subtotal: rejectedTotal,
      deliveryCharge: 0,
      totalAmount: rejectedTotal,
      paymentPreference: order.paymentPreference,
      upfrontAmount: order.paymentPreference === 'full' ? rejectedTotal : Math.round(rejectedTotal * 0.3),
      remainingAmount: order.paymentPreference === 'full' ? 0 : rejectedTotal - Math.round(rejectedTotal * 0.3),
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      parentOrderId: order._id, // Link to original order
      deliveryAddress: order.deliveryAddress,
      status: 'rejected', // Escalated to admin
      escalation: {
        isEscalated: true,
        escalatedAt: new Date(),
        escalatedBy: 'vendor',
        escalationReason: notes || 'Items not available',
        escalationType: 'partial',
        escalatedItems: escalatedItemsDetails,
        originalVendorId: vendor._id,
      },
      notes: `[Escalated from Order ${order.orderNumber}] Items rejected by vendor.${notes ? ` ${notes}` : ''}`,
      statusTimeline: [{
        status: 'rejected',
        timestamp: new Date(),
        updatedBy: 'vendor',
        note: 'Order escalated to admin due to partial rejection by vendor',
      }],
    });

    // Link original order to admin order
    order.childOrderIds = order.childOrderIds || [];
    order.childOrderIds.push(adminOrder._id);
    await order.save();

    // TODO: Send notifications to admin and user

    console.log(`⚠️ Order ${order.orderNumber} partially accepted by vendor ${vendor.name}. Admin order created: ${adminOrder.orderNumber}`);

    res.status(200).json({
      success: true,
      data: {
        vendorOrder: order,
        adminOrder,
        message: 'Order partially accepted. Rejected items escalated to admin.',
      },
    });

    // Create Admin TODO Task
    try {
      await adminTaskController.createTaskInternal({
        title: 'Order Escalated: Partial Items Rejected',
        description: `Order #${order.orderNumber} was partially accepted by vendor "${vendor.name}". Some items were rejected and escalated to Admin order #${adminOrder.orderNumber}.`,
        category: 'order',
        priority: 'high',
        link: `/orders/${adminOrder._id}`,
        relatedId: adminOrder._id,
        metadata: {
          originalOrderNumber: order.orderNumber,
          adminOrderNumber: adminOrder.orderNumber,
          vendorName: vendor.name
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
 * @desc    Escalate order with partial quantities (Scenario 3)
 * @route   POST /api/vendors/orders/:orderId/escalate-partial
 * @access  Private (Vendor)
 */
exports.escalateOrderPartial = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { orderId } = req.params;
    const { escalatedItems, reason, notes } = req.body;

    if (!escalatedItems || !Array.isArray(escalatedItems) || escalatedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Escalated items are required',
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Escalation reason is required',
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      vendorId: vendor._id,
    }).populate('items.productId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you',
      });
    }

    // Allow escalation if order is pending or awaiting
    const canEscalateStatuses = ['pending', 'awaiting'];
    if (!canEscalateStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be escalated. Current status: ${order.status}`,
      });
    }

    const ProductAssignment = require('../models/ProductAssignment');
    const escalatedItemsDetails = [];
    const acceptedItems = [];
    let escalatedTotal = 0;
    let acceptedTotal = 0;

    // Process each item in the order
    for (const orderItem of order.items) {
      const escalatedItem = escalatedItems.find(
        ei => ei.itemId && ei.itemId.toString() === orderItem._id.toString()
      );

      if (escalatedItem) {
        // This item (or part of it) is being escalated
        const assignment = await ProductAssignment.findOne({
          productId: orderItem.productId,
          vendorId: vendor._id,
        });
        const availableStock = assignment?.stock || 0;
        const requestedQty = orderItem.quantity;
        const escalatedQty = escalatedItem.escalatedQuantity || requestedQty;
        const acceptedQty = requestedQty - escalatedQty;

        if (escalatedQty > 0) {
          const escalationItem = {
            itemId: orderItem._id,
            productId: orderItem.productId,
            productName: orderItem.productName,
            requestedQuantity: requestedQty,
            availableQuantity: availableStock,
            escalatedQuantity: escalatedQty,
            reason: escalatedItem.reason || reason,
          };
          // Preserve variant attributes if present
          if (orderItem.variantAttributes) {
            const variantAttrs = orderItem.variantAttributes instanceof Map
              ? Object.fromEntries(orderItem.variantAttributes)
              : orderItem.variantAttributes
            if (Object.keys(variantAttrs).length > 0) {
              const variantAttributesMap = new Map()
              Object.keys(variantAttrs).forEach(key => {
                variantAttributesMap.set(key, String(variantAttrs[key]))
              })
              escalationItem.variantAttributes = variantAttributesMap
            }
          } else if (orderItem.attributeCombination || orderItem.attributes) {
            // Fallback for legacy data
            escalationItem.attributeCombination = orderItem.attributeCombination || orderItem.attributes;
          }
          escalatedItemsDetails.push(escalationItem);
          escalatedTotal += orderItem.unitPrice * escalatedQty;
        }

        if (acceptedQty > 0) {
          const acceptedItem = {
            ...orderItem.toObject(),
            quantity: acceptedQty,
            totalPrice: orderItem.unitPrice * acceptedQty,
          };
          // Preserve variant attributes if present
          if (orderItem.variantAttributes) {
            acceptedItem.variantAttributes = orderItem.variantAttributes
          } else if (orderItem.attributeCombination || orderItem.attributes) {
            // Fallback for legacy data
            acceptedItem.attributeCombination = orderItem.attributeCombination || orderItem.attributes;
          }
          acceptedItems.push(acceptedItem);
          acceptedTotal += orderItem.unitPrice * acceptedQty;
        }
      } else {
        // Item is fully accepted
        const fullAcceptedItem = orderItem.toObject();
        // Preserve variant attributes if present
        if (orderItem.variantAttributes) {
          fullAcceptedItem.variantAttributes = orderItem.variantAttributes
        } else if (orderItem.attributeCombination || orderItem.attributes) {
          // Fallback for legacy data
          fullAcceptedItem.attributeCombination = orderItem.attributeCombination || orderItem.attributes;
        }
        acceptedItems.push(fullAcceptedItem);
        acceptedTotal += orderItem.totalPrice;
      }
    }

    // Update order with accepted items
    order.items = acceptedItems;
    order.subtotal = acceptedTotal;
    order.totalAmount = acceptedTotal + (order.deliveryCharge || 0);
    order.status = 'partially_accepted';
    order.assignedTo = 'vendor';

    // Create escalated order for admin
    const escalatedOrderItems = escalatedItemsDetails.map(ei => {
      const originalItem = order.items.find(item => item.productId.toString() === ei.productId.toString());
      const itemPayload = {
        productId: ei.productId,
        productName: ei.productName,
        quantity: ei.escalatedQuantity,
        unitPrice: originalItem?.unitPrice || 0,
        totalPrice: (originalItem?.unitPrice || 0) * ei.escalatedQuantity,
        status: 'pending',
      };
      // Preserve variant attributes if present
      if (ei.variantAttributes) {
        const variantAttrs = ei.variantAttributes instanceof Map
          ? Object.fromEntries(ei.variantAttributes)
          : ei.variantAttributes
        if (Object.keys(variantAttrs).length > 0) {
          const variantAttributesMap = new Map()
          Object.keys(variantAttrs).forEach(key => {
            variantAttributesMap.set(key, String(variantAttrs[key]))
          })
          itemPayload.variantAttributes = variantAttributesMap
        }
      } else if (originalItem && originalItem.variantAttributes) {
        itemPayload.variantAttributes = originalItem.variantAttributes
      } else if (ei.attributeCombination || (originalItem && (originalItem.attributeCombination || originalItem.attributes))) {
        // Fallback for legacy data
        itemPayload.attributeCombination = ei.attributeCombination || originalItem.attributeCombination || originalItem.attributes;
      }
      return itemPayload;
    });

    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(date);
    todayEnd.setHours(23, 59, 59, 999);
    const todayCount = await Order.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });
    const sequence = String(todayCount + 1).padStart(4, '0');
    const escalatedOrderNumber = `ORD-${dateStr}-${sequence}`;

    const escalatedOrder = await Order.create({
      orderNumber: escalatedOrderNumber,
      userId: order.userId,
      sellerId: order.sellerId,
      seller: order.seller,
      vendorId: null,
      assignedTo: 'admin',
      items: escalatedOrderItems,
      subtotal: escalatedTotal,
      deliveryCharge: 0, // Admin handles delivery
      totalAmount: escalatedTotal,
      paymentPreference: order.paymentPreference,
      upfrontAmount: order.paymentPreference === 'full' ? escalatedTotal : Math.round(escalatedTotal * 0.3),
      remainingAmount: order.paymentPreference === 'full' ? 0 : escalatedTotal - Math.round(escalatedTotal * 0.3),
      paymentStatus: order.paymentStatus,
      deliveryAddress: order.deliveryAddress,
      status: 'rejected',
      parentOrderId: order._id,
      escalation: {
        isEscalated: true,
        escalatedAt: new Date(),
        escalatedBy: 'vendor',
        escalationReason: reason,
        escalationType: 'quantity',
        escalatedItems: escalatedItemsDetails,
        originalVendorId: vendor._id,
      },
      notes: `[Escalated from Order ${order.orderNumber}] Partial quantity escalated by vendor. Reason: ${reason}${notes ? ` | Notes: ${notes}` : ''}`,
      statusTimeline: [{
        status: 'rejected',
        timestamp: new Date(),
        updatedBy: 'vendor',
        note: `Partial quantity escalated to admin. Reason: ${reason}`,
      }],
    });

    // Link orders
    order.childOrderIds = order.childOrderIds || [];
    order.childOrderIds.push(escalatedOrder._id);
    order.notes = `${order.notes || ''}\n[Partial Escalation] Some quantities escalated to admin. Reason: ${reason}`.trim();
    order.statusTimeline.push({
      status: 'partially_accepted',
      timestamp: new Date(),
      updatedBy: 'vendor',
      note: `Order partially accepted. Some quantities escalated to admin.`,
    });

    await order.save();

    // Deduct stock from inventory for the accepted portion
    await deductStockFromInventory(order, vendor._id);

    console.log(`⚠️ Order ${order.orderNumber} partially escalated by vendor ${vendor.name}. Escalated order: ${escalatedOrder.orderNumber}`);

    res.status(200).json({
      success: true,
      data: {
        vendorOrder: order,
        escalatedOrder,
        message: 'Order partially accepted. Escalated quantities sent to admin.',
      },
    });

    // Create Admin TODO Task
    try {
      await adminTaskController.createTaskInternal({
        title: 'Order Escalated: Partial Quantity Rejected',
        description: `Order #${order.orderNumber} was partially accepted by vendor "${vendor.name}". Some quantities were rejected and escalated to Admin order #${escalatedOrder.orderNumber}.`,
        category: 'order',
        priority: 'high',
        link: `/orders/${escalatedOrder._id}`,
        relatedId: escalatedOrder._id,
        metadata: {
          originalOrderNumber: order.orderNumber,
          adminOrderNumber: escalatedOrder.orderNumber,
          vendorName: vendor.name,
          reason: reason
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
 * @desc    Update order status
 * @route   PUT /api/vendors/orders/:orderId/status
 * @access  Private (Vendor)
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { orderId } = req.params;
    const { status, notes, finalizeGracePeriod } = req.body;

    // If finalizing grace period, status is not required
    if (!finalizeGracePeriod && !status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    // Valid status transitions for vendor (only validate if status is provided)
    if (status) {
      const validStatuses = ['awaiting', 'accepted', 'processing', 'dispatched', 'delivered', 'fully_paid'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
        });
      }
    }

    const order = await Order.findOne({
      _id: orderId,
      vendorId: vendor._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you',
      });
    }

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
            ...order.toObject(),
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
    }

    // Prevent updates once the workflow is complete (after grace period)
    if (!hasActiveGracePeriod && normalizedCurrentStatus === finalStageStatus) {
      return res.status(400).json({
        success: false,
        message: 'Order has already completed its workflow. Further updates are not allowed.',
      });
    }

    // Allow fully_paid only after delivered and for partial payment preference
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

    // Validate status transition order
    const currentIndex = statusFlow.indexOf(normalizedCurrentStatus);
    const newIndex = statusFlow.indexOf(normalizedNewStatus);

    if (newIndex === -1 && normalizedNewStatus !== ORDER_STATUS.FULLY_PAID) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status. ${status} is not part of the workflow for this payment preference.`,
      });
    }

    // If reverting to previous status during grace period, allow it
    const isReverting = hasActiveGracePeriod &&
      order.statusUpdateGracePeriod.previousStatus === normalizedNewStatus;

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
        updatedBy: 'vendor',
        previousPaymentStatus: undefined,
        previousRemainingAmount: undefined,
        ...extra,
      };
    };

    const finalizeStatusUpdateGracePeriod = () => {
      order.statusUpdateGracePeriod.isActive = false;
      order.statusUpdateGracePeriod.finalizedAt = now;
    };

    // If status is fully_paid, update order + payment status together
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
      // Update order status for all other statuses
      order.status = normalizedNewStatus;

      // Start grace period for status changes (not for reverts)
      if (isStatusChange && !isReverting) {
        startGracePeriod();
      } else if (isReverting && order.statusUpdateGracePeriod?.isActive) {
        // Reverting to previous status - end grace period and restore payment state if needed
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

    // Add note if provided
    if (notes) {
      order.notes = `${order.notes || ''}\n[Status Update] ${notes}`.trim();
    }

    // Update status timeline
    const timelineStatus = order.status;
    const timelineNote = isReverting
      ? (notes || `Status reverted to ${timelineStatus} from ${previousStatus}`)
      : (notes || `Order status updated to ${timelineStatus}`);

    order.statusTimeline.push({
      status: timelineStatus,
      timestamp: now,
      updatedBy: 'vendor',
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
          : `Order status updated to ${timelineStatus}`;

    console.log(`✅ Order ${order.orderNumber} status updated to ${status} by vendor ${vendor.name}${hasGracePeriod ? ' (grace period active)' : normalizedNewStatus === ORDER_STATUS.FULLY_PAID ? ' (no grace period - immediately finalized)' : ''}`);

    res.status(200).json({
      success: true,
      data: {
        order: {
          ...order.toObject(),
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
 * @desc    Get order statistics
 * @route   GET /api/vendors/orders/stats
 * @access  Private (Vendor)
 */
exports.getOrderStats = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { period = '30' } = req.query; // days

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // Order status breakdown
    const statusBreakdown = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
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

    // Total sales (delivered orders)
    const salesData = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: daysAgo },
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

    // Daily trends
    const dailyTrends = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          createdAt: { $gte: daysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
          sales: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'delivered'] }, { $eq: ['$paymentStatus', 'fully_paid'] }] },
                '$totalAmount',
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: parseInt(period),
        statusBreakdown,
        sales: salesData[0] || {
          totalSales: 0,
          orderCount: 0,
          averageOrderValue: 0,
        },
        dailyTrends,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// INVENTORY MANAGEMENT CONTROLLERS
// ============================================================================

/**
 * @desc    Get all products available for ordering (not just assigned)
 * @route   GET /api/vendors/products
 * @access  Private (Vendor)
 */
exports.getProducts = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    await processPendingDeliveries(vendor._id);
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query - only show active products
    const query = { isActive: true };

    if (category) {
      query.category = category.toLowerCase();
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get all active products (vendors can see all products to order)
    const products = await Product.find(query)
      .select('name description category priceToVendor displayStock actualStock images sku weight expiry attributeStocks')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Check which products are assigned to this vendor
    const productIds = products.map(p => p._id);
    let ordersCountMap = {};

    if (productIds.length > 0) {
      const ordersCounts = await Order.aggregate([
        {
          $match: {
            vendorId: vendor._id,
            'items.productId': { $in: productIds },
          },
        },
        { $unwind: '$items' },
        {
          $match: {
            'items.productId': { $in: productIds },
          },
        },
        {
          $group: {
            _id: '$items.productId',
            ordersCount: { $sum: 1 },
          },
        },
      ]);

      ordersCountMap = ordersCounts.reduce((acc, item) => {
        acc[item._id.toString()] = item.ordersCount;
        return acc;
      }, {});
    }
    const assignments = await ProductAssignment.find({
      vendorId: vendor._id,
      productId: { $in: productIds },
      isActive: true,
    }).lean();

    const assignedProductIds = new Set(assignments.map(a => a.productId.toString()));

    // Check for incoming deliveries (approved purchases within 24 hours)
    // Only show if delivery hasn't been completed yet
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const incomingPurchases = await CreditPurchase.find({
      vendorId: vendor._id,
      status: 'approved',
      deliveryStatus: { $in: ['scheduled', 'in_transit'] },
      expectedDeliveryAt: {
        $gte: now, // Only future deliveries
        $lte: twentyFourHoursFromNow, // Within 24 hours
      },
    })
      .select('items expectedDeliveryAt deliveryStatus')
      .lean();

    // Create a map of productId -> incoming delivery info
    const incomingDeliveryMap = {};
    incomingPurchases.forEach((purchase) => {
      purchase.items.forEach((item) => {
        const productIdStr = item.productId?.toString();
        if (productIdStr) {
          if (!incomingDeliveryMap[productIdStr]) {
            incomingDeliveryMap[productIdStr] = {
              isArrivingWithin24Hours: true,
              expectedDeliveryAt: purchase.expectedDeliveryAt,
              deliveryStatus: purchase.deliveryStatus,
            };
          }
        }
      });
    });

    // Enrich products with assignment status and vendor-specific info
    const enrichedProducts = products.map(product => {
      const isAssigned = assignedProductIds.has(product._id.toString());
      const assignment = assignments.find(a => a.productId.toString() === product._id.toString());
      const adminStock = product.displayStock ?? product.stock ?? 0;
      const vendorStock = assignment?.stock ?? 0;
      const incomingDelivery = incomingDeliveryMap[product._id.toString()];

      return {
        ...product,
        id: product._id,
        isAssigned,
        assignmentId: assignment?._id || null,
        adminStock,
        vendorStock,
        vendorOrdersCount: ordersCountMap[product._id.toString()] || 0,
        // Stock available for ordering is admin managed stock
        stock: adminStock,
        stockStatus: adminStock > 0 ? 'in_stock' : 'out_of_stock',
        pricePerUnit: product.priceToVendor,
        unit: product.weight?.unit || 'kg',
        primaryImage: product.images?.find(img => img.isPrimary)?.url || product.images?.[0]?.url || null,
        // Incoming delivery info
        isArrivingWithin24Hours: incomingDelivery?.isArrivingWithin24Hours || false,
        expectedDeliveryAt: incomingDelivery?.expectedDeliveryAt || null,
      };
    });

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        products: enrichedProducts,
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
 * @desc    Get single product details for vendor
 * @route   GET /api/vendors/products/:productId
 * @access  Private (Vendor)
 */
exports.getProductDetails = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .select('name description category priceToVendor displayStock actualStock images sku weight expiry brand specifications tags attributeStocks')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check if product is assigned to this vendor
    const assignment = await ProductAssignment.findOne({
      vendorId: vendor._id,
      productId: product._id,
      isActive: true,
    }).lean();

    const vendorOrdersCount = await Order.countDocuments({
      vendorId: vendor._id,
      'items.productId': product._id,
    });

    // Calculate how many orders the vendor has fulfilled for this product
    const ordersAggregation = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          items: { $elemMatch: { productId: product._id } },
        },
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.productId': product._id,
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' },
        },
      },
    ]);

    const ordersInfo = ordersAggregation[0] || { totalOrders: 0, totalQuantity: 0 };

    res.status(200).json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          description: product.description,
          category: product.category,
          priceToVendor: product.priceToVendor,
          pricePerUnit: product.priceToVendor,
          adminStock: product.displayStock ?? product.stock ?? 0,
          vendorStock: assignment?.stock ?? 0,
          vendorOrdersCount,
          stockStatus: (product.displayStock ?? product.stock ?? 0) > 0 ? 'in_stock' : 'out_of_stock',
          images: product.images,
          primaryImage: product.images?.find(img => img.isPrimary)?.url || product.images?.[0]?.url || null,
          sku: product.sku,
          weight: product.weight,
          unit: product.weight?.unit || 'kg',
          expiry: product.expiry,
          brand: product.brand,
          specifications: product.specifications,
          tags: product.tags,
          attributeStocks: product.attributeStocks || [], // Include attributeStocks for variants
          isAssigned: !!assignment,
          assignmentId: assignment?._id || null,
          ordersFulfilled: ordersInfo.totalOrders,
          quantitySupplied: ordersInfo.totalQuantity,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory items (assigned products)
 * @route   GET /api/vendors/inventory
 * @access  Private (Vendor)
 */
exports.getInventory = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    await processPendingDeliveries(vendor._id);
    const {
      page = 1,
      limit = 20,
      category,
      search,
      isActive,
      sortBy = 'assignedAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query = { vendorId: vendor._id };

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get product assignments
    let assignments = await ProductAssignment.find(query)
      .populate('productId', 'name sku category priceToUser imageUrl description')
      .populate('assignedBy', 'name email')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v')
      .lean();

    // Filter by category or search if needed
    if (category) {
      assignments = assignments.filter(a => a.productId && a.productId.category === category);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      assignments = assignments.filter(a =>
        a.productId && (
          a.productId.name.toLowerCase().includes(searchLower) ||
          a.productId.sku.toLowerCase().includes(searchLower)
        )
      );
    }

    const total = await ProductAssignment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        inventory: assignments,
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
 * @desc    Get inventory item details
 * @route   GET /api/vendors/inventory/:itemId
 * @access  Private (Vendor)
 */
exports.getInventoryItemDetails = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { itemId } = req.params;

    const assignment = await ProductAssignment.findOne({
      _id: itemId,
      vendorId: vendor._id,
    })
      .populate('productId')
      .populate('assignedBy', 'name email')
      .select('-__v');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found or not assigned to you',
      });
    }

    // Get order count for this product from this vendor
    const orderCount = await Order.countDocuments({
      vendorId: vendor._id,
      'items.productId': assignment.productId._id,
      status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
    });

    res.status(200).json({
      success: true,
      data: {
        assignment,
        statistics: {
          orderCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update inventory stock (placeholder - stock tracking to be added to ProductAssignment model)
 * @route   PUT /api/vendors/inventory/:itemId/stock
 * @access  Private (Vendor)
 */
exports.updateInventoryStock = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { itemId } = req.params;
    const { stock, notes } = req.body;

    if (stock === undefined || stock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid stock quantity is required (≥ 0)',
      });
    }

    const assignment = await ProductAssignment.findOne({
      _id: itemId,
      vendorId: vendor._id,
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found or not assigned to you',
      });
    }

    // Support for both global stock and attribute-specific stock if provided
    const { attributeStocks: updatedAttributeStocks } = req.body;

    if (stock !== undefined) {
      assignment.stock = stock;
      assignment.lastManualStockUpdate = new Date();
    }

    if (updatedAttributeStocks && Array.isArray(updatedAttributeStocks)) {
      assignment.attributeStocks = updatedAttributeStocks;
      assignment.lastManualStockUpdate = new Date();
    }

    if (notes) {
      assignment.notes = `${assignment.notes || ''}\n[${new Date().toISOString()}] ${notes}`.trim();
    }

    await assignment.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Stock updated successfully',
        assignment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get inventory statistics
 * @route   GET /api/vendors/inventory/stats
 * @access  Private (Vendor)
 */
exports.getInventoryStats = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    // Get all assigned products
    const totalProducts = await ProductAssignment.countDocuments({
      vendorId: vendor._id,
      isActive: true,
    });

    // Get products by category
    const assignments = await ProductAssignment.find({
      vendorId: vendor._id,
      isActive: true,
    }).populate('productId', 'category');

    const categoryBreakdown = {};
    assignments.forEach(assignment => {
      if (assignment.productId && assignment.productId.category) {
        const category = assignment.productId.category;
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
      }
    });

    // Get top ordered products
    const topProducts = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
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
        $sort: { totalQuantity: -1 },
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
        totalProducts,
        categoryBreakdown,
        topProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CREDIT MANAGEMENT CONTROLLERS
// ============================================================================

/**
 * @desc    Get credit information
 * @route   GET /api/vendors/credit
 * @access  Private (Vendor)
 */
exports.getCreditInfo = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    const creditUsed = vendor.creditUsed || 0;

    // Check for unpaid credits
    const now = new Date();
    const repaymentDays = vendor.creditPolicy.repaymentDays || 30;
    const unpaidPurchases = await CreditPurchase.find({
      vendorId: vendor._id,
      status: 'approved',
      $or: [
        { deliveryStatus: { $in: ['pending', 'scheduled', 'in_transit'] } },
        {
          deliveryStatus: 'delivered',
          deliveredAt: {
            $gte: new Date(now.getTime() - repaymentDays * 24 * 60 * 60 * 1000),
          },
        },
      ],
    }).select('totalAmount deliveredAt deliveryStatus createdAt');

    const totalUnpaidAmount = unpaidPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    // Check if credit is overdue
    const isOverdue = vendor.creditPolicy.dueDate && now > vendor.creditPolicy.dueDate;
    const daysOverdue = isOverdue && vendor.creditPolicy.dueDate
      ? Math.floor((now - vendor.creditPolicy.dueDate) / (1000 * 60 * 60 * 24))
      : 0;

    // Calculate penalty if overdue
    let penalty = 0;
    const penaltyRate = vendor.creditPolicy.penaltyRate || 2;
    if (isOverdue && penaltyRate > 0) {
      const dailyPenaltyRate = penaltyRate / 100;
      penalty = creditUsed * dailyPenaltyRate * daysOverdue;
    }

    // Days until due
    const daysUntilDue = vendor.creditPolicy.dueDate && !isOverdue
      ? Math.ceil((vendor.creditPolicy.dueDate - now) / (1000 * 60 * 60 * 24))
      : null;

    res.status(200).json({
      success: true,
      data: {
        credit: {
          used: creditUsed,
          totalUnpaid: totalUnpaidAmount,
          unpaidCount: unpaidPurchases.length,
          dueDate: vendor.creditPolicy.dueDate,
          repaymentDays: vendor.creditPolicy.repaymentDays || 30,
          penaltyRate: penaltyRate,
        },
        status: {
          isOverdue,
          daysOverdue,
          daysUntilDue,
          penalty: Math.round(penalty * 100) / 100,
          status: isOverdue ? 'overdue' : daysUntilDue !== null && daysUntilDue <= 7 ? 'dueSoon' : 'active',
          hasUnpaidCredits: unpaidPurchases.length > 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request credit purchase
 * @route   POST /api/vendors/credit/purchase
 * @access  Private (Vendor)
 */
exports.requestCreditPurchase = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const {
      items,
      notes,
      reason,
      bankDetails = {},
      confirmationText,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product must be included in the request.',
      });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Provide a brief reason (minimum 10 characters) for the stock request.',
      });
    }

    if (!confirmationText || confirmationText.trim().toLowerCase() !== 'confirm') {
      return res.status(400).json({
        success: false,
        message: 'Type "confirm" to acknowledge the credit policy and submit the request.',
      });
    }

    const requiredBankFields = ['accountName', 'accountNumber', 'bankName', 'ifsc'];
    const missingField = requiredBankFields.find((field) => !bankDetails[field] || !bankDetails[field].trim());
    if (missingField) {
      return res.status(400).json({
        success: false,
        message: 'Complete bank details are required (account holder, number, bank name, IFSC).',
      });
    }

    const sanitizedBankDetails = {
      accountName: bankDetails.accountName.trim(),
      accountNumber: bankDetails.accountNumber.toString().trim(),
      bankName: bankDetails.bankName.trim(),
      ifsc: bankDetails.ifsc.trim().toUpperCase(),
      branch: bankDetails.bankBranch?.trim() || bankDetails.branch?.trim() || '',
    };

    if (sanitizedBankDetails.accountNumber.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Account number looks incomplete.',
      });
    }

    if (sanitizedBankDetails.ifsc.length < 4) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid IFSC code.',
      });
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    })
      .select('name priceToVendor displayStock stock weight attributeStocks')
      .lean();

    const productMap = products.reduce((acc, product) => {
      acc[product._id.toString()] = product;
      return acc;
    }, {});

    let totalAmount = 0;
    const purchaseItems = items.map((item) => {
      const productId = item.productId?.toString();
      const product = productMap[productId];
      if (!product) {
        throw new Error('One of the selected products is no longer available.');
      }

      // Check if product has attributes and if attributeCombination is provided
      const hasAttributes = product.attributeStocks &&
        Array.isArray(product.attributeStocks) &&
        product.attributeStocks.length > 0;
      const attributeCombination = item.attributeCombination || {};

      if (hasAttributes && Object.keys(attributeCombination).length === 0) {
        throw new Error(`Product ${product.name} requires attribute selection.`);
      }

      // Find matching attributeStock if attributes are provided
      let matchingAttributeStock = null;
      if (hasAttributes && Object.keys(attributeCombination).length > 0) {
        matchingAttributeStock = product.attributeStocks.find(stock => {
          if (!stock.attributes || typeof stock.attributes !== 'object') return false
          // Handle both Map and plain object
          const stockAttrs = stock.attributes instanceof Map
            ? Object.fromEntries(stock.attributes)
            : stock.attributes
          return Object.keys(attributeCombination).every(key => {
            return stockAttrs[key] === attributeCombination[key]
          })
        })

        if (!matchingAttributeStock) {
          throw new Error(`Selected variant for ${product.name} is not available.`);
        }
      }

      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) {
        throw new Error('Each item must include a valid quantity.');
      }

      // Use attribute-specific stock/price if available, otherwise use main product values
      const adminStock = matchingAttributeStock
        ? (matchingAttributeStock.displayStock || 0)
        : (product.displayStock ?? product.stock ?? 0)

      if (quantity > adminStock) {
        throw new Error(`Requested quantity for ${product.name} exceeds admin stock (${adminStock}).`);
      }

      const unitPrice = matchingAttributeStock
        ? (matchingAttributeStock.vendorPrice || 0)
        : (Number(product.priceToVendor) || 0)
      const totalPrice = quantity * unitPrice;
      totalAmount += totalPrice;

      const itemPayload = {
        productId: productId,
        productName: product.name,
        quantity,
        unitPrice,
        totalPrice,
        unit: matchingAttributeStock?.stockUnit || product.weight?.unit || 'kg',
      };

      // Add attribute combination if provided
      // Convert to Map format for MongoDB schema
      if (hasAttributes && Object.keys(attributeCombination).length > 0) {
        // Convert plain object to Map for MongoDB
        const attributeMap = new Map();
        Object.entries(attributeCombination).forEach(([key, value]) => {
          attributeMap.set(key, String(value));
        });
        itemPayload.attributeCombination = attributeMap;
      }

      return itemPayload;
    });

    if (totalAmount < MIN_VENDOR_PURCHASE) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value is ₹${MIN_VENDOR_PURCHASE.toLocaleString('en-IN')}.`,
      });
    }

    if (totalAmount > MAX_VENDOR_PURCHASE) {
      return res.status(400).json({
        success: false,
        message: `Maximum order value is ₹${MAX_VENDOR_PURCHASE.toLocaleString('en-IN')}. Your request: ₹${totalAmount.toLocaleString('en-IN')}.`,
      });
    }

    // Check for unpaid credits
    const now = new Date();
    const repaymentDays = vendor.creditPolicy.repaymentDays || 30;
    const unpaidPurchases = await CreditPurchase.find({
      vendorId: vendor._id,
      status: 'approved',
      $or: [
        { deliveryStatus: { $in: ['pending', 'scheduled', 'in_transit'] } },
        {
          deliveryStatus: 'delivered',
          deliveredAt: {
            $gte: new Date(now.getTime() - repaymentDays * 24 * 60 * 60 * 1000),
          },
        },
      ],
    }).select('totalAmount deliveredAt deliveryStatus createdAt');

    const hasUnpaidCredits = unpaidPurchases.length > 0;
    const totalUnpaidAmount = unpaidPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    // Generate unique credit purchase ID
    const creditPurchaseId = await generateUniqueId(CreditPurchase, 'CRP', 'creditPurchaseId', 101);

    const purchase = await CreditPurchase.create({
      creditPurchaseId,
      vendorId: vendor._id,
      items: purchaseItems,
      totalAmount,
      status: 'pending',
      notes: notes?.trim() || undefined,
      reason: reason.trim(),
      bankDetails: sanitizedBankDetails,
      confirmationText: confirmationText.trim(),
      deliveryStatus: 'pending',
      hasOutstandingDues: hasUnpaidCredits,
      outstandingDuesAmount: totalUnpaidAmount,
    });

    console.log(`✅ Credit purchase requested: ₹${totalAmount} by vendor ${vendor.name} - ${vendor._id}`);

    res.status(201).json({
      success: true,
      data: {
        purchase,
        message: 'Credit purchase request submitted successfully. Awaiting admin approval.',
      },
    });

    // Create Admin TODO Task
    try {
      await adminTaskController.createTaskInternal({
        title: 'New Credit Purchase Request',
        description: `Vendor "${vendor.name}" (${vendor.phone}) requested stock worth ₹${totalAmount.toLocaleString('en-IN')}. Reason: ${reason.substring(0, 100)}...`,
        category: 'finance',
        priority: 'high',
        link: '/vendors/purchase-requests',
        relatedId: purchase._id,
        metadata: {
          vendorName: vendor.name,
          amount: totalAmount,
          purchaseId: purchase.creditPurchaseId
        }
      });
    } catch (taskError) {
      console.error('Failed to create admin task:', taskError);
    }
  } catch (error) {
    if (error.message && error.message.includes('exceeds admin stock')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * @desc    Get credit purchase requests
 * @route   GET /api/vendors/credit/purchases
 * @access  Private (Vendor)
 */
exports.getCreditPurchases = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { vendorId: vendor._id };

    if (status) {
      query.status = status;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const purchases = await CreditPurchase.find(query)
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v')
      .lean();

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
 * @desc    Get credit purchase details
 * @route   GET /api/vendors/credit/purchases/:requestId
 * @access  Private (Vendor)
 */
exports.getCreditPurchaseDetails = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { requestId } = req.params;

    const purchase = await CreditPurchase.findOne({
      _id: requestId,
      vendorId: vendor._id,
    })
      .populate('reviewedBy', 'name email')
      .populate('items.productId', 'name sku category')
      .select('-__v');

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Credit purchase request not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        purchase,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get credit history
 * @route   GET /api/vendors/credit/history
 * @access  Private (Vendor)
 */
exports.getCreditHistory = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { page = 1, limit = 20, period = '30' } = req.query;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const query = {
      vendorId: vendor._id,
      createdAt: { $gte: daysAgo },
    };

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const purchases = await CreditPurchase.find(query)
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-__v')
      .lean();

    // Calculate summary
    const summary = await CreditPurchase.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]);

    const total = await CreditPurchase.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        purchases,
        summary,
        period: parseInt(period),
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
// REPORTS & ANALYTICS CONTROLLERS
// ============================================================================

/**
 * @desc    Get reports data
 * @route   GET /api/vendors/reports
 * @access  Private (Vendor)
 */
exports.getReports = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { period = '30', type = 'summary' } = req.query;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // Revenue summary
    const revenueData = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          status: { $in: [ORDER_STATUS.DELIVERED, ORDER_STATUS.FULLY_PAID] },
          paymentStatus: PAYMENT_STATUS.FULLY_PAID,
          createdAt: { $gte: daysAgo },
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

    // Order breakdown
    const orderBreakdown = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
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

    // Payment summary
    const Payment = require('../models/Payment');
    const vendorOrderIds = await Order.distinct('_id', {
      vendorId: vendor._id,
      createdAt: { $gte: daysAgo },
    });

    const paymentData = await Payment.aggregate([
      {
        $match: {
          orderId: { $in: vendorOrderIds },
          status: 'fully_paid',
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: parseInt(period),
        type,
        revenue: revenueData[0] || {
          totalRevenue: 0,
          orderCount: 0,
          averageOrderValue: 0,
        },
        orders: {
          breakdown: orderBreakdown,
          total: orderBreakdown.reduce((sum, item) => sum + item.count, 0),
        },
        payments: {
          breakdown: paymentData,
          total: paymentData.reduce((sum, item) => sum + item.totalAmount, 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get performance analytics
 * @route   GET /api/vendors/reports/analytics
 * @access  Private (Vendor)
 */
exports.getPerformanceAnalytics = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { period = '30' } = req.query;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // Sales trends
    const salesTrends = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
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

    // Top products
    const topProducts = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
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

    // User region stats (if user location data available)
    const userRegionStats = await Order.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          status: 'delivered',
          paymentStatus: 'fully_paid',
          createdAt: { $gte: daysAgo },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $group: {
          _id: {
            city: '$user.location.city',
            state: '$user.location.state',
          },
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          uniqueUsers: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          city: '$_id.city',
          state: '$_id.state',
          orderCount: 1,
          totalRevenue: 1,
          uniqueCustomers: { $size: '$uniqueUsers' },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: parseInt(period),
        analytics: {
          salesTrends,
          topProducts,
          userRegionStats,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// EARNINGS CONTROLLERS
// ============================================================================

/**
 * @desc    Get vendor earnings summary
 * @route   GET /api/vendors/earnings
 * @access  Private (Vendor)
 */
exports.getEarningsSummary = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    // Calculate total earnings (lifetime)
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

    // Calculate pending withdrawal amount
    const pendingWithdrawals = await WithdrawalRequest.aggregate([
      {
        $match: {
          vendorId: vendor._id,
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

    const pendingWithdrawalAmount = pendingWithdrawals[0]?.totalAmount || 0;

    // Calculate available balance (total earnings - pending withdrawals)
    const availableBalance = totalEarnings - pendingWithdrawalAmount;

    // Calculate this month's earnings
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEarningsResult = await VendorEarning.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          status: 'processed',
          processedAt: { $gte: monthStart },
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$earnings' },
        },
      },
    ]);

    const thisMonthEarnings = thisMonthEarningsResult[0]?.totalEarnings || 0;

    // Calculate total withdrawn amount (approved and completed withdrawals)
    const totalWithdrawnResult = await WithdrawalRequest.aggregate([
      {
        $match: {
          vendorId: vendor._id,
          status: { $in: ['approved', 'completed'] },
        },
      },
      {
        $group: {
          _id: null,
          totalWithdrawn: { $sum: '$amount' },
        },
      },
    ]);

    const totalWithdrawn = totalWithdrawnResult[0]?.totalWithdrawn || 0;

    // Get last withdrawal date
    const lastWithdrawal = await WithdrawalRequest.findOne({
      vendorId: vendor._id,
      status: { $in: ['approved', 'completed'] },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        availableBalance: Math.round(availableBalance * 100) / 100,
        pendingWithdrawal: Math.round(pendingWithdrawalAmount * 100) / 100,
        totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        thisMonthEarnings: Math.round(thisMonthEarnings * 100) / 100,
        lastWithdrawalDate: lastWithdrawal?.createdAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get vendor earnings history
 * @route   GET /api/vendors/earnings/history
 * @access  Private (Vendor)
 */
exports.getEarningsHistory = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { page = 1, limit = 20, startDate, endDate, status } = req.query;

    const query = { vendorId: vendor._id };

    // Date filter
    if (startDate || endDate) {
      query.processedAt = {};
      if (startDate) {
        query.processedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.processedAt.$lte = new Date(endDate);
      }
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const earnings = await VendorEarning.find(query)
      .populate('orderId', 'orderNumber totalAmount')
      .populate('productId', 'name')
      .sort({ processedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await VendorEarning.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        earnings,
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
 * @desc    Get vendor earnings by orders
 * @route   GET /api/vendors/earnings/orders
 * @access  Private (Vendor)
 */
exports.getEarningsByOrders = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Group earnings by order
    const earningsByOrder = await VendorEarning.aggregate([
      {
        $match: {
          vendorId: vendor._id,
        },
      },
      {
        $group: {
          _id: '$orderId',
          totalEarnings: { $sum: '$earnings' },
          itemCount: { $sum: 1 },
          processedAt: { $max: '$processedAt' },
        },
      },
      {
        $sort: { processedAt: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: '_id',
          as: 'order',
        },
      },
      {
        $unwind: '$order',
      },
      {
        $project: {
          orderId: '$_id',
          orderNumber: '$order.orderNumber',
          totalEarnings: 1,
          itemCount: 1,
          processedAt: 1,
          orderTotal: '$order.totalAmount',
        },
      },
    ]);

    const total = await VendorEarning.distinct('orderId', { vendorId: vendor._id }).then(ids => ids.length);

    res.status(200).json({
      success: true,
      data: {
        earningsByOrder,
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
 * @desc    Get vendor available balance
 * @route   GET /api/vendors/balance
 * @access  Private (Vendor)
 */
exports.getBalance = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    // Calculate total earnings
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

    // Calculate pending withdrawal amount
    const pendingWithdrawals = await WithdrawalRequest.aggregate([
      {
        $match: {
          vendorId: vendor._id,
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

    const pendingWithdrawalAmount = pendingWithdrawals[0]?.totalAmount || 0;

    // Calculate available balance
    const availableBalance = totalEarnings - pendingWithdrawalAmount;

    res.status(200).json({
      success: true,
      data: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        availableBalance: Math.round(availableBalance * 100) / 100,
        pendingWithdrawal: Math.round(pendingWithdrawalAmount * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// WITHDRAWAL REQUEST CONTROLLERS
// ============================================================================

/**
 * @desc    Request withdrawal from earnings
 * @route   POST /api/vendors/withdrawals/request
 * @access  Private (Vendor)
 */
exports.requestWithdrawal = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { amount, bankAccountId } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Valid withdrawal amount is required (minimum ₹1,000)',
      });
    }

    // Check if vendor has a pending withdrawal request
    const existingPending = await WithdrawalRequest.findOne({
      vendorId: vendor._id,
      status: 'pending',
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request. Please wait for admin approval.',
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

    if (amount > availableBalance) {
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
        userId: vendor._id,
        userType: 'vendor',
      });

      if (!bankAccount) {
        return res.status(400).json({
          success: false,
          message: 'Bank account not found',
        });
      }
    } else {
      // Get primary bank account
      bankAccount = await BankAccount.findOne({
        userId: vendor._id,
        userType: 'vendor',
        isPrimary: true,
      });

      if (!bankAccount) {
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
      userType: 'vendor',
      vendorId: vendor._id,
      amount,
      availableBalance,
      bankAccountId: bankAccount._id,
      status: 'pending',
    });

    // Log to payment history
    try {
      await createPaymentHistory({
        activityType: 'vendor_withdrawal_requested',
        vendorId: vendor._id,
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
        description: `Vendor ${vendor.name} requested withdrawal of ₹${amount}`,
        metadata: {
          vendorName: vendor.name,
          vendorPhone: vendor.phone,
          availableBalance,
        },
      });
    } catch (historyError) {
      console.error('Error logging withdrawal history:', historyError);
      // Don't fail withdrawal if history logging fails
    }

    console.log(`✅ Withdrawal requested: ₹${amount} by vendor ${vendor.name} (${vendor.phone})`);

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
        title: 'New Withdrawal Request',
        description: `Vendor "${vendor.name}" (${vendor.phone}) requested withdrawal of ₹${amount.toLocaleString('en-IN')}.`,
        category: 'finance',
        priority: 'high',
        link: '/vendor-withdrawals',
        relatedId: withdrawal._id,
        metadata: {
          vendorName: vendor.name,
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
 * @desc    Get vendor withdrawal requests
 * @route   GET /api/vendors/withdrawals
 * @access  Private (Vendor)
 */
exports.getWithdrawals = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { page = 1, limit = 20, status } = req.query;

    const query = {
      vendorId: vendor._id,
      userType: 'vendor',
    };

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const withdrawals = await WithdrawalRequest.find(query)
      .populate('bankAccountId')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await WithdrawalRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
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

// ============================================================================
// BANK ACCOUNT CONTROLLERS
// ============================================================================

/**
 * @desc    Add bank account
 * @route   POST /api/vendors/bank-accounts
 * @access  Private (Vendor)
 */
exports.addBankAccount = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { accountHolderName, accountNumber, ifscCode, bankName, branchName, isPrimary = false } = req.body;

    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({
        success: false,
        message: 'Account holder name, account number, IFSC code, and bank name are required',
      });
    }

    const bankAccount = await createBankAccount({
      userId: vendor._id,
      userType: 'vendor',
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
 * @desc    Get vendor bank accounts
 * @route   GET /api/vendors/bank-accounts
 * @access  Private (Vendor)
 */
exports.getBankAccounts = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    const bankAccounts = await BankAccount.find({
      userId: vendor._id,
      userType: 'vendor',
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
 * @route   PUT /api/vendors/bank-accounts/:accountId
 * @access  Private (Vendor)
 */
exports.updateBankAccount = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { accountId } = req.params;
    const { accountHolderName, accountNumber, ifscCode, bankName, branchName, isPrimary } = req.body;

    const bankAccount = await BankAccount.findOne({
      _id: accountId,
      userId: vendor._id,
      userType: 'vendor',
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
 * @route   DELETE /api/vendors/bank-accounts/:accountId
 * @access  Private (Vendor)
 */
exports.deleteBankAccount = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { accountId } = req.params;

    const bankAccount = await BankAccount.findOne({
      _id: accountId,
      userId: vendor._id,
      userType: 'vendor',
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
// CREDIT REPAYMENT CONTROLLERS
// ============================================================================

/**
 * @desc    Create repayment payment intent (Razorpay)
 * @route   POST /api/vendors/credit/repayment/create-intent
 * @access  Private (Vendor)
 */
exports.createRepaymentIntent = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { amount, bankAccountId } = req.body;

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid repayment amount is required',
      });
    }

    const repaymentAmount = parseFloat(amount);

    // Check vendor has credit to repay
    const creditUsed = vendor.creditUsed || 0;
    if (creditUsed <= 0) {
      return res.status(400).json({
        success: false,
        message: 'You have no outstanding credit to repay',
      });
    }

    // Validate repayment amount doesn't exceed credit used
    if (repaymentAmount > creditUsed) {
      return res.status(400).json({
        success: false,
        message: `Repayment amount (₹${repaymentAmount.toLocaleString('en-IN')}) cannot exceed outstanding credit (₹${creditUsed.toLocaleString('en-IN')})`,
      });
    }

    // Bank account is optional - will be filled in Razorpay interface
    // We don't require bank account selection on our side
    let bankAccount = null;
    if (bankAccountId) {
      bankAccount = await BankAccount.findOne({
        _id: bankAccountId,
        userId: vendor._id,
        userType: 'vendor',
      });

      if (!bankAccount) {
        return res.status(404).json({
          success: false,
          message: 'Bank account not found',
        });
      }
    }
    // If no bankAccountId provided, that's fine - Razorpay will handle it

    // Calculate penalty if overdue
    const now = new Date();
    const isOverdue = vendor.creditPolicy.dueDate && now > vendor.creditPolicy.dueDate;
    const daysOverdue = isOverdue && vendor.creditPolicy.dueDate
      ? Math.floor((now - vendor.creditPolicy.dueDate) / (1000 * 60 * 60 * 24))
      : 0;

    let penaltyAmount = 0;
    const penaltyRate = vendor.creditPolicy.penaltyRate || 2;
    if (isOverdue && penaltyRate > 0) {
      const dailyPenaltyRate = penaltyRate / 100;
      penaltyAmount = creditUsed * dailyPenaltyRate * daysOverdue;
    }

    const totalAmount = repaymentAmount + penaltyAmount;

    // Generate repayment ID
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(date);
    todayEnd.setHours(23, 59, 59, 999);

    const todayCount = await CreditRepayment.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });
    const sequence = String(todayCount + 1).padStart(4, '0');
    const repaymentId = `REP-${dateStr}-${sequence}`;

    // Create Razorpay order for repayment
    const receipt = `REP-${vendor._id.toString().slice(-8)}-${Date.now()}`;
    console.log('[createRepaymentIntent] Creating Razorpay order for repayment:', {
      amount: totalAmount,
      receipt,
      repaymentId,
    });

    const razorpayOrder = await razorpayService.createOrder({
      amount: totalAmount,
      currency: 'INR',
      receipt: receipt,
      notes: {
        vendorId: vendor._id.toString(),
        vendorName: vendor.name,
        repaymentAmount: repaymentAmount.toString(),
        penaltyAmount: penaltyAmount.toString(),
        type: 'credit_repayment',
        repaymentId: repaymentId,
      },
    });

    console.log('[createRepaymentIntent] Razorpay order created:', razorpayOrder.id);

    // Create repayment record
    console.log('[createRepaymentIntent] Creating repayment record with data:', {
      repaymentId,
      vendorId: vendor._id,
      amount: repaymentAmount,
      totalAmount: totalAmount,
      penaltyAmount: penaltyAmount,
      creditUsedBefore: creditUsed,
      creditUsedAfter: creditUsed - repaymentAmount,
      status: 'pending',
      paymentMethod: 'razorpay',
      razorpayOrderId: razorpayOrder.id,
      bankAccountId: bankAccount?._id || null, // Optional - Razorpay will handle bank account
    });

    let repayment;
    try {
      repayment = await CreditRepayment.create({
        repaymentId: repaymentId, // Explicitly set repaymentId
        vendorId: vendor._id,
        amount: repaymentAmount,
        totalAmount: totalAmount,
        penaltyAmount: penaltyAmount,
        creditUsedBefore: creditUsed,
        creditUsedAfter: creditUsed - repaymentAmount, // Will be updated after confirmation
        status: 'pending',
        paymentMethod: 'razorpay',
        razorpayOrderId: razorpayOrder.id,
        bankAccountId: bankAccount?._id || undefined, // Optional - Razorpay will handle bank account
      });
      console.log('[createRepaymentIntent] Repayment record created successfully:', {
        _id: repayment._id,
        repaymentId: repayment.repaymentId,
        status: repayment.status,
      });
    } catch (createError) {
      console.error('[createRepaymentIntent] Error creating repayment record:', {
        message: createError.message,
        name: createError.name,
        errors: createError.errors,
        stack: createError.stack,
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to create repayment record',
        error: createError.message,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        repayment: {
          id: repayment._id,
          repaymentId: repayment.repaymentId,
          amount: repaymentAmount,
          totalAmount: totalAmount,
          penaltyAmount: penaltyAmount,
          creditUsedBefore: creditUsed,
          creditUsedAfter: creditUsed - repaymentAmount,
        },
        razorpay: {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder', // Frontend needs this for Razorpay checkout
        },
        bankAccount: bankAccount ? {
          id: bankAccount._id,
          accountHolderName: bankAccount.accountHolderName,
          accountNumber: bankAccount.accountNumber.slice(-4), // Last 4 digits only
          bankName: bankAccount.bankName,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm repayment after Razorpay payment
 * @route   POST /api/vendors/credit/repayment/confirm
 * @access  Private (Vendor)
 */
exports.confirmRepayment = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { repaymentId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    if (!repaymentId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Repayment ID, Razorpay payment ID, order ID, and signature are required',
      });
    }

    // Find repayment record
    const repayment = await CreditRepayment.findOne({
      _id: repaymentId,
      vendorId: vendor._id,
      status: 'pending',
    });

    if (!repayment) {
      return res.status(404).json({
        success: false,
        message: 'Repayment record not found or already processed',
      });
    }

    // Verify Razorpay signature
    const isValidSignature = razorpayService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValidSignature) {
      repayment.status = 'failed';
      repayment.failureReason = 'Invalid payment signature';
      await repayment.save();

      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Payment verification failed.',
      });
    }

    // Fetch payment details from Razorpay
    const paymentDetails = await razorpayService.fetchPayment(razorpayPaymentId);

    if (!paymentDetails || paymentDetails.status !== 'captured') {
      repayment.status = 'failed';
      repayment.failureReason = 'Payment not captured or failed';
      repayment.gatewayResponse = paymentDetails || {};
      await repayment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment not successful. Please try again.',
      });
    }

    // Verify payment amount matches
    const expectedAmountInPaise = Math.round(repayment.totalAmount * 100);
    if (paymentDetails.amount !== expectedAmountInPaise) {
      repayment.status = 'failed';
      repayment.failureReason = `Amount mismatch. Expected: ${expectedAmountInPaise}, Got: ${paymentDetails.amount}`;
      repayment.gatewayResponse = paymentDetails;
      await repayment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment amount mismatch. Please contact support.',
      });
    }

    // Start transaction to update vendor credit and repayment status
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update repayment record
      repayment.status = 'completed';
      repayment.razorpayPaymentId = razorpayPaymentId;
      repayment.razorpaySignature = razorpaySignature;
      repayment.gatewayResponse = paymentDetails;
      repayment.paidAt = new Date();
      await repayment.save({ session });

      // Update vendor credit used
      const vendorDoc = await Vendor.findById(vendor._id).session(session);
      const previousCreditUsed = vendorDoc.creditUsed || 0;
      const newCreditUsed = Math.max(0, previousCreditUsed - repayment.amount);

      vendorDoc.creditUsed = newCreditUsed;

      // Update due date if credit is fully repaid
      if (newCreditUsed === 0) {
        vendorDoc.creditPolicy.dueDate = undefined;
      }

      await vendorDoc.save({ session });

      // Update repayment record with actual credit used after
      repayment.creditUsedAfter = newCreditUsed;
      await repayment.save({ session });

      await session.commitTransaction();

      // Log to payment history
      try {
        await createPaymentHistory({
          activityType: 'vendor_credit_repayment',
          vendorId: vendor._id,
          amount: repayment.amount,
          status: 'completed',
          paymentMethod: 'razorpay',
          description: `Vendor credit repayment of ₹${repayment.amount}${repayment.penaltyAmount > 0 ? ` (including ₹${repayment.penaltyAmount} penalty)` : ''}`,
          metadata: {
            repaymentId: repayment.repaymentId,
            creditUsedBefore: repayment.creditUsedBefore,
            creditUsedAfter: newCreditUsed,
            penaltyAmount: repayment.penaltyAmount,
            razorpayPaymentId: razorpayPaymentId,
          },
          processedAt: new Date(),
        });
      } catch (historyError) {
        console.error('Error logging credit repayment to payment history:', historyError);
        // Don't fail repayment if history logging fails
      }

      console.log(`✅ Credit repayment completed: Vendor ${vendor.name} repaid ₹${repayment.amount.toLocaleString('en-IN')}. Credit: ${previousCreditUsed} → ${newCreditUsed}`);

      res.status(200).json({
        success: true,
        data: {
          repayment: {
            id: repayment._id,
            repaymentId: repayment.repaymentId,
            amount: repayment.amount,
            totalAmount: repayment.totalAmount,
            penaltyAmount: repayment.penaltyAmount,
            status: repayment.status,
            creditUsedBefore: repayment.creditUsedBefore,
            creditUsedAfter: repayment.creditUsedAfter,
            paidAt: repayment.paidAt,
          },
          vendor: {
            creditUsed: newCreditUsed,
            creditLimit: vendorDoc.creditPolicy.limit || 0,
            creditRemaining: (vendorDoc.creditPolicy.limit || 0) - newCreditUsed,
          },
        },
        message: 'Repayment completed successfully',
      });
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get repayment history
 * @route   GET /api/vendors/credit/repayment/history
 * @access  Private (Vendor)
 */
exports.getRepaymentHistory = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { page = 1, limit = 20, status } = req.query;

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
      .populate('bankAccountId', 'accountHolderName bankName accountNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-gatewayResponse -__v')
      .lean();

    const total = await CreditRepayment.countDocuments(query);

    // Calculate summary
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
// VENDOR NOTIFICATION CONTROLLERS
// ============================================================================

/**
 * @desc    Get vendor notifications
 * @route   GET /api/vendors/notifications
 * @access  Private (Vendor)
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    // Default limit to 4 as per requirement to show only latest few in bell icon
    const { page = 1, limit = 4, read, type } = req.query;

    // Clean up expired notifications (older than 24 hours)
    await VendorNotification.cleanupExpired();

    const query = { vendorId: vendor._id };

    // Filter by read status
    if (read !== undefined) {
      query.read = read === 'true';
    }

    // Filter by type
    if (type) {
      query.type = type;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const notifications = await VendorNotification.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await VendorNotification.countDocuments(query);
    const unreadCount = await VendorNotification.countDocuments({
      vendorId: vendor._id,
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
 * @route   PATCH /api/vendors/notifications/:notificationId/read
 * @access  Private (Vendor)
 */
exports.markNotificationAsRead = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { notificationId } = req.params;

    const notification = await VendorNotification.findOne({
      _id: notificationId,
      vendorId: vendor._id,
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
 * @route   PATCH /api/vendors/notifications/read-all
 * @access  Private (Vendor)
 */
exports.markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    const result = await VendorNotification.updateMany(
      {
        vendorId: vendor._id,
        read: false,
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        updatedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/vendors/notifications/:notificationId
 * @access  Private (Vendor)
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const vendor = req.vendor;
    const { notificationId } = req.params;

    const notification = await VendorNotification.findOneAndDelete({
      _id: notificationId,
      vendorId: vendor._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

