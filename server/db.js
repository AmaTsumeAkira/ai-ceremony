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
