const crypto = require('crypto');
const http = require('http');
const https = require('https');

/**
 * Hermes QQ Notify 插件
 *
 * 消息发送后，通过 Hermes webhook（--deliver-only，零 LLM 成本）推送到主人 QQ。
 * 不依赖 NapCat —— 链路：Miotify → Hermes gateway webhook → QQ 官方 Bot API。
 *
 * 配置（在 Miotify 插件管理界面填写，或通过环境变量注入）：
 *   webhookUrl     Hermes webhook 地址，如 http://64.90.11.66:8644/webhooks/miotify-alerts
 *   webhookSecret  webhook 的 HMAC secret（hermes webhook list 可查）
 *   minPriority    最低优先级（0 = 全部转发）
 *   forwardAllApps 转发所有应用（true=全部；false=只转发 enabledApps 列出的）
 *   enabledApps    只转发这些应用 ID（forwardAllApps=false 时生效，空数组 = 全部）
 *   maxContentLength 消息内容截断长度（QQ 消息长度有限）
 *   retries        失败重试次数（指数退避：1s/2s/4s...）
 *
 * 环境变量（优先于界面配置）：
 *   HERMES_WEBHOOK_URL / HERMES_WEBHOOK_SECRET
 */
module.exports = {
  meta: {
    id: 'hermes-qq-notify',
    name: 'Hermes QQ Notify',
    version: '1.0.0',
    description: '收到消息后通过 Hermes webhook 推送到主人 QQ（不走 NapCat）',
    author: 'Miotify',
    license: 'MIT',
    homepage: 'https://github.com/mikus-loli/Miotify',
  },

  defaultConfig: {
    webhookUrl: '',
    webhookSecret: '',
    minPriority: 0,
    forwardAllApps: true,
    enabledApps: [],
    maxContentLength: 500,
    retries: 2,
  },

  hooks: {
    'message:afterSend': async (ctx, message) => {
      const { config, log } = ctx;

      // 环境变量优先，其次插件配置
      const webhookUrl = process.env.HERMES_WEBHOOK_URL || config.webhookUrl;
      const webhookSecret = process.env.HERMES_WEBHOOK_SECRET || config.webhookSecret;

      if (!webhookUrl || !webhookSecret) {
        log('warn', 'webhookUrl/webhookSecret 未配置，跳过 QQ 通知');
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

      // 查应用名（payload 更友好）
      let appName = '';
      try {
        const db = require('../../src/db');
        const app = db.queryOne('SELECT name FROM applications WHERE id = ?', [message.appid]);
        appName = app ? app.name : '';
      } catch (err) {
        log('warn', `查询应用名失败: ${err.message}`);
      }

      // 内容截断，避免 QQ 消息超长
      const content = String(message.message || '');
      const truncated = content.length > config.maxContentLength
        ? content.substring(0, config.maxContentLength) + '…'
        : content;

      const payload = {
        event_type: 'message',
        app_name: appName,
        appid: message.appid,
        title: message.title || '',
        message: truncated,
        priority: message.priority || 0,
        // SQLite datetime('now') 存的是 UTC，转本地时区展示
        time: formatLocalTime(message.created_at),
      };

      const ok = await postWithRetry(webhookUrl, webhookSecret, payload, config.retries || 0, log);
      if (ok) {
        log('info', `QQ 通知已推送: id=${message.id} app=${appName || message.appid}`);
      } else {
        log('error', `QQ 通知推送失败: id=${message.id}`);
      }
    },
  },

  init: (ctx) => {
    const { config, log } = ctx;
    const url = process.env.HERMES_WEBHOOK_URL || config.webhookUrl;
    const secret = process.env.HERMES_WEBHOOK_SECRET || config.webhookSecret;
    if (!url || !secret) {
      log('warn', 'Hermes webhook 未配置（环境变量或插件配置），QQ 通知不会生效');
    } else {
      log('info', `Hermes QQ Notify 就绪: ${url}`);
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

// HMAC-SHA256 V2 签名（时间戳.body）并 POST，指数退避重试
async function postWithRetry(url, secret, payload, retries, log) {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');

  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    log('error', `webhookUrl 无效: ${err.message}`);
    return false;
  }

  const httpModule = parsed.protocol === 'https:' ? https : http;
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-Webhook-Signature-V2': sig,
      'X-Webhook-Timestamp': String(ts),
    },
    timeout: 5000,
  };

  for (let attempt = 0; attempt <= (retries || 0); attempt++) {
    try {
      const status = await doPost(httpModule, options, body);
      if (status >= 200 && status < 300) {
        log('info', `Webhook 投递成功 (HTTP ${status})`);
        return true;
      }
      log('warn', `Webhook 返回 HTTP ${status}（第 ${attempt + 1} 次尝试）`);
    } catch (err) {
      log('error', `Webhook 请求失败: ${err.message}（第 ${attempt + 1} 次尝试）`);
    }
    if (attempt < (retries || 0)) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  return false;
}

function doPost(httpModule, options, body) {
  return new Promise((resolve, reject) => {
    const req = httpModule.request(options, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode || 0));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.write(body);
    req.end();
  });
}
