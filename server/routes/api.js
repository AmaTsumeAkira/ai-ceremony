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
    const allowedExt = /\.(jpg|jpeg|png|gif|webp)$/i;
    const allowedMime = /^image\/(jpeg|png|gif|webp)$/i;
    if (allowedExt.test(path.extname(file.originalname)) && allowedMime.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  },
});

// 导出端点认证中间件（必须在使用它的路由之前定义）
function requireExportAuth(req, res, next) {
  if (!process.env.CONTROL_PASSWORD) {
    return res.status(500).json({ error: '服务器未配置 CONTROL_PASSWORD' });
  }
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.CONTROL_PASSWORD}`) {
    return res.status(401).json({ error: '未认证' });
  }
  next();
}

// POST /api/user/register — 注册用户
router.post('/user/register', (req, res) => {
  const { nickname } = req.body;
  if (!nickname || !nickname.trim()) {
    return res.status(400).json({ error: 'nickname 不能为空' });
  }
  if (nickname.trim().length > 12) {
    return res.status(400).json({ error: '昵称不能超过 12 个字符' });
  }
  // 昵称去重：若已存在则追加数字后缀
  let finalNickname = nickname.trim();
  const existing = db.prepare('SELECT nickname FROM users WHERE nickname = ?').get(finalNickname);
  if (existing) {
    let suffix = 2;
    while (db.prepare('SELECT nickname FROM users WHERE nickname = ?').get(`${finalNickname}_${suffix}`)) {
      suffix++;
    }
    finalNickname = `${finalNickname}_${suffix}`;
  }
  const stmt = db.prepare('INSERT INTO users (nickname) VALUES (?)');
  const result = stmt.run(finalNickname);
  res.json({ id: result.lastInsertRowid, nickname: finalNickname });
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

// GET /api/users — 获取所有注册用户（含头像和无头像的）
router.get('/users', (req, res) => {
  const rows = db.prepare(
    'SELECT id, nickname, face_url, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(rows);
});

// GET /api/faces — 获取所有已上传头像（大屏端需要公开访问）
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

// GET /api/danmaku/leaderboard — 弹幕排行榜
router.get('/danmaku/leaderboard', (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
  const rows = db.prepare(
    `SELECT u.id, u.nickname, u.face_url, COUNT(d.id) as danmaku_count
     FROM danmaku d
     INNER JOIN users u ON d.user_id = u.id
     WHERE u.nickname IS NOT NULL
     GROUP BY d.user_id
     ORDER BY danmaku_count DESC
     LIMIT ?`
  ).all(limit);
  res.json(rows);
});

// GET /api/blessings/recent — 最近30条祝福
router.get('/blessings/recent', (req, res) => {
  const rows = db.prepare(
    'SELECT id, nickname, content, created_at FROM blessings ORDER BY created_at DESC LIMIT 30'
  ).all();
  res.json(rows.reverse());
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

// GET /api/emoji/stats — Emoji 反应统计（需认证）
router.get('/emoji/stats', requireExportAuth, (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT event_data, COUNT(*) as cnt 
       FROM ceremony_logs 
       WHERE event_type = 'emoji_send' 
       GROUP BY event_data 
       ORDER BY cnt DESC 
       LIMIT 20`
    ).all();
    const stats = rows.map(r => {
      let emoji = r.event_data;
      try { const p = JSON.parse(r.event_data); emoji = p.emoji; } catch {}
      return { emoji, count: r.cnt };
    });
    const totalCount = db.prepare("SELECT COUNT(*) as c FROM ceremony_logs WHERE event_type = 'emoji_send'").get().c;
    res.json({ stats, total: totalCount });
  } catch {
    res.json({ stats: [], total: 0 });
  }
});

// GET /api/stats — 统计数据（需认证）
router.get('/stats', requireExportAuth, (req, res) => {
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
    const allowedExt = /\.(jpg|jpeg|png|gif|webp)$/i;
    const allowedMime = /^image\/(jpeg|png|gif|webp)$/i;
    if (allowedExt.test(path.extname(file.originalname)) && allowedMime.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件'));
    }
  },
});

router.post('/upload-background', requireExportAuth, bgUpload.single('image'), (req, res) => {
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

// GET /api/logs — 活动日志（最近100条，需认证）
router.get('/logs', requireExportAuth, (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
  const type = req.query.type; // optional filter by event_type
  let rows;
  if (type) {
    rows = db.prepare(
      'SELECT id, event_type, event_data, created_at FROM ceremony_logs WHERE event_type = ? ORDER BY id DESC LIMIT ?'
    ).all(type, limit);
  } else {
    rows = db.prepare(
      'SELECT id, event_type, event_data, created_at FROM ceremony_logs ORDER BY id DESC LIMIT ?'
    ).all(limit);
  }
  res.json(rows.reverse()); // 时间正序
});

// DELETE /api/logs — 清空活动日志
router.delete('/logs', requireExportAuth, (req, res) => {
  db.prepare('DELETE FROM ceremony_logs').run();
  res.json({ ok: true });
});

// GET /api/leaderboard/checkin — 签到排行榜（按注册顺序/速度排名）
router.get('/leaderboard/checkin', (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
  try {
    // 获取第一个用户的注册时间作为基准
    const firstUser = db.prepare('SELECT created_at FROM users ORDER BY created_at ASC LIMIT 1').get();
    if (!firstUser) return res.json([]);

    const baseTime = new Date(firstUser.created_at).getTime();
    const rows = db.prepare(`
      SELECT id, nickname, face_url, created_at,
        (SELECT COUNT(*) FROM danmaku d WHERE d.user_id = u.id) AS danmaku_count
      FROM users
      WHERE nickname IS NOT NULL
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit);

    const result = rows.map((row, index) => {
      const checkinTime = new Date(row.created_at).getTime();
      const speedSeconds = Math.round((checkinTime - baseTime) / 1000);
      return {
        rank: index + 1,
        id: row.id,
        nickname: row.nickname,
        face_url: row.face_url,
        created_at: row.created_at,
        danmaku_count: row.danmaku_count,
        speed_seconds: speedSeconds,
        speed_label: speedSeconds < 60
          ? `${speedSeconds}秒`
          : `${Math.floor(speedSeconds / 60)}分${speedSeconds % 60}秒`,
      };
    });
    res.json(result);
  } catch (e) {
    res.json([]);
  }
});

// GET /api/leaderboard/active-users — 活跃用户排行榜（需认证）
router.get('/leaderboard/active-users', requireExportAuth, (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));
  try {
    const rows = db.prepare(`
      SELECT u.id, u.nickname, u.face_url,
        (SELECT COUNT(*) FROM danmaku d WHERE d.user_id = u.id) +
        (SELECT COUNT(*) FROM ceremony_logs cl WHERE cl.event_type = 'emoji_send'
          AND JSON_EXTRACT(cl.event_data, '$.nickname') = u.nickname) +
        (CASE WHEN u.face_url IS NOT NULL THEN 1 ELSE 0 END) AS total_interactions
      FROM users u
      WHERE (SELECT COUNT(*) FROM danmaku d WHERE d.user_id = u.id) +
        (SELECT COUNT(*) FROM ceremony_logs cl WHERE cl.event_type = 'emoji_send'
          AND JSON_EXTRACT(cl.event_data, '$.nickname') = u.nickname) +
        (CASE WHEN u.face_url IS NOT NULL THEN 1 ELSE 0 END) > 0
      ORDER BY total_interactions DESC
      LIMIT ?
    `).all(limit);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

// GET /api/export/users — 导出用户数据为 CSV
router.get('/export/users', requireExportAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT u.id, u.nickname, u.face_url, u.created_at,
            (SELECT COUNT(*) FROM danmaku d WHERE d.user_id = u.id) as danmaku_count
     FROM users u ORDER BY u.id ASC`
  ).all();

  // BOM for Excel Chinese support
  let csv = '\uFEFFID,昵称,头像URL,注册时间,弹幕数\n';
  for (const row of rows) {
    csv += `${row.id},"${(row.nickname || '').replace(/"/g, '""')}","${row.face_url || ''}","${row.created_at}",${row.danmaku_count}\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=users_export_${Date.now()}.csv`);
  res.send(csv);
});

// GET /api/export/danmaku — 导出弹幕数据为 CSV
router.get('/export/danmaku', requireExportAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT d.id, d.user_id, u.nickname, d.content, d.color, d.created_at
     FROM danmaku d LEFT JOIN users u ON d.user_id = u.id
     ORDER BY d.id ASC`
  ).all();

  let csv = '\uFEFFID,用户ID,昵称,内容,颜色,发送时间\n';
  for (const row of rows) {
    csv += `${row.id},${row.user_id || ''},"${(row.nickname || '匿名').replace(/"/g, '""')}","${(row.content || '').replace(/"/g, '""')}","${row.color || '#ffffff'}","${row.created_at}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=danmaku_export_${Date.now()}.csv`);
  res.send(csv);
});

// GET /api/export/checkin — 批量导出签到记录为 CSV
router.get('/export/checkin', requireExportAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT u.id, u.nickname, u.face_url, u.created_at AS registered_at,
            (SELECT COUNT(*) FROM danmaku d WHERE d.user_id = u.id) AS danmaku_count,
            (SELECT COUNT(*) FROM ceremony_logs cl WHERE cl.event_type = 'emoji_send'
             AND JSON_EXTRACT(cl.event_data, '$.nickname') = u.nickname) AS emoji_count,
            CASE WHEN u.face_url IS NOT NULL THEN '是' ELSE '否' END AS has_avatar
     FROM users u
     ORDER BY u.created_at ASC`
  ).all();

  let csv = '\uFEFF序号,用户ID,昵称,是否上传头像,注册时间,弹幕数,Emoji数\n';
  rows.forEach((row, index) => {
    csv += `${index + 1},${row.id},"${(row.nickname || '').replace(/"/g, '""')}","${row.has_avatar}","${row.registered_at}",${row.danmaku_count},${row.emoji_count}\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=checkin_export_${Date.now()}.csv`);
  res.send(csv);
});

// multer 错误处理中间件
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超出限制' });
    }
    return res.status(400).json({ error: `上传错误: ${err.message}` });
  }
  if (err && err.message === '只支持图片文件') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
