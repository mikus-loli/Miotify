const { WebSocketServer } = require('ws');
const config = require('../config');
const { verifyAndLoadUser } = require('../middleware/auth');

const clients = new Map();

class WebSocketManager {
  constructor() {
    this.wss = null;
  }

  attach(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    // 心跳：30s 无 pong 判定为僵尸连接并清理（客户端切网/休眠时 TCP 不会立即断开）
    this.heartbeatInterval = setInterval(() => {
      for (const userClients of clients.values()) {
        for (const ws of userClients) {
          if (ws.isAlive === false) {
            ws.terminate();
            continue;
          }
          ws.isAlive = false;
          ws.ping();
        }
      }
    }, 30000);
    // 不阻止进程退出（测试/优雅关闭时无残留定时器）
    if (typeof this.heartbeatInterval.unref === 'function') {
      this.heartbeatInterval.unref();
    }

    this.wss.on('connection', (ws, req) => {
      // token 通过 Sec-WebSocket-Protocol 子协议头传递（浏览器 WebSocket 第二个参数），
      // 不再从 URL query 读取 —— 避免 token 泄露到访问日志/浏览器历史
      const protocolHeader = req.headers['sec-websocket-protocol'] || '';
      const protocols = String(protocolHeader).split(',').map(s => s.trim()).filter(Boolean);
      // 格式：["miotify", "<jwt>"]，取第二个作为 token
      const token = protocols.length >= 2 ? protocols[protocols.length - 1] : null;

      if (!token) {
        ws.close(4001, 'Missing token');
        return;
      }

      // 复用 JWT 校验：验证签名 + 用户存在 + token_version（改密码后旧 token 无法连 WS）
      let user;
      try {
        user = verifyAndLoadUser(token);
      } catch (_) {
        ws.close(4002, 'Invalid token');
        return;
      }
      if (!user) {
        ws.close(4002, 'Invalid token');
        return;
      }

      const userId = user.id;
      ws.userId = userId;
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });

      // 单用户连接数上限：防止持有有效 token 的客户端开大量连接耗尽内存
      const maxPerUser = config.wsMaxConnectionsPerUser;
      if (maxPerUser > 0) {
        const existing = clients.get(userId);
        if (existing && existing.size >= maxPerUser) {
          ws.close(4003, `Too many connections (max ${maxPerUser})`);
          console.warn(`[WS] Rejected connection for user ${userId}: limit ${maxPerUser} reached`);
          return;
        }
      }

      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId).add(ws);

      ws.on('close', () => {
        const userClients = clients.get(userId);
        if (userClients) {
          userClients.delete(ws);
          if (userClients.size === 0) {
            clients.delete(userId);
          }
        }
      });

      ws.on('error', () => {
        ws.close();
      });

      ws.send(JSON.stringify({ type: 'connected', data: { id: userId } }));
    });
  }

  broadcastToApp(userId, appId, message) {
    const userClients = clients.get(userId);
    if (!userClients) return;
    const payload = JSON.stringify({ type: 'message', data: { appid: appId, ...message } });
    for (const ws of userClients) {
      if (ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }

  getConnectedCount() {
    let count = 0;
    for (const userClients of clients.values()) {
      count += userClients.size;
    }
    return count;
  }
}

module.exports = new WebSocketManager();
