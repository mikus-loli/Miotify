module.exports = {
  meta: {
    id: 'message-logger',
    name: 'Message Logger',
    version: '1.0.0',
    description: '记录所有消息到日志，用于调试和审计',
    author: 'Miotify',
    license: 'MIT',
  },

  defaultConfig: {
    logLevel: 'info',
    includeAppInfo: true,
  },

  hooks: {
    'message:beforeSend': (ctx, message) => {
      const { log, config } = ctx;
      const level = config.logLevel || 'info';
      log(level, `Sending message: ${JSON.stringify(message)}`);
      return message;
    },

    'message:afterSend': (ctx, message) => {
      const { log, config, db } = ctx;
      const count = db.get('messageCount') || 0;
      db.set('messageCount', count + 1);
      if (config.includeAppInfo) {
        log('info', `Message #${message.id} sent to app ${message.appid}`);
      }
    },
  },

  init: (ctx) => {
    ctx.log('info', 'Message Logger plugin initialized');
  },

  destroy: () => {
    console.log('[Plugin:message-logger] Plugin destroyed');
  },
};
