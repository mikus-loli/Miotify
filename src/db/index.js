const init = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db = null;

const SQL_INIT = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    pass TEXT NOT NULL,
    admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    image TEXT DEFAULT '',
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appid INTEGER NOT NULL,
    message TEXT NOT NULL,
    title TEXT DEFAULT '',
    priority INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (appid) REFERENCES applications(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT DEFAULT '',
    author TEXT DEFAULT '',
    homepage TEXT DEFAULT '',
    license TEXT DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    config TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plugin_data (
    plugin_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (plugin_id, key),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL DEFAULT 'info',
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    user_id INTEGER,
    user_name TEXT,
    app_id INTEGER,
    app_name TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_appid ON messages(appid);
  CREATE INDEX IF NOT EXISTS idx_applications_token ON applications(token);
  CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
  CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
  CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);
`;

const crypto = require('crypto');

function generateJwtSecret() {
  return crypto.randomBytes(64).toString('hex');
}

function getSetting(key) {
  const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

function getOrGenerateJwtSecret() {
  if (process.env.JWT_SECRET) {
    return { secret: process.env.JWT_SECRET, generated: false };
  }
  let secret = getSetting('jwt_secret');
  if (secret) {
    return { secret, generated: false };
  }
  secret = generateJwtSecret();
  setSetting('jwt_secret', secret);
  return { secret, generated: true };
}

async function loadDb() {
  const SQL = await init();
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(config.dbPath)) {
    const buf = fs.readFileSync(config.dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run(SQL_INIT);
  migrate();
  await ensureAdmin();
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  const buf = Buffer.from(data);
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(config.dbPath, buf);
}

async function ensureAdmin() {
  const adminRows = queryAll('SELECT id FROM users WHERE admin = 1');
  if (adminRows.length > 0) {
    return;
  }
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(config.defaultAdminPass, 10);
  run('INSERT INTO users (name, pass, admin) VALUES (?, ?, 1)', [config.defaultAdminUser, hash]);
  save();
}

function migrate() {
  const columns = queryAll("PRAGMA table_info(messages)");
  const columnNames = columns.map(c => c.name);
  if (!columnNames.includes('extras')) {
    db.run('ALTER TABLE messages ADD COLUMN extras TEXT DEFAULT NULL');
    save();
    console.log('[DB] Migration: added extras column to messages');
  }
}

function run(sql, params) {
  db.run(sql, params);
  save();
  return db.getRowsModified();
}

function queryAll(sql, params) {
  const stmt = db.prepare(sql);
  stmt.bind(params || []);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function getDb() {
  return db;
}

function addLog({ level = 'info', category, action, message, details = {}, userId = null, userName = null, appId = null, appName = null, ip = null }) {
  run(
    'INSERT INTO logs (level, category, action, message, details, user_id, user_name, app_id, app_name, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [level, category, action, message, JSON.stringify(details), userId, userName, appId, appName, ip]
  );
}

function getLogs({ level = null, category = null, userId = null, limit = 100, offset = 0 }) {
  let sql = 'SELECT * FROM logs WHERE 1=1';
  const params = [];
  
  if (level) {
    sql += ' AND level = ?';
    params.push(level);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  
  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  return queryAll(sql, params);
}

function getLogCount({ level = null, category = null, userId = null }) {
  let sql = 'SELECT COUNT(*) as cnt FROM logs WHERE 1=1';
  const params = [];
  
  if (level) {
    sql += ' AND level = ?';
    params.push(level);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  
  return queryOne(sql, params).cnt;
}

function clearLogs({ beforeDays = 30 }) {
  const modifier = `-${beforeDays} days`;
  const result = run(
    "DELETE FROM logs WHERE date(created_at) < date('now', ?)",
    [modifier]
  );
  return result;
}

module.exports = { loadDb, run, queryAll, queryOne, getDb, save, getOrGenerateJwtSecret, getSetting, setSetting, addLog, getLogs, getLogCount, clearLogs };
