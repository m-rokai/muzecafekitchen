import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for order creation
 * Prevents spam orders - 5 orders per 15 minutes per IP
 */
export const orderRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 orders per window
  message: {
    message: 'Too many orders created. Please try again in a few minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default IP-based key generator (handles IPv6 properly)
});

/**
 * Rate limiter for admin API requests
 * 100 requests per minute per IP
 */
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    message: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for PIN verification
 * Prevents brute force attacks - 5 attempts per 5 minutes
 */
export const pinRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 attempts per window
  message: {
    message: 'Too many PIN attempts. Please try again in 5 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default IP-based key generator (handles IPv6 properly)
});

/**
 * Rate limiter for general menu API requests
 * More lenient - 200 requests per minute
 */
export const menuRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: {
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
