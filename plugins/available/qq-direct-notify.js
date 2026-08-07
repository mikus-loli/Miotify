const https = require('https');

/**
 * QQ 官方 Bot API 直连通知插件
 *
 * 消息发送后，直接调用 QQ 开放平台机器人 API 推送到主人 QQ。
 * 不依赖任何中间服务（NapCat / Hermes webhook / 反代）：
 *   Miotify → QQ 官方 Bot API → 主人 QQ
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
 *   获取 token:  POST https://bots.qq.com/app/getAppAccessToken  {appId, clientSecret}
 *   发 C2C 消息: POST https://api.sgroup.qq.com/v2/users/{openid}/messages
 *               Authorization: QQBot {access_token}
 *               Body: {content, msg_type: 0(文本), msg_seq}
 */
module.exports = {
  meta: {
    id: 'qq-direct-notify',
    name: 'QQ Direct Notify',
    version: '1.0.0',
    description: '收到消息后直接调用 QQ 官方 Bot API 推送到主人 QQ（无中间依赖）',
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
    const ok = (process.env.QQ_APP_ID || config.appId)
      && (process.env.QQ_CLIENT_SECRET || config.clientSecret)
      && (process.env.QQ_TARGET_OPENID || config.targetOpenId);
    if (!ok) {
      log('warn', 'QQ 凭据未配置（环境变量或插件配置），QQ 通知不会生效');
    } else {
      log('info', 'QQ Direct Notify 就绪');
    }
  },

  destroy: () => {},
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
function sendC2CText(token, openid, content, log) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      content,
      msg_type: 0,
      msg_seq: nextMsgSeq(),
    });
    const req = https.request(`${API_BASE}/v2/users/${encodeURIComponent(openid)}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
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
    req.write(body);
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
      await sendC2CText(token, openid, content, log);
      log('info', `QQ API 发送成功（第 ${attempt + 1} 次尝试）`);
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
