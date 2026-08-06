// 测试辅助：创建隔离的 Express app + 临时 DB
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function silenceConsole() {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}
function restoreConsole() {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
}

/**
 * 创建测试用 app + 临时 DB（隔离，不污染真实数据）
 * 通过环境变量注入临时 DB 路径，避免展开 config 丢失 getter
 */
async function createTestApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miotify-test-'));
  const dbPath = path.join(tmpDir, 'test.db');

  // 通过环境变量注入（config.js 顶层读取 process.env，保留完整 getter/setter）
  const prevEnv = {};
  const envKeys = ['DB_PATH', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'DEFAULT_ADMIN_USER', 'DEFAULT_ADMIN_PASS', 'LOG_RETENTION_COUNT', 'LOG_RETENTION_DAYS', 'RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW_MS'];
  for (const k of envKeys) {
    prevEnv[k] = process.env[k];
  }
  process.env.DB_PATH = dbPath;
  process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.DEFAULT_ADMIN_USER = 'admin';
  process.env.DEFAULT_ADMIN_PASS = 'admin';
  process.env.LOG_RETENTION_COUNT = '1000';
  process.env.LOG_RETENTION_DAYS = '0';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';

  // 清掉 config/db 模块缓存，让它们按新环境变量重新加载
  delete require.cache[require.resolve('../src/config.js')];
  delete require.cache[require.resolve('../src/db/index.js')];
  delete require.cache[require.resolve('../src/index.js')];
  delete require.cache[require.resolve('../src/plugins/manager.js')];
  delete require.cache[require.resolve('../src/websocket/index.js')];

  silenceConsole();
  try {
    const db = require('../src/db/index.js');
    const { createApp } = require('../src/index.js');
    const app = await createApp();
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    return {
      app, db, tmpDir, server, baseUrl,
      close: async () => {
        await new Promise((resolve) => server.close(resolve));
        db.flushSave();
        restoreConsole();
        fs.rmSync(tmpDir, { recursive: true, force: true });
        // 还原环境变量
        for (const k of envKeys) {
          if (prevEnv[k] === undefined) delete process.env[k];
          else process.env[k] = prevEnv[k];
        }
      },
    };
  } catch (err) {
    restoreConsole();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const k of envKeys) {
      if (prevEnv[k] === undefined) delete process.env[k];
      else process.env[k] = prevEnv[k];
    }
    throw err;
  }
}

/** 简单 HTTP 请求辅助 */
async function api(baseUrl, method, path, { token, body, appToken } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (appToken) headers['Authorization'] = `Bearer ${appToken}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

module.exports = { createTestApp, api, silenceConsole, restoreConsole };
