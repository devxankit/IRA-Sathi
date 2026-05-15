# Render Deployment Guide for IRA SATHI Backend

This guide will help you deploy the IRA SATHI backend to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. MongoDB Atlas database (or any MongoDB instance)
3. All required API keys and credentials

## Deployment Steps

### 1. Prepare Your Repository

Ensure your backend code is pushed to a Git repository (GitHub, GitLab, or Bitbucket).

### 2. Create a New Web Service on Render

1. Log in to your Render dashboard
2. Click "New +" → "Web Service"
3. Connect your repository
4. Select the repository containing your backend code

### 3. Configure Build Settings

- **Name**: `ira-sathi-backend` (or your preferred name)
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: 
  
  **⚠️ IMPORTANT: Fix the Root Directory Setting**
  
  The error `Service Root Directory "/opt/render/project/src/FarmCommerce/Backend" is missing` means Render is looking in the wrong place.
  
  **To fix this:**
  
  1. **Check your GitHub repository structure:**
     - Go to your GitHub repo: `https://github.com/Sujal-2820/FarmCommerce`
     - Look at the folder structure at the root level
     
  2. **Determine the correct Root Directory:**
     
     **If your repo structure is:**
     ```
     FarmCommerce/
     ├── Backend/
     │   ├── index.js
     │   ├── package.json
     │   └── ...
     └── Frontend/
     ```
     Then set **Root Directory** to: `Backend` (NOT `FarmCommerce/Backend`)
     
     **If your repo structure is:**
     ```
     FarmCommerce/
     └── FarmCommerce/
         ├── Backend/
         └── Frontend/
     ```
     Then set **Root Directory** to: `FarmCommerce/Backend`
     
     **If Backend folder is at repository root:**
     ```
     Backend/
     ├── index.js
     ├── package.json
     └── ...
     ```
     Then leave **Root Directory** EMPTY
  
  3. **Alternative Solution (if above doesn't work):**
     - Leave Root Directory **EMPTY**
     - Set **Build Command** to: `cd Backend && npm install` or `cd FarmCommerce/Backend && npm install` (based on your structure)
     - Set **Start Command** to: `cd Backend && npm start` or `cd FarmCommerce/Backend && npm start`
  
- **Build Command**: `npm install` (or use alternative above)
- **Start Command**: `npm start` (or use alternative above)

### 4. Set Environment Variables

Add the following environment variables in the Render dashboard:

#### Required Variables

```env
NODE_ENV=production
PORT=10000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key_change_this
```

#### CORS Configuration

```env
CORS_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
```

**Important**: Replace `your-frontend-domain.com` with your actual frontend domain(s). For localhost testing, you can add:
```env
CORS_ORIGINS=https://your-frontend-domain.com,http://localhost:5173
```

#### Optional Variables (if using services)

```env
# SMS Service
SMS_INDIA_HUB_API_KEY=your_sms_india_hub_api_key
SMS_INDIA_HUB_SENDER_ID=IRASAT
SMS_INDIA_HUB_API_URL=https://api.smsindiahub.in/api/v3

# Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_TEST_MODE=false
RAZORPAY_SIMULATE_FAILURE=false

# Cloudinary
CLOUDINARY_URL=cloudinary://your_cloudinary_url

# OTP Configuration
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
```

### 5. Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy your application
3. Wait for the deployment to complete (usually 2-5 minutes)

### 6. Verify Deployment

Once deployed, you can verify the deployment by:

1. **Health Check**: Visit `https://your-service-name.onrender.com/health`
   - Should return: `{"status":"ok","message":"IRA SATHI Backend Server is running",...}`

2. **API Test**: Test an endpoint like `/api/users/auth/request-otp`

## Important Notes

### Port Configuration

- Render automatically sets the `PORT` environment variable
- Your code uses `process.env.PORT || 3000`, which will work correctly
- **Do NOT** hardcode the port in your code

### CORS Configuration

- The backend now supports environment-aware CORS
- Set `CORS_ORIGINS` with comma-separated frontend URLs
- Example: `CORS_ORIGINS=https://myapp.com,https://www.myapp.com`

### MongoDB Connection

- Ensure your MongoDB Atlas allows connections from Render's IP addresses
- In MongoDB Atlas: Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0) for Render

### Environment Variables

- **Never commit** `.env` files to Git (already in `.gitignore`)
- Set all environment variables in Render dashboard
- Use Render's environment variable groups for different environments

### Health Checks

- Render uses the `/health` endpoint for health checks
- The endpoint is already configured in your `index.js`

### Logs

- View logs in Render dashboard → Your Service → Logs
- Logs are available in real-time

## Troubleshooting

### Error: "Service Root Directory is missing"

**Problem**: `Service Root Directory "/opt/render/project/src/FarmCommerce/Backend" is missing`

**Solution**:
1. Go to your Render service → Settings
2. Check the **Root Directory** field
3. Based on your GitHub repo structure, set it to:
   - `Backend` (if Backend folder is inside FarmCommerce at root)
   - `FarmCommerce/Backend` (if there's a nested FarmCommerce folder)
   - Leave EMPTY (if Backend is at repo root)
4. Save and redeploy

**Quick Fix**: Try setting Root Directory to just `Backend` (without FarmCommerce/)

### Build Fails

1. Check build logs in Render dashboard
2. Ensure `package.json` has correct `start` script
3. Verify Node.js version compatibility
4. Check Root Directory setting matches your repo structure

### Application Crashes

1. Check application logs
2. Verify all required environment variables are set
3. Ensure MongoDB connection string is correct
4. Check CORS configuration matches your frontend URL

### CORS Errors

1. Verify `CORS_ORIGINS` includes your frontend URL
2. Check frontend is using correct backend URL
3. Ensure no trailing slashes in URLs

### MongoDB Connection Issues

1. Verify MongoDB Atlas network access allows Render IPs
2. Check connection string format
3. Ensure database user has correct permissions

## Updating Your Deployment

1. Push changes to your Git repository
2. Render automatically detects changes and redeploys
3. Monitor deployment logs for any issues

## Local Development

Your local development setup remains unchanged:

1. Create `.env` file in `Backend/` directory
2. Set environment variables locally
3. Run `npm run dev` for development
4. Run `npm start` for production-like testing

The code is fully compatible with both localhost and Render deployment.

## Support

For Render-specific issues, check:
- Render Documentation: https://render.com/docs
- Render Status: https://status.render.com

For application issues, check application logs in Render dashboard.

