# Workflow Files Summary

## ✅ Completed File Structure

All workflow files have been created with minimal scaffolding according to the known workflows from PROJECT_OVERVIEW.md and frontend API definitions.

### 📁 Directory Structure

```
Backend/
├── config/
│   ├── database.js          ✅ MongoDB connection
│   ├── sms.js              ✅ SMS India Hub service
│   └── realtime.js         ✅ Push notifications placeholder
├── models/
│   ├── Admin.js            ✅ Admin model
│   ├── Vendor.js           ✅ Vendor model
│   ├── User.js             ✅ User model
│   └── Seller.js           ✅ Seller (IRA Partner) model
├── routes/
│   ├── admin.js            ✅ Admin routes
│   ├── vendor.js           ✅ Vendor routes
│   ├── user.js             ✅ User routes
│   └── seller.js           ✅ Seller routes
├── controllers/
│   ├── adminController.js  ✅ Admin controller
│   ├── vendorController.js ✅ Vendor controller
│   ├── userController.js   ✅ User controller
│   └── sellerController.js ✅ Seller controller
├── middleware/
│   └── errorHandler.js     ✅ Global error handler
├── utils/
│   └── constants.js        ✅ System constants
├── index.js                ✅ Main entry (routes registered)
└── package.json            ✅ Dependencies installed
```

---

## 1️⃣ Admin Workflow ✅

### Model (`models/Admin.js`)
- **Schema**: Email, password, name, role, OTP handling
- **Methods**: `comparePassword()`, `generateOTP()`, `verifyOTP()`, `clearOTP()`
- **Features**: Two-step authentication (Email/Password + OTP)

### Routes (`routes/admin.js`)
**Authentication:**
- `POST /api/admin/auth/login` - Step 1: Email/Password
- `POST /api/admin/auth/request-otp` - Step 2: Request OTP
- `POST /api/admin/auth/verify-otp` - Step 2: Verify OTP
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/profile`

**Dashboard:**
- `GET /api/admin/dashboard` - Overview data

**Product Management:**
- `GET /api/admin/products` - Get all products
- `GET /api/admin/products/:productId` - Get product details
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:productId` - Update product
- `DELETE /api/admin/products/:productId` - Delete product
- `POST /api/admin/products/:productId/assign` - Assign to vendor
- `PUT /api/admin/products/:productId/visibility` - Toggle visibility

**Vendor Management:**
- `GET /api/admin/vendors` - Get all vendors
- `GET /api/admin/vendors/:vendorId` - Get vendor details
- `POST /api/admin/vendors/:vendorId/approve` - Approve vendor
- `POST /api/admin/vendors/:vendorId/reject` - Reject vendor
- `PUT /api/admin/vendors/:vendorId/credit-policy` - Set credit policy
- `POST /api/admin/vendors/purchases/:requestId/approve` - Approve purchase
- `POST /api/admin/vendors/purchases/:requestId/reject` - Reject purchase

**Seller (IRA Partner) Management:**
- `GET /api/admin/sellers` - Get all sellers
- `GET /api/admin/sellers/:sellerId` - Get seller details
- `POST /api/admin/sellers` - Create seller
- `PUT /api/admin/sellers/:sellerId` - Update seller
- `PUT /api/admin/sellers/:sellerId/target` - Set monthly target
- `POST /api/admin/sellers/withdrawals/:requestId/approve` - Approve withdrawal
- `POST /api/admin/sellers/withdrawals/:requestId/reject` - Reject withdrawal

**User Management:**
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:userId` - Get user details
- `PUT /api/admin/users/:userId/block` - Block/deactivate user

**Order & Payment Management:**
- `GET /api/admin/orders` - Get all orders
- `GET /api/admin/orders/:orderId` - Get order details
- `PUT /api/admin/orders/:orderId/reassign` - Reassign order
- `GET /api/admin/payments` - Get all payments

**Finance & Credit:**
- `GET /api/admin/finance/credits` - Get vendor credits
- `GET /api/admin/finance/recovery` - Get recovery status

**Analytics & Reporting:**
- `GET /api/admin/analytics` - Get analytics
- `GET /api/admin/reports` - Generate reports

### Controller (`controllers/adminController.js`)
- All routes have controller functions (minimal scaffolding)
- Authentication logic implemented (login, OTP, verify)
- Other endpoints marked with TODO for detailed implementation

---

## 2️⃣ Vendor Workflow ✅

### Model (`models/Vendor.js`)
- **Schema**: Name, phone, location (with coordinates), credit info, OTP handling
- **Features**: 
  - Geographic coverage (20km radius)
  - Credit limit and usage tracking
  - Status: pending/approved/rejected/suspended
- **Index**: Geospatial index for location-based queries

### Routes (`routes/vendor.js`)
**Authentication:**
- `POST /api/vendors/auth/register` - Register vendor
- `POST /api/vendors/auth/request-otp` - Request OTP
- `POST /api/vendors/auth/verify-otp` - Verify OTP
- `POST /api/vendors/auth/logout`
- `GET /api/vendors/auth/profile`

**Dashboard:**
- `GET /api/vendors/dashboard` - Overview data

**Order Management:**
- `GET /api/vendors/orders` - Get all orders
- `GET /api/vendors/orders/:orderId` - Get order details
- `POST /api/vendors/orders/:orderId/accept` - Accept order (full)
- `POST /api/vendors/orders/:orderId/reject` - Reject order (escalate to Admin)
- `POST /api/vendors/orders/:orderId/accept-partial` - Partial accept (splits order)
- `PUT /api/vendors/orders/:orderId/status` - Update status (Awaiting → Dispatched → Delivered)
- `GET /api/vendors/orders/stats` - Order statistics

**Inventory Management:**
- `GET /api/vendors/inventory` - Get inventory
- `GET /api/vendors/inventory/:itemId` - Get item details
- `PUT /api/vendors/inventory/:itemId/stock` - Update stock manually
- `GET /api/vendors/inventory/stats` - Inventory statistics

**Credit Management:**
- `GET /api/vendors/credit` - Get credit info
- `POST /api/vendors/credit/purchase` - Request credit purchase (min ₹50,000)
- `GET /api/vendors/credit/purchases` - Get purchase requests
- `GET /api/vendors/credit/purchases/:requestId` - Get purchase details
- `GET /api/vendors/credit/history` - Get credit history

**Reports & Analytics:**
- `GET /api/vendors/reports` - Get reports
- `GET /api/vendors/reports/analytics` - Get performance analytics

### Controller (`controllers/vendorController.js`)
- Authentication logic implemented (register, OTP, verify)
- Credit purchase validation (min ₹50,000)
- Other endpoints marked with TODO

---

## 3️⃣ User Workflow ✅

### Model (`models/User.js`)
- **Schema**: Name, phone, email, sellerId (IRA Partner ID), location, assigned vendor
- **Features**:
  - OTP-based authentication
  - Optional IRA Partner ID linking
  - Location-based vendor assignment (20km radius)
  - Language preference (English/Hindi/Marathi)

### Routes (`routes/user.js`)
**Authentication & Onboarding:**
- `POST /api/users/auth/request-otp` - Request OTP
- `POST /api/users/auth/register` - Register with OTP
- `POST /api/users/auth/login` - Login with OTP
- `POST /api/users/auth/verify-otp` - Verify OTP (legacy)
- `POST /api/users/auth/logout`
- `GET /api/users/profile` - Get profile
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/profile/seller-id` - Update Seller ID

**Product & Catalog:**
- `GET /api/users/products/categories` - Get categories
- `GET /api/users/products` - Get products
- `GET /api/users/products/:productId` - Get product details
- `GET /api/users/products/popular` - Get popular products
- `GET /api/users/products/search` - Search products
- `GET /api/users/offers` - Get offers/banners

**Cart:**
- `GET /api/users/cart` - Get cart
- `POST /api/users/cart` - Add to cart
- `PUT /api/users/cart/:itemId` - Update cart item
- `DELETE /api/users/cart/:itemId` - Remove from cart
- `DELETE /api/users/cart` - Clear cart
- `POST /api/users/cart/validate` - Validate cart (min ₹2,000)

**Vendor Assignment:**
- `POST /api/users/vendors/assign` - Get assigned vendor (20km radius)
- `POST /api/users/vendors/check-stock` - Check vendor stock

**Checkout & Orders:**
- `POST /api/users/orders` - Create order (with partial fulfillment logic)
- `GET /api/users/orders` - Get orders (with status timeline)
- `GET /api/users/orders/:orderId` - Get order details
- `GET /api/users/orders/:orderId/track` - Track order
- `PUT /api/users/orders/:orderId/cancel` - Cancel order

**Payments:**
- `POST /api/users/payments/create-intent` - Create payment intent (30% or 100%)
- `POST /api/users/payments/confirm` - Confirm payment
- `POST /api/users/payments/create-remaining` - Create remaining payment intent (70%)
- `POST /api/users/payments/confirm-remaining` - Confirm remaining payment
- `GET /api/users/payments/:paymentId` - Get payment status
- `GET /api/users/orders/:orderId/payments` - Get order payments

**Addresses:**
- `GET /api/users/addresses` - Get addresses
- `POST /api/users/addresses` - Add address
- `PUT /api/users/addresses/:addressId` - Update address
- `DELETE /api/users/addresses/:addressId` - Delete address
- `PUT /api/users/addresses/:addressId/default` - Set default address

**Favourites:**
- `GET /api/users/favourites` - Get favourites
- `POST /api/users/favourites` - Add to favourites
- `DELETE /api/users/favourites/:productId` - Remove from favourites

**Notifications:**
- `GET /api/users/notifications` - Get notifications
- `PUT /api/users/notifications/:notificationId/read` - Mark as read
- `PUT /api/users/notifications/read-all` - Mark all as read

**Support:**
- `POST /api/users/support/tickets` - Create support ticket
- `GET /api/users/support/tickets` - Get support tickets
- `GET /api/users/support/tickets/:ticketId` - Get ticket details
- `POST /api/users/support/tickets/:ticketId/messages` - Send message
- `POST /api/users/support/call` - Initiate support call

### Controller (`controllers/userController.js`)
- Authentication logic implemented (request OTP, register, login)
- Cart validation (min ₹2,000) scaffolded
- Vendor assignment scaffolded (geospatial query placeholder)
- Other endpoints marked with TODO

---

## 4️⃣ Seller (IRA Partner) Workflow ✅

### Model (`models/Seller.js`)
- **Schema**: sellerId (IRA-1001/SLR-1001), name, phone, area, wallet, commission rates
- **Features**:
  - Monthly target tracking
  - Wallet balance and pending withdrawals
  - Commission structure (2% up to ₹50,000, 3% above per user per month)
  - Status: pending/approved/rejected/suspended

### Routes (`routes/seller.js`)
**Authentication:**
- `POST /api/sellers/auth/register` - Register seller
- `POST /api/sellers/auth/request-otp` - Request OTP
- `POST /api/sellers/auth/verify-otp` - Verify OTP
- `POST /api/sellers/auth/logout`
- `GET /api/sellers/auth/profile`

**Dashboard:**
- `GET /api/sellers/dashboard` - Overview data
- `GET /api/sellers/dashboard/overview` - Overview (referrals, sales, target)
- `GET /api/sellers/dashboard/wallet` - Wallet data
- `GET /api/sellers/dashboard/referrals` - Referrals data
- `GET /api/sellers/dashboard/performance` - Performance data

**Wallet & Commission:**
- `GET /api/sellers/wallet` - Get wallet details
- `GET /api/sellers/wallet/transactions` - Get transactions
- `POST /api/sellers/wallet/withdraw` - Request withdrawal
- `GET /api/sellers/wallet/withdrawals` - Get withdrawal requests

**Referrals & Commissions:**
- `GET /api/sellers/referrals` - Get all referrals (users)
- `GET /api/sellers/referrals/:referralId` - Get referral details
- `GET /api/sellers/referrals/stats` - Get referral statistics

**Target & Performance:**
- `GET /api/sellers/target` - Get monthly target and progress
- `GET /api/sellers/performance` - Get performance analytics

### Controller (`controllers/sellerController.js`)
- Authentication logic implemented (register, OTP, verify)
- Withdrawal request validation scaffolded
- Commission calculation logic placeholder (monthly reset, tiered rates)
- Other endpoints marked with TODO

---

## 🔧 Next Steps

### Shared Models (To be Created)
- `models/Product.js` - Product schema
- `models/Order.js` - Order schema (with partial fulfillment support)
- `models/Payment.js` - Payment schema
- `models/Address.js` - Address schema
- `models/Cart.js` - Cart schema
- `models/CreditPurchase.js` - Vendor credit purchase request
- `models/Commission.js` - Seller commission tracking
- `models/Notification.js` - Notification schema
- `models/SupportTicket.js` - Support ticket schema

### Middleware (To be Created)
- `middleware/auth.js` - JWT authentication middleware
- `middleware/validation.js` - Request validation middleware

### Services (To be Created)
- `services/orderService.js` - Order processing logic (partial fulfillment)
- `services/paymentService.js` - Payment gateway integration
- `services/commissionService.js` - Commission calculation (monthly reset, tiered rates)
- `services/vendorAssignmentService.js` - Vendor assignment (20km radius)
- `services/notificationService.js` - Push notification service

### Detailed Implementation
All controller functions are scaffolded with TODO comments. Next phase will implement:
1. Business logic in controllers
2. Service layer for complex operations
3. Validation and error handling
4. JWT authentication
5. Database queries and aggregations

---

## ✅ Status Summary

- ✅ **Admin Workflow**: Model, Routes, Controller (scaffolded)
- ✅ **Vendor Workflow**: Model, Routes, Controller (scaffolded)
- ✅ **User Workflow**: Model, Routes, Controller (scaffolded)
- ✅ **Seller Workflow**: Model, Routes, Controller (scaffolded)
- ✅ **Routes Registered**: All routes registered in `index.js`
- ✅ **Error Handling**: Global error handler configured
- ✅ **Constants**: System constants defined
- ⏳ **Shared Models**: To be created
- ⏳ **Detailed Implementation**: To be done

---

## 🚀 How to Test

1. **Start Server:**
   ```bash
   cd Backend
   npm run dev
   ```

2. **Test Health Endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Test Routes:**
   - All routes are registered and accessible
   - Authentication endpoints have basic implementation
   - Other endpoints return placeholder responses (to be implemented)

---

*All workflow files created with minimal scaffolding. Ready for detailed implementation phase.*

