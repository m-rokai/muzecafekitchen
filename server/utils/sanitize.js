/**
 * Sanitization utilities for user inputs
 * Prevents XSS attacks and ensures data integrity
 */

/**
 * Sanitize general text input (for descriptions, notes, instructions)
 * Removes HTML tags and limits length
 */
export function sanitizeText(text, maxLength = 500) {
  if (!text || typeof text !== 'string') return null;

  return text
    .replace(/<[^>]*>/g, '')           // Remove HTML tags
    .replace(/[<>]/g, '')              // Remove remaining angle brackets
    .replace(/&[a-zA-Z]+;/g, '')       // Remove HTML entities
    .replace(/javascript:/gi, '')       // Remove javascript: protocol
    .replace(/on\w+=/gi, '')           // Remove event handlers
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize email address
 * Basic validation and cleanup
 */
export function sanitizeEmail(email, maxLength = 254) {
  if (!email || typeof email !== 'string') return null;

  const cleaned = email.trim().toLowerCase().substring(0, maxLength);

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) return null;

  return cleaned;
}

/**
 * Sanitize customer names (more restrictive)
 * Only allows letters, numbers, spaces, hyphens, and apostrophes
 */
export function sanitizeName(text, maxLength = 100) {
  if (!text || typeof text !== 'string') return null;

  return text
    .replace(/[^a-zA-Z0-9\s\-'\.]/g, '') // Only allow safe characters
    .replace(/\s+/g, ' ')                 // Collapse multiple spaces
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize menu item names
 * Allows letters, numbers, spaces, and common punctuation
 */
export function sanitizeMenuItemName(text, maxLength = 100) {
  if (!text || typeof text !== 'string') return null;

  return text
    .replace(/<[^>]*>/g, '')                    // Remove HTML tags
    .replace(/[^a-zA-Z0-9\s\-'&(),\.!]/g, '')   // Allow safe chars
    .replace(/\s+/g, ' ')                        // Collapse multiple spaces
    .trim()
    .substring(0, maxLength);
}

/**
 * Sanitize prices - ensure it's a valid positive number
 */
export function sanitizePrice(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100) / 100; // Round to 2 decimal places
}

/**
 * Sanitize integer values
 */
export function sanitizeInteger(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = parseInt(value, 10);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

/**
 * Sanitize special instructions for orders
 */
export function sanitizeInstructions(text, maxLength = 500) {
  if (!text || typeof text !== 'string') return null;

  return text
    .replace(/<[^>]*>/g, '')           // Remove HTML tags
    .replace(/[<>]/g, '')              // Remove remaining angle brackets
    .trim()
    .substring(0, maxLength) || null;
}

/**
 * Deep sanitize an order object
 */
export function sanitizeOrderData(orderData) {
  return {
    customerName: orderData.customerName ? sanitizeName(orderData.customerName) : null,
    email: orderData.email ? sanitizeEmail(orderData.email) : null,
    notes: sanitizeText(orderData.notes),
    subtotal: sanitizePrice(orderData.subtotal),
    tax: sanitizePrice(orderData.tax),
    total: sanitizePrice(orderData.total),
    items: (orderData.items || []).map(item => ({
      menu_item_id: item.menu_item_id ? sanitizeInteger(item.menu_item_id, 1) : null,
      item_name: sanitizeMenuItemName(item.item_name) || 'Unknown Item',
      quantity: sanitizeInteger(item.quantity, 1, 100),
      unit_price: sanitizePrice(item.unit_price),
      total_price: sanitizePrice(item.total_price),
      special_instructions: sanitizeInstructions(item.special_instructions),
      modifiers: (item.modifiers || []).map(mod => ({
        modifier_name: sanitizeMenuItemName(mod.modifier_name) || 'Unknown',
        price_adjustment: sanitizePrice(mod.price_adjustment),
      })),
    })),
  };
}
