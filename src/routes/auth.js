const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { AppError } = require('../middleware/error');

const router = express.Router();

router.post('/login', (req, res, next) => {
  try {
    const { name, pass } = req.body;
    if (!name || !pass) {
      throw new AppError('name and pass are required', 400);
    }
    const user = db.queryOne('SELECT id, name, pass, admin FROM users WHERE name = ?', [name]);
    if (!user) {
      throw new AppError('invalid username or password', 401);
    }
    const valid = bcrypt.compareSync(pass, user.pass);
    if (!valid) {
      throw new AppError('invalid username or password', 401);
    }
    const token = jwt.sign({ id: user.id, name: user.name, admin: user.admin }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });
    res.json({ token, id: user.id, name: user.name, admin: !!user.admin });
  } catch (err) {
    next(err);
  }
});

router.post('/user', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const { name, pass, admin } = req.body;
    if (!name || !pass) {
      throw new AppError('name and pass are required', 400);
    }
    const existing = db.queryOne('SELECT id FROM users WHERE name = ?', [name]);
    if (existing) {
      throw new AppError('username already exists', 409);
    }
    const hash = bcrypt.hashSync(pass, 10);
    db.run('INSERT INTO users (name, pass, admin) VALUES (?, ?, ?)', [name, hash, admin ? 1 : 0]);
    const user = db.queryOne('SELECT id, name, admin, created_at FROM users WHERE name = ?', [name]);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.get('/user', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const users = db.queryAll('SELECT id, name, admin, created_at FROM users');
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.delete('/user/:id', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user.id) {
      throw new AppError('cannot delete yourself', 400);
    }
    const user = db.queryOne('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      throw new AppError('user not found', 404);
    }
    db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'user deleted' });
  } catch (err) {
    next(err);
  }
});

router.put('/user/:id/password', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id !== req.user.id && !req.user.admin) {
      throw new AppError('forbidden', 403);
    }
    const { pass } = req.body;
    if (!pass) {
      throw new AppError('pass is required', 400);
    }
    const hash = bcrypt.hashSync(pass, 10);
    const changed = db.run('UPDATE users SET pass = ? WHERE id = ?', [hash, id]);
    if (changed === 0) {
      throw new AppError('user not found', 404);
    }
    res.json({ message: 'password updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
