# ✅ Testing Checklist - Step by Step

## 🔐 **PHASE 1: ADMIN LOGIN** (Start Here)

### Prerequisites Check
- [ ] Backend running: `npm run dev` in `FarmCommerce/Backend`
- [ ] Frontend running: `npm run dev` in `FarmCommerce/Frontend`
- [ ] Admin created: `node scripts/createAdmin.js`

### Test Admin Login
- [ ] Open: `http://localhost:5173/admin/login`
- [ ] Enter email: `admin@irasathi.com`
- [ ] Enter password: `admin123`
- [ ] Click Login
- [ ] Check backend console for OTP
- [ ] Copy 6-digit OTP from console
- [ ] Enter OTP in frontend
- [ ] Click Verify
- [ ] ✅ Should see Dashboard

### Verify Login Success
- [ ] Dashboard loads without errors
- [ ] Admin name/email visible in header
- [ ] `admin_token` exists in localStorage (F12 → Application → Local Storage)
- [ ] No errors in browser console (F12 → Console)

---

## 📊 **PHASE 2: DASHBOARD OVERVIEW**

### Test Dashboard Stats
- [ ] Dashboard page loads
- [ ] Statistics cards visible:
  - [ ] Total Users card
  - [ ] Total Vendors card
  - [ ] Total Sellers card
  - [ ] Total Products card
  - [ ] Total Orders card
  - [ ] Revenue statistics
- [ ] All numbers display (even if 0)

### API Test
```bash
GET /api/admin/dashboard
Authorization: Bearer [token]
```
- [ ] Returns 200 OK
- [ ] Contains overview data
- [ ] All statistics present

---

## 📦 **PHASE 3: PRODUCT MANAGEMENT**

### View Products
- [ ] Navigate to Products page
- [ ] Product list loads
- [ ] Can see pagination (if products exist)

### Create Product (via API first)
```bash
POST /api/admin/products
Authorization: Bearer [token]
Body: {
  "name": "Test Product",
  "description": "Test Description",
  "category": "fruits",
  "priceToVendor": 100,
  "priceToUser": 150,
  "stock": 50
}
```
- [ ] Returns 201 Created
- [ ] Product appears in Products list

### Update Product
- [ ] Click on product
- [ ] Edit details
- [ ] Save changes
- [ ] ✅ Changes reflected

### Toggle Product Visibility
- [ ] Find product in list
- [ ] Toggle active/inactive
- [ ] ✅ Status updates

### Assign Product to Vendor
- [ ] Select product
- [ ] Click "Assign to Vendor"
- [ ] Select vendor
- [ ] ✅ Assignment successful

---

## 🏪 **PHASE 4: VENDOR MANAGEMENT**

### View Vendors
- [ ] Navigate to Vendors page
- [ ] Vendor list loads
- [ ] Can filter by status

### Approve Vendor
- [ ] Find pending vendor
- [ ] Click "Approve"
- [ ] ✅ Vendor status changes to "approved"
- [ ] ✅ Vendor becomes active

### Reject Vendor
- [ ] Find pending vendor
- [ ] Click "Reject"
- [ ] Enter reason (optional)
- [ ] ✅ Vendor status changes to "rejected"

### Set Credit Policy
- [ ] Select approved vendor
- [ ] Set credit limit
- [ ] Set repayment days
- [ ] Set penalty rate
- [ ] ✅ Credit policy saved

### Ban Vendor (Requires >3 escalations)
- [ ] Vendor must have >3 escalations
- [ ] Click "Ban Vendor"
- [ ] Select ban type (temporary/permanent)
- [ ] Enter reason
- [ ] ✅ Vendor banned

### Unban Vendor
- [ ] Find temporarily banned vendor
- [ ] Click "Unban"
- [ ] ✅ Ban revoked
- [ ] ✅ Vendor active again

---

## 👥 **PHASE 5: SELLER MANAGEMENT**

### View Sellers
- [ ] Navigate to Sellers page
- [ ] Seller list loads

### Create Seller
- [ ] Click "Create Seller"
- [ ] Fill form:
  - Name
  - Phone
  - Email
  - Area
- [ ] ✅ Seller created
- [ ] ✅ Auto-approved

### Set Monthly Target
- [ ] Select seller
- [ ] Set monthly target amount
- [ ] ✅ Target saved

### Approve Withdrawal
- [ ] Navigate to Withdrawals
- [ ] Find pending withdrawal
- [ ] Click "Approve"
- [ ] ✅ Withdrawal approved
- [ ] ✅ Seller wallet updated

---

## 👤 **PHASE 6: USER MANAGEMENT**

### View Users
- [ ] Navigate to Users page
- [ ] User list loads

### Block User
- [ ] Select user
- [ ] Click "Block"
- [ ] ✅ User blocked
- [ ] ✅ User inactive

### Unblock User
- [ ] Select blocked user
- [ ] Click "Unblock"
- [ ] ✅ User unblocked
- [ ] ✅ User active

---

## 📦 **PHASE 7: ORDER MANAGEMENT**

### View Orders
- [ ] Navigate to Orders page
- [ ] Order list loads

### View Escalated Orders
- [ ] Click "Escalated Orders"
- [ ] See orders assigned to admin
- [ ] ✅ List filters correctly

### Reassign Order
- [ ] Select escalated order
- [ ] Click "Reassign"
- [ ] Select new vendor
- [ ] ✅ Order reassigned

### Fulfill Order from Warehouse
- [ ] Select escalated order
- [ ] Click "Fulfill from Warehouse"
- [ ] Enter delivery date
- [ ] ✅ Order status: processing

---

## 💰 **PHASE 8: FINANCE & CREDIT**

### View Credits
- [ ] Navigate to Finance → Credits
- [ ] See vendor credits list
- [ ] See outstanding amounts
- [ ] ✅ Overdue vendors highlighted

### View Credit History
- [ ] Select vendor
- [ ] View credit history
- [ ] ✅ Purchase and repayment history visible

### View Financial Parameters
- [ ] Navigate to Finance → Parameters
- [ ] ✅ Parameters displayed:
  - Advance payment %
  - Min order value
  - Min vendor purchase

---

## 📈 **PHASE 9: ANALYTICS & REPORTS**

### View Analytics
- [ ] Navigate to Analytics page
- [ ] Select time period
- [ ] ✅ Charts/graphs display:
  - Revenue trends
  - Order trends
  - Top vendors
  - Top sellers
  - Top products

### Generate Reports
- [ ] Navigate to Reports
- [ ] Select report type
- [ ] Select period (daily/weekly/monthly)
- [ ] ✅ Report generated
- [ ] ✅ Data displayed

---

## 💬 **PHASE 10: VENDOR-ADMIN MESSAGING**

### View Messages
- [ ] Navigate to Messages
- [ ] See vendor messages list
- [ ] ✅ Unread count visible

### Reply to Message
- [ ] Select message
- [ ] Type reply
- [ ] Send
- [ ] ✅ Reply sent

### Update Message Status
- [ ] Select message
- [ ] Change status (resolve/close)
- [ ] ✅ Status updated

---

## 🚪 **PHASE 11: LOGOUT**

### Test Logout
- [ ] Click Logout button
- [ ] ✅ Redirected to login page
- [ ] ✅ Token removed from localStorage
- [ ] ✅ Cannot access protected routes

---

## 📝 Notes

- Test each phase completely before moving to next
- Mark ✅ when feature works correctly
- Note any errors/issues for fixing
- Use browser DevTools (F12) to check:
  - Console for errors
  - Network tab for API calls
  - Application → Local Storage for tokens

---

**Status:** 🔄 In Progress
**Started:** [Date]
**Completed:** [Date]


