const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

// 校验 JWT 并加载用户；同时校验 token_version（改密码后旧 token 立即失效）。
// 旧 token 无 ver 字段时按 0 处理，保证升级后已登录用户不被迫重新登录。
function verifyAndLoadUser(token) {
  const decoded = jwt.verify(token, config.jwtSecret);
  const user = db.queryOne('SELECT id, name, admin, created_at, token_version FROM users WHERE id = ?', [decoded.id]);
  if (!user) return null;
  if ((decoded.ver || 0) !== (user.token_version || 0)) return null;
  return user;
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
  }
  const token = auth.slice(7);
  try {
    const user = verifyAndLoadUser(token);
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
      const user = verifyAndLoadUser(token);
      if (user) req.user = user;
    } catch (_) {}
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware, appTokenMiddleware, optionalAuth, verifyAndLoadUser };
