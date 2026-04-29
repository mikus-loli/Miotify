module.exports = {
  meta: {
    id: 'word-filter',
    name: 'Word Filter',
    version: '1.0.0',
    description: '过滤消息中的敏感词汇',
    author: 'Miotify',
    license: 'MIT',
  },

  defaultConfig: {
    blockedWords: ['spam', 'advertisement'],
    replacement: '***',
    rejectOnMatch: false,
  },

  hooks: {
    'message:beforeSend': (ctx, message) => {
      const { config, log } = ctx;
      const { blockedWords = [], replacement = '***', rejectOnMatch = false } = config;

      let filtered = message.message;
      let matched = false;

      for (const word of blockedWords) {
        if (filtered.toLowerCase().includes(word.toLowerCase())) {
          matched = true;
          const regex = new RegExp(word, 'gi');
          filtered = filtered.replace(regex, replacement);
        }
      }

      if (matched) {
        log('warn', `Filtered message contained blocked words`);
        if (rejectOnMatch) {
          log('warn', 'Message rejected due to blocked word');
          return null;
        }
      }

      return { ...message, message: filtered };
    },
  },

  init: (ctx) => {
    const { config, log } = ctx;
    log('info', `Word Filter initialized with ${config.blockedWords?.length || 0} blocked words`);
  },
};
