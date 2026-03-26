# AI 素养大赛 · 开幕式互动系统

实时互动大屏系统，支持弹幕、粒子破碎/重建动画、Emoji 飘屏、马赛克照片墙等功能。

## 快速开始

```bash
# 1. 安装依赖
cd frontend && npm install
cd ../server && npm install

# 2. 构建前端
cd ../frontend && npm run build

# 3. 启动服务
cd ../server && node index.js
```

服务启动后访问：
- 📱 手机端：`http://<IP>:6588/`
- 🎮 控制台：`http://<IP>:6588/control`
- 📺 大屏端：`http://<IP>:6588/display`

## 功能一览

| 功能 | 说明 |
|------|------|
| 🎨 粒子文字 | 控制台自定义文字，粒子自动排列动画 |
| 💥 破碎/重建 | 粒子爆炸散开，能量充满后自动汇聚重建 |
| 💬 弹幕 | 手机端发送弹幕，大屏实时滚动显示 |
| 😀 Emoji 飘屏 | 手机端点表情，大屏从底部飘起 |
| 🧩 马赛克照片墙 | 用户上传头像，组成马赛克拼图 |
| 🖼️ 自定义背景 | 控制台设置大屏背景图片 |
| 📋 多阶段流程 | 一键切换：开场/讲者/互动/高潮/闭幕 |
| 📱 二维码加入 | 大屏左下角显示扫码加入 |
| 🎤 麦克风 | 采集音量驱动能量系统 |

## 页面说明

### 手机端 (`/`)
用户扫码进入，输入昵称后可以：
- 发送弹幕（选颜色）
- 上传头像
- 发送 Emoji 表情

### 控制台 (`/control`)
操作员使用的管理面板：
- 模式切换（空闲/破碎/弹幕/马赛克）
- 破碎触发 / 手动重建
- 清空弹幕
- 麦克风控制（音量阈值、能量阈值）
- 自定义粒子文字
- 设置大屏背景
- 活动流程一键切换

### 大屏端 (`/display`)
投屏展示，支持：
- 粒子文字动画（Three.js）
- 弹幕滚动
- Emoji 飘屏
- 马赛克照片墙
- 自定义背景
- 二维码扫码加入
- 阶段标签提示

## 技术栈

**前端**
- React 19 + Vite 8
- Ant Design 6
- Three.js（粒子系统）
- Socket.IO Client

**后端**
- Node.js + Express
- Socket.IO（实时通信）
- SQLite (better-sqlite3)

## Socket 事件

### 用户端 → 服务端
| 事件 | 数据 | 说明 |
|------|------|------|
| `user:join` | `{ nickname }` | 加入互动 |
| `danmaku:send` | `{ content, color }` | 发送弹幕 |
| `user:upload-face` | `{ base64, filename }` | 上传头像 |
| `emoji:send` | `{ emoji }` | 发送 Emoji |

### 控制端 → 服务端
| 事件 | 数据 | 说明 |
|------|------|------|
| `control:register` | — | 注册为控制端 |
| `control:shatter` | — | 触发破碎 |
| `control:rebuild` | — | 触发重建 |
| `control:set-mode` | `{ mode }` | 切换模式 |
| `control:set-text` | `{ text }` | 设置粒子文字 |
| `control:set-background` | `{ url }` | 设置背景图 |
| `control:set-agenda` | `{ stage }` | 切换活动阶段 |
| `control:clear-danmaku` | — | 清空弹幕 |
| `control:set-threshold` | `{ value }` | 设置能量阈值 |
| `control:voice-level` | `{ level }` | 麦克风音量 |

### 服务端 → 客户端
| 事件 | 说明 |
|------|------|
| `danmaku:new` | 新弹幕 |
| `danmaku:cleared` | 弹幕已清空 |
| `mode:changed` | 模式变更 |
| `shatter:start` | 破碎开始 |
| `shatter:progress` | 能量进度 |
| `emoji:float` | Emoji 飘屏 |
| `display:text-changed` | 粒子文字变更 |
| `display:background-changed` | 背景变更 |
| `agenda:changed` | 阶段变更 |
| `face:new` | 新头像 |
| `mosaic:update` | 进入马赛克模式 |
| `control:state` | 完整状态同步 |
| `control:users-count` | 在线人数 |

## 活动阶段

| 阶段 | 行为 |
|------|------|
| `opening` | 空闲模式，显示"欢迎来到AI素养大赛" |
| `speaker` | 空闲模式，保持当前粒子文字 |
| `interact` | 弹幕模式，鼓励互动 |
| `climax` | 破碎模式，粒子爆炸 |
| `closing` | 重建模式，显示"谢谢大家" |

## 注意事项

- QR 码依赖外部 API (`api.qrserver.com`)，无网络时降级显示文字链接
- 弹幕数据库自动清理，始终只保留最新 80 条
- 头像上传限制 10MB
- 默认端口 6588，可在 `server/index.js` 修改
- 首次启动需删除 `server/ceremony.db` 以初始化最新数据库结构
