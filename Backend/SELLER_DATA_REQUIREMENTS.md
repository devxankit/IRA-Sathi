# Seller Dashboard - Data Requirements Analysis

## SOP Point 1.2: Data Requirements Analysis

This document details all data requirements for Seller Dashboard endpoints based on backend controller analysis.

---

## Collections Required

### 1. **Seller Collection** (`sellers`)
**Purpose**: Seller profile, authentication, wallet, targets

**Fields Required**:
- `sellerId` (String, unique) - Used for matching with User.sellerId
- `name`, `phone`, `email`, `area`, `location`
- `monthlyTarget` (Number) - Sales target for calculating progress
- `wallet.balance` (Number) - Available balance
- `wallet.pending` (Number) - Pending withdrawal requests
- `status` (String) - 'approved' | 'pending' | 'rejected' | 'suspended'
- `isActive` (Boolean) - Must be true for login

**Data States Needed**:
- ✅ At least 5+ approved sellers (`status: 'approved'`, `isActive: true`)
- ✅ Sellers with `monthlyTarget` > 0 (for target progress calculations)
- ✅ Sellers with wallet balance > 0 (for wallet displays)
- ✅ Sellers with pending withdrawals (for pending withdrawal count)

---

### 2. **User Collection** (`users`)
**Purpose**: Referrals (users linked to seller via sellerId)

**Fields Required**:
- `sellerId` (String) - Must match Seller.sellerId (NOT ObjectId reference)
- `name`, `phone`, `email`
- `isActive` (Boolean)
- `isBlocked` (Boolean)

**Data States Needed**:
- ✅ Users with `sellerId` matching each seller's `sellerId`
- ✅ At least 10+ users per seller (for referral counts)
- ✅ Active users (`isActive: true`, `isBlocked: false`)

**Relationships**:
- `User.sellerId` (String) → `Seller.sellerId` (String match)

---

### 3. **Order Collection** (`orders`)
**Purpose**: Sales data, commissions calculation, target progress

**Fields Required**:
- `sellerId` (String) - Must match Seller.sellerId
- `userId` (ObjectId) - Reference to User
- `status` (String) - Must include 'delivered' orders
- `paymentStatus` (String) - Must include 'fully_paid' orders
- `totalAmount` (Number) - For sales calculations
- `createdAt` (Date) - For monthly/date filtering

**Data States Needed**:
- ✅ Orders with `sellerId` matching seller's `sellerId`
- ✅ Orders with `status: 'delivered'` and `paymentStatus: 'fully_paid'` (for sales calculations)
- ✅ Orders in **current month** (`createdAt >= currentMonthStart`) - for monthly stats
- ✅ Orders in **past months** (for target history)
- ✅ At least 10+ delivered/fully_paid orders per seller in current month
- ✅ Orders from different months (for target history view - last 12 months)

**Relationships**:
- `Order.sellerId` (String) → `Seller.sellerId` (String match)
- `Order.userId` (ObjectId) → `User._id` (ObjectId reference)

---

### 4. **Commission Collection** (`commissions`)
**Purpose**: Commission records, wallet transactions, activity feed

**Fields Required**:
- `sellerId` (ObjectId) - Reference to Seller._id
- `userId` (ObjectId) - Reference to User
- `orderId` (ObjectId) - Reference to Order
- `amount` (Number) - Commission amount
- `status` (String) - Commission status
- `month`, `year` (Number) - For monthly grouping
- `createdAt` (Date) - For activity feed sorting

**Data States Needed**:
- ✅ Commissions with `sellerId` matching seller's `_id` (ObjectId)
- ✅ At least 10+ commissions per seller (for transaction history)
- ✅ Recent commissions (for activity feed)
- ✅ Commissions with various statuses (for filtering)

**Relationships**:
- `Commission.sellerId` (ObjectId) → `Seller._id` (ObjectId reference)
- `Commission.userId` (ObjectId) → `User._id` (ObjectId reference)
- `Commission.orderId` (ObjectId) → `Order._id` (ObjectId reference)

**Populate Calls Needed**:
- `.populate('userId', 'name phone')`
- `.populate('orderId', 'orderNumber totalAmount')`

---

### 5. **WithdrawalRequest Collection** (`withdrawalrequests`)
**Purpose**: Withdrawal requests, pending withdrawals count

**Fields Required**:
- `sellerId` (ObjectId) - Reference to Seller._id
- `amount` (Number)
- `status` (String) - 'pending' | 'approved' | 'rejected'
- `reviewedBy` (ObjectId, optional) - Reference to Admin
- `createdAt` (Date)

**Data States Needed**:
- ✅ Withdrawal requests with `sellerId` matching seller's `_id`
- ✅ At least 2+ pending withdrawal requests (`status: 'pending'`) - for pending count
- ✅ At least 3+ approved/rejected withdrawal requests - for history
- ✅ Recent withdrawal requests (for listing)

**Relationships**:
- `WithdrawalRequest.sellerId` (ObjectId) → `Seller._id` (ObjectId reference)
- `WithdrawalRequest.reviewedBy` (ObjectId, optional) → `Admin._id` (ObjectId reference)

**Populate Calls Needed**:
- `.populate('reviewedBy', 'name email')`

---

## Endpoint-Specific Data Requirements

### Authentication Endpoints
- ✅ **Seller Collection**: At least 1 approved seller with `isActive: true`

### Dashboard Endpoints

#### `GET /sellers/dashboard` (getDashboard)
**Required Data**:
- Seller with `monthlyTarget` > 0
- Users with `sellerId` matching seller's `sellerId` (for totalReferrals count)
- Orders with:
  - `sellerId` = seller.sellerId
  - `status: 'delivered'`
  - `paymentStatus: 'fully_paid'`
  - `createdAt` in current month
- WithdrawalRequests with:
  - `sellerId` = seller._id
  - `status: 'pending'`

#### `GET /sellers/dashboard/overview` (getOverview)
**Required Data**:
- Same as getDashboard
- Orders in current month with delivered/fully_paid status

#### `GET /sellers/dashboard/highlights` (getDashboardHighlights)
**Required Data**:
- Users with `sellerId` matching seller's `sellerId`
- Orders with `sellerId` = seller.sellerId, `status: 'delivered'`, `paymentStatus: 'fully_paid'`, current month

#### `GET /sellers/dashboard/activity` (getRecentActivity)
**Required Data**:
- Commissions with `sellerId` = seller._id (recent)
- Orders with `sellerId` = seller.sellerId (recent)
- Both need to populate userId and orderId

### Referrals Endpoints

#### `GET /sellers/referrals` (getReferrals)
**Required Data**:
- Users with `sellerId` matching seller's `sellerId`
- Orders for each user (for purchase stats)
- Commission summary for each user

#### `GET /sellers/referrals/:referralId` (getReferralDetails)
**Required Data**:
- User with `sellerId` matching seller's `sellerId` and `_id` = referralId
- Orders with `userId` = referralId and `sellerId` = seller.sellerId
- Commissions with `userId` = referralId and `sellerId` = seller._id

#### `GET /sellers/referrals/stats` (getReferralStats)
**Required Data**:
- Users with `sellerId` matching seller's `sellerId`
- Orders with `sellerId` = seller.sellerId (for sales calculations)
- Commissions aggregation (for commission stats)

### Wallet Endpoints

#### `GET /sellers/wallet` (getWalletDetails)
**Required Data**:
- Seller with wallet balance
- Commissions with `sellerId` = seller._id (recent 10)

#### `GET /sellers/wallet/transactions` (getWalletTransactions)
**Required Data**:
- Commissions with `sellerId` = seller._id (paginated)
- Commission aggregation for summary

#### `POST /sellers/wallet/withdraw` (requestWithdrawal)
**Creates Data**: New WithdrawalRequest

#### `GET /sellers/wallet/withdrawals` (getWithdrawals)
**Required Data**:
- WithdrawalRequests with `sellerId` = seller._id (various statuses)

#### `GET /sellers/wallet/withdrawals/:requestId` (getWithdrawalDetails)
**Required Data**:
- WithdrawalRequest with `_id` = requestId and `sellerId` = seller._id

### Target & Performance Endpoints

#### `GET /sellers/target` (getTarget)
**Required Data**:
- Seller with `monthlyTarget` > 0
- Orders with `sellerId` = seller.sellerId, `status: 'delivered'`, `paymentStatus: 'fully_paid'`, current month

#### `GET /sellers/targets/history` (getTargetHistory)
**Required Data**:
- Orders with `sellerId` = seller.sellerId, `status: 'delivered'`, `paymentStatus: 'fully_paid'`
- Orders from **last 12 months** (for history)
- Different months to show progress over time

#### `GET /sellers/targets/incentives` (getTargetIncentives)
**Required Data**:
- Orders with `sellerId` = seller.sellerId, `status: 'delivered'`, `paymentStatus: 'fully_paid'`
- Orders from **last 12 months** (to check which months achieved target)
- Monthly sales >= seller.monthlyTarget (for achieved months)

#### `GET /sellers/performance` (getPerformanceAnalytics)
**Required Data**:
- Orders with `sellerId` = seller.sellerId
- Orders from different periods (for trends)
- Various order statuses (for breakdown)
- Users with `sellerId` = seller.sellerId (for referral stats)

---

## Critical Data Relationships

### String Match (NOT ObjectId)
- ✅ `User.sellerId` (String) must match `Seller.sellerId` (String)
- ✅ `Order.sellerId` (String) must match `Seller.sellerId` (String)

### ObjectId References
- ✅ `Commission.sellerId` (ObjectId) → `Seller._id` (ObjectId)
- ✅ `Commission.userId` (ObjectId) → `User._id` (ObjectId)
- ✅ `Commission.orderId` (ObjectId) → `Order._id` (ObjectId)
- ✅ `WithdrawalRequest.sellerId` (ObjectId) → `Seller._id` (ObjectId)
- ✅ `Order.userId` (ObjectId) → `User._id` (ObjectId)

---

## Aggregation Queries Needed

### 1. **Monthly Sales Aggregation**
```javascript
Order.aggregate([
  {
    $match: {
      sellerId: seller.sellerId,
      status: 'delivered',
      paymentStatus: 'fully_paid',
      createdAt: { $gte: currentMonthStart }
    }
  },
  {
    $group: {
      _id: null,
      totalSales: { $sum: '$totalAmount' },
      orderCount: { $sum: 1 },
      averageOrderValue: { $avg: '$totalAmount' }
    }
  }
])
```

**Required Data**:
- At least 5+ orders matching criteria per seller

### 2. **Commission Summary Aggregation**
```javascript
Commission.aggregate([
  { $match: { sellerId: seller._id } },
  {
    $group: {
      _id: { userId: '$userId', month: '$month', year: '$year' },
      totalCommission: { $sum: '$amount' }
    }
  }
])
```

**Required Data**:
- Commissions grouped by user and month

### 3. **Sales Trends Aggregation**
```javascript
Order.aggregate([
  {
    $match: {
      sellerId: seller.sellerId,
      status: 'delivered',
      paymentStatus: 'fully_paid',
      createdAt: { $gte: daysAgo }
    }
  },
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      sales: { $sum: '$totalAmount' },
      orderCount: { $sum: 1 }
    }
  }
])
```

**Required Data**:
- Orders across multiple days (for trends)

### 4. **Top Referrals Aggregation**
```javascript
Order.aggregate([
  {
    $match: {
      sellerId: seller.sellerId,
      status: 'delivered',
      paymentStatus: 'fully_paid'
    }
  },
  {
    $group: {
      _id: '$userId',
      totalPurchases: { $sum: '$totalAmount' },
      orderCount: { $sum: 1 }
    }
  },
  { $sort: { totalPurchases: -1 } },
  { $limit: 10 }
])
```

**Required Data**:
- Orders from different users (for top referrals)

---

## Minimum Data Requirements Summary

### Per Seller:
- ✅ **1 Seller** (approved, active, with monthlyTarget > 0)
- ✅ **10+ Users** with `sellerId` matching seller's `sellerId`
- ✅ **15+ Orders** with `sellerId` matching seller's `sellerId`:
  - At least **10 orders** in **current month** with `status: 'delivered'`, `paymentStatus: 'fully_paid'`
  - At least **5 orders** in **past months** (last 12 months) for target history
- ✅ **10+ Commissions** with `sellerId` matching seller's `_id`
- ✅ **3+ WithdrawalRequests** with `sellerId` matching seller's `_id`:
  - At least **2 pending** requests
  - At least **1 approved/rejected** request

### For Multiple Sellers Testing:
- ✅ **5+ Approved Sellers** (with different sellerId values)
- ✅ **50+ Users** (distributed across sellers via sellerId)
- ✅ **75+ Orders** (distributed across sellers via sellerId)
- ✅ **50+ Commissions** (distributed across sellers via sellerId)
- ✅ **15+ WithdrawalRequests** (distributed across sellers via sellerId)

---

## Data Consistency Rules

1. **String Matching**: `User.sellerId` and `Order.sellerId` must match `Seller.sellerId` exactly (case-sensitive)
2. **ObjectId Matching**: `Commission.sellerId` and `WithdrawalRequest.sellerId` must reference `Seller._id`
3. **Date Ranges**: Orders must span multiple months for target history to work
4. **Order States**: Must have delivered/fully_paid orders for sales calculations
5. **Commission Linking**: Every commission should link to a valid Order and User

---

## Edge Cases to Test

1. **Seller with no referrals** - Dashboard should show 0 referrals
2. **Seller with no orders** - Dashboard should show 0 sales, 0% target progress
3. **Seller with no commissions** - Wallet should show empty transaction history
4. **Seller with no withdrawals** - Withdrawals list should be empty
5. **Seller with target achieved** - Target progress should show 100%+
6. **Seller with target not achieved** - Target progress should show < 100%
7. **Orders in different months** - Target history should show monthly breakdown
8. **Commission from different users** - Transaction history should show different users

---

**Next Steps**: 
- Create `ensureSellerData.js` script based on these requirements
- Create `verifySellerData.js` script to verify all requirements are met

