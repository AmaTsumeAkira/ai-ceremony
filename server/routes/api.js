const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');

const router = express.Router();

// multer 配置：上传到 uploads/ 目录
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `face_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  },
});

// POST /api/user/register — 注册用户
router.post('/user/register', (req, res) => {
  const { nickname } = req.body;
  if (!nickname || !nickname.trim()) {
    return res.status(400).json({ error: 'nickname 不能为空' });
  }
  const stmt = db.prepare('INSERT INTO users (nickname) VALUES (?)');
  const result = stmt.run(nickname.trim());
  res.json({ id: result.lastInsertRowid, nickname: nickname.trim() });
});

// POST /api/user/upload-face — 上传头像文件
router.post('/user/upload-face', upload.single('face'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }
  const userId = req.body.user_id;
  const faceUrl = `/uploads/${req.file.filename}`;

  if (userId) {
    db.prepare('UPDATE users SET face_url = ? WHERE id = ?').run(faceUrl, userId);
  }

  const io = req.app.get('io');
  if (io) {
    io.emit('face:new', { user_id: userId ? Number(userId) : null, face_url: faceUrl });
  }

  res.json({ face_url: faceUrl });
});

// GET /api/faces — 获取所有已上传头像
router.get('/faces', (req, res) => {
  const rows = db.prepare(
    'SELECT id, nickname, face_url FROM users WHERE face_url IS NOT NULL ORDER BY created_at DESC'
  ).all();
  res.json(rows);
});

// GET /api/danmaku/recent — 最近50条弹幕
router.get('/danmaku/recent', (req, res) => {
  const rows = db.prepare(
    `SELECT d.id, d.user_id, u.nickname, d.content, d.color, d.created_at
     FROM danmaku d
     LEFT JOIN users u ON d.user_id = u.id
     ORDER BY d.created_at DESC
     LIMIT 50`
  ).all();
  res.json(rows.reverse()); // 按时间正序返回
});

// GET /api/system/state — 系统状态
router.get('/system/state', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM system_state').all();
  const state = {};
  for (const row of rows) {
    state[row.key] = row.value;
  }
  res.json(state);
});

// GET /api/stats — 统计数据
router.get('/stats', (req, res) => {
  const io = req.app.get('io');
  const onlineCount = io ? io.sockets.sockets.size : 0;
  const danmakuCount = db.prepare('SELECT COUNT(*) as count FROM danmaku').get().count;
  const faceCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE face_url IS NOT NULL").get().count;
  res.json({ online: onlineCount, danmaku: danmakuCount, faces: faceCount });
});

// POST /api/upload-background — 上传背景图片
const bgStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'background'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});
const bgUpload = multer({
  storage: bgStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  },
});

router.post('/upload-background', bgUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }
  const bgUrl = `/uploads/background/${req.file.filename}`;
  const io = req.app.get('io');
  if (io) {
    io.emit('display:background-changed', { url: bgUrl });
  }
  console.log(`[Background] uploaded: ${bgUrl}`);
  res.json({ url: bgUrl });
});

module.exports = router;
