const mongoose = require('mongoose');

/**
 * Seller Schema (IRA Partner)
 * 
 * Field Agents / Seller Boys
 * Earn commission based on referred users' purchases
 * Monthly commission reset with tiered rates (2% up to ₹50,000, 3% above)
 */
const sellerSchema = new mongoose.Schema({
  sellerId: {
    type: String,
    required: [true, 'Seller ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    // Format: IRA-1001 or SLR-1001
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
    sparse: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  area: {
    type: String,
    // Village area assignment
  },
  location: {
    address: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  assignedVendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
  },
  monthlyTarget: {
    type: Number,
    default: 0,
    // Sales target in rupees (e.g., ₹1,00,000)
  },
  wallet: {
    balance: {
      type: Number,
      default: 0,
    },
    pending: {
      type: Number,
      default: 0,
      // Pending withdrawal requests
    },
  },
  commissionRates: {
    low: {
      type: Number,
      default: 2, // 2% up to ₹50,000 per user per month
    },
    high: {
      type: Number,
      default: 3, // 3% above ₹50,000 per user per month
    },
    threshold: {
      type: Number,
      default: 50000, // ₹50,000 threshold
    },
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending',
  },
  isActive: {
    type: Boolean,
    default: false, // Activated only after admin approval
  },
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  otp: {
    code: String,
    expiresAt: Date,
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

// Note: sellerId and phone already have indexes from unique: true

// Generate and store OTP
sellerSchema.methods.generateOTP = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  };
  return code;
};

// Verify OTP
sellerSchema.methods.verifyOTP = function (code) {
  if (!this.otp || !this.otp.code) return false;
  if (Date.now() > this.otp.expiresAt) return false;
  return this.otp.code === code;
};

// Clear OTP after use
sellerSchema.methods.clearOTP = function () {
  this.otp = undefined;
};

const Seller = mongoose.model('Seller', sellerSchema);

module.exports = Seller;

