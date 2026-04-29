const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = db.queryOne('SELECT id, name, admin, created_at FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.admin) {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
}

function appTokenMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing app token' });
  }
  const token = auth.slice(7);
  const app = db.queryOne('SELECT id, name, description, image, user_id, created_at FROM applications WHERE token = ?', [token]);
  if (!app) {
    return res.status(401).json({ error: 'Unauthorized: invalid app token' });
  }
  req.app = app;
  next();
}

function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = db.queryOne('SELECT id, name, admin, created_at FROM users WHERE id = ?', [decoded.id]);
      if (user) req.user = user;
    } catch (_) {}
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, appTokenMiddleware, optionalAuth };
