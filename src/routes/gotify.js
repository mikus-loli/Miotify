const express = require('express');
const db = require('../db');
const config = require('../config');
const pluginManager = require('../plugins/manager');
const wsManager = require('../websocket');
const { AppError } = require('../middleware/error');

const router = express.Router();

const GOTIFY_VERSION = '2.9.1';

router.use((req, res, next) => {
  console.log(`[Gotify] ${req.method} ${req.path}`);
  next();
});

function gotifyTokenMiddleware(req, res, next) {
  let token = null;

  if (req.headers['x-gotify-key']) {
    token = req.headers['x-gotify-key'];
  } else if (req.query.token) {
    token = req.query.token;
  } else if (req.headers.authorization) {
    const auth = req.headers.authorization;
    if (auth.startsWith('Bearer ')) {
      token = auth.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      errorCode: 401,
      errorDescription: 'you need to provide a valid access token (app-token or client-token)',
    });
  }

  const app = db.queryOne('SELECT id, name, description, image, user_id, created_at FROM applications WHERE token = ?', [token]);
  if (app) {
    req.app = app;
    req.tokenType = 'application';
    return next();
  }

  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = db.queryOne('SELECT id, name, admin, created_at FROM users WHERE id = ?', [decoded.id]);
    if (user) {
      req.user = user;
      req.tokenType = 'client';
      return next();
    }
  } catch (_) {}

  return res.status(401).json({
    error: 'Unauthorized',
    errorCode: 401,
    errorDescription: 'you need to provide a valid access token (app-token or client-token)',
  });
}

function requireClientToken(req, res, next) {
  if (req.tokenType !== 'client') {
    return res.status(403).json({
      error: 'Forbidden',
      errorCode: 403,
      errorDescription: 'this endpoint requires a client-token, not an app-token',
    });
  }
  next();
}

function requireAppToken(req, res, next) {
  if (req.tokenType !== 'application') {
    return res.status(403).json({
      error: 'Forbidden',
      errorCode: 403,
      errorDescription: 'this endpoint requires an app-token, not a client-token',
    });
  }
  next();
}

function formatMessage(msg) {
  if (!msg) return null;
  let extras = null;
  if (msg.extras) {
    try {
      extras = JSON.parse(msg.extras);
    } catch (_) {
      extras = null;
    }
  }
  return {
    id: msg.id,
    appid: msg.appid,
    message: msg.message,
    title: msg.title || '',
    priority: msg.priority || 0,
    extras: extras,
    date: msg.created_at ? msg.created_at.replace(' ', 'T') + '+08:00' : new Date().toISOString(),
  };
}

router.get('/health', (req, res) => {
  res.json({ health: 'green' });
});

router.get('/version', (req, res) => {
  res.json({ version: GOTIFY_VERSION });
});

router.post('/message', gotifyTokenMiddleware, requireAppToken, async (req, res, next) => {
  try {
    let { title, message, priority, extras } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Bad Request',
        errorCode: 400,
        errorDescription: 'message is required',
      });
    }

    if (message.length > config.maxMessageLength) {
      return res.status(400).json({
        error: 'Bad Request',
        errorCode: 400,
        errorDescription: `message too long (max ${config.maxMessageLength} chars)`,
      });
    }

    if (!title) {
      title = req.app.name;
    }

    const processed = await pluginManager.executeHook('message:beforeSend', {
      title,
      message,
      priority: priority || 0,
      appid: req.app.id,
    });

    if (processed === null) {
      return res.status(400).json({
        error: 'Bad Request',
        errorCode: 400,
        errorDescription: 'message rejected by plugin',
      });
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

    const extrasJson = extras ? JSON.stringify(extras) : null;
    db.run('INSERT INTO messages (appid, message, title, priority, extras) VALUES (?, ?, ?, ?, ?)', [
      req.app.id,
      message,
      title || '',
      priority || 0,
      extrasJson,
    ]);

    const msg = db.queryOne('SELECT id, appid, message, title, priority, extras, created_at FROM messages WHERE appid = ? ORDER BY id DESC LIMIT 1', [req.app.id]);

    await pluginManager.executeHook('message:afterSend', msg);

    wsManager.broadcastToApp(req.app.user_id, req.app.id, msg);

    console.log(`[Gotify] Message created: id=${msg.id} app=${req.app.name}(${req.app.id}) priority=${priority}`);

    res.status(200).json(formatMessage(msg));
  } catch (err) {
    console.error('[Gotify] Error creating message:', err.message);
    next(err);
  }
});

router.get('/message', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const since = req.query.since ? parseInt(req.query.since, 10) : 0;

    const appIds = db.queryAll('SELECT id FROM applications WHERE user_id = ?', [req.user.id]).map(a => a.id);
    if (appIds.length === 0) {
      return res.json({ messages: [], paging: { next: null, limit, since } });
    }

    const placeholders = appIds.map(() => '?').join(',');
    let sql = `SELECT id, appid, message, title, priority, extras, created_at FROM messages WHERE appid IN (${placeholders})`;
    const params = [...appIds];

    if (since > 0) {
      sql += ' AND id < ?';
      params.push(since);
    }

    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    const messages = db.queryAll(sql, params);
    const nextSince = messages.length > 0 ? messages[messages.length - 1].id : null;

    res.json({
      messages: messages.map(formatMessage),
      paging: { next: nextSince, limit, since },
    });
  } catch (err) {
    console.error('[Gotify] Error fetching messages:', err.message);
    next(err);
  }
});

router.delete('/message', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const appIds = db.queryAll('SELECT id FROM applications WHERE user_id = ?', [req.user.id]).map(a => a.id);
    if (appIds.length === 0) {
      return res.json({});
    }
    const placeholders = appIds.map(() => '?').join(',');
    db.run(`DELETE FROM messages WHERE appid IN (${placeholders})`, appIds);
    console.log(`[Gotify] All messages deleted for user ${req.user.name}`);
    res.json({});
  } catch (err) {
    console.error('[Gotify] Error deleting messages:', err.message);
    next(err);
  }
});

router.get('/message/:id', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msg = db.queryOne('SELECT id, appid, message, title, priority, extras, created_at FROM messages WHERE id = ?', [id]);
    if (!msg) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'message not found',
      });
    }
    const app = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [msg.appid, req.user.id]);
    if (!app) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'message not found',
      });
    }
    res.json(formatMessage(msg));
  } catch (err) {
    next(err);
  }
});

router.delete('/message/:id', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msg = db.queryOne('SELECT id, appid FROM messages WHERE id = ?', [id]);
    if (!msg) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'message not found',
      });
    }
    const app = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [msg.appid, req.user.id]);
    if (!app) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'message not found',
      });
    }
    db.run('DELETE FROM messages WHERE id = ?', [id]);
    res.json({});
  } catch (err) {
    next(err);
  }
});

router.get('/application', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const apps = db.queryAll('SELECT id, token, name, description, image, user_id, created_at FROM applications WHERE user_id = ?', [req.user.id]);
    res.json(apps.map(app => ({
      id: app.id,
      token: app.token,
      name: app.name,
      description: app.description,
      image: app.image || '',
      internal: false,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/application', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({
        error: 'Bad Request',
        errorCode: 400,
        errorDescription: 'name is required',
      });
    }
    const { v4: uuidv4 } = require('uuid');
    const token = uuidv4();
    db.run('INSERT INTO applications (token, name, description, user_id) VALUES (?, ?, ?, ?)', [
      token,
      name,
      description || '',
      req.user.id,
    ]);
    const app = db.queryOne('SELECT id, token, name, description, image FROM applications WHERE token = ?', [token]);
    console.log(`[Gotify] Application created: ${name} by user ${req.user.name}`);
    res.status(200).json({
      id: app.id,
      token: app.token,
      name: app.name,
      description: app.description,
      image: app.image || '',
      internal: false,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/application/:id', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'application not found',
      });
    }
    const { name, description } = req.body;
    if (name) db.run('UPDATE applications SET name = ? WHERE id = ?', [name, id]);
    if (description !== undefined) db.run('UPDATE applications SET description = ? WHERE id = ?', [description, id]);
    const app = db.queryOne('SELECT id, token, name, description, image FROM applications WHERE id = ?', [id]);
    res.json({
      id: app.id,
      token: app.token,
      name: app.name,
      description: app.description,
      image: app.image || '',
      internal: false,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/application/:id', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'application not found',
      });
    }
    db.run('DELETE FROM messages WHERE appid = ?', [id]);
    db.run('DELETE FROM applications WHERE id = ?', [id]);
    console.log(`[Gotify] Application deleted: id=${id} by user ${req.user.name}`);
    res.json({});
  } catch (err) {
    next(err);
  }
});

router.get('/application/:id/messages', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const appid = parseInt(req.params.id, 10);
    const app = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [appid, req.user.id]);
    if (!app) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'application not found',
      });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const since = req.query.since ? parseInt(req.query.since, 10) : 0;

    let sql = 'SELECT id, appid, message, title, priority, extras, created_at FROM messages WHERE appid = ?';
    const params = [appid];
    if (since > 0) {
      sql += ' AND id < ?';
      params.push(since);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    const messages = db.queryAll(sql, params);
    const nextSince = messages.length > 0 ? messages[messages.length - 1].id : null;
    res.json({
      messages: messages.map(formatMessage),
      paging: { next: nextSince, limit, since },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/application/:id/messages', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const appid = parseInt(req.params.id, 10);
    const app = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [appid, req.user.id]);
    if (!app) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'application not found',
      });
    }
    db.run('DELETE FROM messages WHERE appid = ?', [appid]);
    res.json({});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
