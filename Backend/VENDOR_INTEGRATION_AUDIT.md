# Vendor Dashboard Integration Audit

## Frontend vs Backend Endpoint Mapping

### ✅ Matched Endpoints (Paths Match)
1. `requestVendorOTP` → `POST /vendors/auth/request-otp` ✓
2. `registerVendor` → `POST /vendors/auth/register` ✓
3. `getOrders` → `GET /vendors/orders` ✓
4. `getOrderDetails` → `GET /vendors/orders/:orderId` ✓
5. `getOrderStats` → `GET /vendors/orders/stats` ✓
6. `getInventoryItemDetails` → `GET /vendors/inventory/:itemId` ✓
7. `getInventoryStats` → `GET /vendors/inventory/stats` ✓
8. `getCreditPurchases` → `GET /vendors/credit/purchases` ✓
9. `getCreditPurchaseDetails` → `GET /vendors/credit/purchases/:requestId` ✓
10. `getCreditHistory` → `GET /vendors/credit/history` ✓
11. `getReports` → `GET /vendors/reports` ✓

### ⚠️ Path Mismatches (Need Frontend Update)
1. `loginVendorWithOtp` (frontend) → `verifyOTP` (backend)
   - Frontend: `POST /vendors/auth/login`
   - Backend: `POST /vendors/auth/verify-otp`
   - **Action**: Update frontend to use `/vendors/auth/verify-otp`

2. `logoutVendor` (frontend) → `logout` (backend)
   - Frontend: `POST /vendors/logout`
   - Backend: `POST /vendors/auth/logout`
   - **Action**: Update frontend to use `/vendors/auth/logout`

3. `getVendorProfile` (frontend) → `getProfile` (backend)
   - Frontend: `GET /vendors/profile`
   - Backend: `GET /vendors/auth/profile`
   - **Action**: Update frontend to use `/vendors/auth/profile`

4. `fetchDashboardData` (frontend) → `getDashboard` (backend)
   - Frontend: `GET /vendors/dashboard/overview`
   - Backend: `GET /vendors/dashboard`
   - **Action**: Update frontend to use `/vendors/dashboard`

5. `getPerformanceAnalytics` (frontend) → `getPerformanceAnalytics` (backend)
   - Frontend: `GET /vendors/reports/performance`
   - Backend: `GET /vendors/reports/analytics`
   - **Action**: Update frontend to use `/vendors/reports/analytics`

### ❌ Mock Implementations (Need Real Backend Calls)
1. `acceptOrder` - Currently mocked, backend exists at `POST /vendors/orders/:orderId/accept`
2. `acceptOrderPartially` - Currently mocked, backend exists at `POST /vendors/orders/:orderId/accept-partial`
3. `rejectOrder` - Currently mocked, backend exists at `POST /vendors/orders/:orderId/reject`
4. `updateOrderStatus` - Currently mocked, backend exists at `PUT /vendors/orders/:orderId/status`
5. `getInventory` - Currently mocked, backend exists at `GET /vendors/inventory`
6. `updateInventoryStock` - Currently mocked, backend exists at `PUT /vendors/inventory/:itemId/stock`
7. `getCreditInfo` - Currently mocked, backend exists at `GET /vendors/credit`
8. `requestCreditPurchase` - Currently mocked, backend exists at `POST /vendors/credit/purchase`
9. `getReports` - Currently mocked, backend exists at `GET /vendors/reports`

### ❓ Missing Backend Endpoints (May Need Implementation)
1. `getRegionAnalytics` - `GET /vendors/reports/region`
   - Frontend expects this but route doesn't exist in backend
   - **Action**: Check if this functionality exists in `getPerformanceAnalytics` or create new endpoint

### ✅ Placeholder Functions (Frontend Only - No Backend Needed)
1. `initializeRealtimeConnection` - Frontend WebSocket/SSE setup
2. `handleRealtimeNotification` - Frontend notification handler
3. `loginVendor` - Legacy email/password login (not used in OTP flow)

## Integration Actions Required

1. **Update Frontend API Paths**:
   - Fix path mismatches listed above
   
2. **Replace Mock Implementations**:
   - Replace all mocked API calls with real `apiRequest` calls
   
3. **Check Missing Endpoints**:
   - Verify if `getRegionAnalytics` is needed or handled elsewhere

