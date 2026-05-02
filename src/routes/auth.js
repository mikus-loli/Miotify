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
      throw new AppError('请输入用户名和密码', 400);
    }
    const user = db.queryOne('SELECT id, name, pass, admin FROM users WHERE name = ?', [name]);
    if (!user) {
      db.addLog({
        level: 'warn',
        category: 'auth',
        action: 'login_failed',
        message: `登录失败：用户 "${name}" 不存在`,
        ip: req.ip || req.connection.remoteAddress,
      });
      throw new AppError('用户名或密码错误', 401);
    }
    const valid = bcrypt.compareSync(pass, user.pass);
    if (!valid) {
      db.addLog({
        level: 'warn',
        category: 'auth',
        action: 'login_failed',
        message: `登录失败：用户 "${name}" 密码错误`,
        userId: user.id,
        userName: user.name,
        ip: req.ip || req.connection.remoteAddress,
      });
      throw new AppError('用户名或密码错误', 401);
    }
    const token = jwt.sign({ id: user.id, name: user.name, admin: user.admin }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });
    db.addLog({
      level: 'info',
      category: 'auth',
      action: 'login',
      message: `用户 "${user.name}" 登录成功`,
      userId: user.id,
      userName: user.name,
      ip: req.ip || req.connection.remoteAddress,
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
      throw new AppError('请输入用户名和密码', 400);
    }
    const existing = db.queryOne('SELECT id FROM users WHERE name = ?', [name]);
    if (existing) {
      throw new AppError('用户名已存在', 409);
    }
    const hash = bcrypt.hashSync(pass, 10);
    db.run('INSERT INTO users (name, pass, admin) VALUES (?, ?, ?)', [name, hash, admin ? 1 : 0]);
    const user = db.queryOne('SELECT id, name, admin, created_at FROM users WHERE name = ?', [name]);
    db.addLog({
      level: 'info',
      category: 'user',
      action: 'create',
      message: `创建用户 "${name}"`,
      userId: req.user.id,
      userName: req.user.name,
      details: { newUserId: user.id, newUser: name, admin: !!admin },
    });
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

router.get('/user/:id', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id !== req.user.id && !req.user.admin) {
      throw new AppError('无权访问', 403);
    }
    const user = db.queryOne('SELECT id, name, admin, created_at FROM users WHERE id = ?', [id]);
    if (!user) {
      throw new AppError('用户不存在', 404);
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.put('/user/:id', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id !== req.user.id && !req.user.admin) {
      throw new AppError('无权操作', 403);
    }
    const existing = db.queryOne('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) {
      throw new AppError('用户不存在', 404);
    }
    const { name } = req.body;
    if (!name || !name.trim()) {
      throw new AppError('请输入用户名', 400);
    }
    const duplicate = db.queryOne('SELECT id FROM users WHERE name = ? AND id != ?', [name.trim(), id]);
    if (duplicate) {
      throw new AppError('用户名已存在', 409);
    }
    db.run('UPDATE users SET name = ? WHERE id = ?', [name.trim(), id]);
    const user = db.queryOne('SELECT id, name, admin, created_at FROM users WHERE id = ?', [id]);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.put('/user/:id/password', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id !== req.user.id && !req.user.admin) {
      throw new AppError('无权操作', 403);
    }
    const existing = db.queryOne('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) {
      throw new AppError('用户不存在', 404);
    }
    const { pass } = req.body;
    if (!pass) {
      throw new AppError('请输入密码', 400);
    }
    const hash = bcrypt.hashSync(pass, 10);
    db.run('UPDATE users SET pass = ? WHERE id = ?', [hash, id]);
    db.addLog({
      level: 'info',
      category: 'user',
      action: 'change_password',
      message: `修改用户密码`,
      userId: req.user.id,
      userName: req.user.name,
      details: { targetUserId: id },
    });
    res.json({ message: '密码已更新' });
  } catch (err) {
    next(err);
  }
});

router.delete('/user/:id', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user.id) {
      throw new AppError('不能删除自己', 400);
    }
    const user = db.queryOne('SELECT id, name FROM users WHERE id = ?', [id]);
    if (!user) {
      throw new AppError('用户不存在', 404);
    }
    db.run('DELETE FROM users WHERE id = ?', [id]);
    db.addLog({
      level: 'info',
      category: 'user',
      action: 'delete',
      message: `删除用户 "${user.name}"`,
      userId: req.user.id,
      userName: req.user.name,
      details: { deletedUserId: id, deletedUserName: user.name },
    });
    res.json({ message: '用户已删除' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
