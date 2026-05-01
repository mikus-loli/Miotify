const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.admin;

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

    const todayStr = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
    let todayMessages = 0;
    if (appIds.length > 0) {
      const placeholders = appIds.map(() => '?').join(',');
      todayMessages = db.queryOne(
        `SELECT COUNT(*) as cnt FROM messages WHERE appid IN (${placeholders}) AND created_at >= ?`,
        [...appIds, todayStr]
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
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = d.toISOString().slice(0, 10) + 'T00:00:00.000Z';
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayEnd = nextDay.toISOString().slice(0, 10) + 'T00:00:00.000Z';

      let count = 0;
      if (appIds.length > 0) {
        const placeholders = appIds.map(() => '?').join(',');
        count = db.queryOne(
          `SELECT COUNT(*) as cnt FROM messages WHERE appid IN (${placeholders}) AND created_at >= ? AND created_at < ?`,
          [...appIds, dayStart, dayEnd]
        ).cnt;
      }
      messagesByDay.push({
        date: d.toISOString().slice(0, 10),
        count,
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
    for (let h = 0; h < 24; h++) {
      let count = 0;
      if (appIds.length > 0) {
        const placeholders = appIds.map(() => '?').join(',');
        count = db.queryOne(
          `SELECT COUNT(*) as cnt FROM messages WHERE appid IN (${placeholders}) AND CAST(strftime('%H', created_at) AS INTEGER) = ?`,
          [...appIds, h]
        ).cnt;
      }
      messagesByHour.push({ hour: h, count });
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
