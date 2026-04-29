const http = require('http');
const https = require('https');

let clientReady = false;

module.exports = {
  meta: {
    id: 'napcat-forwarder',
    name: 'NapCat Forwarder',
    version: '1.0.0',
    description: '将消息转发到 QQ，通过 NapCat OneBot API 实现',
    author: 'Miotify',
    license: 'MIT',
    homepage: 'https://napcat.napneko.icu/',
  },

  defaultConfig: {
    httpUrl: 'http://127.0.0.1:3000',
    accessToken: '',
    targetType: 'private',
    targetId: 0,
    messageTemplate: '[{title}]\n{message}',
    minPriority: 0,
    enabledApps: [],
    timeout: 5000,
  },

  hooks: {
    'message:afterSend': async (ctx, message) => {
      const { config, log } = ctx;

      if (!clientReady) {
        log('warn', 'NapCat client not ready, skipping message');
        return;
      }

      if (message.priority < (config.minPriority || 0)) {
        log('info', `Skipping message due to low priority: ${message.id}`);
        return;
      }

      if (config.enabledApps && config.enabledApps.length > 0) {
        if (!config.enabledApps.includes(message.appid)) {
          log('info', `Skipping message from app ${message.appid} (not in enabledApps)`);
          return;
        }
      }

      if (!config.targetId) {
        log('warn', 'Target ID not configured, skipping message');
        return;
      }

      const msgText = buildMessage(message, config);

      try {
        const result = await sendToNapCat(config, msgText, log);
        if (result) {
          log('info', `Message forwarded to QQ: ${message.id}`);
          const count = ctx.db.get('sentCount') || 0;
          ctx.db.set('sentCount', count + 1);
        }
      } catch (err) {
        log('error', `Failed to forward message: ${err.message}`);
      }
    },
  },

  init: async (ctx) => {
    const { config, log } = ctx;

    if (!config.httpUrl) {
      log('warn', 'NapCat HTTP URL not configured');
      return;
    }

    if (!config.targetId) {
      log('warn', 'Target ID (QQ号/群号) not configured');
      return;
    }

    try {
      const ready = await checkConnection(config, log);
      clientReady = ready;
      if (ready) {
        log('info', `NapCat connected: ${config.httpUrl}`);
      }
    } catch (err) {
      log('error', `NapCat connection check failed: ${err.message}`);
    }
  },

  destroy: () => {
    clientReady = false;
    console.log('[Plugin:napcat-forwarder] Plugin destroyed');
  },
};

function buildMessage(message, config) {
  const template = config.messageTemplate || '[{title}]\n{message}';
  return template
    .replace('{title}', message.title || '通知')
    .replace('{message}', message.message || '')
    .replace('{priority}', String(message.priority))
    .replace('{appid}', String(message.appid))
    .replace('{time}', message.created_at || new Date().toISOString());
}

async function sendToNapCat(config, message, log) {
  const url = new URL(config.httpUrl);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  const endpoint = config.targetType === 'group' ? '/send_group_msg' : '/send_private_msg';
  const bodyKey = config.targetType === 'group' ? 'group_id' : 'user_id';

  const payload = JSON.stringify({
    [bodyKey]: Number(config.targetId),
    message: message,
  });

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    timeout: config.timeout || 5000,
  };

  if (config.accessToken) {
    options.headers['Authorization'] = `Bearer ${config.accessToken}`;
  }

  return new Promise((resolve, reject) => {
    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'ok' || json.retcode === 0) {
            resolve(true);
          } else {
            log('warn', `NapCat response: ${JSON.stringify(json)}`);
            resolve(false);
          }
        } catch (e) {
          log('warn', `NapCat invalid response: ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

async function checkConnection(config, log) {
  const url = new URL(config.httpUrl);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: '/get_login_info',
    method: 'GET',
    timeout: 3000,
  };

  if (config.accessToken) {
    options.headers = {
      'Authorization': `Bearer ${config.accessToken}`,
    };
  }

  return new Promise((resolve) => {
    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'ok' && json.data) {
            log('info', `Logged in as: ${json.data.nickname} (${json.data.user_id})`);
            resolve(true);
          } else {
            log('warn', `Login check failed: ${JSON.stringify(json)}`);
            resolve(false);
          }
        } catch (e) {
          log('warn', `Invalid response from NapCat: ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      log('error', `Connection error: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      log('error', 'Connection timeout');
      resolve(false);
    });

    req.end();
  });
}
