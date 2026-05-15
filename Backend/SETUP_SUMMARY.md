# Backend Setup Summary

## ✅ Completed Setup

### 1. **Packages Installed**
- ✅ `mongodb` - MongoDB native driver
- ✅ `mongoose` - MongoDB ODM
- ✅ `express` - Web framework
- ✅ `dotenv` - Environment variables
- ✅ `cors` - CORS middleware
- ✅ `helmet` - Security headers
- ✅ `morgan` - HTTP logging
- ✅ `jsonwebtoken` - JWT authentication
- ✅ `bcryptjs` - Password hashing
- ✅ `axios` - HTTP client (for SMS India Hub API)

### 2. **Directory Structure Created**
```
Backend/
├── config/
│   ├── database.js      ✅ MongoDB connection setup
│   ├── sms.js          ✅ SMS India Hub service
│   └── realtime.js     ✅ Push notifications placeholder (future)
├── models/             ✅ Ready for Mongoose schemas
├── routes/             ✅ Ready for API routes
├── controllers/        ✅ Ready for route controllers
├── services/           ✅ Ready for business logic
├── middleware/         ✅ Error handler created
│   └── errorHandler.js
├── utils/              ✅ Constants file created
│   └── constants.js
├── index.js            ✅ Main entry point
├── package.json        ✅ Updated with scripts
├── README.md           ✅ Documentation
└── .gitignore          ✅ Git ignore rules
```

### 3. **Core Files Created**

#### `index.js` - Main Entry Point
- Express server setup
- Middleware configuration (CORS, Helmet, Morgan, Body parsers)
- MongoDB connection
- Health check endpoint (`/health`)
- Error handling
- Graceful shutdown
- Real-time server placeholder for push notifications

#### `config/database.js`
- MongoDB connection with Mongoose
- Connection pooling configuration
- Error handling and reconnection logic
- Graceful shutdown handling

#### `config/sms.js`
- SMS India Hub integration
- OTP generation (6-digit)
- `sendOTP()` function
- `sendSMS()` function for general notifications
- Development mode fallback (logs OTP if SMS fails)

#### `config/realtime.js`
- Placeholder for push notifications
- Ready for WebSocket/SSE implementation
- Future-ready structure

#### `middleware/errorHandler.js`
- Global error handler
- Mongoose error handling (CastError, ValidationError, duplicate keys)
- Development/production error responses

#### `utils/constants.js`
- System constants from PROJECT_OVERVIEW.md:
  - Financial thresholds (MIN_ORDER_VALUE, MIN_VENDOR_PURCHASE, DELIVERY_CHARGE)
  - Geographic rules (VENDOR_COVERAGE_RADIUS_KM)
  - Payment percentages
  - Commission structure
  - Order/Payment status enums

### 4. **Environment Variables Needed**

Create a `.env` file in the Backend directory with:

```env
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# MongoDB
MONGO_URI=mongodb+srv://yash007patidar_db_user:oTtWNuYdLNaGKMe6@cluster0.bjmsiqo.mongodb.net/irasathi?retryWrites=true&w=majority&appName=Cluster0

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# SMS India Hub
SMS_INDIA_HUB_API_KEY=your_sms_india_hub_api_key
SMS_INDIA_HUB_SENDER_ID=IRASAT
SMS_INDIA_HUB_API_URL=https://api.smsindiahub.in/api/v3

# OTP
OTP_EXPIRY_MINUTES=5
OTP_LENGTH=6

# System Parameters
MIN_ORDER_VALUE=2000
MIN_VENDOR_PURCHASE=50000
DELIVERY_CHARGE=50
VENDOR_COVERAGE_RADIUS_KM=20
DELIVERY_TIMELINE_HOURS=24
IRA_PARTNER_COMMISSION_RATE_LOW=2
IRA_PARTNER_COMMISSION_RATE_HIGH=3
IRA_PARTNER_COMMISSION_THRESHOLD=50000

# Razorpay Payment Gateway (Test Mode)
RAZORPAY_KEY_ID=rzp_test_8sYbzHWidwe5Zw
RAZORPAY_KEY_SECRET=GkxKRQ2B0U63BKBoayuugS3D
RAZORPAY_TEST_MODE=true
RAZORPAY_SIMULATE_FAILURE=false
```

## 🚀 Next Steps

### Immediate (To Get Started)
1. **Create `.env` file** with MongoDB connection string
   - **Connection String:** `mongodb+srv://yash007patidar_db_user:oTtWNuYdLNaGKMe6@cluster0.bjmsiqo.mongodb.net/irasathi?retryWrites=true&w=majority&appName=Cluster0`
   - See `MONGODB_CONNECTION.md` for complete connection details

2. **Test Server**
   ```bash
   cd Backend
   npm run dev
   ```
   - Server should start on http://localhost:3000
   - Test health endpoint: http://localhost:3000/health

3. **Configure SMS India Hub**
   - Get API key from SMS India Hub
   - Add to `.env` file

### Development Roadmap

#### Phase 1: Models & Schemas
- Create Mongoose models:
  - `models/User.js`
  - `models/Vendor.js`
  - `models/Seller.js` (IRA Partner)
  - `models/Admin.js`
  - `models/Product.js`
  - `models/Order.js`
  - `models/Payment.js`
  - `models/Address.js`
  - etc.

#### Phase 2: Authentication & OTP
- Create OTP service using `config/sms.js`
- User registration/login with OTP
- Vendor/Seller/Admin authentication
- JWT token generation and validation

#### Phase 3: Routes & Controllers
- Create routes for each module:
  - `/api/users/*`
  - `/api/vendors/*`
  - `/api/sellers/*`
  - `/api/admin/*`
- Implement controllers with business logic

#### Phase 4: Services
- Order processing service
- Payment gateway integration
- Vendor assignment service (20km radius)
- Commission calculation service
- Notification service

#### Phase 5: Push Notifications
- Implement WebSocket/SSE in `config/realtime.js`
- Real-time order status updates
- Payment reminders
- Commission notifications

## 📝 Notes

- **MongoDB**: Using Mongoose ODM for easier schema management
- **SMS Service**: SMS India Hub integration ready, falls back in development mode
- **Push Notifications**: Infrastructure prepared, implementation deferred
- **Error Handling**: Global error handler catches all errors
- **Security**: Helmet for security headers, CORS configured
- **Logging**: Morgan for HTTP request logging

## 🔍 Testing

Once `.env` is configured, test the server:

```bash
# Start server
npm run dev

# In another terminal, test health endpoint
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "IRA SATHI Backend Server is running",
  "timestamp": "2024-..."
}
```

## 📚 References

- Frontend API definitions: `Frontend/src/modules/*/services/*Api.js`
- System requirements: `PROJECT_OVERVIEW.md`




Cloudinary for Product Images:
password: YashP#001
cloud name: dzr6joukq
API KEY: 455119592853485
API Secret: -5D4C5afkdVNFcqRgSLpFxqSjwA
API Environment Variable: CLOUDINARY_URL=cloudinary://455119592853485:-5D4C5afkdVNFcqRgSLpFxqSjwA@dzr6joukq

MongoDB password: eZs25fdXKLkVA5