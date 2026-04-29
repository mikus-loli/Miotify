const express = require('express');
const db = require('../db');
const config = require('../config');
const { AppError } = require('../middleware/error');
const wsManager = require('../websocket');
const pluginManager = require('../plugins/manager');

const router = express.Router();

function gotifyAuth(req, res, next) {
  let token = req.headers['x-gotify-key'];
  if (!token) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.slice(7);
    }
  }
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing app token', errorCode: 401 });
  }
  const app = db.queryOne('SELECT id, name, description, image, user_id, created_at FROM applications WHERE token = ?', [token]);
  if (!app) {
    return res.status(401).json({ error: 'Unauthorized: invalid app token', errorCode: 401 });
  }
  req.app = app;
  next();
}

router.post('/message', gotifyAuth, async (req, res, next) => {
  try {
    let { title, message, priority, extras } = req.body;
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

    await pluginManager.executeHook('message:afterSend', msg);

    wsManager.broadcastToApp(req.app.user_id, req.app.id, msg);

    res.status(200).json({
      id: msg.id,
      appid: msg.appid,
      message: msg.message,
      title: msg.title,
      priority: msg.priority,
      date: msg.created_at,
      extras: extras || {},
    });
  } catch (err) {
    next(err);
  }
});

router.get('/message', gotifyAuth, (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const since = req.query.since ? parseInt(req.query.since, 10) : 0;

    const sql = 'SELECT id, appid, message, title, priority, created_at FROM messages WHERE appid = ? AND id > ? ORDER BY id DESC LIMIT ?';
    const messages = db.queryAll(sql, [req.app.id, since, limit]);

    const gotifyMessages = messages.map((msg) => ({
      id: msg.id,
      appid: msg.appid,
      message: msg.message,
      title: msg.title,
      priority: msg.priority,
      date: msg.created_at,
    }));

    const nextSince = messages.length > 0 ? messages[messages.length - 1].id : null;
    res.json({
      messages: gotifyMessages,
      paging: {
        next: nextSince,
        limit,
        since,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/message/:id', gotifyAuth, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msg = db.queryOne('SELECT id, appid FROM messages WHERE id = ?', [id]);
    if (!msg) {
      throw new AppError('message not found', 404);
    }
    if (msg.appid !== req.app.id) {
      throw new AppError('message not found', 404);
    }
    db.run('DELETE FROM messages WHERE id = ?', [id]);
    res.json({ message: 'message deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
