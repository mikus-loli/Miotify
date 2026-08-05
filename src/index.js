const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./db');
const wsManager = require('./websocket');
const pluginManager = require('./plugins/manager');
const { errorHandler, notFoundHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/application');
const messageRoutes = require('./routes/message');
const pluginRoutes = require('./routes/plugins');
const gotifyRoutes = require('./routes/gotify');
const statsRoutes = require('./routes/stats');
const logsRoutes = require('./routes/logs');

async function start() {
  await db.loadDb();
  console.log('[DB] Database initialized');
  // 启动时执行一次日志轮转，防止 logs 表无限膨胀
  try {
    db.rotateLogs();
  } catch (err) {
    console.error('[DB] Log rotation failed:', err.message);
  }

  const { secret, generated } = db.getOrGenerateJwtSecret();
  config.setJwtSecret(secret);
  if (generated) {
    // 生产环境（Docker）也打印首次生成的密钥，README 承诺可在 docker logs 中查看；
    // 仅在首次生成时输出，重启复用数据库中的密钥不会再打印。
    console.log('');
    console.log('========================================');
    console.log('[IMPORTANT] JWT Secret Generated:');
    console.log(secret);
    console.log('Please save this secret securely!');
    console.log('========================================');
    console.log('');
  }

  const adminResult = await db.ensureAdmin();
  if (adminResult.created) {
    console.log('');
    console.log('========================================');
    console.log('[IMPORTANT] Admin Account Created:');
    console.log(`Username: ${adminResult.user}`);
    console.log(`Password: ${adminResult.pass}`);
    console.log('Please change the password after first login!');
    console.log('========================================');
    console.log('');
  }

  await pluginManager.loadPlugins();
  console.log('[Plugin] Plugins loaded');

  const app = express();

  // trust proxy：部署在 ESA CDN / 反向代理后。设 1 信任一层代理，
  // 让 req.ip / 限流拿到真实客户端 IP（X-Forwarded-For 最右一层）
  app.set('trust proxy', 1);

  // CORS 默认关闭跨域（前端 SPA 与 API 同源部署，不需要 CORS）。
  // 如需跨域访问，显式设置 CORS_ORIGIN 环境变量（逗号分隔白名单）。
  const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.use(cors({
      origin: (origin, cb) => {
        if (!origin || corsOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error('CORS origin not allowed'));
        }
      },
      credentials: true,
    }));
    console.log(`[CORS] Allowed origins: ${corsOrigins.join(', ')}`);
  } else {
    // 同源部署：不需要跨域头，同时避免 CDN 反射任意 Origin
    console.log('[CORS] Disabled (same-origin deployment). Set CORS_ORIGIN to enable cross-origin.');
  }

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    // CDN 后面多层代理时，显式取 X-Forwarded-For 最右一层（真实客户端 IP）
    keyGenerator: (req) => {
      const xff = req.headers['x-forwarded-for'];
      if (xff) {
        const ips = String(xff).split(',').map(s => s.trim()).filter(Boolean);
        return ips[ips.length - 1] || req.ip || 'unknown';
      }
      return req.ip || 'unknown';
    },
  });
  app.use('/api', limiter);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', websocket: wsManager.getConnectedCount() });
  });

  app.use('/api', authRoutes);
  app.use('/api', applicationRoutes);
  app.use('/api', messageRoutes);
  app.use('/api', pluginRoutes);
  app.use('/api', statsRoutes);
  app.use('/api', logsRoutes);

  app.use(gotifyRoutes);

  const webDistPath = path.join(__dirname, '..', 'web', 'dist');
  const uploadPath = path.join(path.dirname(config.dbPath), 'uploads');

  if (fs.existsSync(uploadPath)) {
    app.use('/uploads', express.static(uploadPath));
    console.log('[Upload] Serving uploads from', uploadPath);
  }

  if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath, { index: false }));
    app.get('/{*splat}', (req, res, next) => {
      if (req.accepts('html')) {
        res.sendFile(path.join(webDistPath, 'index.html'));
      } else {
        next();
      }
    });
    console.log('[Web] Serving frontend from web/dist');
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = http.createServer(app);
  wsManager.attach(server);

  server.listen(config.port, () => {
    console.log(`[Miotify] Server running on http://localhost:${config.port}`);
    console.log(`[Miotify] WebSocket endpoint: ws://localhost:${config.port}/ws?token=<jwt>`);
    console.log(`[Miotify] Gotify-compatible API: POST /message`);
  });
}

start().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
