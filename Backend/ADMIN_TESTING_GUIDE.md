# 🧪 Admin Dashboard Testing Guide

## Prerequisites

### 1. Ensure Backend is Running
```bash
cd FarmCommerce/Backend
npm run dev
```
✅ **Expected Output:** Server should start on `http://localhost:3000`

### 2. Ensure Frontend is Running
```bash
cd FarmCommerce/Frontend
npm run dev
```
✅ **Expected Output:** Frontend should start (usually on `http://localhost:5173` or similar)

### 3. Create Admin Account (If Not Exists)
```bash
cd FarmCommerce/Backend
node scripts/createAdmin.js
```

**Default Admin Credentials:**
- **Email:** `admin@irasathi.com`
- **Password:** `admin123`
- **Name:** `Test Admin`
- **Role:** `super_admin`

---

## 📋 Step-by-Step Testing

### **STEP 1: Admin Login** ✅

#### **Method 1: Testing via Dashboard (Frontend)**

1. **Navigate to Admin Login Page**
   - Open browser: `http://localhost:5173/admin/login` (or your frontend URL)
   - You should see the Admin Login form

2. **Enter Credentials**
   - Email: `admin@irasathi.com`
   - Password: `admin123`
   - Click "Login" or "Continue"

3. **Check OTP Generation**
   - ✅ After submitting credentials, check the **Backend Console** (terminal where `npm run dev` is running)
   - You should see:
     ```
     ============================================================
     🔐 ADMIN OTP GENERATED
     ============================================================
     📧 Email: admin@irasathi.com
     🔢 OTP Code: XXXXXX
     ⏰ Generated At: [timestamp]
     ⏳ Expires In: 5 minutes
     ============================================================
     ```
   - Copy the OTP code from the console

4. **Enter OTP**
   - Frontend should show OTP input field
   - Enter the 6-digit OTP from console
   - Click "Verify OTP"

5. **Verify Login Success**
   - ✅ Should redirect to Admin Dashboard
   - ✅ Check browser console (F12) - no errors
   - ✅ Check localStorage: `admin_token` should be set
   - ✅ Top navigation should show admin name/email

#### **Method 2: Testing via API (Postman/Thunder Client)**

**Step 1.1: Login with Email/Password**
```http
POST http://localhost:3000/api/admin/auth/login
Content-Type: application/json

{
  "email": "admin@irasathi.com",
  "password": "admin123"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "requiresOtp": true,
    "message": "OTP sent to email",
    "email": "admin@irasathi.com",
    "expiresIn": 300
  }
}
```

**Step 1.2: Request OTP (Optional - Already sent in Step 1.1)**
```http
POST http://localhost:3000/api/admin/auth/request-otp
Content-Type: application/json

{
  "email": "admin@irasathi.com"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully",
    "expiresIn": 300
  }
}
```

**Step 1.3: Verify OTP**
```http
POST http://localhost:3000/api/admin/auth/verify-otp
Content-Type: application/json

{
  "email": "admin@irasathi.com",
  "otp": "123456"
}
```
⚠️ **Note:** Replace `123456` with the actual OTP from backend console

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "...",
      "email": "admin@irasathi.com",
      "name": "Test Admin",
      "role": "super_admin"
    }
  }
}
```
✅ **Save the `token` for subsequent requests**

---

### **STEP 2: Get Admin Profile** ✅

#### **Via Dashboard:**
- Should automatically load profile after login
- Check Dashboard header - should show admin name/email

#### **Via API:**
```http
GET http://localhost:3000/api/admin/auth/profile
Authorization: Bearer YOUR_TOKEN_HERE
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "admin": {
      "id": "...",
      "email": "admin@irasathi.com",
      "name": "Test Admin",
      "role": "super_admin",
      "lastLogin": "2024-..."
    }
  }
}
```

---

### **STEP 3: Dashboard Overview** 📊

#### **Via Dashboard:**
1. Navigate to Dashboard (should auto-load after login)
2. Check if statistics cards are displayed:
   - Total Users
   - Total Vendors
   - Total Sellers
   - Total Products
   - Total Orders
   - Revenue Statistics

#### **Via API:**
```http
GET http://localhost:3000/api/admin/dashboard
Authorization: Bearer YOUR_TOKEN_HERE
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "overview": {
      "users": { "total": 0, "active": 0, "blocked": 0 },
      "vendors": { "total": 0, "approved": 0, "pending": 0 },
      "sellers": { "total": 0, "approved": 0, "pending": 0 },
      "products": { "total": 0, "active": 0 },
      "orders": { "total": 0, "pending": 0, ... },
      "revenue": { "total": 0, "last30Days": 0, ... },
      ...
    }
  }
}
```

---

## 🔄 Next Steps to Test

After completing Admin Login, you can test:

1. **Product Management** - Create, update, delete products
2. **Vendor Management** - Approve/reject vendors, manage credit policies
3. **Seller Management** - Create sellers, manage withdrawals
4. **User Management** - View users, block/unblock
5. **Order Management** - View orders, reassign, fulfill
6. **Payment Management** - View payments
7. **Finance & Credit** - Manage vendor credits
8. **Analytics** - View analytics and reports

---

## 🐛 Troubleshooting

### **Issue: "Admin not found" or "Invalid credentials"**
- ✅ Check if admin exists: `node scripts/createAdmin.js`
- ✅ Verify email/password are correct
- ✅ Check backend console for errors

### **Issue: "Invalid or expired OTP"**
- ✅ OTP expires in 5 minutes
- ✅ Check backend console for OTP code
- ✅ Request new OTP: `POST /api/admin/auth/request-otp`

### **Issue: "Unauthorized" (401)**
- ✅ Token expired or invalid
- ✅ Login again to get new token
- ✅ Check if token is in localStorage (Dashboard) or Authorization header (API)

### **Issue: CORS Error**
- ✅ Ensure backend CORS is enabled
- ✅ Check if frontend URL matches CORS allowed origins
- ✅ Verify API_BASE_URL in frontend matches backend URL

### **Issue: Backend Not Starting**
- ✅ Check MongoDB connection
- ✅ Verify `.env` file exists with `MONGO_URI`
- ✅ Check if port 3000 is available
- ✅ Review error messages in terminal

---

## 📝 Testing Checklist

- [ ] Backend server running (http://localhost:3000)
- [ ] Frontend server running (http://localhost:5173)
- [ ] Admin account created
- [ ] Can access Admin Login page
- [ ] Can submit email/password
- [ ] OTP appears in backend console
- [ ] Can enter OTP
- [ ] Login successful - redirected to Dashboard
- [ ] Token saved in localStorage
- [ ] Profile loads correctly
- [ ] Dashboard statistics display
- [ ] No console errors (browser & backend)

---

## 🎯 Quick Test Commands

```bash
# Test backend health
curl http://localhost:3000/health

# Create admin (if needed)
cd FarmCommerce/Backend
node scripts/createAdmin.js

# View backend logs
# Check terminal where npm run dev is running
```

---

**Ready for next step?** Once Admin Login works, proceed to test **Product Management** or **Vendor Management** features! 🚀


