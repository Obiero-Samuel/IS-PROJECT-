const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware: verifyToken
 * Reads the Authorization: Bearer <token> header, verifies the JWT,
 * and attaches req.user = { id, email, role } from the database.
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
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Invalid token user.' } });
    }

    const user = userRes.rows[0];
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: requireRole
 * Usage: requireRole('admin') or requireRole('authority', 'admin')
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
