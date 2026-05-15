# Vendor Testing Log

## Test Environment
- **Database**: Fresh start (all data deleted, collections preserved)
- **Date**: Starting Vendor testing
- **Prerequisites**: 
  - ✅ Admin account created
  - ✅ Products added in Admin

---

## Test 1: Vendor Registration

**Endpoint**: `POST /api/vendors/auth/register`

**Request**:
```json
{
  "name": "Test Vendor",
  "phone": "+919876543210",
  "location": {
    "address": "123 Main Street",
    "city": "Indore",
    "state": "Madhya Pradesh",
    "pincode": "452001",
    "coordinates": {
      "lat": 22.7196,
      "lng": 75.8577
    }
  }
}
```

**Expected Response**:
- Status: 201
- `success: true`
- OTP should be generated and logged to console
- Vendor should be auto-approved (status: 'approved', isActive: true)

**Important Notes**:
- Only ONE vendor per region (city + state) is allowed
- If you try to register another vendor in the same city+state, it should be rejected
- OTP will be logged to backend console

**Status**: ⏳ PENDING TEST

---

## Test 2: Vendor OTP Request

**Endpoint**: `POST /api/vendors/auth/request-otp`

**Request**:
```json
{
  "phone": "+919876543210"
}
```

**Expected Response**:
- Status: 200
- `success: true`
- OTP should be generated and logged to console

**Status**: ⏳ PENDING TEST

---

## Test 3: Vendor OTP Verification (Complete Registration)

**Endpoint**: `POST /api/vendors/auth/verify-otp`

**Request**:
```json
{
  "phone": "+919876543210",
  "otp": "<OTP_FROM_CONSOLE>"
}
```

**Expected Response**:
- Status: 200
- `success: true`
- `token` should be returned
- `vendor` profile data should be returned
- Vendor should have direct access to dashboard (no approval needed)

**Status**: ⏳ PENDING TEST

---

## Test 4: Vendor Profile Retrieval

**Endpoint**: `GET /api/vendors/auth/profile`

**Headers**:
```
Authorization: Bearer <TOKEN_FROM_VERIFY_OTP>
```

**Expected Response**:
- Status: 200
- `success: true`
- Vendor profile data (name, phone, location, status, credit info)

**Status**: ⏳ PENDING TEST

---

## Test 5: Vendor Dashboard

**Endpoint**: `GET /api/vendors/dashboard`

**Headers**:
```
Authorization: Bearer <TOKEN>
```

**Expected Response**:
- Status: 200
- `success: true`
- Dashboard overview data (orders, inventory, credit, etc.)

**Status**: ⏳ PENDING TEST

---

## Test 6: Vendor Inventory (Check Assigned Products)

**Endpoint**: `GET /api/vendors/inventory`

**Headers**:
```
Authorization: Bearer <TOKEN>
```

**Expected Response**:
- Status: 200
- `success: true`
- List of products assigned to this vendor
- Initially should be empty (no products assigned yet)

**Status**: ⏳ PENDING TEST

---

## Test 7: Admin Assigns Product to Vendor (Optional)

**Endpoint**: `POST /api/admin/products/:productId/assign`

**Headers**:
```
Authorization: Bearer <ADMIN_TOKEN>
```

**Request**:
```json
{
  "vendorId": "<VENDOR_ID>",
  "notes": "Initial assignment"
}
```

**Expected Response**:
- Status: 201
- `success: true`
- Product assignment created

**After this, vendor should see the product in their inventory**

**Status**: ⏳ PENDING TEST

---

## Test 8: Vendor Views Inventory Again

**Endpoint**: `GET /api/vendors/inventory`

**Headers**:
```
Authorization: Bearer <VENDOR_TOKEN>
```

**Expected Response**:
- Status: 200
- `success: true`
- Should now show the assigned product(s)

**Status**: ⏳ PENDING TEST

---

## Next Steps After Vendor Testing

1. ✅ Vendor Registration & Login
2. ✅ Vendor Dashboard
3. ✅ Vendor Inventory
4. ⏳ Test Vendor Orders (requires User to place order)
5. ⏳ Move to User Testing

---

## Notes

- **Region Restriction**: Only one vendor per region (city + state)
- **Auto-Approval**: Vendors are automatically approved on registration
- **OTP**: All OTPs are logged to backend console (development mode)
- **Token**: Save vendor token for authenticated requests

---

## Test Data Suggestions

### Vendor 1 (Indore)
- Name: "Indore Fertilizer Vendor"
- Phone: "+919876543210"
- City: "Indore"
- State: "Madhya Pradesh"
- Coordinates: lat: 22.7196, lng: 75.8577

### Vendor 2 (Mumbai) - Different Region
- Name: "Mumbai Fertilizer Vendor"
- Phone: "+919876543211"
- City: "Mumbai"
- State: "Maharashtra"
- Coordinates: lat: 19.0760, lng: 72.8777

### Vendor 3 (Attempt Duplicate in Indore) - Should Fail
- Name: "Another Indore Vendor"
- Phone: "+919876543212"
- City: "Indore"
- State: "Madhya Pradesh"
- Expected: Registration should be rejected (region already taken)

