// qq-image-notify：Miotify 通知 → 渲染精致卡片图片 → QQ 官方 API 发送
//
// 链路：Miotify 收到通知 → HTML/CSS 模板 → Chromium 无头截图 PNG
//       → 上传 QQ 官方（file_type=1 图片）→ msg_type=7 富媒体消息发送
//
// 复用 qq-direct-notify 的基础设施：token 缓存、msg_seq、被动消息免额度、
// 优先级/应用过滤、失败重试。渲染失败时自动降级为文本消息。
//
// 配置（插件管理界面填写，或环境变量注入，环境变量优先）：
//   appId            QQ 开放平台机器人的 AppID
//   clientSecret     QQ 开放平台机器人的 ClientSecret
//   targetOpenId     接收消息的用户 openid（C2C 单聊）
//   minPriority      最低优先级（0 = 全部转发）
//   forwardAllApps   转发所有应用（true=全部；false=只转发 enabledApps 列出的）
//   enabledApps      只转发这些应用 ID（forwardAllApps=false 时生效，空数组 = 全部）
//   maxContentLength 消息内容截断长度（渲染前截断，默认 2000 字符）
//   maxContentLines  卡片正文最大行数（超出截断，默认 10 行）
//   fallbackText     渲染失败时降级为文本消息（默认 true）
//   retries          失败重试次数（指数退避，默认 2）
//
// 环境变量（优先于界面配置）：
//   QQ_APP_ID / QQ_CLIENT_SECRET / QQ_TARGET_OPENID / QQ_CARD_CHROMIUM
//
// QQ API:
//   获取 token:  POST https://bots.qq.com/app/getAppAccessToken  {appId, clientSecret}
//   上传文件:    POST https://api.sgroup.qq.com/v2/users/{openid}/files
//                {file_type: 1, file_data: "<base64>", srv_send_msg: false}
//                → {file_info: "..."}（有过期时间，可复用）
//   发 C2C 消息: POST https://api.sgroup.qq.com/v2/users/{openid}/messages
//                {msg_type: 7, media: {file_info}, msg_seq, msg_id(可选,被动消息)}

const https = require('https');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// ⚠️ 相对路径：插件在 plugins/available/ 下，lib 在 plugins/lib/ 下，必须用 ../lib/
const renderer = require('../lib/qq-image-render');

module.exports = {
  meta: {
    id: 'qq-image-notify',
    name: 'QQ Image Notify',
    version: '1.0.0',
    description: '收到消息后渲染成精致卡片图片，通过 QQ 官方 Bot API 推送（macOS 风格，无中间依赖，被动消息免额度）',
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
    maxContentLength: 2000,
    maxContentLines: 10,
    fallbackText: true,
    retries: 2,
  },

  hooks: {
    'message:afterSend': async (ctx, message) => {
      const { config, log } = ctx;

      const appId = process.env.QQ_APP_ID || config.appId;
      const clientSecret = process.env.QQ_CLIENT_SECRET || config.clientSecret;
      const targetOpenId = process.env.QQ_TARGET_OPENID || config.targetOpenId;

      if (!appId || !clientSecret || !targetOpenId) {
        log('warn', 'appId/clientSecret/targetOpenId 未配置，跳过 QQ 图片通知');
        return;
      }

      // 优先级过滤
      if (message.priority < (config.minPriority || 0)) {
        return;
      }

      // 应用过滤
      if (!config.forwardAllApps) {
        const enabledAppIds = (config.enabledApps || []).map(Number);
        if (enabledAppIds.length > 0 && !enabledAppIds.includes(Number(message.appid))) {
          log('info', `跳过应用 ${message.appid}（不在 enabledApps）`);
          return;
        }
      }

      // 查应用信息（名称 + 图标，渲染卡片用）
      let appName = '';
      let appImage = '';
      try {
        const db = require('../../src/db');
        const app = db.queryOne('SELECT name, image FROM applications WHERE id = ?', [message.appid]);
        appName = app ? app.name : '';
        appImage = app && app.image ? app.image : '';
        // /uploads/xxx 相对路径 → 容器内绝对路径（Docker 挂载 /app/data）
        if (appImage && appImage.startsWith('/uploads/')) {
          const base = process.env.DB_PATH ? require('path').dirname(process.env.DB_PATH) : '/app/data';
          appImage = require('path').join(base, appImage.replace(/^\/uploads\//, 'uploads/'));
          if (!require('fs').existsSync(appImage)) {
            appImage = '';
          }
        }
      } catch (err) {
        log('warn', `查询应用信息失败: ${err.message}`);
      }

      // 组装渲染数据（内容截断防超长）
      const rawContent = String(message.message || '');
      const maxLen = config.maxContentLength || 2000;
      const truncatedContent = rawContent.length > maxLen
        ? rawContent.substring(0, maxLen) + '…'
        : rawContent;

      const renderInput = {
        appName: appName || `应用#${message.appid}`,
        title: message.title || '',
        message: truncatedContent,
        priority: message.priority || 0,
        created_at: message.created_at,
        appImage,
      };

      const ok = await sendImageWithRetry(appId, clientSecret, targetOpenId, renderInput, config, log);
      if (ok) {
        log('info', `QQ 图片通知已推送: id=${message.id} app=${appName || message.appid}`);
      } else {
        log('error', `QQ 图片通知推送失败: id=${message.id}`);
      }
    },
  },

  init: (ctx) => {
    const { config, log } = ctx;
    const appId = process.env.QQ_APP_ID || config.appId;
    const clientSecret = process.env.QQ_CLIENT_SECRET || config.clientSecret;
    if (!appId || !clientSecret) {
      log('warn', 'QQ 凭据未配置（环境变量或插件配置），QQ 图片通知不会生效');
      return;
    }
    log('info', 'QQ Image Notify 就绪');
    loadMsgIds();
    startListener(appId, clientSecret, log);
  },

  destroy: () => {
    stopListener();
    renderer.closeBrowser();
  },
};

// ---------------------------------------------------------------------------
// 渲染 + 上传 + 发送
// ---------------------------------------------------------------------------

// 渲染 PNG 到临时文件
async function renderCard(renderInput, config, log) {
  const outFile = path.join('/tmp', `qq-card-${Date.now()}-${Math.floor(Math.random() * 1e6)}.png`);
  try {
    await renderer.renderToFile(renderInput, outFile);
    return outFile;
  } catch (err) {
    log('warn', `卡片渲染失败: ${err.message}`);
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    return null;
  }
}

// 上传图片到 QQ 官方，返回 file_info
function uploadFile(token, openid, filePath, log) {
  return new Promise((resolve, reject) => {
    let fileData;
    try {
      fileData = fs.readFileSync(filePath).toString('base64');
    } catch (err) {
      return reject(new Error(`读取图片失败: ${err.message}`));
    }
    const body = JSON.stringify({
      file_type: 1,           // 1=图片(png/jpg)
      file_data: fileData,    // base64 编码（本地生成无需公网 URL）
      srv_send_msg: false,    // 只上传不直接发送，返回 file_info 供复用
    });
    const req = https.request(`https://api.sgroup.qq.com/v2/users/${encodeURIComponent(openid)}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `QQBot ${token}`,
      },
      timeout: 30000,
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(raw);
            if (data.file_info) return resolve(data.file_info);
            return reject(new Error(`上传响应无 file_info: ${raw.slice(0, 200)}`));
          } catch (err) {
            return reject(new Error(`上传响应解析失败: ${err.message}`));
          }
        }
        let detail = raw.slice(0, 300);
        try {
          const data = JSON.parse(raw);
          detail = `${data.message || ''} (code=${data.code || '?'}, err_code=${data.err_code || '?'}, trace_id=${data.trace_id || '?'})`;
        } catch { /* 保留原始文本 */ }
        reject(new Error(`QQ 上传 API ${res.statusCode}: ${detail}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('上传超时')); });
    req.write(body);
    req.end();
  });
}

// 发送富媒体图片消息（msg_type=7）
function sendC2CImage(token, openid, fileInfo, msgId, log) {
  return new Promise((resolve, reject) => {
    const body = {
      msg_type: 7,
      msg_seq: nextMsgSeq(),
      media: { file_info: fileInfo },
    };
    if (msgId) {
      body.msg_id = msgId;
    }
    const bodyStr = JSON.stringify(body);
    const req = https.request(`https://api.sgroup.qq.com/v2/users/${encodeURIComponent(openid)}/messages`, {
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

// 渲染 → 上传 → 发送（带重试）
async function sendImageWithRetry(appId, clientSecret, openid, renderInput, config, log) {
  // 1. 渲染卡片
  const cardPath = await renderCard(renderInput, config, log);
  if (!cardPath) {
    // 渲染失败 → 降级文本
    if (config.fallbackText !== false) {
      log('warn', '渲染失败，降级为文本消息发送');
      const text = [
        `📬 ${renderInput.appName}`,
        renderInput.title ? `🏷️ ${renderInput.title}` : '',
        renderInput.message,
      ].filter(Boolean).join('\n');
      return sendTextWithRetry(appId, clientSecret, openid, text, config.retries || 0, log);
    }
    return false;
  }

  try {
    let token;
    try {
      token = await getAccessToken(appId, clientSecret, log);
    } catch (err) {
      log('error', `获取 QQ token 失败: ${err.message}`);
      return false;
    }

    for (let attempt = 0; attempt <= (config.retries || 0); attempt++) {
      try {
        // 2. 上传图片
        const fileInfo = await uploadFile(token, openid, cardPath, log);
        // 3. 发送富媒体消息
        const msgId = getLastMsgId(openid);
        await sendC2CImage(token, openid, fileInfo, msgId, log);
        log('info', `QQ 图片消息发送成功（第 ${attempt + 1} 次尝试${msgId ? '，被动消息' : '，主动消息'}）`);
        return true;
      } catch (err) {
        const msg = err.message || '';
        // token 失效 → 刷新重试一次
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
          attempt = -1;
          continue;
        }
        // 被动消息失败 → 降级主动
        const hadMsgId = getLastMsgId(openid);
        if (hadMsgId && /11255|invalid|forbidden/i.test(msg)) {
          log('warn', `被动消息失败（msg_id 可能过期），降级主动消息重试: ${msg}`);
          lastMsgIdByUser.delete(openid);
          saveMsgIds();
          continue;
        }
        log('error', `QQ 图片发送失败（第 ${attempt + 1} 次尝试）: ${msg}`);
        if (attempt < (config.retries || 0)) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    return false;
  } finally {
    // 清理临时图片
    try {
      if (fs.existsSync(cardPath)) fs.unlinkSync(cardPath);
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// QQ Bot API 基础设施（复用 qq-direct-notify 同款实现）
// ---------------------------------------------------------------------------

const TOKEN_URL = 'https://bots.qq.com/app/getAppAccessToken';
const API_BASE = 'https://api.sgroup.qq.com';
const API_GATEWAY_PATH = '/gateway';
const INTENTS_C2C = 1 << 25;

let cachedToken = null;
let cachedExpiresAt = 0;
let lastMsgSeq = 0;

function nextMsgSeq() {
  const timePart = Math.floor(Date.now() / 1000) % 65536;
  lastMsgSeq = (lastMsgSeq + 1) % 65536;
  return (timePart + lastMsgSeq) % 65536;
}

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

// 发送 C2C 文本消息（降级用）
function sendC2CText(token, openid, content, msgId, log) {
  return new Promise((resolve, reject) => {
    const body = { content, msg_type: 0, msg_seq: nextMsgSeq() };
    if (msgId) body.msg_id = msgId;
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
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(raw);
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

async function sendTextWithRetry(appId, clientSecret, openid, content, retries, log) {
  let token;
  try {
    token = await getAccessToken(appId, clientSecret, log);
  } catch (err) {
    log('error', `获取 QQ token 失败: ${err.message}`);
    return false;
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const msgId = getLastMsgId(openid);
      await sendC2CText(token, openid, content, msgId, log);
      return true;
    } catch (err) {
      const msg = err.message || '';
      if (attempt === 0 && /401|11251|invalid.*token|token.*invalid/i.test(msg)) {
        cachedToken = null;
        cachedExpiresAt = 0;
        try {
          token = await getAccessToken(appId, clientSecret, log);
        } catch (tokenErr) {
          return false;
        }
        attempt = -1;
        continue;
      }
      const hadMsgId = getLastMsgId(openid);
      if (hadMsgId && /11255|invalid|forbidden/i.test(msg)) {
        lastMsgIdByUser.delete(openid);
        saveMsgIds();
        continue;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 事件监听（WebSocket）：记录用户最近 msg_id，发送时走被动消息免额度
// ---------------------------------------------------------------------------

const lastMsgIdByUser = new Map();
const MSGID_STORE_FILE = 'data/qq-image-msgids.json';
let ws = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let lastS = null;
let heartbeatIntervalMs = 45000;
let stopRequested = false;
let reconnectAttempts = 0;
let connectTimeoutId = null;

function loadMsgIds() {
  try {
    const file = path.resolve(MSGID_STORE_FILE);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          if (v) lastMsgIdByUser.set(k, v);
        }
      }
    }
  } catch { /* ignore */ }
}

function saveMsgIds() {
  try {
    const file = path.resolve(MSGID_STORE_FILE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(Object.fromEntries(lastMsgIdByUser)), 'utf8');
  } catch { /* ignore */ }
}

function getLastMsgId(openid) {
  return lastMsgIdByUser.get(openid) || null;
}

function getGatewayUrl(token) {
  return new Promise((resolve, reject) => {
    const req = https.request(`${API_BASE}${API_GATEWAY_PATH}`, {
      method: 'GET',
      headers: { 'Authorization': `QQBot ${token}`, 'Content-Length': 0 },
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
        if (!settled) { settled = true; resolve(); }
      });

      ws.on('error', (err) => {
        if (connectTimeoutId) { clearTimeout(connectTimeoutId); connectTimeoutId = null; }
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(new Error(err.message));
        }
      });

      ws.on('open', () => {
        // 建连超时兜底：收到 READY 后必须清除（避免误判重连循环）
        connectTimeoutId = setTimeout(() => {
          log('warn', '建连超时（未收到 READY），断开重连');
          try { ws.close(); } catch { /* ignore */ }
        }, 20000);
      });
    }).catch((err) => {
      if (!settled) { settled = true; reject(err); }
    });

    // 整体超时兜底
    timeoutId = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('连接超时')); }
    }, 30000);
  });
}

function handleGatewayMessage(msg, appId, clientSecret, log) {
  if (msg.op === 10) {
    // Hello：记录心跳间隔
    if (msg.d && msg.d.heartbeat_interval) {
      heartbeatIntervalMs = msg.d.heartbeat_interval;
    }
    // 发 Identify（intents: 1<<25 = C2C 单聊消息）
    const identify = {
      op: 2,
      d: {
        token: `QQBot ${cachedToken}`,
        intents: INTENTS_C2C,
        shard: [0, 3], // 与 Hermes gateway [0,1]、qq-direct [0,2] 区分
        properties: { $os: 'linux', $browser: 'miotify-image', $device: 'miotify-image' },
      },
    };
    ws.send(JSON.stringify(identify));
    return;
  }

  if (msg.op === 11) {
    // Heartbeat ACK
    return;
  }

  if (msg.op === 0) {
    // Dispatch
    if (msg.t === 'READY') {
      if (connectTimeoutId) { clearTimeout(connectTimeoutId); connectTimeoutId = null; }
      log('info', 'QQ 事件监听 READY（被动消息通道就绪）');
      startHeartbeat();
      return;
    }
    if (msg.t === 'C2C_MESSAGE_CREATE' && msg.d) {
      const openid = msg.d.author && msg.d.author.user_openid;
      const msgId = msg.d.id;
      if (openid && msgId) {
        lastMsgIdByUser.set(openid, msgId);
        saveMsgIds();
      }
    }
  }
}

function startHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op: 1, d: lastS }));
    }
  }, heartbeatIntervalMs);
}

function clearHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

function stopListener() {
  stopRequested = true;
  clearHeartbeat();
  if (connectTimeoutId) { clearTimeout(connectTimeoutId); connectTimeoutId = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) {
    try { ws.close(); } catch { /* ignore */ }
    ws = null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
