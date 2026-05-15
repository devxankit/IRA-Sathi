# Notification & Inventory Logic Update Summary

## Overview
This update implements comprehensive notification systems for Vendors, Sellers, and Admins, and enforces strictly defined "Out of Stock" logic across the user-facing platform.

## Key Features Implemented

### 1. Vendor Notifications
*   **Withdrawal Payment**: Receives `withdrawal_approved` notification when Admin processes a withdrawal.
*   **Stock Deficit (Low Stock Alert)**: Receives `stock_low_alert` when Admin processes an order that exceeds available stock. 
    *   **Urgent Deficit Alert**: If an order > stock, a `system_alert` (Urgent) is sent with the specific deficit amount, guiding the vendor to Escalate immediately.
*   **Credit Purchase**: Receives notification when stock purchase is approved.
*   **Escalation**: Receives notification when an escalated order is accepted by Admin.

### 2. Seller Notifications
*   **Withdrawal Payment**: Receives `withdrawal_approved` notification when Admin processes a withdrawal.
*   **Commission**: Receives notification for every commission earned.
*   **Tier Upgrade**: Receives notification when upgraded to a higher commission tier (e.g., 2% -> 3%).

### 3. Admin Notifications
*   **Inventory Alert**: Receives a Platform Notification when Admin inventory hits 0 or drops below 20 units.

### 4. User-Facing "Out of Stock" Logic
Implemented a strict rule across all product views (Search, Listing, Details, Popular, Banners).
**Rule**: A product is considered **Out of Stock** (Stock = 0) if:
1.  Physical Stock is 0.
2.  **OR** Total Stock Value (Stock x Price) < ₹2000.

**Affected Endpoints:**
*   `getProducts` (Listing)
*   `getProductDetails` (Product Page)
*   `getPopularProducts` (Home)
*   `searchProducts` (Search)
*   `getOffers` (Banners/Carousels)

## Fallback & Safety Mechanisms
*   **Non-Blocking Deficit**: If a vendor runs out of stock during an order, the system **does not crash**. Instead, it clamps the stock to 0 (preventing negative DB values) and sends an **Urgent Notification** to the Vendor to manual action (Escalate/Replenish).
*   **Admin Stock Safety**: Restored and secured Admin stock reduction logic to ensure it tracks inventory correctly and alerts admins.

## Next Steps
*   Frontend should automatically respect the `isOutOfStock` flag / `stock: 0` provided by the API to disable "Add to Cart" buttons.
