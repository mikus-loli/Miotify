require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 8080,
  jwtSecret: process.env.JWT_SECRET || 'miotify-default-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || './data/miotify.db',
  defaultAdminUser: process.env.DEFAULT_ADMIN_USER || 'admin',
  defaultAdminPass: process.env.DEFAULT_ADMIN_PASS || 'admin',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH, 10) || 5000,
  maxMessagesPerApp: parseInt(process.env.MAX_MESSAGES_PER_APP, 10) || 200,
};
