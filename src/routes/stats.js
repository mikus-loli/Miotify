const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { tzModifier } = require('../timezone');

const router = express.Router();

router.get('/stats', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.admin;

    // 时区修正：SQLite datetime('now') 恒为 UTC，按默认中国时区（config.timezone）生成修饰符，
    // 让"今日/近7天/24小时分布"统计按中国时间口径展示（+8 小时），不依赖容器 TZ。
    const modifier = tzModifier();

    const appIds = db.queryAll('SELECT id FROM applications WHERE user_id = ?', [userId]).map(a => a.id);
    const totalApps = appIds.length;

    let totalMessages;
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      totalMessages = db.queryOne(`SELECT COUNT(*) as cnt FROM messages WHERE appid IN (${placeholders})`, appIds).cnt;
    } else {
      totalMessages = 0;
    }

    let totalUsers = 0;
    if (isAdmin) {
      totalUsers = db.queryOne('SELECT COUNT(*) as cnt FROM users').cnt;
    }

    let todayMessages = 0;
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      todayMessages = db.queryOne(
        `SELECT COUNT(*) as cnt FROM messages WHERE appid IN (${placeholders}) AND date(created_at, ?) = date('now', ?)`,
        [...appIds, modifier, modifier]
      ).cnt;
    }

    const priorityStats = { low: 0, normal: 0, high: 0 };
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      const rows = db.queryAll(
        `SELECT 
          SUM(CASE WHEN priority < 2 THEN 1 ELSE 0 END) as low,
          SUM(CASE WHEN priority >= 2 AND priority < 5 THEN 1 ELSE 0 END) as normal,
          SUM(CASE WHEN priority >= 5 THEN 1 ELSE 0 END) as high
        FROM messages WHERE appid IN (${placeholders})`,
        appIds
      );
      if (rows[0]) {
        priorityStats.low = rows[0].low || 0;
        priorityStats.normal = rows[0].normal || 0;
        priorityStats.high = rows[0].high || 0;
      }
    }

    const messagesByDay = [];
    const dayResults = new Map();
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      const rows = db.queryAll(
        `SELECT date(created_at, ?) as day, COUNT(*) as cnt FROM messages WHERE appid IN (${placeholders}) AND date(created_at, ?) >= date('now', ?, ?) GROUP BY date(created_at, ?) ORDER BY day`,
        // 注意参数顺序：SELECT 子句里的 ? 最先占位，然后才是 IN 的 appIds
        // 参数 = SELECT date(1) + IN(n) + WHERE date(1) + date('now')(2) + GROUP BY(1)
        [modifier, ...appIds, modifier, modifier, '-6 days', modifier]
      );
      for (const row of rows) {
        dayResults.set(row.day, row.cnt);
      }
    }
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // 用本地时区拼 YYYY-MM-DD（与 SQL 的 date(created_at, modifier) 口径一致），
      // 不能用 toISOString()——那是 UTC 日期，跨天时段（如本地凌晨）会与 SQL 结果错位
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      messagesByDay.push({
        date: dateStr,
        count: dayResults.get(dateStr) || 0,
      });
    }

    const messagesByApp = [];
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      const rows = db.queryAll(
        `SELECT a.id, a.name, COUNT(m.id) as count 
         FROM applications a 
         LEFT JOIN messages m ON m.appid = a.id 
         WHERE a.id IN (${placeholders}) 
         GROUP BY a.id 
         ORDER BY count DESC 
         LIMIT 10`,
        appIds
      );
      messagesByApp.push(...rows);
    }

    const messagesByHour = [];
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      const rows = db.queryAll(
        `SELECT CAST(strftime('%H', created_at, ?) AS INTEGER) as hour, COUNT(*) as cnt FROM messages WHERE appid IN (${placeholders}) GROUP BY hour ORDER BY hour`,
        // strftime 的修饰符 ? 在 SELECT 子句，先于 IN 的 appIds 占位
        [modifier, ...appIds]
      );
      const hourMap = new Map();
      for (const row of rows) {
        hourMap.set(row.hour, row.cnt);
      }
      for (let h = 0; h < 24; h++) {
        messagesByHour.push({ hour: h, count: hourMap.get(h) || 0 });
      }
    } else {
      for (let h = 0; h < 24; h++) {
        messagesByHour.push({ hour: h, count: 0 });
      }
    }

    res.json({
      totalApps,
      totalMessages,
      totalUsers,
      todayMessages,
      priorityStats,
      messagesByDay,
      messagesByApp,
      messagesByHour,
    });
  } catch (err) {
    console.error('[Stats API Error]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
