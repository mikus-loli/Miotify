const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
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

  // SVG 是文本格式，无法通过 magic bytes 验证
  if (declaredExt === 'svg') {
    const content = buffer.toString('utf8').substring(0, 100).toLowerCase();
    if (!content.includes('<svg') && !content.includes('<?xml')) {
      return false;
    }
    return true;
  }

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
    const validExts = ['png', 'jpeg', 'jpg', 'gif', 'webp', 'svg+xml'];
    if (!validExts.includes(ext)) {
      throw new AppError('unsupported image type', 400);
    }

    const fileExt = ext === 'svg+xml' ? 'svg' : ext;
    const filename = `${uuidv4()}.${fileExt}`;
    const filepath = path.join(uploadDir, filename);

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (buffer.length > 2 * 1024 * 1024) {
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
    const existing = db.queryOne('SELECT id, image FROM applications WHERE id = ? AND user_id = ?', [id, req.user.id]);
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
    res.json({ message: 'application deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
