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

async function start() {
  await db.loadDb();
  console.log('[DB] Database initialized');

  await pluginManager.loadPlugins();
  console.log('[Plugin] Plugins loaded');

  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });
  app.use('/api', limiter);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', websocket: wsManager.getConnectedCount() });
  });

  app.use('/api', authRoutes);
  app.use('/api', applicationRoutes);
  app.use('/api', messageRoutes);
  app.use('/api', pluginRoutes);

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
    console.log(`[Miotify] Default admin: ${config.defaultAdminUser} / ${config.defaultAdminPass}`);
  });
}

start().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
