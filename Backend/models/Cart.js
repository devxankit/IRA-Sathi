const mongoose = require('mongoose');
const { MIN_ORDER_VALUE } = require('../utils/constants');

/**
 * Cart Schema
 * 
 * User shopping cart
 * Validates minimum order value (₹2,000)
 */
const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true,
    // One cart per user
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative'],
    },
    // Variant attributes (for products with attributeStocks)
    variantAttributes: {
      type: Map,
      of: String,
      // Stores the selected variant's attributes (e.g., { "Type": "Amino Acid", "Concentration": "20%" })
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  subtotal: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal cannot be negative'],
  },
  // Validation flags
  meetsMinimumOrder: {
    type: Boolean,
    default: false,
    // True if subtotal >= MIN_ORDER_VALUE
  },
}, {
  timestamps: true,
});

// Note: userId already has an index from unique: true

// Virtual: Calculate subtotal from items
cartSchema.virtual('calculatedSubtotal').get(function () {
  if (this.items && this.items.length > 0) {
    return this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }
  return 0;
});

// Pre-save hook: Calculate subtotal and validate minimum order
cartSchema.pre('save', function (next) {
  // Calculate subtotal from items
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => {
      item.totalPrice = item.quantity * item.unitPrice;
      return sum + item.totalPrice;
    }, 0);
  } else {
    this.subtotal = 0;
  }

  // Check if meets minimum order value
  this.meetsMinimumOrder = this.subtotal >= MIN_ORDER_VALUE;

  next();
});

// Instance method: Add item to cart
cartSchema.methods.addItem = function (productId, quantity, unitPrice, variantAttributes = null) {
  console.log('🛒 Cart.addItem called:', { productId, quantity, unitPrice, variantAttributes })
  
  // Convert variantAttributes to plain object for comparison
  let variantAttrsObj = {}
  if (variantAttributes) {
    if (variantAttributes instanceof Map) {
      variantAttrsObj = Object.fromEntries(variantAttributes)
    } else if (typeof variantAttributes === 'object') {
      variantAttrsObj = variantAttributes
    }
  }
  
  const hasVariantAttrs = variantAttrsObj && typeof variantAttrsObj === 'object' && Object.keys(variantAttrsObj).length > 0
  console.log('🛒 Variant attributes object:', variantAttrsObj, 'Has variants:', hasVariantAttrs)
  
  // For items with variants, check if exact variant already exists
  // IMPORTANT: Different variants of same product should be separate cart items
  const existingItemIndex = hasVariantAttrs
    ? this.items.findIndex(item => {
        if (item.productId.toString() !== productId.toString()) return false
        
        const itemAttrs = item.variantAttributes instanceof Map 
          ? Object.fromEntries(item.variantAttributes)
          : (item.variantAttributes || {})
        
        // Compare variant attributes - must match exactly (sorted keys for consistent comparison)
        const itemAttrsStr = JSON.stringify(Object.keys(itemAttrs).sort().reduce((obj, key) => {
          obj[key] = String(itemAttrs[key])
          return obj
        }, {}))
        const variantAttrsStr = JSON.stringify(Object.keys(variantAttrsObj).sort().reduce((obj, key) => {
          obj[key] = String(variantAttrsObj[key])
          return obj
        }, {}))
        
        const matches = itemAttrsStr === variantAttrsStr
        console.log('🛒 Comparing variants:', {
          itemAttrs,
          variantAttrsObj,
          itemAttrsStr,
          variantAttrsStr,
          matches
        })
        return matches
      })
    : this.items.findIndex(
        item => item.productId.toString() === productId.toString() &&
                (!item.variantAttributes || 
                 (item.variantAttributes instanceof Map ? item.variantAttributes.size === 0 : Object.keys(item.variantAttributes).length === 0))
      );

  console.log('🛒 Existing item index:', existingItemIndex, 'Total items before:', this.items.length)

  if (existingItemIndex >= 0) {
    // Update existing item (same variant already exists)
    console.log('🛒 Updating existing item at index:', existingItemIndex)
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].totalPrice = 
      this.items[existingItemIndex].quantity * this.items[existingItemIndex].unitPrice;
  } else {
    // Add new item (different variant or new product)
    console.log('🛒 Adding NEW item to cart (different variant or new product)')
    const newItem = {
      productId,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      addedAt: new Date(),
    };
    
    // Add variant attributes if provided
    if (hasVariantAttrs) {
      // Convert to Map for storage
      const variantAttrsMap = new Map()
      Object.keys(variantAttrsObj).forEach(key => {
        variantAttrsMap.set(key, String(variantAttrsObj[key]))
      })
      newItem.variantAttributes = variantAttrsMap
      console.log('🛒 Added variant attributes to new item:', Object.fromEntries(variantAttrsMap))
    }
    
    this.items.push(newItem);
    console.log('🛒 New item added. Total items now:', this.items.length)
  }
  
  // Recalculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.meetsMinimumOrder = this.subtotal >= MIN_ORDER_VALUE;
  
  console.log('🛒 Cart after addItem:', {
    itemsCount: this.items.length,
    items: this.items.map((item, idx) => ({
      index: idx,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      variantAttributes: item.variantAttributes instanceof Map 
        ? Object.fromEntries(item.variantAttributes)
        : item.variantAttributes
    }))
  })
};

// Instance method: Remove item from cart
cartSchema.methods.removeItem = function (productId) {
  this.items = this.items.filter(
    item => item.productId.toString() !== productId.toString()
  );
  
  // Recalculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.meetsMinimumOrder = this.subtotal >= MIN_ORDER_VALUE;
};

// Instance method: Update item quantity
cartSchema.methods.updateItemQuantity = function (productId, quantity) {
  const item = this.items.find(
    item => item.productId.toString() === productId.toString()
  );

  if (item) {
    item.quantity = quantity;
    item.totalPrice = item.quantity * item.unitPrice;
    
    // Recalculate subtotal
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.meetsMinimumOrder = this.subtotal >= MIN_ORDER_VALUE;
  }
};

// Instance method: Clear cart
cartSchema.methods.clear = function () {
  this.items = [];
  this.subtotal = 0;
  this.meetsMinimumOrder = false;
};

// Instance method: Validate cart before checkout
// @param {string} paymentPreference - 'partial' (30% advance) or 'full' (100% payment)
cartSchema.methods.validateForCheckout = function (paymentPreference = 'full') {
  if (!this.items || this.items.length === 0) {
    return { valid: false, message: 'Cart is empty' };
  }

  // Skip minimum order value check if user chooses partial payment (30% advance)
  // For partial payment, user can pay 30% now and remaining 70% later, so no minimum required
  if (paymentPreference === 'partial') {
    return { valid: true, message: 'Cart is valid for checkout (partial payment)' };
  }

  // For full payment, enforce minimum order value
  if (!this.meetsMinimumOrder) {
    return {
      valid: false,
      message: `Minimum order value is ₹${MIN_ORDER_VALUE}. Current total: ₹${this.subtotal}`,
      currentTotal: this.subtotal,
      minimumRequired: MIN_ORDER_VALUE,
    };
  }

  return { valid: true, message: 'Cart is valid for checkout' };
};

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;

