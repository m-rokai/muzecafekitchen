import express from 'express';
import * as db from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { orderRateLimit } from '../middleware/rateLimit.js';
import { validateOrderCreation, validateOrderStatus } from '../validators/schemas.js';
import { sanitizeOrderData, sanitizeName, sanitizeText } from '../utils/sanitize.js';
import { sendOrderConfirmation, sendOrderReadyNotification } from '../services/email.js';

const router = express.Router();

// Create new order - with rate limiting and validation
router.post('/', orderRateLimit, (req, res) => {
  try {
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

    // Emit to kitchen display
    const io = req.app.get('io');
    if (io) {
      console.log('📤 Emitting new-order to kitchen:', order.id, order.customer_name);
      io.emit('new-order', order);
    } else {
      console.log('⚠️ Socket.io not available');
    }

    // Send confirmation email (async, don't block response)
    if (order.email) {
      sendOrderConfirmation(order).catch(err => {
        console.error('Failed to send confirmation email:', err);
      });
    }

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

// Update order status - requires authentication (kitchen staff only)
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

    const orderId = parseInt(req.params.id);
    db.updateOrderStatus(orderId, status);

    // Get updated order
    const order = db.getOrder(orderId);

    // Emit update to all clients
    const io = req.app.get('io');
    if (io) {
      io.emit('order-updated', order);
    }

    // Send email notification when order is ready
    if (status === 'ready' && order.email) {
      sendOrderReadyNotification(order).catch(err => {
        console.error('Failed to send ready notification email:', err);
      });
    }

    res.json({ message: 'Status updated', order });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

export default router;
