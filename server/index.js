require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const apiRoutes = require('./routes/api');
const setupSocket = require('./socket/handlers');

const PORT = 6588;
const app = express();

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
const bgDir = path.join(uploadsDir, 'background');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });

// CORS 配置
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    /^http:\/\/192\.168\.\d+\.\d+:5173$/,
    'https://syds.fromakira.cn',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件：uploads 目录
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 前端静态文件
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use('/assets', express.static(path.join(distPath, 'assets')));

// 页面路由
app.get('/control', (req, res) => {
  res.sendFile(path.join(distPath, 'control.html'));
});
app.get('/display', (req, res) => {
  res.sendFile(path.join(distPath, 'display.html'));
});
app.get('/help', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// API 路由
app.use('/api', apiRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 首页兜底（用户端）
app.get('/', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// 404 兜底
app.use((req, res) => {
  res.status(404).sendFile(path.join(distPath, 'index.html'));
});

// HTTP server + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      /^http:\/\/192\.168\.\d+\.\d+:5173$/,
      'https://syds.fromakira.cn',
    ],
    credentials: true,
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB for base64 uploads
});

// 将 io 实例挂到 app，供路由使用
app.set('io', io);

// 初始化 Socket.IO 事件处理
setupSocket(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎯 AI 素养大赛开幕式互动系统后端`);
  console.log(`📡 HTTP:  http://0.0.0.0:${PORT}`);
  console.log(`🔌 WS:    ws://0.0.0.0:${PORT}`);
  console.log(`📁 静态:  http://0.0.0.0:${PORT}/uploads/`);
  console.log(`❤️  健康:  http://0.0.0.0:${PORT}/health\n`);
});
