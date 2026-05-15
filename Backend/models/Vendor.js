const mongoose = require('mongoose');

/**
 * Vendor Schema
 * 
 * Regional distributors (1 per 20km radius)
 * Registration requires location verification via Google Maps API
 * Geographic Coverage Rule: Only 1 vendor allowed per 20 km radius
 */
const vendorSchema = new mongoose.Schema({
  vendorId: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true,
    // Format: VND-101, VND-102, etc.
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^\+?[1-9]\d{9,14}$/, 'Please provide a valid phone number'],
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  location: {
    address: {
      type: String,
      required: true,
    },
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },
    coverageRadius: {
      type: Number,
      default: 20, // 20 km radius
    },
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended', 'temporarily_banned', 'permanently_banned'],
    default: 'pending',
  },
  creditLimit: {
    type: Number,
    default: 0,
  },
  creditUsed: {
    type: Number,
    default: 0,
  },
  creditPolicy: {
    repaymentDays: {
      type: Number,
      default: 30,
    },
    penaltyRate: {
      type: Number,
      default: 2, // 2% default penalty rate
    },
    dueDate: Date,
  },
  // Escalation tracking
  escalationCount: {
    type: Number,
    default: 0,
    // Track number of times vendor escalated orders to admin
  },
  escalationHistory: [{
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    escalatedAt: {
      type: Date,
      default: Date.now,
    },
    reason: String,
  }],
  // Ban management
  banInfo: {
    isBanned: {
      type: Boolean,
      default: false,
    },
    banType: {
      type: String,
      enum: ['none', 'temporary', 'permanent'],
      default: 'none',
    },
    bannedAt: Date,
    bannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    banReason: String,
    banExpiry: Date, // For temporary bans
    revokedAt: Date, // When temporary ban was revoked
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    revocationReason: String,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    // Soft delete for permanent ban (vendor ID deleted but activities persist)
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  deletionReason: String,
  otp: {
    code: String,
    expiresAt: Date,
  },
  isActive: {
    type: Boolean,
    default: false, // Inactive until approved by admin // Active by default on registration
  },
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  // Verification documents (images only, max 2MB)
  aadhaarCard: {
    url: {
      type: String,
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
    },
    format: {
      type: String,
      enum: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
    },
    size: {
      type: Number, // File size in bytes
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  panCard: {
    url: {
      type: String,
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
    },
    format: {
      type: String,
      enum: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
    },
    size: {
      type: Number, // File size in bytes
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  // FCM Push Notification Tokens
  fcmTokenWeb: {
    type: String,
    default: null,
    // Firebase Cloud Messaging token for web push notifications
  },
  fcmTokenApp: {
    type: String,
    default: null,
    // Firebase Cloud Messaging token for mobile app push notifications
  },
}, {
  timestamps: true,
});

// Index for location-based queries (20km radius)
vendorSchema.index({ 'location.coordinates': '2dsphere' });
// Note: vendorId already has an index from unique: true

// Generate and store OTP (always generates a new unique OTP)
vendorSchema.methods.generateOTP = function () {
  // Use crypto for better randomness (fallback to Math.random if not available)
  let code;
  try {
    const crypto = require('crypto');
    // Generate truly random 6-digit code
    const randomBytes = crypto.randomBytes(3);
    const randomNumber = randomBytes.readUIntBE(0, 3);
    code = (100000 + (randomNumber % 900000)).toString().padStart(6, '0');
  } catch (error) {
    // Fallback to Math.random if crypto is not available
    code = Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Always generate a new OTP (overwrite existing)
  this.otp = {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  };
  return code;
};

// Verify OTP
vendorSchema.methods.verifyOTP = function (code) {
  if (!this.otp || !this.otp.code) return false;
  if (Date.now() > this.otp.expiresAt) return false;
  return this.otp.code === code;
};

// Clear OTP after use
vendorSchema.methods.clearOTP = function () {
  this.otp = undefined;
};

const Vendor = mongoose.model('Vendor', vendorSchema);

module.exports = Vendor;

