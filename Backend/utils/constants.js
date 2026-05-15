/**
 * System Constants
 * 
 * Centralized constants based on PROJECT_OVERVIEW.md requirements
 */

// Financial Thresholds
const MIN_ORDER_VALUE = parseInt(process.env.MIN_ORDER_VALUE) || 2000;
const MIN_VENDOR_PURCHASE = parseInt(process.env.MIN_VENDOR_PURCHASE) || 50000;
const MAX_VENDOR_PURCHASE = parseInt(process.env.MAX_VENDOR_PURCHASE) || 100000;
const DELIVERY_CHARGE = parseInt(process.env.DELIVERY_CHARGE) || 50;

// Geographic Rules
const VENDOR_COVERAGE_RADIUS_KM = parseInt(process.env.VENDOR_COVERAGE_RADIUS_KM) || 20;
const VENDOR_ASSIGNMENT_BUFFER_KM = parseFloat(process.env.VENDOR_ASSIGNMENT_BUFFER_KM) || 0.3; // 300 meters buffer for order assignment
const VENDOR_ASSIGNMENT_MAX_RADIUS_KM = VENDOR_COVERAGE_RADIUS_KM + VENDOR_ASSIGNMENT_BUFFER_KM; // 20.3km total

// Delivery Policy
const DELIVERY_TIMELINE_HOURS = parseInt(process.env.DELIVERY_TIMELINE_HOURS) || 24;

// Payment Options
const ADVANCE_PAYMENT_PERCENTAGE = 30;
const REMAINING_PAYMENT_PERCENTAGE = 70;
const FULL_PAYMENT_PERCENTAGE = 100;

// IRA Partner Commission Structure
const IRA_PARTNER_COMMISSION_RATE_LOW = parseFloat(process.env.IRA_PARTNER_COMMISSION_RATE_LOW) || 2; // 2%
const IRA_PARTNER_COMMISSION_RATE_HIGH = parseFloat(process.env.IRA_PARTNER_COMMISSION_RATE_HIGH) || 3; // 3%
const IRA_PARTNER_COMMISSION_THRESHOLD = parseInt(process.env.IRA_PARTNER_COMMISSION_THRESHOLD) || 50000;

// OTP Configuration
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH) || 6;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;

// Order Status
const ORDER_STATUS = {
  PENDING: 'pending',
  AWAITING: 'awaiting',
  ACCEPTED: 'accepted',
  PROCESSING: 'processing', // legacy support
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  FULLY_PAID: 'fully_paid',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  PARTIALLY_ACCEPTED: 'partially_accepted',
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PARTIAL_PAID: 'partial_paid',
  FULLY_PAID: 'fully_paid',
  FAILED: 'failed',
};

// Payment Methods
const PAYMENT_METHODS = {
  RAZORPAY: 'razorpay',
  PAYTM: 'paytm',
  STRIPE: 'stripe',
};

module.exports = {
  // Financial
  MIN_ORDER_VALUE,
  MIN_VENDOR_PURCHASE,
  MAX_VENDOR_PURCHASE,
  DELIVERY_CHARGE,
  
  // Geographic
  VENDOR_COVERAGE_RADIUS_KM,
  VENDOR_ASSIGNMENT_BUFFER_KM,
  VENDOR_ASSIGNMENT_MAX_RADIUS_KM,
  
  // Delivery
  DELIVERY_TIMELINE_HOURS,
  
  // Payment
  ADVANCE_PAYMENT_PERCENTAGE,
  REMAINING_PAYMENT_PERCENTAGE,
  FULL_PAYMENT_PERCENTAGE,
  PAYMENT_METHODS,
  
  // Commission
  IRA_PARTNER_COMMISSION_RATE_LOW,
  IRA_PARTNER_COMMISSION_RATE_HIGH,
  IRA_PARTNER_COMMISSION_THRESHOLD,
  
  // OTP
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  
  // Status Enums
  ORDER_STATUS,
  PAYMENT_STATUS,
};

