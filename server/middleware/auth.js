import jwt from 'jsonwebtoken';

// Secret key for JWT - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'muze-cafe-secret-key-change-in-production';
const TOKEN_EXPIRY = '8h'; // Tokens expire after 8 hours (typical work shift)

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

  // Attach decoded token to request for use in routes
  req.auth = decoded;
  next();
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
