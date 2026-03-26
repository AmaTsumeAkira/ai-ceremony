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
  state.energy = String(Math.round(energy));
  state.threshold = String(threshold);
  io.emit('control:state', state);
}

function broadcastUsersCount(io) {
  io.emit('control:users-count', io.sockets.sockets.size);
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
        }
        
        if (!nickname || !nickname.trim()) {
          return socket.emit('error', { message: 'nickname 不能为空' });
        }
        const stmt = db.prepare(
          'INSERT INTO users (nickname, socket_id) VALUES (?, ?)'
        );
        const result = stmt.run(nickname.trim(), socket.id);
        socket.userId = result.lastInsertRowid;
        socket.userNickname = nickname.trim();
        socket.userType = 'user';
        socket.join('users');

        socket.emit('user:joined', { id: result.lastInsertRowid, nickname: nickname.trim() });
        broadcastUsersCount(io);
        logEvent('user_join', { nickname: nickname.trim(), id: result.lastInsertRowid });
        console.log(`[User] ${nickname} joined, id=${result.lastInsertRowid}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('user:upload-face', (data) => {
      try {
        const { base64, filename } = data;
        if (!base64) return socket.emit('error', { message: '无图片数据' });

        const fs = require('fs');
        const path = require('path');

        const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!matches) return socket.emit('error', { message: 'base64 格式错误' });

        const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const imgExt = matches[1].split('/')[1] === 'jpeg' ? 'jpg' : matches[1].split('/')[1];
        if (!allowedTypes.includes(imgExt)) {
          return socket.emit('error', { message: '只支持 jpg/png/gif/webp 格式' });
        }

        const ext = imgExt;
        const buffer = Buffer.from(matches[2], 'base64');
        const fname = `face_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filepath = path.join(__dirname, '..', 'uploads', fname);

        fs.writeFileSync(filepath, buffer);

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
        const { content, color } = data;
        if (!content || !content.trim()) {
          return socket.emit('error', { message: '弹幕内容不能为空' });
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
      const validModes = ['idle', 'shatter', 'rebuild', 'mosaic', 'danmaku'];
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
      const { emoji } = data;
      if (typeof emoji === 'string' && emoji.trim()) {
        io.emit('emoji:float', {
          emoji: emoji.trim(),
          nickname: socket.userNickname || '匿名',
          x: 0.2 + Math.random() * 0.6,
        });
        console.log(`[Emoji] ${socket.userNickname || '匿名'}: ${emoji.trim()}`);
      }
    });

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
      const { level, threshold: shoutThreshold, energyThreshold: clientEnergyThreshold } = data;
      // 同步客户端设置的阈值
      if (typeof clientEnergyThreshold === 'number' && clientEnergyThreshold > 0 && clientEnergyThreshold !== threshold) {
        threshold = clientEnergyThreshold;
        db.prepare("UPDATE system_state SET value = ? WHERE key = 'threshold'").run(String(threshold));
      }
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
        io.emit('display:countdown', { seconds });
        logEvent('countdown', { seconds });
        console.log(`[Control] countdown started: ${seconds}s`);
      }
    }));

    socket.on('control:countdown-cancel', requireAuth(() => {
      io.emit('display:countdown-cancel');
      console.log('[Control] countdown cancelled');
    }));

    // 倒计时结束自动触发碎裂（display 端通知）
    socket.on('display:countdown-done', () => {
      db.prepare("UPDATE system_state SET value = 'shatter' WHERE key = 'mode'").run();
      energy = 0;
      io.emit('shatter:start');
      io.emit('shatter:progress', 0);
      broadcastState(io);
      console.log('[Display] countdown done, auto-shatter triggered');
    });

    // ========== 马赛克预览模式 ==========
    socket.on('control:mosaic-preview', requireAuth((data) => {
      const { enabled } = data;
      io.emit('display:mosaic-preview', { enabled: !!enabled });
      console.log(`[Control] mosaic preview: ${enabled ? 'ON' : 'OFF'}`);
    }));

    // ========== 断开连接 ==========
    socket.on('disconnect', () => {
      authenticatedSockets.delete(socket.id);
      if (socket.userId) {
        db.prepare('UPDATE users SET socket_id = NULL WHERE id = ?').run(socket.userId);
      }
      broadcastUsersCount(io);
      console.log(`[Socket] disconnected: ${socket.id} (${socket.userNickname || 'unknown'})`);
    });
  });
}

module.exports = setupSocket;
