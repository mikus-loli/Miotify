const express = require('express');
const pluginManager = require('../plugins/manager');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { AppError } = require('../middleware/error');

const router = express.Router();

router.get('/plugins', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const plugins = pluginManager.getPlugins();
    res.json(plugins.map(p => ({
      ...p,
      enabled: !!p.enabled,
      config: JSON.parse(p.config || '{}'),
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/plugin/:id', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const plugin = pluginManager.getPlugin(req.params.id);
    if (!plugin) {
      throw new AppError('plugin not found', 404);
    }
    res.json({
      ...plugin,
      enabled: !!plugin.enabled,
      config: JSON.parse(plugin.config || '{}'),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/plugin/:id/enabled', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      throw new AppError('enabled must be a boolean', 400);
    }
    const plugin = pluginManager.setPluginEnabled(req.params.id, enabled);
    if (!plugin) {
      throw new AppError('plugin not found', 404);
    }
    res.json({
      ...plugin,
      enabled: !!plugin.enabled,
      config: JSON.parse(plugin.config || '{}'),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/plugin/:id/config', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const plugin = pluginManager.setPluginConfig(req.params.id, req.body);
    if (!plugin) {
      throw new AppError('plugin not found', 404);
    }
    res.json({
      ...plugin,
      enabled: !!plugin.enabled,
      config: JSON.parse(plugin.config || '{}'),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/plugin/:id/priority', authMiddleware, adminMiddleware, (req, res, next) => {
  try {
    const { priority } = req.body;
    if (typeof priority !== 'number') {
      throw new AppError('priority must be a number', 400);
    }
    const plugin = pluginManager.setPluginPriority(req.params.id, priority);
    if (!plugin) {
      throw new AppError('plugin not found', 404);
    }
    res.json({
      ...plugin,
      enabled: !!plugin.enabled,
      config: JSON.parse(plugin.config || '{}'),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
