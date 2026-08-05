const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');

const clients = new Map();

class WebSocketManager {
  constructor() {
    this.wss = null;
  }

  attach(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

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

      let decoded;
      try {
        decoded = jwt.verify(token, config.jwtSecret);
      } catch (_) {
        ws.close(4002, 'Invalid token');
        return;
      }

      const userId = decoded.id;
      ws.userId = userId;
      ws.appIds = new Set();

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
