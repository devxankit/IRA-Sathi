const VendorNotification = require('../models/VendorNotification');

/**
 * Vendor Notification Helper
 * 
 * Utility functions to create vendor notifications for various events
 */

/**
 * Create notification for new order assigned
 */
async function notifyOrderAssigned(vendorId, order) {
  try {
    const customerName = order.userId?.name || 'Customer';
    const amount = order.totalAmount || 0;
    
    await VendorNotification.createNotification({
      vendorId,
      type: 'order_assigned',
      title: '📦 New Order Received',
      message: `You have a new order from ${customerName} (₹${amount.toLocaleString('en-IN')})`,
      relatedEntityType: 'order',
      relatedEntityId: order._id || order.id,
      priority: 'high',
      metadata: {
        orderNumber: order.orderNumber,
        customerName,
        amount,
        orderId: order._id?.toString() || order.id,
      },
    });
  } catch (error) {
    console.error('Error creating order assigned notification:', error);
  }
}

/**
 * Create notification for stock arrival
 */
async function notifyStockArrival(vendorId, stockData) {
  try {
    const productName = stockData.productName || 'Stock';
    const quantity = stockData.quantity || 0;
    const unit = stockData.unit || 'units';
    
    await VendorNotification.createNotification({
      vendorId,
      type: 'stock_arrival',
      title: '📥 Stock Arrived',
      message: `${productName} stock has arrived (${quantity} ${unit})`,
      relatedEntityType: 'stock',
      relatedEntityId: stockData.productId || stockData._id,
      priority: 'normal',
      metadata: {
        productName,
        quantity,
        unit,
        productId: stockData.productId?.toString() || stockData._id?.toString(),
      },
    });
  } catch (error) {
    console.error('Error creating stock arrival notification:', error);
  }
}

/**
 * Create notification for repayment due reminder
 */
async function notifyRepaymentDue(vendorId, repaymentData) {
  try {
    const dueDate = repaymentData.dueDate;
    const amount = repaymentData.amount || repaymentData.creditUsed || 0;
    const daysUntilDue = repaymentData.daysUntilDue || 0;
    
    let title, message;
    if (daysUntilDue <= 0) {
      title = '⏰ Credit Repayment Overdue';
      message = `Your credit repayment of ₹${amount.toLocaleString('en-IN')} is overdue. Please repay immediately to avoid penalties.`;
    } else if (daysUntilDue <= 5) {
      title = '⏰ Credit Repayment Due Soon';
      message = `Your credit repayment of ₹${amount.toLocaleString('en-IN')} is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''}.`;
    } else {
      title = '⏰ Credit Repayment Reminder';
      message = `Your credit repayment of ₹${amount.toLocaleString('en-IN')} is due on ${new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`;
    }
    
    await VendorNotification.createNotification({
      vendorId,
      type: 'repayment_due_reminder',
      title,
      message,
      relatedEntityType: 'repayment',
      priority: daysUntilDue <= 0 ? 'urgent' : daysUntilDue <= 5 ? 'high' : 'normal',
      metadata: {
        amount,
        dueDate: dueDate?.toISOString(),
        daysUntilDue,
      },
    });
  } catch (error) {
    console.error('Error creating repayment due notification:', error);
  }
}

/**
 * Create notification for repayment overdue alert
 */
async function notifyRepaymentOverdue(vendorId, repaymentData) {
  try {
    const amount = repaymentData.amount || repaymentData.creditUsed || 0;
    const daysOverdue = repaymentData.daysOverdue || 0;
    const penaltyAmount = repaymentData.penaltyAmount || 0;
    
    await VendorNotification.createNotification({
      vendorId,
      type: 'repayment_overdue_alert',
      title: '⚠️ Repayment Overdue',
      message: `Your credit repayment of ₹${amount.toLocaleString('en-IN')} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue. Penalty: ₹${penaltyAmount.toLocaleString('en-IN')}. Please repay immediately.`,
      relatedEntityType: 'repayment',
      priority: 'urgent',
      metadata: {
        amount,
        daysOverdue,
        penaltyAmount,
      },
    });
  } catch (error) {
    console.error('Error creating repayment overdue notification:', error);
  }
}

/**
 * Create notification for successful repayment
 */
async function notifyRepaymentSuccess(vendorId, repayment) {
  try {
    const amount = repayment.amount || 0;
    const penaltyAmount = repayment.penaltyAmount || 0;
    const totalAmount = amount + penaltyAmount;
    
    await VendorNotification.createNotification({
      vendorId,
      type: 'repayment_success',
      title: '✅ Repayment Successful',
      message: `Your repayment of ₹${amount.toLocaleString('en-IN')}${penaltyAmount > 0 ? ` (including ₹${penaltyAmount.toLocaleString('en-IN')} penalty)` : ''} has been processed successfully.`,
      relatedEntityType: 'repayment',
      relatedEntityId: repayment._id || repayment.id,
      priority: 'normal',
      metadata: {
        amount,
        penaltyAmount,
        totalAmount,
        repaymentId: repayment.repaymentId || repayment._id?.toString() || repayment.id,
      },
    });
  } catch (error) {
    console.error('Error creating repayment success notification:', error);
  }
}

/**
 * Create notification for low stock alert
 */
async function notifyLowStock(vendorId, product) {
  try {
    const productName = product.name || 'Product';
    const currentStock = product.stock || product.currentStock || 0;
    const unit = product.unit || product.stockUnit || 'units';
    
    await VendorNotification.createNotification({
      vendorId,
      type: 'stock_low_alert',
      title: '⚠️ Low Stock Alert',
      message: `${productName} stock is running low (${currentStock} ${unit} remaining)`,
      relatedEntityType: 'stock',
      relatedEntityId: product._id || product.id,
      priority: 'normal',
      metadata: {
        productName,
        currentStock,
        unit,
        productId: product._id?.toString() || product.id,
      },
    });
  } catch (error) {
    console.error('Error creating low stock notification:', error);
  }
}

/**
 * Create notification for credit purchase approval
 */
async function notifyCreditPurchaseApproved(vendorId, purchase) {
  try {
    const amount = purchase.amount || purchase.requestedAmount || 0;
    
    await VendorNotification.createNotification({
      vendorId,
      type: 'credit_purchase_approved',
      title: '✅ Purchase Request Approved',
      message: `Your credit purchase request of ₹${amount.toLocaleString('en-IN')} has been approved by Admin.`,
      relatedEntityType: 'credit_purchase',
      relatedEntityId: purchase._id || purchase.id,
      priority: 'normal',
      metadata: {
        amount,
        purchaseId: purchase.purchaseId || purchase._id?.toString() || purchase.id,
      },
    });
  } catch (error) {
    console.error('Error creating credit purchase approved notification:', error);
  }
}

/**
 * Create notification for credit purchase rejection
 */
async function notifyCreditPurchaseRejected(vendorId, purchase) {
  try {
    const amount = purchase.amount || purchase.requestedAmount || 0;
    const reason = purchase.rejectionReason || 'Please contact Admin for details.';
    
    await VendorNotification.createNotification({
      vendorId,
      type: 'credit_purchase_rejected',
      title: '❌ Purchase Request Rejected',
      message: `Your credit purchase request of ₹${amount.toLocaleString('en-IN')} has been rejected. ${reason}`,
      relatedEntityType: 'credit_purchase',
      relatedEntityId: purchase._id || purchase.id,
      priority: 'high',
      metadata: {
        amount,
        reason,
        purchaseId: purchase.purchaseId || purchase._id?.toString() || purchase.id,
      },
    });
  } catch (error) {
    console.error('Error creating credit purchase rejected notification:', error);
  }
}

module.exports = {
  notifyOrderAssigned,
  notifyStockArrival,
  notifyRepaymentDue,
  notifyRepaymentOverdue,
  notifyRepaymentSuccess,
  notifyLowStock,
  notifyCreditPurchaseApproved,
  notifyCreditPurchaseRejected,
};











