const fs = require('fs');
const path = require('path');
const db = require('../db');

const pluginsDir = path.join(__dirname, '..', '..', 'plugins', 'available');
const loadedPlugins = new Map();
const hooks = new Map();

function initHooks() {
  hooks.set('message:beforeSend', []);
  hooks.set('message:afterSend', []);
  hooks.set('message:onReceive', []);
  hooks.set('user:onCreate', []);
  hooks.set('user:onDelete', []);
  hooks.set('app:onCreate', []);
  hooks.set('app:onDelete', []);
  hooks.set('plugin:onEnable', []);
  hooks.set('plugin:onDisable', []);
}

function ensurePluginsDir() {
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }
}

async function loadPlugins() {
  initHooks();
  ensurePluginsDir();

  const registeredPlugins = db.queryAll('SELECT * FROM plugins ORDER BY priority ASC');
  const registeredMap = new Map(registeredPlugins.map(p => [p.id, p]));

  const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
  const loadedPluginIds = new Set();

  for (const file of files) {
    const pluginPath = path.join(pluginsDir, file);
    try {
      delete require.cache[require.resolve(pluginPath)];
      const pluginDef = require(pluginPath);

      if (!pluginDef.meta || !pluginDef.meta.id) {
        console.warn(`[Plugin] Invalid plugin definition in ${file}: missing meta.id`);
        continue;
      }

      const pluginId = pluginDef.meta.id;
      loadedPluginIds.add(pluginId);
      const defaultConfig = pluginDef.defaultConfig || {};

      if (registeredMap.has(pluginId)) {
        const existing = registeredMap.get(pluginId);
        const existingConfig = JSON.parse(existing.config || '{}');
        const mergedConfig = { ...defaultConfig, ...existingConfig };
        
        db.run(
          `UPDATE plugins SET name = ?, version = ?, description = ?, author = ?, homepage = ?, license = ?, config = ?, updated_at = datetime('now') WHERE id = ?`,
          [
            pluginDef.meta.name || pluginId,
            pluginDef.meta.version || '1.0.0',
            pluginDef.meta.description || '',
            pluginDef.meta.author || '',
            pluginDef.meta.homepage || '',
            pluginDef.meta.license || '',
            JSON.stringify(mergedConfig),
            pluginId,
          ]
        );
        console.log(`[Plugin] Updated: ${pluginId}`);
      } else {
        db.run(
          `INSERT INTO plugins (id, name, version, description, author, homepage, license, config)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pluginId,
            pluginDef.meta.name || pluginId,
            pluginDef.meta.version || '1.0.0',
            pluginDef.meta.description || '',
            pluginDef.meta.author || '',
            pluginDef.meta.homepage || '',
            pluginDef.meta.license || '',
            JSON.stringify(defaultConfig),
          ]
        );
        console.log(`[Plugin] Registered: ${pluginId}`);
      }

      const pluginRecord = db.queryOne('SELECT * FROM plugins WHERE id = ?', [pluginId]);
      if (pluginRecord.enabled) {
        await enablePlugin(pluginId, pluginDef, pluginRecord);
      }
    } catch (err) {
      console.error(`[Plugin] Failed to load ${file}:`, err.message);
    }
  }

  for (const registered of registeredPlugins) {
    if (!loadedPluginIds.has(registered.id)) {
      db.run('DELETE FROM plugins WHERE id = ?', [registered.id]);
      db.run('DELETE FROM plugin_data WHERE plugin_id = ?', [registered.id]);
      console.log(`[Plugin] Removed: ${registered.id} (file not found)`);
    }
  }
}

async function enablePlugin(pluginId, pluginDef, pluginRecord) {
  if (loadedPlugins.has(pluginId)) {
    return;
  }

  const config = JSON.parse(pluginRecord.config || '{}');
  const context = createPluginContext(pluginId, config);

  if (pluginDef.hooks) {
    for (const [hookName, handler] of Object.entries(pluginDef.hooks)) {
      if (hooks.has(hookName) && typeof handler === 'function') {
        const boundHandler = (...args) => handler(context, ...args);
        hooks.get(hookName).push({ pluginId, handler: boundHandler, priority: pluginRecord.priority });
        hooks.get(hookName).sort((a, b) => a.priority - b.priority);
      }
    }
  }

  if (pluginDef.init) {
    try {
      await pluginDef.init(context);
    } catch (err) {
      console.error(`[Plugin] Init failed for ${pluginId}:`, err.message);
      return;
    }
  }

  loadedPlugins.set(pluginId, { def: pluginDef, context, record: pluginRecord });
  console.log(`[Plugin] Enabled: ${pluginId}`);
}

function disablePlugin(pluginId) {
  const plugin = loadedPlugins.get(pluginId);
  if (!plugin) return;

  for (const [hookName, handlers] of hooks.entries()) {
    const idx = handlers.findIndex(h => h.pluginId === pluginId);
    if (idx !== -1) {
      handlers.splice(idx, 1);
    }
  }

  if (plugin.def.destroy) {
    try {
      plugin.def.destroy();
    } catch (err) {
      console.error(`[Plugin] Destroy failed for ${pluginId}:`, err.message);
    }
  }

  loadedPlugins.delete(pluginId);
  console.log(`[Plugin] Disabled: ${pluginId}`);
}

function createPluginContext(pluginId, config) {
  return {
    pluginId,
    config,
    db: {
      get: (key) => {
        const row = db.queryOne('SELECT value FROM plugin_data WHERE plugin_id = ? AND key = ?', [pluginId, key]);
        return row ? JSON.parse(row.value) : null;
      },
      set: (key, value) => {
        db.run(
          `INSERT OR REPLACE INTO plugin_data (plugin_id, key, value) VALUES (?, ?, ?)`,
          [pluginId, key, JSON.stringify(value)]
        );
      },
      delete: (key) => {
        db.run('DELETE FROM plugin_data WHERE plugin_id = ? AND key = ?', [pluginId, key]);
      },
    },
    log: (level, message) => {
      const prefix = `[Plugin:${pluginId}]`;
      if (level === 'error') console.error(prefix, message);
      else if (level === 'warn') console.warn(prefix, message);
      else console.log(prefix, message);
    },
  };
}

async function executeHook(hookName, ...args) {
  const handlers = hooks.get(hookName);
  if (!handlers || handlers.length === 0) return args[0];

  let result = args[0];
  for (const { handler } of handlers) {
    try {
      const hookResult = await handler(...args);
      if (hookResult !== undefined && hookName === 'message:beforeSend') {
        if (hookResult === null) return null;
        result = hookResult;
        args[0] = result;
      }
    } catch (err) {
      console.error(`[Plugin] Hook ${hookName} error:`, err.message);
    }
  }
  return result;
}

function getPlugins() {
  return db.queryAll('SELECT * FROM plugins ORDER BY name ASC');
}

function getPlugin(pluginId) {
  return db.queryOne('SELECT * FROM plugins WHERE id = ?', [pluginId]);
}

function setPluginEnabled(pluginId, enabled) {
  const plugin = db.queryOne('SELECT * FROM plugins WHERE id = ?', [pluginId]);
  if (!plugin) return null;

  db.run('UPDATE plugins SET enabled = ?, updated_at = datetime("now") WHERE id = ?', [enabled ? 1 : 0, pluginId]);

  if (enabled) {
    const pluginPath = path.join(pluginsDir, `${pluginId}.js`);
    if (fs.existsSync(pluginPath)) {
      delete require.cache[require.resolve(pluginPath)];
      const pluginDef = require(pluginPath);
      enablePlugin(pluginId, pluginDef, { ...plugin, enabled: 1 });
    }
  } else {
    disablePlugin(pluginId);
  }

  return db.queryOne('SELECT * FROM plugins WHERE id = ?', [pluginId]);
}

function setPluginConfig(pluginId, config) {
  const plugin = db.queryOne('SELECT * FROM plugins WHERE id = ?', [pluginId]);
  if (!plugin) return null;

  const newConfig = { ...JSON.parse(plugin.config || '{}'), ...config };
  db.run('UPDATE plugins SET config = ?, updated_at = datetime("now") WHERE id = ?', [JSON.stringify(newConfig), pluginId]);

  if (loadedPlugins.has(pluginId)) {
    const loaded = loadedPlugins.get(pluginId);
    loaded.context.config = newConfig;
  }

  return db.queryOne('SELECT * FROM plugins WHERE id = ?', [pluginId]);
}

function setPluginPriority(pluginId, priority) {
  db.run('UPDATE plugins SET priority = ?, updated_at = datetime("now") WHERE id = ?', [priority, pluginId]);
  return db.queryOne('SELECT * FROM plugins WHERE id = ?', [pluginId]);
}

function isPluginEnabled(pluginId) {
  return loadedPlugins.has(pluginId);
}

module.exports = {
  loadPlugins,
  executeHook,
  getPlugins,
  getPlugin,
  setPluginEnabled,
  setPluginConfig,
  setPluginPriority,
  isPluginEnabled,
};
