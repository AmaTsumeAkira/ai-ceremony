const db = require('../db');

// 重建能量系统状态（从数据库加载）
let energy = 0;
let threshold = (() => {
  try {
    const row = db.prepare("SELECT value FROM system_state WHERE key = 'threshold'").get();
    return row ? Number(row.value) : 1000;
  } catch { return 1000; }
})();
let decayInterval = null;
let countdownToken = null; // 倒计时完成时 display 端需提供的令牌

// ========== 弹幕速率限制 ==========
const danmakuRateLimit = new Map(); // socketId -> { count, windowStart }
const DANMAKU_MAX_PER_SEC = 3;

function checkDanmakuRate(socketId) {
  const now = Date.now();
  const entry = danmakuRateLimit.get(socketId);
  if (!entry || now - entry.windowStart > 1000) {
    danmakuRateLimit.set(socketId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= DANMAKU_MAX_PER_SEC) return false;
  entry.count++;
  return true;
}

// ========== Emoji 速率限制 ==========
const emojiRateLimit = new Map(); // socketId -> { count, windowStart }
const EMOJI_MAX_PER_SEC = 3;

// ========== 祝福速率限制 ==========
const blessingRateLimit = new Map(); // socketId -> { count, windowStart }

function checkEmojiRate(socketId) {
  const now = Date.now();
  const entry = emojiRateLimit.get(socketId);
  if (!entry || now - entry.windowStart > 1000) {
    emojiRateLimit.set(socketId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= EMOJI_MAX_PER_SEC) return false;
  entry.count++;
  return true;
}

// ========== 活动日志 ==========
function logEvent(eventType, eventData) {
  try {
    const dataStr = typeof eventData === 'object' ? JSON.stringify(eventData) : String(eventData || '');
    db.prepare('INSERT INTO ceremony_logs (event_type, event_data) VALUES (?, ?)').run(eventType, dataStr);
    // 保留最近 2000 条
    db.prepare(`DELETE FROM ceremony_logs WHERE id NOT IN (SELECT id FROM ceremony_logs ORDER BY id DESC LIMIT 2000)`).run();
  } catch (e) { /* ignore */ }
}

// ========== 认证状态 ==========
const authenticatedSockets = new Set();

function getEnergyProgress() {
  return Math.min(100, Math.floor((energy / threshold) * 100));
}

function broadcastState(io) {
  const rows = db.prepare('SELECT key, value FROM system_state').all();
  const state = {};
  for (const row of rows) state[row.key] = row.value;
  state.energy = String(Math.round(isNaN(energy) ? 0 : energy));
  state.threshold = String(isNaN(threshold) ? 1000 : threshold);
  io.emit('control:state', state);
}

function broadcastUsersCount(io) {
  io.emit('control:users-count', io.sockets.sockets.size);
  // Broadcast online user list for display page
  const users = [];
  for (const [, s] of io.sockets.sockets) {
    if (s.userType === 'user' && s.userNickname) {
      users.push({ id: s.userId, nickname: s.userNickname });
    }
  }
  io.emit('display:online-users', users);
}

function setupSocket(io) {
  // 每秒衰减能量
  if (!decayInterval) {
    decayInterval = setInterval(() => {
      if (energy > 0) {
        energy = Math.max(0, energy - 5);
        io.emit('shatter:progress', getEnergyProgress());
      }
    }, 1000);
  }

  // 定期清理过期的弹幕速率限制条目（防止内存泄漏）
  const rateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of danmakuRateLimit) {
      if (now - entry.windowStart > 5000) {
        danmakuRateLimit.delete(id);
      }
    }
    for (const [id, entry] of emojiRateLimit) {
      if (now - entry.windowStart > 5000) {
        emojiRateLimit.delete(id);
      }
    }
    for (const [id, entry] of blessingRateLimit) {
      if (now - entry.windowStart > 10000) {
        blessingRateLimit.delete(id);
      }
    }
  }, 30000);

  // 清理 interval 防止进程退出时悬挂
  const cleanup = () => {
    clearInterval(rateLimitCleanup);
    if (decayInterval) {
      clearInterval(decayInterval);
      decayInterval = null;
    }
  };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  io.on('connection', (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);
    broadcastUsersCount(io);

    // ========== 认证 ==========
    socket.on('control:auth', (data) => {
      const { password } = data || {};
      if (password === process.env.CONTROL_PASSWORD) {
        authenticatedSockets.add(socket.id);
        socket.emit('control:auth-result', { ok: true });
        console.log(`[Auth] control authenticated: ${socket.id}`);
      } else {
        socket.emit('control:auth-result', { ok: false, message: '密码错误' });
        console.log(`[Auth] control auth failed: ${socket.id}`);
      }
    });

    // 控制端权限检查
    function requireAuth(fn) {
      return (...args) => {
        if (!authenticatedSockets.has(socket.id)) {
          socket.emit('error', { message: '未认证，请先输入密码' });
          return;
        }
        fn(...args);
      };
    }

    // ========== 用户端事件 ==========

    socket.on('user:join', (data) => {
      try {
        const { nickname, reconnectUserId } = data;
        
        // 断线重连：尝试恢复已有身份
        if (reconnectUserId) {
          const existing = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(reconnectUserId);
          if (existing) {
            db.prepare('UPDATE users SET socket_id = ? WHERE id = ?').run(socket.id, existing.id);
            socket.userId = existing.id;
            socket.userNickname = existing.nickname;
            socket.userType = 'user';
            socket.join('users');
            socket.emit('user:reconnected', { id: existing.id, nickname: existing.nickname });
            broadcastUsersCount(io);
            console.log(`[User] reconnected: ${existing.nickname} (id=${existing.id})`);
            return;
          }
          // reconnectUserId 无效，忽略该参数继续正常注册流程
          console.log(`[User] reconnectUserId ${reconnectUserId} not found, registering new user`);
        }
        
        if (!nickname || !nickname.trim()) {
          return socket.emit('error', { message: 'nickname 不能为空' });
        }
        if (nickname.trim().length > 12) {
          return socket.emit('error', { message: '昵称不能超过 12 个字符' });
        }
        if (nickname.trim().length < 1) {
          return socket.emit('error', { message: '昵称不能为空' });
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

        const stmt = db.prepare(
          'INSERT INTO users (nickname, socket_id) VALUES (?, ?)'
        );
        const result = stmt.run(finalNickname, socket.id);
        socket.userId = result.lastInsertRowid;
        socket.userNickname = finalNickname;
        socket.userType = 'user';
        socket.join('users');

        socket.emit('user:joined', { id: result.lastInsertRowid, nickname: finalNickname });
        broadcastUsersCount(io);
        logEvent('user_join', { nickname: finalNickname, id: result.lastInsertRowid });
        console.log(`[User] ${finalNickname} joined, id=${result.lastInsertRowid}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ========== 修改昵称 ==========
    socket.on('user:change-nickname', (data) => {
      try {
        if (!socket.userId) {
          return socket.emit('error', { message: '请先注册' });
        }
        const { nickname } = data;
        if (!nickname || !nickname.trim()) {
          return socket.emit('user:nickname-changed', { ok: false, message: '昵称不能为空' });
        }
        const trimmed = nickname.trim();
        if (trimmed.length > 12) {
          return socket.emit('user:nickname-changed', { ok: false, message: '昵称不能超过 12 个字符' });
        }
        if (trimmed === socket.userNickname) {
          return socket.emit('user:nickname-changed', { ok: false, message: '新昵称与当前昵称相同' });
        }
        // 检查昵称是否已被占用
        const existing = db.prepare('SELECT id, nickname FROM users WHERE nickname = ?').get(trimmed);
        if (existing && existing.id !== socket.userId) {
          return socket.emit('user:nickname-changed', { ok: false, message: '该昵称已被占用' });
        }
        db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(trimmed, socket.userId);
        const oldNickname = socket.userNickname;
        socket.userNickname = trimmed;
        socket.emit('user:nickname-changed', { ok: true, nickname: trimmed });
        broadcastUsersCount(io);
        logEvent('nickname_change', { old: oldNickname, new: trimmed, id: socket.userId });
        console.log(`[User] nickname changed: ${oldNickname} → ${trimmed} (id=${socket.userId})`);
      } catch (err) {
        socket.emit('user:nickname-changed', { ok: false, message: err.message });
      }
    });

    socket.on('user:upload-face', async (data) => {
      try {
        const { base64, filename } = data;
        if (!base64) return socket.emit('error', { message: '无图片数据' });

        const fs = require('fs').promises;
        const path = require('path');

        const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches) return socket.emit('error', { message: 'base64 格式错误' });

        // 防止超大 payload 拒绝服务：先检查 base64 字符串长度（约 6.7MB 对应 5MB 原图）
        if (matches[2].length > 5 * 1024 * 1024 * 4 / 3) {
          return socket.emit('error', { message: '图片数据过大，不能超过 5MB' });
        }

        const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const imgExt = matches[1].split('/')[1] === 'jpeg' ? 'jpg' : matches[1].split('/')[1];
        if (!allowedTypes.includes(imgExt)) {
          return socket.emit('error', { message: '只支持 jpg/png/gif/webp 格式' });
        }

        const ext = imgExt;
        const buffer = Buffer.from(matches[2], 'base64');
        // 限制图片大小 5MB
        if (buffer.length > 5 * 1024 * 1024) {
          return socket.emit('error', { message: '图片不能超过 5MB' });
        }
        const fname = `face_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filepath = path.join(__dirname, '..', 'uploads', fname);

        await fs.writeFile(filepath, buffer);

        const faceUrl = `/uploads/${fname}`;
        if (socket.userId) {
          db.prepare('UPDATE users SET face_url = ? WHERE id = ?').run(faceUrl, socket.userId);
        }

        socket.emit('face:uploaded', { face_url: faceUrl });
        io.emit('face:new', { user_id: socket.userId || null, face_url: faceUrl, nickname: socket.userNickname });
        logEvent('face_upload', { nickname: socket.userNickname, face_url: faceUrl });
        console.log(`[Face] uploaded by ${socket.userNickname}: ${faceUrl}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('danmaku:send', (data) => {
      try {
        if (!checkDanmakuRate(socket.id)) {
          return socket.emit('error', { message: '弹幕发送太快了，请稍候' });
        }
        const { content, color } = data;
        if (!content || !content.trim()) {
          return socket.emit('error', { message: '弹幕内容不能为空' });
        }
        if (content.trim().length > 100) {
          return socket.emit('error', { message: '弹幕内容不能超过 100 个字符' });
        }
        const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#ffffff';

        const stmt = db.prepare(
          'INSERT INTO danmaku (user_id, content, color) VALUES (?, ?, ?)'
        );
        const result = stmt.run(socket.userId || null, content.trim(), safeColor);

        const danmaku = {
          id: result.lastInsertRowid,
          user_id: socket.userId,
          nickname: socket.userNickname || '匿名',
          content: content.trim(),
          color: safeColor,
          created_at: new Date().toISOString(),
        };

        io.emit('danmaku:new', danmaku);
        logEvent('danmaku', { nickname: danmaku.nickname, content: content.trim() });
        console.log(`[Danmaku] ${danmaku.nickname}: ${content.trim()}`);

        db.prepare(`
          DELETE FROM danmaku WHERE id NOT IN (
            SELECT id FROM danmaku ORDER BY id DESC LIMIT 80
          )
        `).run();
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ========== 控制端事件（需认证） ==========

    socket.on('control:register', () => {
      socket.userType = 'control';
      socket.join('control');
      // 检查是否已认证
      const isAuth = authenticatedSockets.has(socket.id);
      socket.emit('control:registered', { message: '控制端已连接', authenticated: isAuth });
      broadcastState(io);
      broadcastUsersCount(io);
      console.log(`[Control] registered: ${socket.id} (auth: ${isAuth})`);
    });

    socket.on('control:shatter', requireAuth(() => {
      db.prepare("UPDATE system_state SET value = 'shatter' WHERE key = 'mode'").run();
      energy = 0;
      io.emit('shatter:start');
      io.emit('shatter:progress', 0);
      broadcastState(io);
      logEvent('shatter', { action: 'trigger' });
      console.log('[Control] shatter triggered');
    }));

    socket.on('control:rebuild', requireAuth(() => {
      db.prepare("UPDATE system_state SET value = 'rebuild' WHERE key = 'mode'").run();
      energy = threshold;
      io.emit('shatter:progress', 100);
      io.emit('mode:changed', { mode: 'rebuild' });
      broadcastState(io);
      logEvent('rebuild', { action: 'trigger' });
      console.log('[Control] rebuild triggered');
    }));

    socket.on('display:register', () => {
      socket.userType = 'display';
      socket.join('display');
      socket.emit('display:registered', { message: '大屏已连接' });
      broadcastState(io);
      broadcastUsersCount(io);
      console.log(`[Display] registered: ${socket.id}`);
    });

    // 能量阈值设置
    socket.on('control:set-energy-threshold', requireAuth((data) => {
      const { value } = data;
      if (typeof value === 'number' && value > 0) {
        threshold = value;
        db.prepare("UPDATE system_state SET value = ? WHERE key = 'threshold'").run(String(value));
        broadcastState(io);
        console.log(`[Control] energy threshold set to ${value}`);
      }
    }));

    socket.on('control:clear-danmaku', requireAuth(() => {
      db.prepare('DELETE FROM danmaku').run();
      io.emit('danmaku:cleared');
      broadcastState(io);
      console.log('[Control] danmaku cleared');
    }));

    socket.on('control:set-mode', requireAuth((data) => {
      const { mode } = data;
      const validModes = ['idle', 'shatter', 'rebuild', 'mosaic', 'danmaku', 'climax'];
      if (validModes.includes(mode)) {
        db.prepare("UPDATE system_state SET value = ? WHERE key = 'mode'").run(mode);
        io.emit('mode:changed', { mode });
        broadcastState(io);
        logEvent('mode_change', { mode });
        console.log(`[Control] mode set to ${mode}`);
      }
    }));

    // ========== 主持稿阶段 ==========
    socket.on('control:set-agenda', requireAuth((data) => {
      const { stage } = data;
      const stages = {
        welcome:  { mode: 'idle',    text: '欢迎来到第三届AIGC数字素养大赛', label: '开场前' },
        review:   { mode: 'idle',    text: '数跃新阶', label: '循迹·往届回顾' },
        route:    { mode: 'speaker', text: '第三届AIGC数字素养大赛', label: '定航·赛道介绍' },
        inspire:  { mode: 'speaker', text: '数智进阶', label: '赋能·领导致辞' },
        launch:   { mode: 'climax',  text: '启动仪式', label: '启跃·启动仪式' },
        closing:  { mode: 'idle',    text: '谢谢大家', label: '合影留念' },
      };
      const s = stages[stage];
      if (s) {
        db.prepare("UPDATE system_state SET value = ? WHERE key = 'mode'").run(s.mode);
        db.prepare("UPDATE system_state SET value = ? WHERE key = 'agenda'").run(stage);
        if (s.text) {
          db.prepare("UPDATE system_state SET value = ? WHERE key = 'particleText'").run(s.text);
          io.emit('display:text-changed', { text: s.text });
        }
        if (s.mode === 'shatter' || s.mode === 'climax') {
          energy = 0;
          io.emit('shatter:start');
          io.emit('shatter:progress', 0);
        } else if (s.mode === 'rebuild') {
          energy = threshold;
          io.emit('shatter:progress', 100);
        }
        io.emit('mode:changed', { mode: s.mode });
        io.emit('agenda:changed', { stage, label: s.label });
        broadcastState(io);
        logEvent('agenda', { stage, label: s.label });
        console.log(`[Control] agenda stage: ${stage} (${s.label})`);
      }
    }));

    // ========== 自定义粒子文字 ==========
    socket.on('control:set-text', requireAuth((data) => {
      const { text } = data;
      if (typeof text === 'string' && text.trim()) {
        db.prepare("UPDATE system_state SET value = ? WHERE key = 'particleText'").run(text.trim());
        io.emit('display:text-changed', { text: text.trim() });
        broadcastState(io);
        console.log(`[Control] particle text set to: ${text.trim()}`);
      }
    }));

    // ========== Emoji 飘屏 ==========
    socket.on('emoji:send', (data) => {
      if (!checkEmojiRate(socket.id)) {
        return socket.emit('error', { message: 'Emoji 发送太快了，请稍候' });
      }
      const { emoji } = data;
      if (typeof emoji === 'string' && emoji.trim()) {
        io.emit('emoji:float', {
          emoji: emoji.trim(),
          nickname: socket.userNickname || '匿名',
          x: 0.2 + Math.random() * 0.6,
        });
        logEvent('emoji_send', { emoji: emoji.trim(), nickname: socket.userNickname || '匿名' });
        // 更新 emoji 统计并广播
        try {
          const emojiStats = db.prepare(
            `SELECT event_data, COUNT(*) as cnt FROM ceremony_logs WHERE event_type = 'emoji_send' GROUP BY event_data ORDER BY cnt DESC LIMIT 10`
          ).all();
          const stats = emojiStats.map(r => {
            let em = r.event_data;
            try { const p = JSON.parse(r.event_data); em = p.emoji; } catch {}
            return { emoji: em, count: r.cnt };
          });
          const totalCount = db.prepare("SELECT COUNT(*) as c FROM ceremony_logs WHERE event_type = 'emoji_send'").get().c;
          io.emit('emoji:stats', { stats, total: totalCount });
        } catch {}
        console.log(`[Emoji] ${socket.userNickname || '匿名'}: ${emoji.trim()}`);
      }
    });

    // ========== 祝福墙 ==========
    function checkBlessingRate(socketId) {
      const now = Date.now();
      const entry = blessingRateLimit.get(socketId);
      if (!entry || now - entry.windowStart > 5000) {
        blessingRateLimit.set(socketId, { count: 1, windowStart: now });
        return true;
      }
      return false;
    }

    // 用户发送祝福
    socket.on('blessing:send', (data) => {
      try {
        if (!socket.userId) {
          return socket.emit('error', { message: '请先注册' });
        }
        if (!checkBlessingRate(socket.id)) {
          return socket.emit('error', { message: '发送太频繁，请稍候' });
        }
        const { content } = data;
        if (!content || !content.trim()) {
          return socket.emit('error', { message: '祝福内容不能为空' });
        }
        const text = content.trim();
        if (text.length > 80) {
          return socket.emit('error', { message: '祝福内容不能超过 80 个字符' });
        }

        const stmt = db.prepare(
          'INSERT INTO blessings (user_id, nickname, content) VALUES (?, ?, ?)'
        );
        const result = stmt.run(socket.userId, socket.userNickname, text);

        const blessing = {
          id: result.lastInsertRowid,
          user_id: socket.userId,
          nickname: socket.userNickname,
          content: text,
          created_at: new Date().toISOString(),
        };

        // 自动批准，直接广播到大屏
        io.emit('blessing:new', blessing);
        logEvent('blessing', { nickname: socket.userNickname, content: text });
        socket.emit('blessing:sent', { ok: true, id: result.lastInsertRowid });
        console.log(`[Blessing] ${socket.userNickname}: ${text}`);

        // 保留最近 200 条祝福
        db.prepare(`DELETE FROM blessings WHERE id NOT IN (SELECT id FROM blessings ORDER BY id DESC LIMIT 200)`).run();
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // 获取当前祝福列表（用户端加入时请求）
    socket.on('blessing:get-recent', () => {
      try {
        const rows = db.prepare(
          'SELECT id, nickname, content, created_at FROM blessings ORDER BY created_at DESC LIMIT 30'
        ).all();
        socket.emit('blessing:recent', rows.reverse());
      } catch {}
    });

    // 控制端清空祝福
    socket.on('control:clear-blessings', requireAuth(() => {
      db.prepare('DELETE FROM blessings').run();
      io.emit('blessing:cleared');
      broadcastState(io);
      logEvent('blessing_clear', { action: 'cleared' });
      console.log('[Control] blessings cleared');
    }));

    // ========== 系统消息 ==========
    socket.on('control:system-message', requireAuth((data) => {
      const { text } = data;
      if (typeof text === 'string' && text.trim()) {
        io.to('users').emit('system:message', {
          text: text.trim(),
          timestamp: Date.now(),
        });
        logEvent('system_message', { text: text.trim() });
        console.log(`[System] message sent: "${text.trim()}"`);
      }
    }));

    // ========== 自定义背景 ==========
    socket.on('control:set-background', requireAuth((data) => {
      const { url } = data;
      if (typeof url === 'string') {
        db.prepare("UPDATE system_state SET value = ? WHERE key = 'background'").run(url);
        io.emit('display:background-changed', { url });
        broadcastState(io);
        console.log(`[Control] background set to: ${url}`);
      }
    }));

    // ========== 麦克风音量 ==========
    socket.on('control:voice-level', requireAuth((data) => {
      const { level, threshold: shoutThreshold } = data;
      // shoutThreshold: 音量门限，低于此值不计入能量
      const minLevel = typeof shoutThreshold === 'number' ? shoutThreshold : 0;
      if (typeof level === 'number' && level >= 0 && level <= 100 && level >= minLevel) {
        energy += level * 0.1;
        const progress = getEnergyProgress();
        io.emit('shatter:progress', progress);

        if (energy >= threshold) {
          io.emit('mosaic:update');
          io.emit('mode:changed', { mode: 'mosaic' });
          db.prepare("UPDATE system_state SET value = 'mosaic' WHERE key = 'mode'").run();
          energy = 0;
          console.log('[Control] energy threshold reached, rebuild complete');
        }
        broadcastState(io);
      }
    }));

    // ========== 倒计时 ==========
    socket.on('control:countdown', requireAuth((data) => {
      const { seconds } = data;
      if (typeof seconds === 'number' && seconds > 0 && seconds <= 60) {
        // 生成一次性令牌，用于 display 端完成倒计时后验证
        countdownToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
        io.emit('display:countdown', { seconds, token: countdownToken });
        logEvent('countdown', { seconds });
        console.log(`[Control] countdown started: ${seconds}s`);
      }
    }));

    socket.on('control:countdown-cancel', requireAuth(() => {
      countdownToken = null;
      io.emit('display:countdown-cancel');
      console.log('[Control] countdown cancelled');
    }));

    // 倒计时结束自动触发碎裂（display 端通知，需提供令牌）
    socket.on('display:countdown-done', (data) => {
      if (socket.userType !== 'display') {
        console.log(`[Security] unauthorized countdown-done from ${socket.id}`);
        return;
      }
      // 验证倒计时令牌
      const { token } = data || {};
      if (!countdownToken || token !== countdownToken) {
        console.log(`[Security] invalid countdown token from ${socket.id}`);
        return;
      }
      countdownToken = null; // 令牌一次性使用
      db.prepare("UPDATE system_state SET value = 'shatter' WHERE key = 'mode'").run();
      energy = 0;
      io.emit('shatter:start');
      io.emit('shatter:progress', 0);
      broadcastState(io);
      logEvent('shatter', { trigger: 'countdown-done' });
      console.log('[Display] countdown done, auto-shatter triggered');
    });

    // ========== 马赛克预览模式 ==========
    socket.on('control:mosaic-preview', requireAuth((data) => {
      const { enabled } = data;
      io.emit('display:mosaic-preview', { enabled: !!enabled });
      console.log(`[Control] mosaic preview: ${enabled ? 'ON' : 'OFF'}`);
    }));

    // ========== 公告弹窗 ==========
    socket.on('control:announcement', requireAuth((data) => {
      const { text, duration } = data;
      if (typeof text === 'string' && text.trim()) {
        const dur = Math.max(3, Math.min(Number(duration) || 5, 30));
        io.emit('display:announcement', { text: text.trim(), duration: dur });
        logEvent('announcement', { text: text.trim(), duration: dur });
        console.log(`[Control] announcement: "${text.trim()}" (${dur}s)`);
      }
    }));

    socket.on('control:announcement-cancel', requireAuth(() => {
      io.emit('display:announcement-cancel');
      console.log('[Control] announcement cancelled');
    }));

    // ========== 幸运抽奖 ==========
    socket.on('control:lucky-draw', requireAuth((data) => {
      const { count = 1 } = data;
      const drawCount = Math.max(1, Math.min(Number(count) || 1, 20));
      const users = db.prepare(
        'SELECT id, nickname, face_url FROM users WHERE nickname IS NOT NULL ORDER BY RANDOM() LIMIT ?'
      ).all(drawCount);
      if (users.length === 0) {
        socket.emit('control:lucky-draw-result', { winners: [], error: '暂无注册用户' });
        return;
      }
      io.emit('display:lucky-draw', { winners: users });
      logEvent('lucky_draw', { winners: users.map(u => u.nickname), count: users.length });
      console.log(`[LuckyDraw] winners: ${users.map(u => u.nickname).join(', ')}`);
    }));

    // ========== 投票系统 ==========
    socket.on('control:create-poll', requireAuth((data) => {
      const { question, options } = data;
      if (!question || !question.trim()) {
        return socket.emit('error', { message: '投票问题不能为空' });
      }
      if (!options || !Array.isArray(options) || options.filter(o => o && o.trim()).length < 2) {
        return socket.emit('error', { message: '至少需要 2 个有效选项' });
      }
      const cleanOptions = options.filter(o => o && o.trim()).map(o => o.trim()).slice(0, 6);
      // 关闭之前的活跃投票
      db.prepare("UPDATE polls SET status = 'closed' WHERE status = 'active'").run();
      const stmt = db.prepare('INSERT INTO polls (question, options) VALUES (?, ?)');
      const result = stmt.run(question.trim(), JSON.stringify(cleanOptions));
      const poll = {
        id: result.lastInsertRowid,
        question: question.trim(),
        options: cleanOptions,
        status: 'active',
        votes: cleanOptions.map(() => 0),
        totalVotes: 0,
      };
      io.emit('poll:created', poll);
      logEvent('poll_created', { question: poll.question, options: cleanOptions });
      console.log(`[Poll] created: "${poll.question}" (${cleanOptions.length} options)`);
    }));

    socket.on('control:close-poll', requireAuth(() => {
      const poll = db.prepare("SELECT id FROM polls WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
      if (!poll) return;
      db.prepare("UPDATE polls SET status = 'closed' WHERE id = ?").run(poll.id);
      const results = getPollResults(poll.id);
      io.emit('poll:closed', results);
      logEvent('poll_closed', { poll_id: poll.id });
      console.log(`[Poll] closed: id=${poll.id}`);
    }));

    socket.on('control:hide-poll', requireAuth(() => {
      io.emit('poll:hidden');
      console.log('[Poll] hidden from display');
    }));

    function getPollResults(pollId) {
      const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
      if (!poll) return null;
      const options = JSON.parse(poll.options);
      const votes = options.map(() => 0);
      const rows = db.prepare('SELECT option_index, COUNT(*) as cnt FROM poll_votes WHERE poll_id = ? GROUP BY option_index').all(pollId);
      let totalVotes = 0;
      for (const row of rows) {
        if (row.option_index >= 0 && row.option_index < options.length) {
          votes[row.option_index] = row.cnt;
          totalVotes += row.cnt;
        }
      }
      return { id: poll.id, question: poll.question, options, votes, totalVotes, status: poll.status };
    }

    // 用户投票
    socket.on('poll:vote', (data) => {
      const { pollId, optionIndex } = data;
      if (!socket.userId) {
        return socket.emit('error', { message: '请先注册' });
      }
      const poll = db.prepare("SELECT * FROM polls WHERE id = ? AND status = 'active'").get(pollId);
      if (!poll) {
        return socket.emit('error', { message: '投票不存在或已结束' });
      }
      const options = JSON.parse(poll.options);
      if (optionIndex < 0 || optionIndex >= options.length) {
        return socket.emit('error', { message: '无效选项' });
      }
      try {
        db.prepare('INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES (?, ?, ?)').run(pollId, socket.userId, optionIndex);
      } catch (e) {
        if (e.message.includes('UNIQUE')) {
          return socket.emit('error', { message: '你已经投过票了' });
        }
        throw e;
      }
      socket.emit('poll:voted', { pollId, optionIndex });
      const results = getPollResults(pollId);
      io.emit('poll:results', results);
      logEvent('poll_vote', { nickname: socket.userNickname, poll_id: pollId, option: options[optionIndex] });
      console.log(`[Poll] vote: ${socket.userNickname} → option ${optionIndex} (${options[optionIndex]})`);
    });

    // 获取当前活跃投票
    socket.on('poll:get-active', () => {
      const poll = db.prepare("SELECT * FROM polls WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
      if (poll) {
        const results = getPollResults(poll.id);
        socket.emit('poll:active', results);
      } else {
        socket.emit('poll:active', null);
      }
    });

    // ========== 断开连接 ==========
    socket.on('disconnect', () => {
      authenticatedSockets.delete(socket.id);
      danmakuRateLimit.delete(socket.id);
      emojiRateLimit.delete(socket.id);
      blessingRateLimit.delete(socket.id);
      if (socket.userId) {
        db.prepare('UPDATE users SET socket_id = NULL WHERE id = ?').run(socket.userId);
      }
      broadcastUsersCount(io);
      console.log(`[Socket] disconnected: ${socket.id} (${socket.userNickname || 'unknown'})`);
    });
  });
}

module.exports = setupSocket;
