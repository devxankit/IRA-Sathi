# Seller Dashboard Integration - Endpoint Audit

## SOP Point 1.1: Backend Endpoint Audit

### Frontend API Functions (sellerApi.js) vs Backend Routes

| Frontend API Function | Frontend Endpoint | Backend Route | Status | Notes |
|----------------------|-------------------|---------------|--------|-------|
| **AUTHENTICATION** |
| `requestSellerOTP` | POST `/sellers/auth/request-otp` | POST `/sellers/auth/request-otp` | ✅ Match | |
| `registerSeller` | POST `/sellers/auth/register` | POST `/sellers/auth/register` | ✅ Match | |
| `loginSellerWithOtp` | POST `/sellers/auth/login` | POST `/sellers/auth/verify-otp` | ⚠️ Path Mismatch | Frontend expects `/login`, backend has `/verify-otp` |
| `sellerLogin` | POST `/sellers/login` | ❌ Missing | Frontend has legacy email/password login |
| `sellerLogout` | POST `/sellers/logout` | POST `/sellers/auth/logout` | ⚠️ Path Mismatch | |
| `getSellerProfile` | GET `/sellers/profile` | GET `/sellers/auth/profile` | ⚠️ Path Mismatch | |
| `updateSellerProfile` | PUT `/sellers/profile` | ❌ Missing | Need to implement |
| `changePassword` | PUT `/sellers/password` | ❌ Missing | Need to implement |
| **DASHBOARD** |
| `getDashboardOverview` | GET `/sellers/dashboard/overview` | GET `/sellers/dashboard/overview` | ✅ Match | |
| `getDashboardHighlights` | GET `/sellers/dashboard/highlights` | ❌ Missing | Need to implement |
| `getRecentActivity` | GET `/sellers/dashboard/activity` | ❌ Missing | Need to implement |
| **REFERRALS** |
| `getReferrals` | GET `/sellers/referrals` | GET `/sellers/referrals` | ✅ Match | |
| `getReferralDetails` | GET `/sellers/referrals/:referralId` | GET `/sellers/referrals/:referralId` | ✅ Match | |
| `getReferralStats` | GET `/sellers/referrals/stats` | GET `/sellers/referrals/stats` | ✅ Match | |
| **WALLET** |
| `getWalletBalance` | GET `/sellers/wallet` | GET `/sellers/wallet` | ✅ Match | |
| `getWalletTransactions` | GET `/sellers/wallet/transactions` | GET `/sellers/wallet/transactions` | ✅ Match | |
| `requestWithdrawal` | POST `/sellers/wallet/withdraw` | POST `/sellers/wallet/withdraw` | ✅ Match | |
| `getWithdrawalRequests` | GET `/sellers/wallet/withdrawals` | GET `/sellers/wallet/withdrawals` | ✅ Match | |
| `getWithdrawalRequestDetails` | GET `/sellers/wallet/withdrawals/:requestId` | ❌ Missing | Need to implement |
| **TARGET & PERFORMANCE** |
| `getMonthlyTarget` | GET `/sellers/targets/current` | GET `/sellers/target` | ⚠️ Path Mismatch | Frontend expects `/targets/current` |
| `getTargetHistory` | GET `/sellers/targets/history` | ❌ Missing | Need to implement |
| `getPerformanceAnalytics` | GET `/sellers/performance` | GET `/sellers/performance` | ✅ Match | |
| `getTargetIncentives` | GET `/sellers/targets/incentives` | ❌ Missing | Need to implement |
| **ANNOUNCEMENTS & NOTIFICATIONS** |
| `getAnnouncements` | GET `/sellers/announcements` | ❌ Missing | Need to implement |
| `markAnnouncementRead` | PUT `/sellers/announcements/:id/read` | ❌ Missing | Need to implement |
| `markAllAnnouncementsRead` | PUT `/sellers/announcements/read-all` | ❌ Missing | Need to implement |
| `getNotifications` | GET `/sellers/notifications` | ❌ Missing | Need to implement |
| `markNotificationRead` | PUT `/sellers/notifications/:id/read` | ❌ Missing | Need to implement |
| `markAllNotificationsRead` | PUT `/sellers/notifications/read-all` | ❌ Missing | Need to implement |
| **SHARING** |
| `getSellerShareLink` | GET `/sellers/share-link` | ❌ Missing | Need to implement |
| `trackShareAction` | POST `/sellers/share/track` | ❌ Missing | Need to implement |
| **SUPPORT** |
| `reportIssue` | POST `/sellers/support/report` | ❌ Missing | Need to implement |
| `getSupportTickets` | GET `/sellers/support/tickets` | ❌ Missing | Need to implement |
| `getSupportTicketDetails` | GET `/sellers/support/tickets/:ticketId` | ❌ Missing | Need to implement |
| **PREFERENCES** |
| `getNotificationPreferences` | GET `/sellers/notifications/preferences` | ❌ Missing | Need to implement |
| `updateNotificationPreferences` | PUT `/sellers/notifications/preferences` | ❌ Missing | Need to implement |

### Summary

- **Total Frontend API Functions**: 32
- **✅ Matched Endpoints**: 13
- **⚠️ Path Mismatches**: 4
- **❌ Missing Endpoints**: 15

### Action Items

1. **Fix Path Mismatches** (4 endpoints):
   - `/sellers/auth/login` → `/sellers/auth/verify-otp` (or add `/login` as alias)
   - `/sellers/logout` → `/sellers/auth/logout` (or add `/logout` as alias)
   - `/sellers/profile` → `/sellers/auth/profile` (or add `/profile` route)
   - `/sellers/targets/current` → `/sellers/target` (or add `/targets/current` route)

2. **Add Missing Endpoints** (15 endpoints):
   - Profile: `PUT /sellers/profile`, `PUT /sellers/password`
   - Dashboard: `GET /sellers/dashboard/highlights`, `GET /sellers/dashboard/activity`
   - Wallet: `GET /sellers/wallet/withdrawals/:requestId`
   - Targets: `GET /sellers/targets/history`, `GET /sellers/targets/incentives`
   - Announcements: `GET /sellers/announcements`, `PUT /sellers/announcements/:id/read`, `PUT /sellers/announcements/read-all`
   - Notifications: `GET /sellers/notifications`, `PUT /sellers/notifications/:id/read`, `PUT /sellers/notifications/read-all`
   - Sharing: `GET /sellers/share-link`, `POST /sellers/share/track`
   - Support: `POST /sellers/support/report`, `GET /sellers/support/tickets`, `GET /sellers/support/tickets/:ticketId`
   - Preferences: `GET /sellers/notifications/preferences`, `PUT /sellers/notifications/preferences`

---

## SOP Point 1.2: Data Requirements Analysis

Based on sellerController.js analysis, the following data is required:

### Collections Queried:
1. **Seller** - Seller profile, wallet balance, monthly target
2. **User** - Referrals (users with sellerId matching seller's sellerId)
3. **Order** - Sales data (orders with sellerId, status='delivered', paymentStatus='fully_paid')
4. **Commission** - Commission records linked to seller
5. **WithdrawalRequest** - Withdrawal requests linked to seller

### Data States Required:
1. **Users**:
   - Users with `sellerId` matching seller's `sellerId`
   - Users who made purchases (for active referrals count)

2. **Orders**:
   - Orders with `sellerId` matching seller's `sellerId`
   - Status: `'delivered'`
   - Payment Status: `'fully_paid'`
   - Created in current month (for monthly stats)

3. **Commissions**:
   - Commissions with `sellerId` matching seller's `_id`
   - Various statuses (pending, approved, paid)

4. **WithdrawalRequests**:
   - Withdrawal requests with `sellerId` matching seller's `_id`
   - Status: `'pending'` (for pending count)

### Relationships Needed:
- User.sellerId → Seller.sellerId (string match, not ObjectId)
- Order.sellerId → Seller.sellerId (string match)
- Commission.sellerId → Seller._id (ObjectId reference)
- Commission.userId → User._id (ObjectId reference)
- Commission.orderId → Order._id (ObjectId reference)
- WithdrawalRequest.sellerId → Seller._id (ObjectId reference)
- WithdrawalRequest.reviewedBy → Admin._id (ObjectId reference)

### Aggregation Queries Needed:
1. Monthly sales aggregation (sum of totalAmount, order count, average)
2. Commission summary aggregation (total commissions, pending, paid)
3. Performance analytics (sales trends, order status breakdown, top referrals)

---

**Next Steps**: 
- Proceed to SOP Point 1.3: Create seed scripts to ensure all required data exists
- Proceed to SOP Point 1.4: Create verification script to verify data integrity

