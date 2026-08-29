import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const MIN_JWT_SECRET_LENGTH = 32;
export const STAFF_ROLES = Object.freeze(['admin', 'staff']);

function resolveJwtSecret() {
  const configured = typeof process.env.JWT_SECRET === 'string'
    ? process.env.JWT_SECRET.trim()
    : '';
  if (process.env.NODE_ENV === 'production') {
    if (configured.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must be configured with at least ${MIN_JWT_SECRET_LENGTH} characters in production`);
    }
    return configured;
  }

  // Development/test processes get an ephemeral secret instead of a committed
  // fallback. Tokens are intentionally invalidated whenever the process restarts.
  return configured || crypto.randomBytes(32).toString('base64url');
}

const JWT_SECRET = resolveJwtSecret();
const TOKEN_EXPIRY = '8h'; // Tokens expire after 8 hours (typical work shift)

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

/**
 * Generate a JWT token for authenticated admin/staff
 * @param {object} payload - Data to encode in token
 * @returns {string} JWT token
 */
export function generateToken(payload = {}) {
  return jwt.sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Verify a JWT token
 * @param {string} token - Token to verify
 * @returns {object|null} Decoded payload or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware to require authentication
 * Checks for Bearer token in Authorization header
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentication required',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }

  if (!isStaffRole(decoded.role)) {
    return res.status(403).json({
      message: 'Staff authentication required',
      code: 'STAFF_ROLE_REQUIRED',
    });
  }

  // Attach decoded token to request for use in routes
  req.auth = decoded;
  next();
}

/** Require an administrator for configuration, destructive, and admin-only data routes. */
export function requireAdmin(req, res, next) {
  if (!req.auth) {
    return requireAuth(req, res, next);
  }
  if (req.auth.role !== 'admin') {
    return res.status(403).json({
      message: 'Administrator access required',
      code: 'ADMIN_ROLE_REQUIRED',
    });
  }
  return next();
}

/**
 * Optional auth middleware - doesn't fail if no token, but attaches auth if present
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) {
      req.auth = decoded;
    }
  }

  next();
}

function safeSubject(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 255) return null;
  // Identity subjects are opaque, but must not contain header/control data.
  if (value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

function sameSecret(left, right) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Resolve a customer identity from a verified upstream boundary.
 *
 * Production deliberately has no arbitrary-header fallback. A trusted
 * gateway can configure CUSTOMER_AUTH_MODE=trusted-proxy and inject the
 * subject only after authenticating the customer, while local tests/dev can
 * explicitly opt into CUSTOMER_AUTH_MODE=dev-header. The latter is rejected
 * in production so a browser cannot self-assert an identity there.
 */
export async function resolveVerifiedCustomerSubject(req) {
  const resolver = req.app?.get('customerAuthResolver');
  if (typeof resolver === 'function') {
    const resolved = await resolver(req);
    const subject = typeof resolved === 'string' ? resolved : resolved?.subject;
    return subject ? { subject: safeSubject(subject), source: 'upstream-adapter' } : null;
  }

  const mode = process.env.CUSTOMER_AUTH_MODE || 'required';
  if (mode === 'dev-header') {
    if (process.env.NODE_ENV === 'production') return null;
    const subject = safeSubject(
      req.get('X-Dev-Customer-Subject') || req.get('X-Verified-Subject'),
    );
    return subject ? { subject, source: 'dev-header' } : null;
  }

  if (mode === 'trusted-proxy') {
    const configuredSecret = process.env.CUSTOMER_AUTH_PROXY_SECRET;
    const suppliedSecret = req.get('X-Auth-Proxy-Secret');
    if (!configuredSecret || !sameSecret(configuredSecret, suppliedSecret)) return null;
    const subject = safeSubject(req.get('X-Verified-Subject'));
    return subject ? { subject, source: 'trusted-proxy' } : null;
  }

  return null;
}

/** Require a verified upstream customer subject for customer order routes. */
export function requireCustomerIdentity(req, res, next) {
  resolveVerifiedCustomerSubject(req)
    .then(identity => {
      if (!identity?.subject) {
        const configured = process.env.CUSTOMER_AUTH_MODE === 'trusted-proxy'
          ? !!process.env.CUSTOMER_AUTH_PROXY_SECRET
          : process.env.NODE_ENV !== 'production'
            && process.env.CUSTOMER_AUTH_MODE === 'dev-header';
        return res.status(configured ? 401 : 503).json({
          message: configured
            ? 'A verified customer identity is required'
            : 'Customer authentication is not configured',
          code: configured ? 'CUSTOMER_AUTH_REQUIRED' : 'CUSTOMER_AUTH_NOT_CONFIGURED',
        });
      }
      req.customerIdentity = identity;
      next();
    })
    .catch(err => next(err));
}
