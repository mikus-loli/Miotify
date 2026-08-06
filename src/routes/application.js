const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const pluginManager = require('../plugins/manager');
const { authMiddleware } = require('../middleware/auth');
const { AppError } = require('../middleware/error');
const { formatAppResponse } = require('../utils/security');

const router = express.Router();

const uploadDir = path.join(path.dirname(config.dbPath), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

router.post('/application', authMiddleware, (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      throw new AppError('name is required', 400);
    }
    const token = uuidv4();
    db.run('INSERT INTO applications (token, name, description, user_id) VALUES (?, ?, ?, ?)', [
      token,
      name,
      description || '',
      req.user.id,
    ]);
    const app = db.queryOne('SELECT id, token, name, description, image, user_id, created_at FROM applications WHERE token = ?', [token]);
    // 创建时返回完整 token（仅此一次）
    // 触发 app:onCreate hook（不阻塞响应）
    pluginManager.executeHook('app:onCreate', { id: app.id, name: app.name, user_id: app.user_id }).catch(() => {});
    res.status(201).json(formatAppResponse(app, true));
  } catch (err) {
    next(err);
  }
});

router.get('/application', authMiddleware, (req, res, next) => {
  try {
    const apps = db.queryAll('SELECT id, token, name, description, image, user_id, created_at FROM applications WHERE user_id = ?', [req.user.id]);
    res.json(apps.map(app => formatAppResponse(app, false)));
  } catch (err) {
    next(err);
  }
});

router.get('/application/:id', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const app = db.queryOne('SELECT id, token, name, description, image, user_id, created_at FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!app) {
      throw new AppError('application not found', 404);
    }
    res.json(formatAppResponse(app, false));
  } catch (err) {
    next(err);
  }
});

// 获取完整 token：列表接口故意掩码防泄露，需要完整 token（配置青龙/NapCat 等）时单独拉取。
// 仅应用属主或管理员可查看。
router.get('/application/:id/token', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const app = db.queryOne('SELECT id, token, user_id FROM applications WHERE id = ?', [id]);
    if (!app || (app.user_id !== req.user.id && !req.user.admin)) {
      throw new AppError('application not found', 404);
    }
    res.json({ token: app.token });
  } catch (err) {
    next(err);
  }
});

router.put('/application/:id', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.queryOne('SELECT id FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      throw new AppError('application not found', 404);
    }
    const { name, description, image } = req.body;
    if (name) {
      db.run('UPDATE applications SET name = ? WHERE id = ?', [name, id]);
    }
    if (description !== undefined) {
      db.run('UPDATE applications SET description = ? WHERE id = ?', [description, id]);
    }
    if (image !== undefined) {
      // 仅允许服务端上传的 /uploads/ 路径或 http(s) 外部图片 URL，
      // 防止任意字符串（如 javascript:、file:、追踪像素）写入 image 字段
      const validImage = image === '' ||
        /^\/uploads\/[A-Za-z0-9._-]+$/.test(image) ||
        /^https?:\/\//i.test(image);
      if (!validImage) {
        throw new AppError('image must be an /uploads/ path or http(s) URL', 400);
      }
      db.run('UPDATE applications SET image = ? WHERE id = ?', [image, id]);
    }
    const app = db.queryOne('SELECT id, token, name, description, image, user_id, created_at FROM applications WHERE id = ?', [id]);
    res.json(formatAppResponse(app, false));
  } catch (err) {
    next(err);
  }
});

// 验证文件 magic bytes（文件头）以确保是真实图片
function validateImageBuffer(buffer, declaredExt) {
  const magicNumbers = {
    png: [0x89, 0x50, 0x4E, 0x47], // PNG: ‰PNG
    jpg: [0xFF, 0xD8, 0xFF],       // JPEG: ÿØÿ
    jpeg: [0xFF, 0xD8, 0xFF],
    gif: [0x47, 0x49, 0x46],       // GIF: GIF
    webp: [0x52, 0x49, 0x46, 0x46], // WebP: RIFF (check further for WEBP)
  };

  const expectedMagic = magicNumbers[declaredExt];
  if (!expectedMagic) return false;

  for (let i = 0; i < expectedMagic.length; i++) {
    if (buffer[i] !== expectedMagic[i]) {
      return false;
    }
  }

  // WebP 需要额外检查
  if (declaredExt === 'webp') {
    const webpMarker = buffer.slice(8, 12).toString('ascii');
    if (webpMarker !== 'WEBP') {
      return false;
    }
  }

  return true;
}

router.post('/application/:id/image', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.queryOne('SELECT id, image FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      throw new AppError('application not found', 404);
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('image/')) {
      throw new AppError('content-type must be an image type', 400);
    }

    const ext = contentType.split('/')[1] || 'png';
    // 注意：不允许 svg+xml —— SVG 可内嵌 <script>，直接访问 /uploads/xxx.svg 会执行脚本（存储型 XSS）
    const validExts = ['png', 'jpeg', 'jpg', 'gif', 'webp'];
    if (!validExts.includes(ext)) {
      throw new AppError('unsupported image type', 400);
    }

    const fileExt = ext;
    const filename = `${uuidv4()}.${fileExt}`;
    const filepath = path.join(uploadDir, filename);

    const chunks = [];
    let received = 0;
    let rejected = false;
    const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
    req.on('data', (chunk) => {
      if (rejected) return;
      received += chunk.length;
      // 流式限制：超过上限立即响应 400，并丢弃剩余请求体，避免超大 body 全量缓存进内存（内存 DoS）
      if (received > MAX_IMAGE_SIZE) {
        rejected = true;
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        req.resume(); // 继续消费请求体，让连接正常收尾（不缓存）
        res.status(400).json({ error: 'image size exceeds 2MB limit' });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        if (rejected) return;
        const buffer = Buffer.concat(chunks);
        // 兜底校验（正常流程已在 data 阶段拦截）
        if (buffer.length > MAX_IMAGE_SIZE) {
          throw new AppError('image size exceeds 2MB limit', 400);
        }

        // 验证文件内容是否匹配声明的类型
        if (!validateImageBuffer(buffer, fileExt)) {
          throw new AppError('file content does not match declared image type', 400);
        }

        fs.writeFileSync(filepath, buffer);

        if (existing.image) {
          const oldPath = path.join(uploadDir, path.basename(existing.image));
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }

        const imageUrl = `/uploads/${filename}`;
        db.run('UPDATE applications SET image = ? WHERE id = ?', [imageUrl, id]);
        const app = db.queryOne('SELECT id, token, name, description, image, user_id, created_at FROM applications WHERE id = ?', [id]);
        res.json(formatAppResponse(app, false));
      } catch (err) {
        next(err);
      }
    });
    req.on('error', (err) => next(err));
  } catch (err) {
    next(err);
  }
});

router.delete('/application/:id/image', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.queryOne('SELECT id, image FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      throw new AppError('application not found', 404);
    }
    if (existing.image) {
      const oldPath = path.join(uploadDir, path.basename(existing.image));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
      db.run('UPDATE applications SET image = ? WHERE id = ?', ['', id]);
    }
    const app = db.queryOne('SELECT id, token, name, description, image, user_id, created_at FROM applications WHERE id = ?', [id]);
    res.json(formatAppResponse(app, false));
  } catch (err) {
    next(err);
  }
});

router.delete('/application/:id', authMiddleware, (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = db.queryOne('SELECT id, name, image FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      throw new AppError('application not found', 404);
    }
    if (existing.image) {
      const oldPath = path.join(uploadDir, path.basename(existing.image));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    db.run('DELETE FROM applications WHERE id = ?', [id]);
    // 触发 app:onDelete hook（不阻塞响应）
    pluginManager.executeHook('app:onDelete', { id, name: existing.name }).catch(() => {});
    res.json({ message: 'application deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
