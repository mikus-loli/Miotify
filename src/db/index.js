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

  CREATE INDEX IF NOT EXISTS idx_messages_appid ON messages(appid);
  CREATE INDEX IF NOT EXISTS idx_applications_token ON applications(token);
  CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
`;

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

module.exports = { loadDb, run, queryAll, queryOne, getDb, save };
