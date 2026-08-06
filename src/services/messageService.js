const db = require('../db');
const config = require('../config');
const pluginManager = require('../plugins/manager');

/**
 * 发送消息核心流程（内部 /api/message 与 Gotify 兼容 /message 共用）。
 *
 * 统一处理：输入校验 → message:beforeSend 钩子（可修改/拒绝）→
 * 每应用消息数上限清理（删最旧）→ 插入 → message:afterSend 钩子。
 * 两个路由层各自负责：认证、错误文案/格式、日志、WS 广播与响应序列化。
 *
 * @param {{id:number, name:string, user_id:number}} app 应用行（须含 id/name/user_id）
 * @param {{title?:string, message:string, priority?:number, extras?:object}} input 消息输入
 * @returns {Promise<{ok:true, msg:object}|{ok:false, error:'EMPTY'|'TOO_LONG'|'REJECTED'}>}
 *   - ok:true 时 msg 为插入后的消息行（extras 为 JSON 字符串，由路由层按需解析）
 *   - ok:false 时 error 为拒绝原因（路由层据此生成各自的错误响应）
 */
async function sendMessage(app, input) {
  const { title, message, priority, extras } = input || {};

  if (!message) return { ok: false, error: 'EMPTY' };
  if (message.length > config.maxMessageLength) return { ok: false, error: 'TOO_LONG' };

  const processed = await pluginManager.executeHook('message:beforeSend', {
    title,
    message,
    priority: priority || 0,
    appid: app.id,
  });

  // 插件返回 null 表示拒绝发送
  if (processed === null) return { ok: false, error: 'REJECTED' };

  // 每应用消息数上限：超出时删除最旧一条
  const count = db.queryOne('SELECT COUNT(*) as cnt FROM messages WHERE appid = ?', [app.id]);
  if (count.cnt >= config.maxMessagesPerApp) {
    const oldest = db.queryOne('SELECT id FROM messages WHERE appid = ? ORDER BY id ASC LIMIT 1', [app.id]);
    if (oldest) {
      db.run('DELETE FROM messages WHERE id = ?', [oldest.id]);
    }
  }

  db.run('INSERT INTO messages (appid, message, title, priority, extras) VALUES (?, ?, ?, ?, ?)', [
    app.id,
    processed.message,
    processed.title || '',
    processed.priority || 0,
    extras ? JSON.stringify(extras) : null,
  ]);

  const msg = db.queryOne(
    'SELECT id, appid, message, title, priority, extras, created_at FROM messages WHERE appid = ? ORDER BY id DESC LIMIT 1',
    [app.id]
  );

  await pluginManager.executeHook('message:afterSend', msg);
  return { ok: true, msg };
}

module.exports = { sendMessage };
