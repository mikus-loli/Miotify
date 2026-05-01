require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateAndSaveSecret() {
  const secret = crypto.randomBytes(32).toString('hex');
  const envPath = path.resolve(process.cwd(), '.env');
  
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('JWT_SECRET=')) {
      envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${secret}`);
    } else {
      envContent += `\nJWT_SECRET=${secret}`;
    }
  } else {
    envContent = `JWT_SECRET=${secret}\n`;
  }
  
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  return secret;
}

let jwtSecret = process.env.JWT_SECRET;
let jwtSecretGenerated = false;

if (!jwtSecret) {
  jwtSecret = generateAndSaveSecret();
  jwtSecretGenerated = true;
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 8080,
  jwtSecret,
  jwtSecretGenerated,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || './data/miotify.db',
  defaultAdminUser: process.env.DEFAULT_ADMIN_USER || 'admin',
  defaultAdminPass: process.env.DEFAULT_ADMIN_PASS || 'admin',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH, 10) || 5000,
  maxMessagesPerApp: parseInt(process.env.MAX_MESSAGES_PER_APP, 10) || 200,
};
