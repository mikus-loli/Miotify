const https = require('https');
const WebSocket = require('ws');

/**
 * QQ 官方 Bot API 直连通知插件
 *
 * 消息发送后，直接调用 QQ 开放平台机器人 API 推送到主人 QQ。
 * 不依赖任何中间服务（NapCat / Hermes webhook / 反代）：
 *   Miotify → QQ 官方 Bot API → 主人 QQ
 *
 * 被动消息免额度：
 *   - 插件启动时通过 WebSocket 订阅 QQ 事件（C2C_MSG_RECEIVE），记录主人最近一条消息的 msg_id
 *   - 发送时带上 msg_id → 视为"回复"（被动消息）→ 不受主动消息额度限制（11255）
 *   - 用户 48h 内与机器人有过互动时生效；超时退化为主动消息（额度内）
 *
 * 配置（插件管理界面填写，或环境变量注入，环境变量优先）：
 *   appId            QQ 开放平台机器人的 AppID
 *   clientSecret     QQ 开放平台机器人的 ClientSecret
 *   targetOpenId     接收消息的用户 openid（C2C 单聊）
 *   minPriority      最低优先级（0 = 全部转发）
 *   forwardAllApps   转发所有应用（true=全部；false=只转发 enabledApps 列出的）
 *   enabledApps      只转发这些应用 ID（forwardAllApps=false 时生效，空数组 = 全部）
 *   maxContentLength 消息内容截断长度（QQ 文本消息上限 4000）
 *   retries          失败重试次数（指数退避，默认 2）
 *
 * 环境变量（优先于界面配置）：
 *   QQ_APP_ID / QQ_CLIENT_SECRET / QQ_TARGET_OPENID
 *
 * QQ API:
 *   获取 token:    POST https://bots.qq.com/app/getAppAccessToken  {appId, clientSecret}
 *   获取 gateway:  GET  https://api.sgroup.qq.com/gateway  (Authorization: QQBot {token})
 *   发 C2C 消息:   POST https://api.sgroup.qq.com/v2/users/{openid}/messages
 *                 Authorization: QQBot {access_token}
 *                 Body: {content, msg_type: 0(文本), msg_seq, msg_id(可选,被动消息)}
 */
module.exports = {
  meta: {
    id: 'qq-direct-notify',
    name: 'QQ Direct Notify',
    version: '2.0.0',
    description: '收到消息后直接调用 QQ 官方 Bot API 推送到主人 QQ（无中间依赖，被动消息免额度）',
    author: 'Miotify',
    license: 'MIT',
    homepage: 'https://github.com/mikus-loli/Miotify',
  },

  defaultConfig: {
    appId: '',
    clientSecret: '',
    targetOpenId: '',
    minPriority: 0,
    forwardAllApps: true,
    enabledApps: [],
    maxContentLength: 4000,
    retries: 2,
  },

  hooks: {
    'message:afterSend': async (ctx, message) => {
      const { config, log } = ctx;

      const appId = process.env.QQ_APP_ID || config.appId;
      const clientSecret = process.env.QQ_CLIENT_SECRET || config.clientSecret;
      const targetOpenId = process.env.QQ_TARGET_OPENID || config.targetOpenId;

      if (!appId || !clientSecret || !targetOpenId) {
        log('warn', 'appId/clientSecret/targetOpenId 未配置，跳过 QQ 通知');
        return;
      }

      // 优先级过滤
      if (message.priority < (config.minPriority || 0)) {
        return;
      }

      // 应用过滤：forwardAllApps=true 转发所有；false 时只转发 enabledApps 列出的（空数组 = 全部）
      if (!config.forwardAllApps) {
        const enabledAppIds = (config.enabledApps || []).map(Number);
        if (enabledAppIds.length > 0 && !enabledAppIds.includes(Number(message.appid))) {
          log('info', `跳过应用 ${message.appid}（不在 enabledApps）`);
          return;
        }
      }

      // 查应用名（内容更友好）
      let appName = '';
      try {
        const db = require('../../src/db');
        const app = db.queryOne('SELECT name FROM applications WHERE id = ?', [message.appid]);
        appName = app ? app.name : '';
      } catch (err) {
        log('warn', `查询应用名失败: ${err.message}`);
      }

      // 组装 QQ 文本消息（内容截断防超长）
      const content = String(message.message || '');
      const truncated = content.length > config.maxContentLength
        ? content.substring(0, config.maxContentLength) + '…'
        : content;
      const lines = [
        `📬 Miotify 收到新消息`,
        `📱 应用：${appName}（#${message.appid}）`,
        `🏷️ 标题：${message.title || ''}`,
        `📄 内容：${truncated}`,
        `🔔 优先级：${message.priority || 0}`,
        `🕐 时间：${formatLocalTime(message.created_at)}`,
      ];
      const text = lines.join('\n');

      const ok = await sendWithRetry(appId, clientSecret, targetOpenId, text, config.retries || 0, log);
      if (ok) {
        log('info', `QQ 直连通知已推送: id=${message.id} app=${appName || message.appid}`);
      } else {
        log('error', `QQ 直连通知推送失败: id=${message.id}`);
      }
    },
  },

  init: (ctx) => {
    const { config, log } = ctx;
    const appId = process.env.QQ_APP_ID || config.appId;
    const clientSecret = process.env.QQ_CLIENT_SECRET || config.clientSecret;
    if (!appId || !clientSecret) {
      log('warn', 'QQ 凭据未配置（环境变量或插件配置），QQ 通知不会生效');
      return;
    }
    log('info', 'QQ Direct Notify 就绪');
    // 启动事件监听（记录主人最近 msg_id，发送时走被动消息免额度）
    startListener(appId, clientSecret, log);
  },

  destroy: () => {
    stopListener();
  },
};

// SQLite UTC 时间 → 本地时区显示
function formatLocalTime(utcStr) {
  if (!utcStr) return '';
  try {
    return new Date(String(utcStr).replace(' ', 'T') + 'Z').toLocaleString('zh-CN', { hour12: false });
  } catch {
    return utcStr;
  }
}

// ---------------------------------------------------------------------------
// QQ Bot API
// ---------------------------------------------------------------------------

const TOKEN_URL = 'https://bots.qq.com/app/getAppAccessToken';
const API_BASE = 'https://api.sgroup.qq.com';
const API_GATEWAY_PATH = '/gateway';
// intents: 1<<25 = C2C_GROUP_AT_MESSAGES（含 C2C 单聊 C2C_MSG_RECEIVE）
const INTENTS_C2C = 1 << 25;

let cachedToken = null;
let cachedExpiresAt = 0;
let lastMsgSeq = 0;

// msg_seq：QQ API 只接受 0-65535（16 位）范围，超范围返回 40011000。
// 进程内严格递增；重启后从时间戳派生继续，避免与上次序列冲突。
function nextMsgSeq() {
  const timePart = Math.floor(Date.now() / 1000) % 65536;
  lastMsgSeq = (lastMsgSeq + 1) % 65536;
  return (timePart + lastMsgSeq) % 65536;
}

// 获取 access_token（缓存，提前 60s 刷新）
function getAccessToken(appId, clientSecret, log) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    if (cachedToken && now < cachedExpiresAt - 60000) {
      return resolve(cachedToken);
    }
    const body = JSON.stringify({ appId, clientSecret });
    const req = https.request(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (!data.access_token) {
            return reject(new Error(`QQ token 响应异常: ${raw.slice(0, 200)}`));
          }
          cachedToken = data.access_token;
          cachedExpiresAt = Date.now() + (data.expires_in || 7200) * 1000;
          log('info', `QQ access_token 已刷新（有效期 ${data.expires_in || 7200}s）`);
          resolve(cachedToken);
        } catch (err) {
          reject(new Error(`QQ token 解析失败: ${err.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('token 请求超时')); });
    req.write(body);
    req.end();
  });
}

// 发送 C2C 文本消息；token 失效时自动刷新重试一次
function sendC2CText(token, openid, content, msgId, log) {
  return new Promise((resolve, reject) => {
    const body = {
      content,
      msg_type: 0,
      msg_seq: nextMsgSeq(),
    };
    // 带 msg_id = 被动消息（回复用户最近一条消息），不受主动消息额度限制
    if (msgId) {
      body.msg_id = msgId;
    }
    const bodyStr = JSON.stringify(body);
    const req = https.request(`${API_BASE}/v2/users/${encodeURIComponent(openid)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Authorization': `QQBot ${token}`,
      },
      timeout: 10000,
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return resolve(raw);
        }
        // 完整错误响应（含 code/trace_id）便于排查：如 openid 无效返回 500 invalid request
        let detail = raw.slice(0, 300);
        try {
          const data = JSON.parse(raw);
          detail = `${data.message || ''} (code=${data.code || '?'}, err_code=${data.err_code || '?'}, trace_id=${data.trace_id || '?'})`;
        } catch { /* 保留原始文本 */ }
        reject(new Error(`QQ API ${res.statusCode}: ${detail}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('发送超时')); });
    req.write(bodyStr);
    req.end();
  });
}

// 发送 + 重试（token 失效刷新重试一次；网络/服务错误指数退避）
async function sendWithRetry(appId, clientSecret, openid, content, retries, log) {
  let token;
  try {
    token = await getAccessToken(appId, clientSecret, log);
  } catch (err) {
    log('error', `获取 QQ token 失败: ${err.message}`);
    return false;
  }

  for (let attempt = 0; attempt <= (retries || 0); attempt++) {
    try {
      const msgId = getLastMsgId(openid);
      await sendC2CText(token, openid, content, msgId, log);
      log('info', `QQ API 发送成功（第 ${attempt + 1} 次尝试${msgId ? '，被动消息' : '，主动消息'}）`);
      return true;
    } catch (err) {
      const msg = err.message || '';
      // token 失效（401 / 错误码 11251 等）→ 清缓存刷新后重试一次
      if (attempt === 0 && /401|11251|invalid.*token|token.*invalid/i.test(msg)) {
        log('warn', `QQ token 可能失效，刷新后重试: ${msg}`);
        cachedToken = null;
        cachedExpiresAt = 0;
        try {
          token = await getAccessToken(appId, clientSecret, log);
        } catch (tokenErr) {
          log('error', `刷新 token 失败: ${tokenErr.message}`);
          return false;
        }
        attempt = -1; // 重试循环重新从 0 开始（只允许一次刷新）
        continue;
      }
      log('error', `QQ 发送失败（第 ${attempt + 1} 次尝试）: ${msg}`);
      if (attempt < (retries || 0)) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 事件监听（WebSocket）：记录用户最近 msg_id，发送时走被动消息免额度
// 参考 https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/interface-framework/event-emit.html
// ---------------------------------------------------------------------------

const lastMsgIdByUser = new Map(); // openid → 最近一条消息的 msg_id
let ws = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let lastS = null;
let heartbeatIntervalMs = 45000;
let stopRequested = false;
let reconnectAttempts = 0;
let connectTimeoutId = null; // 建连阶段超时（收到 READY 后清除）

function getLastMsgId(openid) {
  return lastMsgIdByUser.get(openid) || null;
}

// 获取 WSS 接入点
function getGatewayUrl(token) {
  return new Promise((resolve, reject) => {
    const req = https.request(`${API_BASE}${API_GATEWAY_PATH}`, {
      method: 'GET',
      headers: {
        'Authorization': `QQBot ${token}`,
        'Content-Length': 0,
      },
      timeout: 10000,
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data.url) return resolve(data.url);
          reject(new Error(`gateway 响应异常: ${raw.slice(0, 150)}`));
        } catch (err) {
          reject(new Error(`gateway 解析失败: ${err.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('gateway 请求超时')); });
    req.end();
  });
}

async function startListener(appId, clientSecret, log) {
  stopRequested = false;
  reconnectAttempts = 0;
  log('info', 'QQ 事件监听启动中（订阅 C2C 消息，用于被动消息免额度）...');
  try {
    await connectLoop(appId, clientSecret, log);
  } catch (err) {
    log('error', `QQ 事件监听启动失败: ${err.message}（不影响主动消息发送）`);
  }
}

async function connectLoop(appId, clientSecret, log) {
  while (!stopRequested) {
    try {
      await connectOnce(appId, clientSecret, log);
    } catch (err) {
      log('warn', `QQ 事件监听断开: ${err.message}`);
    }
    if (stopRequested) break;
    // 指数退避重连
    reconnectAttempts = Math.min(reconnectAttempts + 1, 6);
    const delay = Math.min(5000 * Math.pow(2, reconnectAttempts), 300000);
    log('info', `QQ 事件监听 ${delay / 1000}s 后重连（第 ${reconnectAttempts} 次）`);
    await sleep(delay);
  }
}

function connectOnce(appId, clientSecret, log) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;

    getAccessToken(appId, clientSecret, log).then((token) =>
      getGatewayUrl(token)
    ).then((url) => {
      log('info', `QQ 事件 gateway: ${url}`);
      ws = new WebSocket(url, { handshakeTimeout: 10000 });

      ws.on('open', () => {
        reconnectAttempts = 0;
        log('info', 'QQ 事件 WebSocket 已连接');
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          handleGatewayMessage(msg, appId, clientSecret, log);
        } catch (err) {
          log('warn', `QQ 事件解析失败: ${err.message}`);
        }
      });

      ws.on('close', () => {
        clearHeartbeat();
        if (connectTimeoutId) { clearTimeout(connectTimeoutId); connectTimeoutId = null; }
        if (!settled) {
          settled = true;
          resolve();
        }
      });

      ws.on('error', (err) => {
        if (connectTimeoutId) { clearTimeout(connectTimeoutId); connectTimeoutId = null; }
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(new Error(err.message));
        }
      });
    }).catch((err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('事件连接超时'));
      }
    }, 15000);
    connectTimeoutId = timeoutId;
  });
}

function handleGatewayMessage(msg, appId, clientSecret, log) {
  const op = msg.op;
  if (op === 10) {
    // Hello：拿到心跳间隔，发送 Identify
    heartbeatIntervalMs = (msg.d && msg.d.heartbeat_interval) || 45000;
    sendIdentify(appId, clientSecret, log);
  } else if (op === 0) {
    // Dispatch：事件推送
    if (msg.s !== undefined) lastS = msg.s;
    if (msg.t === 'C2C_MESSAGE_CREATE' && msg.d) {
      const msgId = msg.d.id;
      const userOpenid = msg.d.author && msg.d.author.user_openid;
      if (msgId && userOpenid) {
        lastMsgIdByUser.set(userOpenid, msgId);
        log('info', `QQ C2C 事件已记录 msg_id（openid ${userOpenid.slice(0, 8)}...）`);
      }
    }
    // 首次 READY 后启动心跳，并清除建连超时（连接已就绪）
    if (msg.t === 'READY') {
      if (connectTimeoutId) { clearTimeout(connectTimeoutId); connectTimeoutId = null; }
      startHeartbeat();
      reconnectAttempts = 0;
      // 记录目标用户（如已有）——实际 msg_id 在 C2C_MSG_RECEIVE 时记录
      log('info', 'QQ 事件监听就绪（READY，订阅 C2C 消息）');
    }
  } else if (op === 11) {
    // Heartbeat ACK
  }
}

function sendIdentify(appId, clientSecret, log) {
  getAccessToken(appId, clientSecret, log).then((token) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: `QQBot ${token}`,
          intents: INTENTS_C2C,
          // shard 用 [0,2]：与 Hermes gateway 的 [0,1] 区分，避免同 shard 冲突（QQ 同一机器人多连接需不同 shard）
          shard: [0, 2],
          properties: { $os: 'linux', $browser: 'miotify', $device: 'miotify' },
        },
      }));
      log('info', 'QQ 事件 Identify 已发送');
    }
  }).catch((err) => {
    log('warn', `Identify 获取 token 失败: ${err.message}`);
  });
}

function startHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op: 1, d: lastS }));
    }
  }, heartbeatIntervalMs);
  if (heartbeatTimer.unref) heartbeatTimer.unref();
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function stopListener() {
  stopRequested = true;
  clearHeartbeat();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.close(); } catch { /* 忽略 */ }
    ws = null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
