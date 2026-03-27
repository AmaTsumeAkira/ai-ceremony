const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'ceremony.db');

// 创建并初始化数据库
const db = new Database(DB_PATH);

// 开启 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    face_url TEXT,
    socket_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS danmaku (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT NOT NULL,
    color TEXT DEFAULT '#ffffff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// 活动日志表
db.exec(`
  CREATE TABLE IF NOT EXISTS ceremony_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    event_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 投票表
db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    option_index INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (poll_id) REFERENCES polls(id),
    UNIQUE(poll_id, user_id)
  );
`);

// 祝福墙表
db.exec(`
  CREATE TABLE IF NOT EXISTS blessings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    nickname TEXT NOT NULL,
    content TEXT NOT NULL,
    approved INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 弹幕精选表
db.exec(`
  CREATE TABLE IF NOT EXISTS pinned_danmaku (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    danmaku_id INTEGER NOT NULL,
    user_id INTEGER,
    nickname TEXT,
    content TEXT NOT NULL,
    color TEXT DEFAULT '#ffffff',
    pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (danmaku_id) REFERENCES danmaku(id)
  );
`);

// 初始化默认系统状态
const defaultStates = {
  mode: 'idle',
  threshold: '1000',
  energy: '0',
  particleText: 'AI',
  background: '',
  agenda: '',
};

const insertState = db.prepare(
  'INSERT OR IGNORE INTO system_state (key, value) VALUES (?, ?)'
);

for (const [key, value] of Object.entries(defaultStates)) {
  insertState.run(key, value);
}

module.exports = db;
