const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const pluginManager = require('../plugins/manager');
const wsManager = require('../websocket');
const { AppError } = require('../middleware/error');
const { verifyAndLoadUser } = require('../middleware/auth');

const router = express.Router();

const GOTIFY_VERSION = '2.9.1';

// Gotify 兼容端点同样受限流保护（青龙等客户端发送消息的入口）
const gotifyLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    errorCode: 429,
    errorDescription: 'Too many requests, please try again later',
  },
  // 健康检查/版本探测不消耗配额（免 token 端点，监控探活不应被限流）。
  // /health 已在入口层定义并返回（见 src/index.js），不经过本 router，无需 skip。
  skip: (req) => req.path === '/version',
  // CDN 后面取真实客户端 IP（与 /api 限流一致），ipKeyGenerator 规范化 IPv6
  keyGenerator: (req) => {
    const ip = config.trustProxy > 0 && req.headers['x-forwarded-for']
      ? String(req.headers['x-forwarded-for']).split(',').map(s => s.trim()).filter(Boolean).pop()
      : req.ip;
    return ipKeyGenerator(ip || 'unknown');
  },
});
router.use(gotifyLimiter);

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

  try {
    const user = verifyAndLoadUser(token);
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
    // SQLite datetime('now') 存的是 UTC，必须标 Z（原实现硬编码 +08:00 导致时间错 8 小时）
    date: msg.created_at ? new Date(msg.created_at.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString(),
  };
}

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

    // WS 推送保持 db 行格式（created_at 字段，前端 MessageCard 依赖），
    // 仅将 extras 解析为对象，与 REST 响应的 extras 形态一致
    let wsExtras = null;
    if (msg.extras) {
      try { wsExtras = JSON.parse(msg.extras); } catch (_) { wsExtras = null; }
    }
    wsManager.broadcastToApp(req.app.user_id, req.app.id, { ...msg, extras: wsExtras });

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
    const idCursor = req.query.id ? parseInt(req.query.id, 10) : 0;

    const appIds = db.queryAll('SELECT id FROM applications WHERE user_id = ?', [req.user.id]).map(a => a.id);
    if (appIds.length === 0) {
      return res.json({ messages: [], paging: { next: null, limit, since } });
    }

    const placeholders = appIds.map(() => '?').join(',');
    let sql = `SELECT id, appid, message, title, priority, extras, created_at FROM messages WHERE appid IN (${placeholders})`;
    const params = [...appIds];

    // Gotify 官方语义：since 返回 id 大于 since 的消息（增量拉取），id 返回旧消息（向后翻页）
    if (idCursor > 0) {
      sql += ' AND id < ?';
      params.push(idCursor);
    } else if (since > 0) {
      sql += ' AND id > ?';
      params.push(since);
    }

    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    const messages = db.queryAll(sql, params);
    // Gotify 官方 paging.next 是 URL 字符串（客户端直接请求下一页/增量拉取），不是数字 id
    let next = null;
    if (messages.length > 0) {
      if (idCursor > 0) {
        // 翻页模式：继续向更旧翻
        next = `/message?limit=${limit}&id=${messages[messages.length - 1].id}`;
      } else {
        // 增量模式（含首屏）：用最新消息 id 作为下次 since 游标
        next = `/message?limit=${limit}&since=${messages[0].id}`;
      }
    }

    // 触发 message:onReceive（Gotify 客户端增量拉取到消息），不阻塞响应
    for (const msg of messages) {
      pluginManager.executeHook('message:onReceive', msg).catch(() => {});
    }

    res.json({
      messages: messages.map(formatMessage),
      paging: { next, limit, since },
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
    // Gotify 官方 API 返回完整 token（客户端依赖此字段获取 app token），不能掩码
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

router.get('/application/:id', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const app = db.queryOne('SELECT id, token, name, description, image, user_id, created_at FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!app) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'application not found',
      });
    }
    // 官方 API 返回完整 token
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

// 官方端点：获取当前登录用户信息（client token）
router.get('/current/user', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    res.json({
      id: req.user.id,
      name: req.user.name,
      admin: !!req.user.admin,
    });
  } catch (err) {
    next(err);
  }
});

// 官方端点：修改当前用户密码（client token）
// 与内部 /api/user/:id/password 一致：bcrypt 72 字节上限 + token_version 递增使旧 token 立即失效
router.post('/current/user/password', gotifyTokenMiddleware, requireClientToken, async (req, res, next) => {
  try {
    const { pass } = req.body;
    if (!pass) {
      return res.status(400).json({
        error: 'Bad Request',
        errorCode: 400,
        errorDescription: 'pass is required',
      });
    }
    if (pass.length > 72) {
      return res.status(400).json({
        error: 'Bad Request',
        errorCode: 400,
        errorDescription: 'password must not exceed 72 characters',
      });
    }
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(pass, 10);
    db.run('UPDATE users SET pass = ?, token_version = token_version + 1 WHERE id = ?', [hash, req.user.id]);
    db.addLog({
      level: 'info',
      category: 'user',
      action: 'change_password',
      message: `通过 Gotify 端点修改密码（用户 ${req.user.name}）`,
      userId: req.user.id,
      userName: req.user.name,
      details: { source: 'gotify-compat' },
    });
    res.json({});
  } catch (err) {
    next(err);
  }
});

router.post('/application', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const { name, description } = req.body;
    // 与内部 /api/application 一致：name 必须存在且 trim 后非空，防止存带空格的应用名
    if (!name || !String(name).trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        errorCode: 400,
        errorDescription: 'name is required',
      });
    }
    const appName = String(name).trim();
    const { v4: uuidv4 } = require('uuid');
    const token = uuidv4();
    db.run('INSERT INTO applications (token, name, description, user_id) VALUES (?, ?, ?, ?)', [
      token,
      appName,
      description || '',
      req.user.id,
    ]);
    const app = db.queryOne('SELECT id, token, name, description, image FROM applications WHERE token = ?', [token]);
    console.log(`[Gotify] Application created: ${appName} by user ${req.user.name}`);
    // 创建时返回完整 token（仅此一次）
    // 触发 app:onCreate hook（不阻塞响应）
    pluginManager.executeHook('app:onCreate', { id: app.id, name: app.name, user_id: req.user.id }).catch(() => {});
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
    if (name) {
      // 与创建一致：更新应用名也 trim，防止引入带空格的名字
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({
          error: 'Bad Request',
          errorCode: 400,
          errorDescription: 'name must not be empty',
        });
      }
      db.run('UPDATE applications SET name = ? WHERE id = ?', [trimmed, id]);
    }
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
    const existing = db.queryOne('SELECT id, name, image FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'application not found',
      });
    }
    // 删除应用前清理其图标文件，避免孤儿图片堆积（与 /api 版行为一致）
    if (existing.image) {
      const uploadDir = path.join(path.dirname(config.dbPath), 'uploads');
      const filename = path.basename(existing.image);
      const filepath = path.join(uploadDir, filename);
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (err) {
        console.warn(`[Gotify] Failed to delete image ${filename}:`, err.message);
      }
    }
    db.run('DELETE FROM messages WHERE appid = ?', [id]);
    db.run('DELETE FROM applications WHERE id = ?', [id]);
    console.log(`[Gotify] Application deleted: id=${id} by user ${req.user.name}`);
    // 触发 app:onDelete hook（不阻塞响应）
    pluginManager.executeHook('app:onDelete', { id, name: existing.name }).catch(() => {});
    res.json({});
  } catch (err) {
    next(err);
  }
});

// 官方 Gotify 路径是单数 /application/{id}/message；同时兼容 Miotify 历史复数路径
router.get(['/application/:id/message', '/application/:id/messages'], gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
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
      // Gotify 官方语义：since 返回 id 大于 since 的消息（增量拉取）
      sql += ' AND id > ?';
      params.push(since);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    const messages = db.queryAll(sql, params);
    // 官方 paging.next 为 URL 字符串，用最新消息 id 作为下次增量游标。
    // 指向官方单数路径 /application/{id}/message（Miotify 同时兼容复数，但 next 应给官方形态）
    const next = messages.length > 0
      ? `/application/${appid}/message?limit=${limit}&since=${messages[0].id}`
      : null;
    res.json({
      messages: messages.map(formatMessage),
      paging: { next, limit, since },
    });
  } catch (err) {
    next(err);
  }
});

// 官方端点：上传应用图片（与 /api 版同一套 magic bytes + 2MB 流式限制校验）
const { v4: uuidv4 } = require('uuid');
const IMAGE_MAGIC = {
  png: [0x89, 0x50, 0x4E, 0x47],
  jpg: [0xFF, 0xD8, 0xFF],
  jpeg: [0xFF, 0xD8, 0xFF],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46],
};
function validateImageMagic(buffer, ext) {
  const magic = IMAGE_MAGIC[ext];
  if (!magic) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  if (ext === 'webp' && buffer.slice(8, 12).toString('ascii') !== 'WEBP') return false;
  return true;
}

router.post('/application/:id/image', gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.queryOne('SELECT id, image FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({
        error: 'Not Found',
        errorCode: 404,
        errorDescription: 'application not found',
      });
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Bad Request', errorCode: 400, errorDescription: 'content-type must be an image type' });
    }
    const ext = contentType.split('/')[1] || 'png';
    // 不允许 svg+xml（可内嵌 <script>，存储型 XSS）
    if (!['png', 'jpeg', 'jpg', 'gif', 'webp'].includes(ext)) {
      return res.status(400).json({ error: 'Bad Request', errorCode: 400, errorDescription: 'unsupported image type' });
    }

    const uploadDir = path.join(path.dirname(config.dbPath), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filename = `${uuidv4()}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    const chunks = [];
    let received = 0;
    let rejected = false;
    const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
    req.on('data', (chunk) => {
      if (rejected) return;
      received += chunk.length;
      if (received > MAX_IMAGE_SIZE) {
        rejected = true;
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        req.resume();
        res.status(400).json({ error: 'Bad Request', errorCode: 400, errorDescription: 'image size exceeds 2MB limit' });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        if (rejected) return;
        const buffer = Buffer.concat(chunks);
        if (!validateImageMagic(buffer, ext)) {
          return res.status(400).json({ error: 'Bad Request', errorCode: 400, errorDescription: 'file content does not match declared image type' });
        }
        fs.writeFileSync(filepath, buffer);
        if (existing.image) {
          const oldPath = path.join(uploadDir, path.basename(existing.image));
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        db.run('UPDATE applications SET image = ? WHERE id = ?', [`/uploads/${filename}`, id]);
        const app = db.queryOne('SELECT id, token, name, description, image, user_id, created_at FROM applications WHERE id = ?', [id]);
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
    req.on('error', (err) => next(err));
  } catch (err) {
    next(err);
  }
});

router.delete(['/application/:id/message', '/application/:id/messages'], gotifyTokenMiddleware, requireClientToken, (req, res, next) => {
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
