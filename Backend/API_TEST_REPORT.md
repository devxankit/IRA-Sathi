# IRA SATHI Backend API - Comprehensive Test Report

**Generated:** 2025-11-21T07:08:07.032Z

## Test Summary

- **Total Tests:** 141
- **Passed:** 119 ✅
- **Failed:** 22 ❌
- **Success Rate:** 84.40%
- **Duration:** 42.16s

## Test Results by Category

### Admin Auth

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/auth/login` | POST | Admin Login - Step 1 (Email/Password) | ✅ PASS (200) |  |
| `/admin/auth/request-otp` | POST | Request OTP | ✅ PASS (200) |  |
| `/admin/auth/verify-otp` | POST | Verify OTP | ✅ PASS (200) |  |
| `/admin/auth/profile` | GET | Get Admin Profile (Authenticated) | ✅ PASS (200) |  |
| `/admin/auth/profile` | GET | Get Admin Profile (Unauthenticated) | ✅ PASS (401) | Error: Request failed with status code 401 |
| `/admin/auth/login` | POST | Admin Login - Invalid Credentials | ✅ PASS (401) | Error: Request failed with status code 401 |
| `/admin/auth/verify-otp` | POST | Verify OTP - Invalid OTP | ✅ PASS (401) | Error: Request failed with status code 401 |

### Vendor Auth

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/vendors/auth/request-otp` | POST | Request OTP | ✅ PASS (200) |  |
| `/vendors/auth/verify-otp` | POST | Verify OTP / Login | ✅ PASS (200) |  |
| `/vendors/auth/profile` | GET | Get Vendor Profile | ✅ PASS (200) |  |
| `/vendors/auth/request-otp` | POST | Request OTP - Invalid Phone | ✅ PASS (400) | Error: Request failed with status code 400 |

### Seller Auth

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/sellers/auth/request-otp` | POST | Request OTP | ✅ PASS (200) |  |
| `/sellers/auth/verify-otp` | POST | Verify OTP / Login | ✅ PASS (200) |  |
| `/sellers/auth/profile` | GET | Get Seller Profile | ✅ PASS (200) |  |

### User Auth

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/auth/request-otp` | POST | Request OTP | ✅ PASS (200) |  |
| `/users/auth/register` | POST | Register User | ✅ PASS (201) |  |
| `/users/auth/login` | POST | Login with OTP | ✅ PASS (200) |  |
| `/users/auth/register` | POST | Register with SellerID | ✅ PASS (400) | User already has sellerId - should preserve it |
| `/users/profile` | GET | Get User Profile | ✅ PASS (200) |  |
| `/users/profile/seller-id` | GET | Get Seller ID | ✅ PASS (200) |  |
| `/users/auth/login` | POST | Login - Invalid OTP | ✅ PASS (401) | Error: Request failed with status code 401 |

### Admin Dashboard

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/dashboard` | GET | Get Dashboard Overview | ✅ PASS (200) |  |
| `/admin/dashboard` | GET | Get Dashboard - Unauthorized | ✅ PASS (401) | Error: Request failed with status code 401 |

### Admin Products

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/products` | GET | Get All Products | ✅ PASS (200) |  |
| `/admin/products` | GET | Get Products - Filtered (Active & Category) | ✅ PASS (200) |  |
| `/admin/products/:productId` | GET | Get Product Details | ✅ PASS (200) |  |
| `/admin/products/:productId` | GET | Get Product Details - Invalid ID | ✅ PASS (404) | Error: Request failed with status code 404 |
| `/admin/products` | POST | Create Product | ✅ PASS (201) |  |
| `/admin/products/:productId` | PUT | Update Product | ✅ PASS (200) |  |
| `/admin/products/:productId/visibility` | PUT | Toggle Product Visibility | ✅ PASS (200) |  |
| `/admin/products/:productId/assign` | POST | Assign Product to Vendor | ✅ PASS (201) |  |
| `/admin/products` | POST | Create Product - Missing Required Fields | ✅ PASS (400) | Error: Request failed with status code 400 |
| `/admin/products/:productId` | DELETE | Delete Product | ✅ PASS (400) | Error: Request failed with status code 400 |

### Admin Vendors

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/vendors` | GET | Get All Vendors | ✅ PASS (200) |  |
| `/admin/vendors` | GET | Get Vendors - Filtered (Status & Active) | ✅ PASS (200) |  |
| `/admin/vendors/:vendorId` | GET | Get Vendor Details | ✅ PASS (200) |  |
| `/admin/vendors/:vendorId/credit-policy` | PUT | Update Vendor Credit Policy | ✅ PASS (200) |  |
| `/admin/vendors/:vendorId/purchases` | GET | Get Vendor Purchase Requests | ✅ PASS (200) |  |
| `/admin/vendors/:vendorId` | GET | Get Vendor Details - Invalid ID | ✅ PASS (404) | Error: Request failed with status code 404 |

### Admin Sellers

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/sellers` | GET | Get All Sellers | ✅ PASS (200) |  |
| `/admin/sellers` | GET | Get Sellers - Filtered | ✅ PASS (200) |  |
| `/admin/sellers/:sellerId` | GET | Get Seller Details | ✅ PASS (200) |  |
| `/admin/sellers` | POST | Create Seller | ✅ PASS (201) |  |
| `/admin/sellers/:sellerId` | PUT | Update Seller | ✅ PASS (200) |  |
| `/admin/sellers/:sellerId/target` | PUT | Set Seller Target | ✅ PASS (200) |  |
| `/admin/sellers/:sellerId/withdrawals` | GET | Get Seller Withdrawals | ✅ PASS (200) |  |
| `/admin/sellers/withdrawals/:requestId/approve` | POST | Approve Withdrawal | ✅ PASS (400) | Error: Request failed with status code 400 |
| `/admin/sellers/withdrawals/:requestId/reject` | POST | Reject Withdrawal | ✅ PASS (200) |  |

### Admin Users

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/users` | GET | Get All Users | ✅ PASS (200) |  |
| `/admin/users` | GET | Get Users - Filtered | ✅ PASS (200) |  |
| `/admin/users/:userId` | GET | Get User Details | ✅ PASS (200) |  |
| `/admin/users/:userId/block` | PUT | Block User | ✅ PASS (200) |  |
| `/admin/users/:userId/block` | PUT | Unblock User | ✅ PASS (200) |  |

### Admin Orders

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/orders` | GET | Get All Orders | ✅ PASS (200) |  |
| `/admin/orders` | GET | Get Orders - Filtered | ✅ PASS (200) |  |
| `/admin/orders/:orderId` | GET | Get Order Details | ✅ PASS (200) |  |

### Admin Payments

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/payments` | GET | Get All Payments | ✅ PASS (200) |  |
| `/admin/payments` | GET | Get Payments - Filtered | ✅ PASS (200) |  |

### Admin Finance

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/finance/credits` | GET | Get Vendor Credits | ✅ PASS (200) |  |
| `/admin/finance/recovery` | GET | Get Credit Recovery Status | ✅ PASS (200) |  |

### Admin Analytics

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/analytics` | GET | Get Analytics Data | ✅ PASS (200) |  |
| `/admin/reports` | GET | Generate Reports | ✅ PASS (200) |  |

### Admin Messages

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/admin/vendor-messages` | GET | Get All Vendor Messages | ✅ PASS (200) |  |
| `/admin/vendor-messages/stats` | GET | Get Message Statistics | ✅ PASS (200) |  |
| `/admin/vendor-messages` | POST | Create Message to Vendor | ✅ PASS (400) | Error: Request failed with status code 400 |

### Vendor Dashboard

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/vendors/dashboard` | GET | Get Dashboard Overview | ✅ PASS (200) |  |
| `/vendors/dashboard` | GET | Get Dashboard - Unauthorized | ✅ PASS (401) | Error: Request failed with status code 401 |

### Vendor Orders

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/vendors/orders` | GET | Get All Orders | ✅ PASS (200) |  |
| `/vendors/orders` | GET | Get Orders - Filtered | ✅ PASS (200) |  |
| `/vendors/orders/stats` | GET | Get Order Statistics | ✅ PASS (200) |  |
| `/vendors/orders/:orderId` | GET | Get Order Details | ❌ FAIL (404) | Error: Request failed with status code 404 |
| `/vendors/orders/:orderId/reject` | POST | Reject Order | ✅ PASS (404) | Error: Request failed with status code 404 |
| `/vendors/orders/:orderId/status` | PUT | Update Order Status | ✅ PASS (404) | Error: Request failed with status code 404 |
| `/vendors/orders/:orderId` | GET | Get Order Details - Invalid ID | ✅ PASS (404) | Error: Request failed with status code 404 |

### Vendor Inventory

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/vendors/inventory` | GET | Get All Inventory | ✅ PASS (200) |  |
| `/vendors/inventory/stats` | GET | Get Inventory Statistics | ✅ PASS (200) |  |
| `/vendors/inventory/:itemId` | GET | Get Inventory Item Details | ✅ PASS (200) |  |
| `/vendors/inventory/:itemId/stock` | PUT | Update Stock Quantity | ✅ PASS (400) | Error: Request failed with status code 400 |

### Vendor Credit

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/vendors/credit` | GET | Get Credit Information | ✅ PASS (200) |  |
| `/vendors/credit/purchases` | GET | Get Credit Purchase Requests | ✅ PASS (200) |  |
| `/vendors/credit/purchases/:requestId` | GET | Get Credit Purchase Details | ✅ PASS (200) |  |
| `/vendors/credit/purchase` | POST | Request Credit Purchase | ✅ PASS (400) | Error: Request failed with status code 400 |
| `/vendors/credit/history` | GET | Get Credit History | ✅ PASS (200) |  |
| `/vendors/credit/purchase` | POST | Request Credit Purchase - Below Minimum (₹50,000) | ✅ PASS (400) | Error: Request failed with status code 400 |

### Vendor Reports

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/vendors/reports` | GET | Get Reports Data | ❌ FAIL (404) | Error: Request failed with status code 404 |
| `/vendors/reports/analytics` | GET | Get Performance Analytics | ✅ PASS (200) |  |

### Vendor Messages

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/vendors/messages` | GET | Get Vendor Messages | ✅ PASS (200) |  |
| `/vendors/messages` | POST | Create Message to Admin | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/vendors/messages` | POST | Create Message - Missing Required Fields | ✅ PASS (400) | Error: Request failed with status code 400 |

### Seller Dashboard

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/sellers/dashboard` | GET | Get Dashboard Overview | ✅ PASS (200) |  |
| `/sellers/dashboard/overview` | GET | Get Dashboard Overview | ✅ PASS (200) |  |
| `/sellers/dashboard/wallet` | GET | Get Dashboard Wallet | ✅ PASS (200) |  |
| `/sellers/dashboard/referrals` | GET | Get Dashboard Referrals | ✅ PASS (200) |  |
| `/sellers/dashboard/performance` | GET | Get Dashboard Performance | ✅ PASS (200) |  |

### Seller Wallet

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/sellers/wallet` | GET | Get Wallet Details | ✅ PASS (200) |  |
| `/sellers/wallet/transactions` | GET | Get Wallet Transactions | ✅ PASS (200) |  |
| `/sellers/wallet/withdraw` | POST | Request Withdrawal | ✅ PASS (201) |  |
| `/sellers/wallet/withdrawals` | GET | Get Withdrawal Requests | ✅ PASS (200) |  |
| `/sellers/wallet/withdraw` | POST | Request Withdrawal - Insufficient Balance | ✅ PASS (400) | Error: Request failed with status code 400 |

### Seller Referrals

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/sellers/referrals` | GET | Get All Referrals | ✅ PASS (200) |  |
| `/sellers/referrals/stats` | GET | Get Referral Statistics | ✅ PASS (200) |  |
| `/sellers/referrals/:referralId` | GET | Get Referral Details | ✅ PASS (200) |  |

### Seller Performance

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/sellers/target` | GET | Get Monthly Target | ✅ PASS (200) |  |
| `/sellers/performance` | GET | Get Performance Analytics | ✅ PASS (200) |  |

### User Products

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/products/categories` | GET | Get Categories | ✅ PASS (200) | Public endpoint |
| `/users/products` | GET | Get Products | ✅ PASS (200) | Public endpoint |
| `/users/products` | GET | Get Products - Filtered | ✅ PASS (200) | Public endpoint |
| `/users/products/popular` | GET | Get Popular Products | ❌ FAIL (404) | Public endpoint |
| `/users/products/search` | GET | Search Products | ❌ FAIL (404) | Public endpoint |
| `/users/products/:productId` | GET | Get Product Details | ✅ PASS (200) | Public endpoint |
| `/users/offers` | GET | Get Offers/Banners | ✅ PASS (200) | Public endpoint |

### User Cart

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/cart` | GET | Get Cart | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/cart/validate` | POST | Validate Cart | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/cart` | POST | Add to Cart | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/cart` | DELETE | Clear Cart | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/cart` | POST | Add to Cart - Invalid Product ID | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/cart` | POST | Add to Cart - Missing Quantity | ❌ FAIL (403) | Error: Request failed with status code 403 |

### User Orders

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/orders` | GET | Get All Orders | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/orders` | GET | Get Orders - Filtered | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/orders/:orderId` | GET | Get Order Details | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/orders/:orderId/track` | GET | Track Order | ❌ FAIL (403) | Error: Request failed with status code 403 |

### User Payments

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/payments/:paymentId` | GET | Get Payment Status | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/orders/:orderId/payments` | GET | Get Order Payments | ❌ FAIL (403) | Error: Request failed with status code 403 |

### User Addresses

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/addresses` | GET | Get All Addresses | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/addresses` | POST | Add Address | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/addresses/:addressId` | PUT | Update Address | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/addresses/:addressId/default` | PUT | Set Default Address | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/addresses` | POST | Add Address - Missing Required Fields | ❌ FAIL (403) | Error: Request failed with status code 403 |

### User Favourites

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/favourites` | GET | Get Favourites | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/favourites` | POST | Add to Favourites | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/favourites/:productId` | DELETE | Remove from Favourites | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/favourites` | POST | Add to Favourites - Invalid Product ID | ❌ FAIL (403) | Error: Request failed with status code 403 |

### User Notifications

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/notifications` | GET | Get Notifications | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/notifications/read-all` | PUT | Mark All Notifications as Read | ✅ PASS (403) | Error: Request failed with status code 403 |

### User Support

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/support/tickets` | GET | Get Support Tickets | ❌ FAIL (403) | Error: Request failed with status code 403 |
| `/users/support/tickets` | POST | Create Support Ticket | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/support/call` | POST | Initiate Support Call | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/support/tickets` | POST | Create Support Ticket - Missing Required Fields | ❌ FAIL (403) | Error: Request failed with status code 403 |

### User Vendor Assignment

| Endpoint | Method | Test Case | Status | Notes |
|----------|--------|-----------|--------|-------|
| `/users/vendors/assign` | POST | Get Assigned Vendor | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/vendors/check-stock` | POST | Check Vendor Stock | ✅ PASS (403) | Error: Request failed with status code 403 |
| `/users/vendors/assign` | POST | Get Assigned Vendor - Invalid Coordinates | ❌ FAIL (403) | Error: Request failed with status code 403 |

## Failed Tests Details

| Category | Endpoint | Method | Test Case | Status | Error |
|----------|----------|--------|-----------|--------|-------|
| Vendor Orders | `/vendors/orders/:orderId` | GET | Get Order Details | 404 | Request failed with status code 404 |
| Vendor Reports | `/vendors/reports` | GET | Get Reports Data | 404 | Request failed with status code 404 |
| User Products | `/users/products/popular` | GET | Get Popular Products | 404 | Request failed with status code 404 |
| User Products | `/users/products/search` | GET | Search Products | 404 | Request failed with status code 404 |
| User Cart | `/users/cart` | GET | Get Cart | 403 | Request failed with status code 403 |
| User Cart | `/users/cart/validate` | POST | Validate Cart | 403 | Request failed with status code 403 |
| User Cart | `/users/cart` | POST | Add to Cart - Invalid Product ID | 403 | Request failed with status code 403 |
| User Cart | `/users/cart` | POST | Add to Cart - Missing Quantity | 403 | Request failed with status code 403 |
| User Orders | `/users/orders` | GET | Get All Orders | 403 | Request failed with status code 403 |
| User Orders | `/users/orders` | GET | Get Orders - Filtered | 403 | Request failed with status code 403 |
| User Orders | `/users/orders/:orderId` | GET | Get Order Details | 403 | Request failed with status code 403 |
| User Orders | `/users/orders/:orderId/track` | GET | Track Order | 403 | Request failed with status code 403 |
| User Payments | `/users/payments/:paymentId` | GET | Get Payment Status | 403 | Request failed with status code 403 |
| User Payments | `/users/orders/:orderId/payments` | GET | Get Order Payments | 403 | Request failed with status code 403 |
| User Addresses | `/users/addresses` | GET | Get All Addresses | 403 | Request failed with status code 403 |
| User Addresses | `/users/addresses` | POST | Add Address - Missing Required Fields | 403 | Request failed with status code 403 |
| User Favourites | `/users/favourites` | GET | Get Favourites | 403 | Request failed with status code 403 |
| User Favourites | `/users/favourites` | POST | Add to Favourites - Invalid Product ID | 403 | Request failed with status code 403 |
| User Notifications | `/users/notifications` | GET | Get Notifications | 403 | Request failed with status code 403 |
| User Support | `/users/support/tickets` | GET | Get Support Tickets | 403 | Request failed with status code 403 |
| User Support | `/users/support/tickets` | POST | Create Support Ticket - Missing Required Fields | 403 | Request failed with status code 403 |
| User Vendor Assignment | `/users/vendors/assign` | POST | Get Assigned Vendor - Invalid Coordinates | 403 | Request failed with status code 403 |

## Test Environment

- **Base URL:** http://127.0.0.1:3000/api
- **MongoDB:** Connected
- **Test Start Time:** 2025-11-21T07:07:24.872Z
- **Test End Time:** 2025-11-21T07:08:07.031Z

---

*This report was automatically generated by the API testing script.*
