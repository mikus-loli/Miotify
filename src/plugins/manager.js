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
    let pluginDef = null;
    try {
      delete require.cache[require.resolve(pluginPath)];
      pluginDef = require(pluginPath);

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
        const ok = await enablePlugin(pluginId, pluginDef, pluginRecord);
        // init 失败（如 SMTP 连不上、配置非法）时回滚 enabled 标记，避免 UI 显示"运行中"但实际未加载
        if (ok === false) {
          db.run('UPDATE plugins SET enabled = 0 WHERE id = ?', [pluginId]);
          console.warn(`[Plugin] ${pluginId} disabled due to init failure (enabled flag rolled back)`);
        }
      }
    } catch (err) {
      // 加载失败：保留 DB 记录（降级为停用），绝不误删用户配置/数据
      console.error(`[Plugin] Failed to load ${file}:`, err.message);
      if (pluginDef && pluginDef.meta && pluginDef.meta.id) {
        const pluginId = pluginDef.meta.id;
        loadedPluginIds.add(pluginId);
        db.run('UPDATE plugins SET enabled = 0 WHERE id = ?', [pluginId]);
        console.warn(`[Plugin] ${pluginId} disabled due to load failure (record kept)`);
      } else {
        // require 阶段就失败（语法错误等），无法拿到 id —— 尝试用文件名匹配已注册插件
        const guessedId = file.replace(/\.js$/, '');
        if (registeredMap.has(guessedId)) {
          db.run('UPDATE plugins SET enabled = 0 WHERE id = ?', [guessedId]);
          console.warn(`[Plugin] ${guessedId} disabled due to load failure (record kept)`);
        }
      }
    }
  }

  for (const registered of registeredPlugins) {
    // 只有文件真的不存在才清理记录；加载失败的文件仍在磁盘上，保留记录
    if (!loadedPluginIds.has(registered.id) && !fs.existsSync(path.join(pluginsDir, `${registered.id}.js`))) {
      db.run('DELETE FROM plugin_data WHERE plugin_id = ?', [registered.id]);
      db.run('DELETE FROM plugins WHERE id = ?', [registered.id]);
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

  // 先 init，成功后才注册 hooks —— init 失败不会留下"僵尸 hook"（已注册但无法禁用）
  if (pluginDef.init) {
    try {
      await pluginDef.init(context);
    } catch (err) {
      console.error(`[Plugin] Init failed for ${pluginId}:`, err.message);
      return false;
    }
  }

  if (pluginDef.hooks) {
    for (const [hookName, handler] of Object.entries(pluginDef.hooks)) {
      if (typeof handler === 'function') {
        // 自动注册未初始化过的 hook 名（不依赖 initHooks 预初始化，更健壮）
        if (!hooks.has(hookName)) {
          hooks.set(hookName, []);
          console.warn(`[Plugin] ${pluginId} registers unknown hook "${hookName}"`);
        }
        const boundHandler = (...args) => handler(context, ...args);
        hooks.get(hookName).push({ pluginId, handler: boundHandler, priority: pluginRecord.priority });
        hooks.get(hookName).sort((a, b) => a.priority - b.priority);
      }
    }
  }

  loadedPlugins.set(pluginId, { def: pluginDef, context, record: pluginRecord });
  console.log(`[Plugin] Enabled: ${pluginId}`);
  // 通知其他插件：本插件已启用（不阻塞主流程）
  try {
    await executeHook('plugin:onEnable', { id: pluginId, name: pluginDef.meta?.name || pluginId });
  } catch (_) {}
  return true;
}

function disablePlugin(pluginId) {
  const plugin = loadedPlugins.get(pluginId);
  if (!plugin) return;

  // 移除该插件注册的所有 hooks（filter 全量移除，避免重复注册残留）
  for (const [hookName, handlers] of hooks.entries()) {
    hooks.set(hookName, handlers.filter(h => h.pluginId !== pluginId));
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
  // 通知其他插件：本插件已停用（不阻塞主流程）
  executeHook('plugin:onDisable', { id: pluginId, name: plugin.def.meta?.name || pluginId }).catch(() => {});
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
      try {
        delete require.cache[require.resolve(pluginPath)];
        const pluginDef = require(pluginPath);
        // 同步尝试加载；加载失败时回滚 DB 的 enabled 标记，避免 UI 显示"运行中"但实际未启用
        const ok = enablePlugin(pluginId, pluginDef, { ...plugin, enabled: 1 });
        if (ok && typeof ok.then === 'function') {
          ok.then((result) => {
            if (result === false) {
              db.run('UPDATE plugins SET enabled = 0 WHERE id = ?', [pluginId]);
            }
          });
        } else if (ok === false) {
          db.run('UPDATE plugins SET enabled = 0 WHERE id = ?', [pluginId]);
        }
      } catch (err) {
        console.error(`[Plugin] Failed to enable ${pluginId}:`, err.message);
        db.run('UPDATE plugins SET enabled = 0 WHERE id = ?', [pluginId]);
      }
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
    // 配置变更后重建插件资源（destroy + init），让 email-forwarder 等插件的新配置即时生效
    if (typeof loaded.def.destroy === 'function') {
      try {
        loaded.def.destroy();
      } catch (err) {
        console.error(`[Plugin] Destroy failed during config update for ${pluginId}:`, err.message);
      }
    }
    if (typeof loaded.def.init === 'function') {
      try {
        const initResult = loaded.def.init(loaded.context);
        if (initResult && typeof initResult.catch === 'function') {
          initResult.catch((err) => {
            console.error(`[Plugin] Re-init failed after config update for ${pluginId}:`, err.message);
          });
        }
      } catch (err) {
        console.error(`[Plugin] Re-init failed after config update for ${pluginId}:`, err.message);
      }
    }
  }

  return db.queryOne('SELECT * FROM plugins WHERE id = ?', [pluginId]);
}

function setPluginPriority(pluginId, priority) {
  db.run('UPDATE plugins SET priority = ?, updated_at = datetime("now") WHERE id = ?', [priority, pluginId]);
  // 同步更新内存中已注册 hooks 的优先级并重新排序，让改动立即生效（无需重启）
  for (const [hookName, handlers] of hooks.entries()) {
    const updated = handlers.map(h => h.pluginId === pluginId ? { ...h, priority } : h);
    updated.sort((a, b) => a.priority - b.priority);
    hooks.set(hookName, updated);
  }
  // 同时更新已加载插件的 record 缓存，避免重复启用时用旧优先级
  if (loadedPlugins.has(pluginId)) {
    const loaded = loadedPlugins.get(pluginId);
    loaded.record = { ...loaded.record, priority };
  }
  return db.queryOne('SELECT * FROM plugins WHERE id = ?', [pluginId]);
}

function isPluginEnabled(pluginId) {
  return loadedPlugins.has(pluginId);
}

module.exports = {
  loadPlugins,
  enablePlugin,
  disablePlugin,
  executeHook,
  getPlugins,
  getPlugin,
  setPluginEnabled,
  setPluginConfig,
  setPluginPriority,
  isPluginEnabled,
};
