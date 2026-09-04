import { verifyAccessToken } from '../lib/supabase.js';

export const STAFF_ROLES = Object.freeze(['admin', 'staff']);

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}
function bearerToken(req) {
  const header = req.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function authFromUser(user) {
  return {
    sub: user.id,
    subject: user.id,
    email: user.email || null,
    role: user.app_metadata?.role || 'customer',
    isAnonymous: Boolean(user.is_anonymous),
    user,
  };
}

async function resolveAuth(req) {
  if (req.auth) return req.auth;
  const token = bearerToken(req);
  if (!token) return null;
  const user = await verifyAccessToken(token);
  if (!user) return null;
  req.auth = authFromUser(user);
  return req.auth;
}

export async function requireAuth(req, res, next) {
  try {
    const auth = await resolveAuth(req);
    if (!auth) {
      return res.status(401).json({ message: 'Authentication required', code: 'NO_TOKEN' });
    }
    if (!isStaffRole(auth.role)) {
      return res.status(403).json({
        message: 'Staff authentication required',
        code: 'STAFF_ROLE_REQUIRED',
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const auth = await resolveAuth(req);
    if (!auth) {
      return res.status(401).json({ message: 'Authentication required', code: 'NO_TOKEN' });
    }
    if (auth.role !== 'admin') {
      return res.status(403).json({
        message: 'Administrator access required',
        code: 'ADMIN_ROLE_REQUIRED',
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function optionalAuth(req, res, next) {
  try {
    await resolveAuth(req);
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireCustomerIdentity(req, res, next) {
  try {
    const auth = await resolveAuth(req);
    if (!auth) {
      return res.status(401).json({
        message: 'Customer authentication is required',
        code: 'CUSTOMER_AUTH_REQUIRED',
      });
    }
    req.customerIdentity = { subject: auth.subject, source: 'supabase-auth' };
    return next();
  } catch (error) {
    return next(error);
  }
}
