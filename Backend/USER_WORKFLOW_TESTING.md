# User Workflow - Manual Testing Guide

## Overview
This document provides step-by-step manual testing procedures for the User workflow in IRA Sathi, including registration, login, product browsing, cart management, order placement, and commission calculation.

---

## Prerequisites

1. **Backend Server Running**: `cd Backend && npm start`
2. **Frontend Server Running**: `cd Frontend && npm start`
3. **Database**: MongoDB should be running and connected
4. **Test Data**: Ensure you have:
   - At least one approved Vendor in the database
   - At least one approved Seller (IRA Partner) with sellerId (e.g., SLR-101)
   - At least one active Product in the database
   - Admin account created

---

## 1. USER REGISTRATION FLOW

### Test Case 1.1: New User Registration (Without Seller ID)

**Steps:**
1. Navigate to `/user/register` or click "Sign up" from login page
2. Fill in the registration form:
   - **Full Name**: "Test User"
   - **Contact Number**: Use a unique phone number (e.g., 9876543210)
   - **IRA Partner ID**: Leave empty (optional)
   - **Address**: "123 Test Street"
   - **City**: "Mumbai" (or city where vendor exists)
   - **State**: "Maharashtra"
   - **Pincode**: "400001"
   - **Latitude**: Enter valid latitude (e.g., 19.0760 for Mumbai)
   - **Longitude**: Enter valid longitude (e.g., 72.8777 for Mumbai)
3. Click "Continue" button
4. **Expected**: OTP should be sent to the phone number (check console for OTP)
5. Enter the OTP received
6. Click "Verify"

**Expected Results:**
- ✅ User should be registered successfully
- ✅ User should be redirected to `/user/dashboard`
- ✅ User token should be stored in localStorage as `user_token`
- ✅ User should be assigned to a vendor (if vendor exists within 20km radius or same city)
- ✅ Console should show: "✅ User registered/updated successfully"
- ✅ Console should show vendor assignment (if vendor found)

**Backend Verification:**
```bash
# Check user in database
db.users.findOne({ phone: "9876543210" })
# Should show: name, phone, location, assignedVendor, isActive: true
```

---

### Test Case 1.2: New User Registration (With Seller ID)

**Steps:**
1. Navigate to `/user/register`
2. Fill in the registration form:
   - **Full Name**: "Test User 2"
   - **Contact Number**: Use another unique phone number (e.g., 9876543211)
   - **IRA Partner ID**: Enter a valid seller ID (e.g., "SLR-101") - Click "Have one?" to show field
   - **Address**: "456 Test Avenue"
   - **City**: "Mumbai"
   - **State**: "Maharashtra"
   - **Pincode**: "400002"
   - **Latitude**: 19.0760
   - **Longitude**: 72.8777
3. Click "Continue"
4. Enter OTP and verify

**Expected Results:**
- ✅ User should be registered with sellerId linked
- ✅ Seller ID should be stored in user document
- ✅ Seller reference should be populated
- ✅ Console should show: "🔗 Seller ID: SLR-101"

**Backend Verification:**
```bash
db.users.findOne({ phone: "9876543211" })
# Should show: sellerId: "SLR-101", seller: ObjectId(...)
```

---

### Test Case 1.3: Registration with Invalid Seller ID

**Steps:**
1. Navigate to `/user/register`
2. Fill form with:
   - **IRA Partner ID**: "INVALID-123"
   - Other valid details
3. Complete OTP verification

**Expected Results:**
- ❌ Should show error: "Invalid seller ID. Seller not found or inactive."
- ❌ Registration should fail
- ❌ User should not be created

---

### Test Case 1.4: Registration with Phone Already in Use (Vendor/Seller)

**Steps:**
1. Use a phone number that exists in vendors or sellers collection
2. Try to register as user

**Expected Results:**
- ❌ Should show error: "This phone number is already registered as [vendor/seller]"
- ❌ Registration should be blocked

---

## 2. USER LOGIN FLOW

### Test Case 2.1: Existing User Login

**Steps:**
1. Navigate to `/user/login` or click "Sign in" from register page
2. Enter phone number of an existing registered user
3. Click "Continue"
4. Enter OTP received
5. Click "Verify"

**Expected Results:**
- ✅ User should be logged in successfully
- ✅ Redirected to `/user/dashboard`
- ✅ Token stored in localStorage
- ✅ User context should be populated with user data

---

### Test Case 2.2: Login with Non-Existent User

**Steps:**
1. Navigate to `/user/login`
2. Enter phone number that doesn't exist in users collection
3. Complete OTP flow

**Expected Results:**
- ❌ Should show error: "User not found. Please register first."
- ❌ Should redirect to registration page after 2 seconds
- ❌ Should show `requiresRegistration: true` flag

---

### Test Case 2.3: Login with Blocked User

**Steps:**
1. Block a user in database: `db.users.updateOne({ phone: "..." }, { $set: { isBlocked: true } })`
2. Try to login with that phone number

**Expected Results:**
- ❌ Should show error: "Your account has been blocked or deactivated. Please contact support."
- ❌ Login should be denied

---

### Test Case 2.4: Login with Invalid OTP

**Steps:**
1. Request OTP for existing user
2. Enter wrong OTP (e.g., "000000")

**Expected Results:**
- ❌ Should show error: "Invalid or expired OTP"
- ❌ Login should fail
- ❌ User should be able to resend OTP

---

## 3. PRODUCT BROWSING & CART MANAGEMENT

### Test Case 3.1: Browse Products

**Steps:**
1. Login as user
2. Navigate to products/catalog page
3. View product list

**Expected Results:**
- ✅ Should display list of active products
- ✅ Products should show: name, price, image, category
- ✅ Only active products should be visible

**API Test:**
```bash
GET /api/users/products
Headers: Authorization: Bearer <user_token>
```

---

### Test Case 3.2: View Product Details

**Steps:**
1. Click on any product card
2. View product details page

**Expected Results:**
- ✅ Should show full product details
- ✅ Should show stock availability
- ✅ Should show price
- ✅ Should have "Add to Cart" button

---

### Test Case 3.3: Add Product to Cart

**Steps:**
1. View product details
2. Select quantity
3. Click "Add to Cart"

**Expected Results:**
- ✅ Product should be added to cart
- ✅ Cart count should update in header
- ✅ Success message should appear
- ✅ Cart should persist across page refreshes

**Backend Verification:**
```bash
db.carts.findOne({ userId: ObjectId("...") })
# Should show items array with productId, quantity, totalPrice
```

---

### Test Case 3.4: Update Cart Item Quantity

**Steps:**
1. Go to cart page
2. Increase/decrease quantity of an item
3. Save changes

**Expected Results:**
- ✅ Quantity should update
- ✅ Total price should recalculate
- ✅ Cart subtotal should update

---

### Test Case 3.5: Remove Item from Cart

**Steps:**
1. Go to cart page
2. Click remove/delete on an item

**Expected Results:**
- ✅ Item should be removed from cart
- ✅ Cart should update
- ✅ Total should recalculate

---

### Test Case 3.6: Cart Validation (Minimum Order Value)

**Steps:**
1. Add products to cart with total < ₹2,000
2. Try to proceed to checkout

**Expected Results:**
- ❌ Should show error: "Minimum order value is ₹2,000"
- ❌ Should prevent checkout
- ❌ Should show shortfall amount

**Note**: Minimum order check is skipped if payment preference is 'partial' (30% advance)

---

## 4. ORDER PLACEMENT FLOW

### Test Case 4.1: Create Order (Full Payment)

**Prerequisites:**
- Cart with items totaling ≥ ₹2,000
- User logged in
- Delivery address set

**Steps:**
1. Go to cart
2. Click "Proceed to Checkout"
3. Select delivery address (or use default)
4. Select payment preference: "Pay in Full"
5. Review order summary
6. Click "Place Order"

**Expected Results:**
- ✅ Order should be created with status: "pending"
- ✅ Order number should be generated (format: ORD-YYYYMMDD-XXXX)
- ✅ Payment preference should be "full"
- ✅ Delivery charge should be ₹0 (waived for full payment)
- ✅ Vendor should be assigned (if vendor exists in user's location)
- ✅ Cart should be cleared
- ✅ Order should appear in "My Orders" section

**Backend Verification:**
```bash
db.orders.findOne({ orderNumber: "ORD-..." })
# Should show:
# - userId, sellerId (if linked), vendorId (if assigned)
# - items array
# - totalAmount, upfrontAmount, remainingAmount
# - paymentStatus: "pending"
# - status: "pending"
# - assignedTo: "vendor" or "admin"
```

---

### Test Case 4.2: Create Order (Partial Payment - 30% Advance)

**Steps:**
1. Go to checkout
2. Select payment preference: "Pay 30% Advance"
3. Place order

**Expected Results:**
- ✅ Order should be created
- ✅ Delivery charge should be applied (₹X)
- ✅ Upfront amount = 30% of total
- ✅ Remaining amount = 70% of total
- ✅ Payment status: "pending"

---

### Test Case 4.3: Order with Seller ID Linked

**Prerequisites:**
- User registered with sellerId (e.g., SLR-101)
- Cart with items

**Steps:**
1. Place order as user with sellerId

**Expected Results:**
- ✅ Order should include sellerId
- ✅ Order should include seller reference
- ✅ Commission will be calculated after payment (not during order creation)

**Backend Verification:**
```bash
db.orders.findOne({ userId: ObjectId("...") })
# Should show: sellerId: "SLR-101", seller: ObjectId(...)
```

---

### Test Case 4.4: Order Vendor Assignment

**Test Scenarios:**

**A. Vendor within 20km radius:**
- User location: Mumbai (19.0760, 72.8777)
- Vendor location: Within 20km
- **Expected**: Order assigned to vendor, `assignedTo: "vendor"`

**B. Vendor in same city (fallback):**
- User location: Mumbai
- Vendor location: Mumbai (different coordinates, >20km)
- **Expected**: Order assigned to vendor by city matching

**C. No vendor found:**
- User location: City with no vendors
- **Expected**: Order assigned to admin, `assignedTo: "admin"`

**Backend Verification:**
```bash
# Check console logs for vendor assignment
# Should show: "✅ Order assigned to vendor: [name]" or "⚠️ No vendor found"
```

---

## 5. PAYMENT FLOW

### Test Case 5.1: Payment Intent Creation

**Steps:**
1. After order creation, proceed to payment
2. Payment intent should be created

**Expected Results:**
- ✅ Payment intent should be generated
- ✅ Should return payment details
- ✅ User should be redirected to payment gateway (or mock payment screen)

**API Test:**
```bash
POST /api/users/payments/intent
Body: { orderId: "...", amount: 5000, paymentMethod: "razorpay" }
```

---

### Test Case 5.2: Confirm Payment (Full Payment)

**Steps:**
1. Complete payment for order with "full" payment preference
2. Payment should be confirmed

**Expected Results:**
- ✅ Payment status should update to "fully_paid"
- ✅ Payment record should be created
- ✅ Order paymentStatus should be "fully_paid"
- ✅ **Commission should be calculated and credited to seller** (if sellerId linked)
- ✅ Seller wallet balance should increase

**Backend Verification:**
```bash
# Check payment
db.payments.findOne({ orderId: ObjectId("...") })
# Should show: status: "fully_paid", paidAt: Date

# Check commission (if seller linked)
db.commissions.findOne({ orderId: ObjectId("...") })
# Should show: commissionAmount, commissionRate, status: "credited"

# Check seller wallet
db.sellers.findOne({ sellerId: "SLR-101" })
# wallet.balance should be increased
```

---

### Test Case 5.3: Commission Calculation (Tiered Rates)

**Prerequisites:**
- User with sellerId linked
- Multiple orders in same month

**Test Scenario A: First Order (≤ ₹50,000)**
1. Place order with total ₹10,000
2. Complete payment
3. **Expected Commission**: 2% = ₹200

**Test Scenario B: Second Order (Still ≤ ₹50,000)**
1. Place another order with total ₹30,000
2. Cumulative: ₹40,000 (still ≤ ₹50,000)
3. Complete payment
4. **Expected Commission**: 2% = ₹600

**Test Scenario C: Third Order (Crosses ₹50,000)**
1. Place order with total ₹20,000
2. Cumulative: ₹60,000 (> ₹50,000)
3. Complete payment
4. **Expected Commission**: 3% = ₹600 (entire order at 3% rate)

**Backend Verification:**
```bash
# Check commissions for this month
db.commissions.find({
  sellerId: ObjectId("..."),
  userId: ObjectId("..."),
  month: 12, # current month
  year: 2024
}).sort({ createdAt: 1 })

# First two should have rate: 2%, last one should have rate: 3%
```

---

### Test Case 5.4: Partial Payment (30% Advance)

**Steps:**
1. Place order with "partial" payment preference
2. Pay 30% advance
3. Complete payment

**Expected Results:**
- ✅ First payment: 30% should be recorded
- ✅ Payment status: "partially_paid"
- ✅ Remaining amount should be tracked
- ✅ Commission should NOT be calculated yet (only after full payment)

---

## 6. ORDER STATUS TRACKING

### Test Case 6.1: View Orders

**Steps:**
1. Login as user
2. Navigate to "My Orders"

**Expected Results:**
- ✅ Should display all user's orders
- ✅ Should show: order number, date, status, total amount
- ✅ Should be sorted by latest first

---

### Test Case 6.2: Order Status Updates

**Order Status Flow:**
1. **Pending** → Vendor accepts/rejects
2. **Accepted** → Vendor updates to "Awaiting Dispatch"
3. **Awaiting Dispatch** → Vendor updates to "Dispatched"
4. **Dispatched** → Vendor updates to "Delivered"

**Expected Results:**
- ✅ User should see status updates in real-time (if real-time implemented)
- ✅ Order history should show status timeline
- ✅ Status changes should be reflected in "My Orders"

---

## 7. SELLER ID MANAGEMENT

### Test Case 7.1: Seller ID Set During Registration (Lifetime Lock)

**Steps:**
1. Register new user with sellerId: "SLR-101"
2. Try to update sellerId later (via profile or login)

**Expected Results:**
- ✅ SellerId should be set during registration
- ❌ SellerId should NOT be changeable after first registration
- ❌ If user tries to change sellerId, should show error: "Seller ID can only be set during first-time registration"

---

### Test Case 7.2: Seller ID Set During Login (One-Time Only)

**Steps:**
1. Register user WITHOUT sellerId
2. Login with sellerId parameter

**Expected Results:**
- ✅ SellerId should be set during login (if not already set)
- ✅ SellerId should be linked to user
- ❌ If sellerId already exists, should NOT be changed

---

## 8. ERROR HANDLING & EDGE CASES

### Test Case 8.1: Invalid Location Coordinates

**Steps:**
1. Register with invalid coordinates (lat > 90, lng > 180)

**Expected Results:**
- ❌ Should show validation error
- ❌ Registration should be blocked

---

### Test Case 8.2: Empty Cart Checkout

**Steps:**
1. Try to checkout with empty cart

**Expected Results:**
- ❌ Should show error: "Cart is empty"
- ❌ Checkout should be blocked

---

### Test Case 8.3: Insufficient Stock

**Steps:**
1. Add product to cart with quantity > available stock
2. Try to place order

**Expected Results:**
- ⚠️ Order might still be created (depends on implementation)
- ⚠️ Warning should be logged in console
- ⚠️ Stock should be reduced (may go negative)

**Note**: This should be handled better - consider validating stock before order creation.

---

## 9. INTEGRATION TESTING

### Test Case 9.1: Complete User Journey

**End-to-End Flow:**
1. ✅ Register new user with sellerId
2. ✅ Login
3. ✅ Browse products
4. ✅ Add products to cart (total ≥ ₹2,000)
5. ✅ Place order (full payment)
6. ✅ Complete payment
7. ✅ Verify commission credited to seller
8. ✅ Check order status updates
9. ✅ View order history

**Expected Results:**
- ✅ All steps should complete successfully
- ✅ Data should be consistent across all collections
- ✅ Commission should be calculated correctly
- ✅ Seller wallet should be updated

---

## 10. BACKEND API TESTING

### API Endpoints to Test:

1. **Authentication:**
   - `POST /api/users/auth/request-otp`
   - `POST /api/users/auth/register`
   - `POST /api/users/auth/login`

2. **Products:**
   - `GET /api/users/products`
   - `GET /api/users/products/:productId`

3. **Cart:**
   - `GET /api/users/cart`
   - `POST /api/users/cart`
   - `PUT /api/users/cart/:itemId`
   - `DELETE /api/users/cart/:itemId`

4. **Orders:**
   - `POST /api/users/orders`
   - `GET /api/users/orders`
   - `GET /api/users/orders/:orderId`

5. **Payments:**
   - `POST /api/users/payments/intent`
   - `POST /api/users/payments/confirm`

---

## BUGS & ISSUES FOUND

### Issue 1: Syntax Error in `findVendorByLocation`
**Location**: `FarmCommerce/Backend/controllers/userController.js:1503`
**Problem**: `cityNormalized` variable is not defined
**Fix Required**: Define `cityNormalized` before use

### Issue 2: Commission Calculation Timing
**Location**: Commission is calculated in two places (payment confirmation endpoints)
**Status**: ✅ Working correctly - commission calculated after full payment

### Issue 3: Stock Reduction
**Location**: Stock is reduced after payment, not before order creation
**Status**: ⚠️ May cause overselling - consider validating stock before order creation

---

## TESTING CHECKLIST

- [ ] User Registration (without sellerId)
- [ ] User Registration (with sellerId)
- [ ] User Registration (invalid sellerId)
- [ ] User Login (existing user)
- [ ] User Login (non-existent user)
- [ ] User Login (blocked user)
- [ ] Product Browsing
- [ ] Add to Cart
- [ ] Update Cart
- [ ] Remove from Cart
- [ ] Cart Validation (minimum order)
- [ ] Order Creation (full payment)
- [ ] Order Creation (partial payment)
- [ ] Vendor Assignment
- [ ] Payment Intent
- [ ] Payment Confirmation
- [ ] Commission Calculation (2% rate)
- [ ] Commission Calculation (3% rate)
- [ ] Seller Wallet Update
- [ ] Order Status Tracking
- [ ] Seller ID Lifetime Lock

---

## NOTES

1. **OTP Testing**: OTP is logged to console for testing purposes
2. **Payment Gateway**: Currently using mock/dummy payment - replace with actual Razorpay integration
3. **Real-time Updates**: Order status updates may require WebSocket implementation
4. **Location**: Currently manual entry - will be replaced with Google Maps API
5. **Commission Reset**: Commission rates reset monthly (on 1st of each month)

---

**Last Updated**: 2024-12-15
**Version**: 1.0

