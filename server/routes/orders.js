import express from 'express';
import * as db from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { orderRateLimit } from '../middleware/rateLimit.js';
import { validateOrderCreation, validateOrderStatus } from '../validators/schemas.js';
import { sanitizeOrderData, sanitizeName, sanitizeText } from '../utils/sanitize.js';
import { sendOrderReadyNotification, sendOrderCancellation } from '../services/email.js';
import { schedulePickupReminderAfterReady } from '../services/pickupReminder.js';

const router = express.Router();

// Create new order - with rate limiting and validation
router.post('/', orderRateLimit, (req, res) => {
  try {
    // Step 0: Refuse new orders if the kitchen is closed
    if (db.getSetting('kitchen_open') === 'false') {
      const message = db.getSetting('kitchen_closed_message')
        || 'Online ordering is temporarily paused. Please try again soon.';
      return res.status(503).json({ message, kitchenClosed: true });
    }

    // Step 1: Validate input structure with Zod
    const validation = validateOrderCreation(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid order data',
        errors: validation.errors,
      });
    }

    // Step 2: Sanitize all user inputs
    const sanitized = sanitizeOrderData(req.body);
    const { customerName, email, items, notes } = sanitized;

    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ message: 'Customer name and items are required' });
    }

    // ============ SERVER-SIDE PRICE VERIFICATION ============
    // Recalculate all prices from database to prevent price manipulation
    let verifiedSubtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const quantity = item.quantity || 1;

      // Get verified item price from database
      let verifiedUnitPrice = 0;
      let itemName = item.item_name;

      if (item.menu_item_id) {
        const menuItem = db.getMenuItem(item.menu_item_id);
        if (menuItem) {
          verifiedUnitPrice = menuItem.price;
          itemName = menuItem.name; // Use database name
        } else {
          console.warn(`Menu item ${item.menu_item_id} not found, using client price`);
          verifiedUnitPrice = item.unit_price || 0;
        }
      } else {
        // No menu_item_id, use client price (could be custom item)
        verifiedUnitPrice = item.unit_price || 0;
      }

      // Verify modifier prices
      let modifierTotal = 0;
      const verifiedModifiers = [];

      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          // Look up modifier price in database
          const dbModifier = db.getModifierOptionByName(mod.modifier_name);
          const verifiedPriceAdjustment = dbModifier
            ? dbModifier.price_adjustment
            : mod.price_adjustment || 0;

          if (!dbModifier) {
            console.warn(`Modifier "${mod.modifier_name}" not found in database, using client price`);
          }

          modifierTotal += verifiedPriceAdjustment;
          verifiedModifiers.push({
            modifier_name: mod.modifier_name,
            price_adjustment: verifiedPriceAdjustment,
          });
        }
      }

      // Calculate verified item total
      const verifiedItemTotal = (verifiedUnitPrice + modifierTotal) * quantity;
      verifiedSubtotal += verifiedItemTotal;

      verifiedItems.push({
        menu_item_id: item.menu_item_id || null,
        item_name: itemName,
        quantity,
        unit_price: verifiedUnitPrice,
        total_price: verifiedItemTotal,
        special_instructions: item.special_instructions || null,
        modifiers: verifiedModifiers,
      });
    }

    // Get tax rate from settings and calculate tax
    const taxRateSetting = db.getSetting('tax_rate');
    const taxRate = taxRateSetting ? parseFloat(taxRateSetting) : 0.0825;
    const verifiedTax = verifiedSubtotal * taxRate;
    const verifiedTotal = verifiedSubtotal + verifiedTax;

    // Create order with verified prices
    const { id: orderId, pickup_number } = db.createOrder({
      customer_name: customerName,
      email: email || null,
      subtotal: verifiedSubtotal,
      tax: verifiedTax,
      total: verifiedTotal,
      notes: notes || null,
    });

    // Add order items with verified prices
    for (const item of verifiedItems) {
      const orderItemId = db.addOrderItem({
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        special_instructions: item.special_instructions,
      });

      // Add modifiers with verified prices
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          db.addOrderItemModifier({
            order_item_id: orderItemId,
            modifier_name: mod.modifier_name,
            price_adjustment: mod.price_adjustment,
          });
        }
      }
    }

    // Get the complete order
    const order = db.getOrder(orderId);

    // NOTE: kitchen emit + confirmation email now happen in the Stripe webhook
    // once payment is confirmed (see routes/stripeWebhook.js). Orders are
    // created unpaid and must be paid via Checkout before reaching the kitchen.

    res.status(201).json({
      id: orderId,
      pickup_number,
      message: 'Order created successfully',
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Get kitchen open/closed status (kitchen staff)
router.get('/kitchen-status', requireAuth, (req, res) => {
  try {
    const open = db.getSetting('kitchen_open') !== 'false';
    const message = db.getSetting('kitchen_closed_message') || '';
    res.json({ open, message });
  } catch (err) {
    console.error('Error getting kitchen status:', err);
    res.status(500).json({ message: 'Failed to load kitchen status' });
  }
});

// Toggle kitchen open/closed (kitchen staff)
router.patch('/kitchen-status', requireAuth, (req, res) => {
  try {
    const { open, message } = req.body || {};
    if (typeof open !== 'boolean') {
      return res.status(400).json({ message: '`open` must be a boolean' });
    }
    db.setSetting('kitchen_open', open ? 'true' : 'false');
    if (typeof message === 'string') {
      // Cap to 200 chars to keep banners readable
      db.setSetting('kitchen_closed_message', message.slice(0, 200));
    }
    const status = {
      open,
      message: open ? '' : (db.getSetting('kitchen_closed_message') || ''),
    };

    const io = req.app.get('io');
    if (io) {
      console.log(`📤 Emitting kitchen-status: ${open ? 'OPEN' : 'CLOSED'}`);
      io.emit('kitchen-status', status);
    }

    res.json({ message: 'Kitchen status updated', ...status });
  } catch (err) {
    console.error('Error setting kitchen status:', err);
    res.status(500).json({ message: 'Failed to update kitchen status' });
  }
});

// Get active orders (for kitchen display) - MUST be before /:id route
// Requires authentication - kitchen staff only
router.get('/active', requireAuth, (req, res) => {
  try {
    const orders = db.getActiveOrders();
    res.json(orders);
  } catch (err) {
    console.error('Error getting active orders:', err);
    res.status(500).json({ message: 'Failed to load orders' });
  }
});

// Get order by ID
router.get('/:id', (req, res) => {
  try {
    const order = db.getOrder(parseInt(req.params.id));
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error('Error getting order:', err);
    res.status(500).json({ message: 'Failed to load order' });
  }
});

// Update order status - requires authentication (kitchen staff only).
// Staff-initiated cancellation routes through cancelOrder() so the reason +
// cancelled_by are persisted; other transitions use updateOrderStatus().
router.patch('/:id/status', requireAuth, (req, res) => {
  try {
    // Validate status input
    const validation = validateOrderStatus(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid status',
        errors: validation.errors,
      });
    }

    const { status } = validation.data;
    const reason = typeof req.body.reason === 'string' ? sanitizeText(req.body.reason, 500) : null;
    const orderId = parseInt(req.params.id);

    let order;
    if (status === 'cancelled') {
      const result = db.cancelOrder(orderId, { reason, source: 'staff' });
      if (!result.ok) {
        const httpCode = result.code === 'not_found' ? 404 : 409;
        return res.status(httpCode).json({ message: result.message, code: result.code });
      }
      order = result.order;
    } else {
      db.updateOrderStatus(orderId, status);
      order = db.getOrder(orderId);
    }

    // Emit update to all clients
    const io = req.app.get('io');
    if (io) {
      io.emit('order-updated', order);
    }

    // Send email notification when order is ready, and arm the 10-minute
    // pickup reminder. The reminder is a no-op if the order moves to
    // completed or cancelled before it fires.
    if (status === 'ready') {
      if (order.email) {
        sendOrderReadyNotification(order).catch(err => {
          console.error('Failed to send ready notification email:', err);
        });
      }
      schedulePickupReminderAfterReady(orderId, req.app.get('io'));
    }

    if (status === 'cancelled' && order.email) {
      sendOrderCancellation(order).catch(err => {
        console.error('Failed to send cancellation email:', err);
      });
    }

    res.json({ message: 'Status updated', order });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// Customer-initiated cancellation. Public route — bearer credential is
// possession of the order id (same trust model as GET /orders/:id). Only
// permitted while status is 'pending'; once the kitchen starts the order
// the customer is told to come to the counter.
router.patch('/:id/cancel', (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const reason = typeof req.body?.reason === 'string'
      ? sanitizeText(req.body.reason, 500)
      : null;

    const result = db.cancelOrder(orderId, { reason, source: 'customer' });
    if (!result.ok) {
      const httpCode = result.code === 'not_found' ? 404
        : result.code === 'too_late' ? 409
        : result.code === 'final_state' ? 409
        : 400;
      return res.status(httpCode).json({
        message: result.message,
        code: result.code,
        order: result.order,
      });
    }

    const order = result.order;

    const io = req.app.get('io');
    if (io) {
      console.log('📤 Customer cancelled order', order.id);
      io.emit('order-updated', order);
    }

    if (order.email) {
      sendOrderCancellation(order).catch(err => {
        console.error('Failed to send cancellation email:', err);
      });
    }

    res.json({ message: 'Order cancelled', order });
  } catch (err) {
    console.error('Error cancelling order:', err);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
});

export default router;
