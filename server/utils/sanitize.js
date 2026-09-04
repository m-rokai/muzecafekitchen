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
    channel: ['cafe', 'partner_meal'].includes(orderData.channel) ? orderData.channel : null,
    paymentSourceToken: typeof orderData.paymentSourceToken === 'string'
      ? orderData.paymentSourceToken.trim().substring(0, 2048)
      : null,
    notes: sanitizeText(orderData.notes),
    items: (orderData.items || []).map(item => ({
      menu_item_id: item.menu_item_id ? sanitizeInteger(item.menu_item_id, 1) : null,
      quantity: sanitizeInteger(item.quantity, 1, 100),
      special_instructions: sanitizeInstructions(item.special_instructions),
      modifiers: (item.modifiers || []).map(mod => ({
        modifier_option_id: mod.modifier_option_id
          ? sanitizeInteger(mod.modifier_option_id, 1)
          : null,
      })),
    })),
  };
}
