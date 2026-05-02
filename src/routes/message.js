const express = require('express');
const db = require('../db');
const config = require('../config');
const { authMiddleware, appTokenMiddleware, optionalAuth } = require('../middleware/auth');
const { AppError } = require('../middleware/error');
const wsManager = require('../websocket');
const pluginManager = require('../plugins/manager');

const router = express.Router();

router.post('/message', appTokenMiddleware, async (req, res, next) => {
  try {
    let { title, message, priority } = req.body;
    if (!message) {
      throw new AppError('message is required', 400);
    }
    if (message.length > config.maxMessageLength) {
      throw new AppError(`message too long (max ${config.maxMessageLength} chars)`, 400);
    }

    const processed = await pluginManager.executeHook('message:beforeSend', {
      title,
      message,
      priority: priority || 0,
      appid: req.app.id,
    });

    if (processed === null) {
      db.addLog({
        level: 'warn',
        category: 'message',
        action: 'message_rejected',
        message: `Message rejected by plugin for app "${req.app.name}"`,
        appId: req.app.id,
        appName: req.app.name,
        details: { title, messagePreview: message.substring(0, 100) },
      });
      throw new AppError('message rejected by plugin', 400);
    }

    title = processed.title;
    message = processed.message;
    priority = processed.priority;

    const count = db.queryOne('SELECT COUNT(*) as cnt FROM messages WHERE appid = ?', [req.app.id]);
    if (count.cnt >= config.maxMessagesPerApp) {
      const oldest = db.queryOne('SELECT id FROM messages WHERE appid = ? ORDER BY id ASC LIMIT 1', [req.app.id]);
      if (oldest) {
        db.run('DELETE FROM messages WHERE id = ?', [oldest.id]);
      }
    }
    db.run('INSERT INTO messages (appid, message, title, priority) VALUES (?, ?, ?, ?)', [
      req.app.id,
      message,
      title || '',
      priority || 0,
    ]);
    const msg = db.queryOne('SELECT id, appid, message, title, priority, created_at FROM messages WHERE appid = ? ORDER BY id DESC LIMIT 1', [req.app.id]);

    db.addLog({
      level: 'info',
      category: 'message',
      action: 'message_sent',
      message: `Message sent via app "${req.app.name}"`,
      appId: req.app.id,
      appName: req.app.name,
      details: { messageId: msg.id, title: msg.title, priority: msg.priority },
    });

    await pluginManager.executeHook('message:afterSend', msg);

    wsManager.broadcastToApp(req.app.user_id, req.app.id, msg);
    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
});

router.get('/message', authMiddleware, (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const since = req.query.since ? parseInt(req.query.since, 10) : 0;
    const appid = req.query.appid ? parseInt(req.query.appid, 10) : null;

    let sql;
    let params;
    if (appid) {
      const app = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [appid, req.user.id]);
      if (!app) {
        throw new AppError('application not found', 404);
      }
      sql = 'SELECT id, appid, message, title, priority, created_at FROM messages WHERE appid = ? AND id > ? ORDER BY id DESC LIMIT ?';
      params = [appid, since, limit];
    } else {
      const appIds = db.queryAll('SELECT id FROM applications WHERE user_id = ?', [req.user.id]).map(a => a.id);
      if (appIds.length === 0) {
        return res.json({ messages: [], paging: { next: null, limit, since } });
      }
      const placeholders = appIds.map(() => '?').join(',');
      sql = `SELECT id, appid, message, title, priority, created_at FROM messages WHERE appid IN (${placeholders}) AND id > ? ORDER BY id DESC LIMIT ?`;
      params = [...appIds, since, limit];
    }
    const messages = db.queryAll(sql, params);
    const nextSince = messages.length > 0 ? messages[messages.length - 1].id : null;
    res.json({ messages, paging: { next: nextSince, limit, since } });
  } catch (err) {
    next(err);
  }
});

router.get('/message/:id', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msg = db.queryOne('SELECT id, appid, message, title, priority, created_at FROM messages WHERE id = ?', [id]);
    if (!msg) {
      throw new AppError('message not found', 404);
    }
    const app = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [msg.appid, req.user.id]);
    if (!app) {
      throw new AppError('message not found', 404);
    }
    res.json(msg);
  } catch (err) {
    next(err);
  }
});

router.delete('/message/:id', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msg = db.queryOne('SELECT id, appid FROM messages WHERE id = ?', [id]);
    if (!msg) {
      throw new AppError('message not found', 404);
    }
    const app = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [msg.appid, req.user.id]);
    if (!app) {
      throw new AppError('message not found', 404);
    }
    db.run('DELETE FROM messages WHERE id = ?', [id]);
    res.json({ message: 'message deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
