const express = require('express');
const db = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { AppError } = require('../middleware/error');

const router = express.Router();

router.get('/user', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const users = db.queryAll('SELECT id, name, admin, created_at FROM users');
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get('/user/:id', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id !== req.user.id && !req.user.admin) {
      throw new AppError('forbidden', 403);
    }
    const user = db.queryOne('SELECT id, name, admin, created_at FROM users WHERE id = ?', [id]);
    if (!user) {
      throw new AppError('user not found', 404);
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
