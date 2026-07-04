/**
 * This file contains security middleware.
 * It approves authentication from JWT tokens and enforces role-based authorization.
 */
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * verifyToken middleware:
 * Verify JWT and attach user identity to req.user.
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Access denied. No token provided.' } });
  }

  const token = authHeader.split(' ')[1];

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: { message: 'Invalid or expired token.' } });
  }

  try {
    const userRes = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Invalid token user.' } });
    }

    const user = userRes.rows[0];

    const isActive = Object.prototype.hasOwnProperty.call(user, 'is_active')
      ? Boolean(user.is_active)
      : true;

    if (!isActive) {
      return res.status(403).json({ error: { message: 'Account is deactivated. Please contact admin.' } });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      ward_id: user.ward_id,
      authority_id: user.authority_id ?? null,
      is_active: isActive,
    };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * requireRole middleware:
 * Allow access only for listed roles.
 * Example usage: requireRole('admin') or requireRole('authority', 'admin').
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Not authenticated.' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'Forbidden: insufficient permissions.' } });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };
