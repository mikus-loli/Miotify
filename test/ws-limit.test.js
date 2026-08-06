// WS 连接数限制专项测试
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { WebSocket } = require('ws');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miotify-ws-test-'));
const dbPath = path.join(tmpDir, 'test.db');

// 注入环境变量
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = 'test-ws-secret';
process.env.WS_MAX_CONNECTIONS_PER_USER = '2';
process.env.DEFAULT_ADMIN_PASS = 'admin';

delete require.cache[require.resolve('../src/config.js')];
delete require.cache[require.resolve('../src/db/index.js')];
delete require.cache[require.resolve('../src/index.js')];
delete require.cache[require.resolve('../src/websocket/index.js')];

const config = require('../src/config.js');
const db = require('../src/db/index.js');
const wsManager = require('../src/websocket/index.js');

let passed = 0, failed = 0;
const assert = (cond, msg) => { if (cond) { passed++; console.log('  ✅', msg); } else { failed++; console.log('  ❌', msg); } };

(async () => {
  console.log('=== WS 连接数限制测试 ===');
  console.log('配置 wsMaxConnectionsPerUser =', config.wsMaxConnectionsPerUser);

  await db.loadDb();
  const { secret } = db.getOrGenerateJwtSecret();
  config.setJwtSecret(secret);

  const server = http.createServer();
  wsManager.attach(server);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;

  // 造一个有效 JWT
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: 1, name: 'admin', admin: true }, secret, { expiresIn: '1h' });

  function connect() {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['miotify', token]);
      const result = { ws, state: 'connecting' };
      ws.on('open', () => { result.state = 'open'; resolve(result); });
      ws.on('close', (code, reason) => { result.state = `closed:${code}:${reason}`; resolve(result); });
      ws.on('unexpected-response', (req, res) => { result.state = `http:${res.statusCode}`; resolve(result); });
      ws.on('error', () => {});
    });
  }

  // 1. 第一个连接成功
  const c1 = await connect();
  await new Promise(r => setTimeout(r, 200));
  assert(c1.state === 'open', `连接1 成功 (${c1.state})`);

  // 2. 第二个连接成功（未超限）
  const c2 = await connect();
  await new Promise(r => setTimeout(r, 200));
  assert(c2.state === 'open', `连接2 成功 (${c2.state})`);

  // 3. 第三个连接被拒绝（超限，close 4003）
  const c3 = await connect();
  await new Promise(r => setTimeout(r, 300));
  assert(c3.state.includes('4003'), `连接3 被拒绝 4003 (${c3.state})`);

  // 4. 关闭一个连接后可再连
  c1.ws.close();
  await new Promise(r => setTimeout(r, 300));
  const c4 = await connect();
  await new Promise(r => setTimeout(r, 300));
  assert(c4.state === 'open', `关闭后重新连接成功 (${c4.state})`);

  // 5. 计数正确
  assert(wsManager.getConnectedCount() === 2, `连接数 = 2 (实际 ${wsManager.getConnectedCount()})`);

  // 清理
  for (const c of [c2, c4]) { try { c.ws.close(); } catch (_) {} }
  await new Promise(r => setTimeout(r, 200));
  server.close();
  db.flushSave();
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
