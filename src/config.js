require('dotenv').config();

let _jwtSecret = process.env.JWT_SECRET || null;

module.exports = {
  port: parseInt(process.env.PORT, 10) || 8080,
  get jwtSecret() {
    return _jwtSecret;
  },
  setJwtSecret(secret) {
    _jwtSecret = secret;
  },
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || './data/miotify.db',
  defaultAdminUser: process.env.DEFAULT_ADMIN_USER || 'admin',
  defaultAdminPass: process.env.DEFAULT_ADMIN_PASS || 'admin',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH, 10) || 5000,
  maxMessagesPerApp: parseInt(process.env.MAX_MESSAGES_PER_APP, 10) || 200,
  // 日志保留策略：按条数（默认 5000 条）和天数（默认 30 天）双重上限，0 表示不限制
  logRetentionCount: parseInt(process.env.LOG_RETENTION_COUNT, 10) || 5000,
  logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS, 10) || 30,
};
