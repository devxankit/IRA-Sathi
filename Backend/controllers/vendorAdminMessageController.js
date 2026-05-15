/**
 * Vendor Admin Message Controller
 * 
 * Handles communication/messaging between Vendors and Admin
 * Used for text-based requests and other non-standard workflow communications
 */

const VendorAdminMessage = require('../models/VendorAdminMessage');
const Vendor = require('../models/Vendor');
const Admin = require('../models/Admin');

/**
 * @desc    Create message from vendor to admin
 * @route   POST /api/vendors/messages
 * @access  Private (Vendor)
 */
exports.createMessage = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const {
      subject,
      message,
      category = 'general',
      priority = 'normal',
      relatedOrderId,
      relatedCreditPurchaseId,
      tags = [],
    } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required',
      });
    }

    // Validate vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || !vendor.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Vendor not found or inactive',
      });
    }

    // Create message
    const vendorMessage = new VendorAdminMessage({
      vendorId,
      direction: 'vendor_to_admin',
      subject,
      message,
      category,
      priority,
      relatedOrderId,
      relatedCreditPurchaseId,
      tags,
      status: 'open',
      isRead: false,
    });

    await vendorMessage.save();

    res.status(201).json({
      success: true,
      data: {
        message: {
          id: vendorMessage._id,
          messageId: vendorMessage.messageId,
          subject: vendorMessage.subject,
          message: vendorMessage.message,
          category: vendorMessage.category,
          priority: vendorMessage.priority,
          status: vendorMessage.status,
          createdAt: vendorMessage.createdAt,
        },
        message: 'Message sent to admin successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get vendor's messages (sent and received)
 * @route   GET /api/vendors/messages
 * @access  Private (Vendor)
 */
exports.getVendorMessages = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const {
      direction,
      status,
      category,
      priority,
      isRead,
      limit = 20,
      offset = 0,
    } = req.query;

    // Build query
    const query = { vendorId };
    
    if (direction) query.direction = direction;
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (isRead !== undefined) query.isRead = isRead === 'true';

    // Get messages
    const messages = await VendorAdminMessage.find(query)
      .populate('sentBy', 'email name')
      .populate('resolvedBy', 'email name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await VendorAdminMessage.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        messages: messages.map(msg => ({
          id: msg._id,
          messageId: msg.messageId,
          direction: msg.direction,
          subject: msg.subject,
          message: msg.message,
          category: msg.category,
          priority: msg.priority,
          status: msg.status,
          isRead: msg.isRead,
          readAt: msg.readAt,
          sentBy: msg.sentBy ? {
            id: msg.sentBy._id,
            name: msg.sentBy.name || msg.sentBy.email,
          } : null,
          resolvedAt: msg.resolvedAt,
          resolvedBy: msg.resolvedBy ? {
            id: msg.resolvedBy._id,
            name: msg.resolvedBy.name || msg.resolvedBy.email,
          } : null,
          resolutionNote: msg.resolutionNote,
          replyCount: msg.replyCount,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        })),
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get vendor message details
 * @route   GET /api/vendors/messages/:messageId
 * @access  Private (Vendor)
 */
exports.getVendorMessageDetails = async (req, res, next) => {
  try {
    const vendorId = req.user.userId;
    const { messageId } = req.params;

    const message = await VendorAdminMessage.findOne({
      _id: messageId,
      vendorId,
    })
      .populate('sentBy', 'email name')
      .populate('resolvedBy', 'email name')
      .populate('relatedOrderId', 'orderNumber status')
      .populate('relatedCreditPurchaseId', 'totalAmount status');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Mark as read if vendor is viewing and message is from admin
    if (message.direction === 'admin_to_vendor' && !message.isRead) {
      message.markAsRead();
      await message.save();
    }

    res.status(200).json({
      success: true,
      data: {
        message: {
          id: message._id,
          messageId: message.messageId,
          direction: message.direction,
          subject: message.subject,
          message: message.message,
          category: message.category,
          priority: message.priority,
          status: message.status,
          isRead: message.isRead,
          readAt: message.readAt,
          sentBy: message.sentBy ? {
            id: message.sentBy._id,
            name: message.sentBy.name || message.sentBy.email,
          } : null,
          resolvedAt: message.resolvedAt,
          resolvedBy: message.resolvedBy ? {
            id: message.resolvedBy._id,
            name: message.resolvedBy.name || message.resolvedBy.email,
          } : null,
          resolutionNote: message.resolutionNote,
          relatedOrder: message.relatedOrderId ? {
            id: message.relatedOrderId._id,
            orderNumber: message.relatedOrderId.orderNumber,
            status: message.relatedOrderId.status,
          } : null,
          relatedCreditPurchase: message.relatedCreditPurchaseId ? {
            id: message.relatedCreditPurchaseId._id,
            totalAmount: message.relatedCreditPurchaseId.totalAmount,
            status: message.relatedCreditPurchaseId.status,
          } : null,
          replyCount: message.replyCount,
          tags: message.tags,
          attachments: message.attachments,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin messages (from all vendors)
 * @route   GET /api/admin/vendor-messages
 * @access  Private (Admin)
 */
exports.getAdminMessages = async (req, res, next) => {
  try {
    const {
      vendorId,
      direction,
      status,
      category,
      priority,
      isRead,
      limit = 50,
      offset = 0,
    } = req.query;

    // Build query
    const query = {};
    
    if (vendorId) query.vendorId = vendorId;
    if (direction) query.direction = direction;
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (isRead !== undefined) query.isRead = isRead === 'true';

    // Get messages
    const messages = await VendorAdminMessage.find(query)
      .populate('vendorId', 'name phone location')
      .populate('sentBy', 'email name')
      .populate('resolvedBy', 'email name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await VendorAdminMessage.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        messages: messages.map(msg => ({
          id: msg._id,
          messageId: msg.messageId,
          vendor: {
            id: msg.vendorId._id,
            name: msg.vendorId.name,
            phone: msg.vendorId.phone,
          },
          direction: msg.direction,
          subject: msg.subject,
          message: msg.message,
          category: msg.category,
          priority: msg.priority,
          status: msg.status,
          isRead: msg.isRead,
          readAt: msg.readAt,
          readBy: msg.readBy,
          sentBy: msg.sentBy ? {
            id: msg.sentBy._id,
            name: msg.sentBy.name || msg.sentBy.email,
          } : null,
          resolvedAt: msg.resolvedAt,
          resolvedBy: msg.resolvedBy ? {
            id: msg.resolvedBy._id,
            name: msg.resolvedBy.name || msg.resolvedBy.email,
          } : null,
          resolutionNote: msg.resolutionNote,
          replyCount: msg.replyCount,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        })),
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin message details
 * @route   GET /api/admin/vendor-messages/:messageId
 * @access  Private (Admin)
 */
exports.getAdminMessageDetails = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await VendorAdminMessage.findById(messageId)
      .populate('vendorId', 'name phone location status')
      .populate('sentBy', 'email name')
      .populate('resolvedBy', 'email name')
      .populate('readBy', 'email name')
      .populate('relatedOrderId', 'orderNumber status totalAmount')
      .populate('relatedCreditPurchaseId', 'totalAmount status');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Mark as read if admin is viewing and message is from vendor
    if (message.direction === 'vendor_to_admin' && !message.isRead) {
      message.markAsRead(req.user.userId);
      await message.save();
    }

    res.status(200).json({
      success: true,
      data: {
        message: {
          id: message._id,
          messageId: message.messageId,
          vendor: {
            id: message.vendorId._id,
            name: message.vendorId.name,
            phone: message.vendorId.phone,
            location: message.vendorId.location,
            status: message.vendorId.status,
          },
          direction: message.direction,
          subject: message.subject,
          message: message.message,
          category: message.category,
          priority: message.priority,
          status: message.status,
          isRead: message.isRead,
          readAt: message.readAt,
          readBy: message.readBy ? {
            id: message.readBy._id,
            name: message.readBy.name || message.readBy.email,
          } : null,
          resolvedAt: message.resolvedAt,
          resolvedBy: message.resolvedBy ? {
            id: message.resolvedBy._id,
            name: message.resolvedBy.name || message.resolvedBy.email,
          } : null,
          resolutionNote: message.resolutionNote,
          relatedOrder: message.relatedOrderId ? {
            id: message.relatedOrderId._id,
            orderNumber: message.relatedOrderId.orderNumber,
            status: message.relatedOrderId.status,
            totalAmount: message.relatedOrderId.totalAmount,
          } : null,
          relatedCreditPurchase: message.relatedCreditPurchaseId ? {
            id: message.relatedCreditPurchaseId._id,
            totalAmount: message.relatedCreditPurchaseId.totalAmount,
            status: message.relatedCreditPurchaseId.status,
          } : null,
          replyCount: message.replyCount,
          tags: message.tags,
          attachments: message.attachments,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin sends reply/message to vendor
 * @route   POST /api/admin/vendor-messages
 * @access  Private (Admin)
 */
exports.adminCreateMessage = async (req, res, next) => {
  try {
    const adminId = req.user.userId;
    const {
      vendorId,
      subject,
      message,
      category = 'general',
      priority = 'normal',
      repliedTo, // Message ID this is replying to
      relatedOrderId,
      relatedCreditPurchaseId,
      tags = [],
    } = req.body;

    if (!vendorId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID, subject, and message are required',
      });
    }

    // Validate vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || !vendor.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found or inactive',
      });
    }

    // If replying to a message, validate it exists and increment reply count
    let parentMessage = null;
    if (repliedTo) {
      parentMessage = await VendorAdminMessage.findOne({
        _id: repliedTo,
        vendorId,
      });
      
      if (parentMessage) {
        parentMessage.replyCount = (parentMessage.replyCount || 0) + 1;
        await parentMessage.save();
      }
    }

    // Create message from admin to vendor
    const adminMessage = new VendorAdminMessage({
      vendorId,
      direction: 'admin_to_vendor',
      subject,
      message,
      category,
      priority,
      repliedTo,
      relatedOrderId,
      relatedCreditPurchaseId,
      tags,
      sentBy: adminId,
      status: 'open',
      isRead: false,
    });

    await adminMessage.save();

    res.status(201).json({
      success: true,
      data: {
        message: {
          id: adminMessage._id,
          messageId: adminMessage.messageId,
          vendor: {
            id: vendor._id,
            name: vendor.name,
          },
          subject: adminMessage.subject,
          message: adminMessage.message,
          category: adminMessage.category,
          priority: adminMessage.priority,
          status: adminMessage.status,
          repliedTo: parentMessage ? {
            id: parentMessage._id,
            messageId: parentMessage.messageId,
            subject: parentMessage.subject,
          } : null,
          createdAt: adminMessage.createdAt,
        },
        message: 'Message sent to vendor successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin updates message status (resolve, close, etc.)
 * @route   PUT /api/admin/vendor-messages/:messageId/status
 * @access  Private (Admin)
 */
exports.updateMessageStatus = async (req, res, next) => {
  try {
    const adminId = req.user.userId;
    const { messageId } = req.params;
    const { status, resolutionNote } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const message = await VendorAdminMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Update status
    message.status = status;

    // If resolving, set resolved information
    if (status === 'resolved' || status === 'closed') {
      message.markAsResolved(adminId, resolutionNote || '');
    }

    await message.save();

    res.status(200).json({
      success: true,
      data: {
        message: {
          id: message._id,
          messageId: message.messageId,
          status: message.status,
          resolvedAt: message.resolvedAt,
          resolvedBy: message.resolvedBy,
          resolutionNote: message.resolutionNote,
        },
        message: 'Message status updated successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark message as read (Admin)
 * @route   PUT /api/admin/vendor-messages/:messageId/read
 * @access  Private (Admin)
 */
exports.markMessageAsRead = async (req, res, next) => {
  try {
    const adminId = req.user.userId;
    const { messageId } = req.params;

    const message = await VendorAdminMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    if (!message.isRead) {
      message.markAsRead(adminId);
      await message.save();
    }

    res.status(200).json({
      success: true,
      data: {
        message: {
          id: message._id,
          messageId: message.messageId,
          isRead: message.isRead,
          readAt: message.readAt,
        },
        message: 'Message marked as read',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get message statistics for admin dashboard
 * @route   GET /api/admin/vendor-messages/stats
 * @access  Private (Admin)
 */
exports.getMessageStats = async (req, res, next) => {
  try {
    const stats = {
      total: await VendorAdminMessage.countDocuments({}),
      unread: await VendorAdminMessage.countDocuments({
        direction: 'vendor_to_admin',
        isRead: false,
      }),
      open: await VendorAdminMessage.countDocuments({
        status: { $in: ['open', 'in_progress'] },
      }),
      resolved: await VendorAdminMessage.countDocuments({
        status: 'resolved',
      }),
      byCategory: await VendorAdminMessage.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
      ]),
      byPriority: await VendorAdminMessage.aggregate([
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 },
          },
        },
      ]),
    };

    res.status(200).json({
      success: true,
      data: {
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

