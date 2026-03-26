import React from 'react';

const Help = () => {
  const links = [
    { title: '控制台 (Control)', path: '/control', desc: '管理活动流程、触发特效、上传图片等。', icon: '🎮' },
    { title: '展示端 (Display)', path: '/display', desc: '大屏幕展示：粒子文字、碎裂动画、马赛克、弹幕。', icon: '📺' },
    { title: '移动端 (Mobile)', path: '/', desc: '用户扫码进入：发送弹幕、表情、上传头像。', icon: '📱' },
    { title: '帮助 (Help)', path: '/help', desc: '系统说明页（本页）。', icon: '❓' },
  ];

  const features = [
    {
      category: '大屏展示 /display',
      icon: '📺',
      items: [
        '粒子文字动画 — 自动根据文字长度换行，三色渐变',
        '粒子碎裂特效 — 粒子飞散后可重建',
        '马赛克照片墙 — 用户头像拼成马赛克，圆形裁剪',
        'Emoji 马赛克预览 — 无头像时自动用 Emoji 填充',
        '弹幕飘屏 — 自动滚动，多种颜色可选',
        'Emoji 飘屏 — 用户发送的 Emoji 浮动展示',
        '底部浮动二维码 — 扫码加入互动',
        '倒计时动画 — 倒计时结束后自动触发碎裂',
        '自定义粒子文字 — 控制面板可实时修改',
        '背景图自定义 — 支持上传自定义背景',
      ],
    },
    {
      category: '控制台 /control',
      icon: '🎮',
      items: [
        '密码认证保护 — 首次使用需输入密码',
        '主持稿阶段控制 — 6个阶段：开场前→循迹→定航→赋能→启跃→合影',
        '手动触发碎裂/重建 — 一键触发粒子碎裂动画',
        '模式切换 — idle/shatter/rebuild/mosaic/danmaku',
        '自定义粒子文字 — 实时修改大屏文字内容',
        '能量系统 — 麦克风音量驱动能量条，满值自动触发重建',
        '阈值设置 — 可调整碎裂触发阈值',
        '倒计时控制 — 启动/取消倒计时',
        '弹幕清空 — 一键清空所有弹幕',
        '马赛克预览 — 预览马赛克效果（Emoji填充）',
        '背景上传 — 上传自定义背景图',
        '实时状态监控 — 在线人数、当前模式、能量进度',
      ],
    },
    {
      category: '手机端 /',
      icon: '📱',
      items: [
        '昵称注册 — 输入昵称即可加入互动',
        '头像上传 — 拍照或选图上传，支持裁剪',
        '弹幕发送 — 输入内容+选颜色，实时发送',
        'Emoji 快捷发送 — 10个常用 Emoji 一键发送',
        '颜色选择器 — 6种预设弹幕颜色',
        '当前模式显示 — 实时显示大屏当前状态',
        '断线重连 — 网络波动自动恢复身份',
        '微信浏览器兼容 — polling 降级适配',
      ],
    },
    {
      category: '导出功能 /export',
      icon: '📊',
      items: [
        '（开发中）用户列表导出',
        '（开发中）弹幕记录导出',
      ],
    },
  ];

  const apiEndpoints = [
    { name: '健康检查', url: '/health', desc: 'GET — 返回系统状态和运行时间' },
    { name: '用户列表', url: '/api/users', desc: 'GET — 获取所有注册用户' },
    { name: '弹幕列表', url: '/api/danmaku/recent', desc: 'GET — 获取最近弹幕' },
    { name: '上传头像', url: '/api/user/upload-face', desc: 'POST — multipart/form-data，最大5MB' },
    { name: '系统状态', url: '/api/state', desc: 'GET — 获取当前系统状态' },
  ];

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '30px 20px',
      fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      color: '#e0e0e0',
      lineHeight: '1.8',
      background: '#0a0a1a',
      minHeight: '100vh',
    }}>
      <header style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #40a9ff, #722ed1, #eb2f96)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: '32px', fontWeight: '900', color: '#fff',
          boxShadow: '0 0 40px rgba(64, 169, 255, 0.3)',
        }}>AI</div>
        <h1 style={{ color: '#fff', margin: '0 0 8px', fontSize: '28px', letterSpacing: '4px' }}>
          第三届 AIGC 数字素养大赛
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, letterSpacing: '2px' }}>
          开幕式互动系统 · 功能说明
        </p>
      </header>

      {/* 快速跳转 */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={sectionTitle}>快速跳转</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '16px' }}>
          {links.map(link => (
            <a key={link.path} href={link.path} style={cardStyle}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{link.icon}</div>
              <h3 style={{ margin: '0 0 6px', color: '#40a9ff', fontSize: '15px' }}>{link.title}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{link.desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* 功能列表 */}
      {features.map((group) => (
        <section key={group.category} style={{ marginBottom: '36px' }}>
          <h2 style={sectionTitle}>
            <span style={{ marginRight: '8px' }}>{group.icon}</span>
            {group.category}
          </h2>
          <div style={featureBox}>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {group.items.map((item, i) => (
                <li key={i} style={{ marginBottom: '6px', fontSize: '14px' }}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      {/* API 接口 */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={sectionTitle}>🔌 API 接口</h2>
        <div style={featureBox}>
          {apiEndpoints.map((ep) => (
            <div key={ep.url} style={{ marginBottom: '12px' }}>
              <code style={{ background: 'rgba(64,169,255,0.15)', color: '#40a9ff', padding: '2px 8px', borderRadius: '4px', fontSize: '13px' }}>
                {ep.url}
              </code>
              <span style={{ marginLeft: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                {ep.desc}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 系统信息 */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={sectionTitle}>ℹ️ 系统信息</h2>
        <div style={featureBox}>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
            <li><strong>协议:</strong> {window.location.protocol === 'https:' ? 'WSS (生产)' : 'WS (开发)'}</li>
            <li><strong>当前域名:</strong> {window.location.hostname}</li>
            <li><strong>后端接口:</strong> <code style={{ background: 'rgba(64,169,255,0.15)', padding: '2px 6px', borderRadius: '4px' }}>{window.location.origin}/api</code></li>
            <li><strong>前端框架:</strong> React + Vite</li>
            <li><strong>3D 引擎:</strong> Three.js (粒子动画)</li>
            <li><strong>实时通信:</strong> Socket.IO</li>
            <li><strong>数据库:</strong> SQLite (better-sqlite3)</li>
          </ul>
        </div>
      </section>

      <footer style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px', padding: '20px 0' }}>
        © 2026 第三届 AIGC 数字素养大赛 · 开幕式互动系统
      </footer>
    </div>
  );
};

const sectionTitle = {
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: '10px',
  marginBottom: '0',
  fontSize: '18px',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
};

const cardStyle = {
  textDecoration: 'none',
  color: 'inherit',
  padding: '16px',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.03)',
  transition: 'all 0.2s',
  display: 'block',
};

const featureBox = {
  background: 'rgba(255,255,255,0.03)',
  padding: '20px',
  borderRadius: '0 0 12px 12px',
  border: '1px solid rgba(255,255,255,0.05)',
  borderTop: 'none',
};

export default Help;
