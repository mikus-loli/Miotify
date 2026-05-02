const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/logs', authMiddleware, (req, res) => {
  try {
    const level = req.query.level || null;
    const category = req.query.category || null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;

    const logs = db.getLogs({ level, category, limit, offset });
    const total = db.getLogCount({ level, category });

    res.json({ logs, total, limit, offset });
  } catch (err) {
    console.error('[Logs API Error]', err);
    res.status(500).json({ error: '获取日志失败' });
  }
});

router.delete('/logs', authMiddleware, (req, res) => {
  try {
    if (!req.user.admin) {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    const deleted = db.clearLogs();
    db.addLog({
      level: 'info',
      category: 'system',
      action: 'clear_logs',
      message: `清理了所有日志`,
      details: { deletedCount: deleted },
      userId: req.user.id,
      userName: req.user.name,
    });
    res.json({ message: '日志已清理', deleted });
  } catch (err) {
    console.error('[Logs API Error]', err);
    res.status(500).json({ error: '清理日志失败' });
  }
});

router.get('/logs/stats', authMiddleware, (req, res) => {
  try {
    const levelStats = db.queryAll(
      "SELECT level, COUNT(*) as cnt FROM logs GROUP BY level"
    );
    const categoryStats = db.queryAll(
      "SELECT category, COUNT(*) as cnt FROM logs GROUP BY category ORDER BY cnt DESC LIMIT 10"
    );
    const recentCount = db.queryOne(
      "SELECT COUNT(*) as cnt FROM logs WHERE date(created_at) >= date('now', '-1 day')"
    ).cnt;

    res.json({
      levelStats: levelStats.reduce((acc, r) => { acc[r.level] = r.cnt; return acc; }, {}),
      categoryStats,
      recentCount,
    });
  } catch (err) {
    console.error('[Logs API Error]', err);
    res.status(500).json({ error: '获取日志统计失败' });
  }
});

module.exports = router;
