import React from 'react';

const Help = () => {
  const links = [
    { title: '控制台', path: '/control', desc: '管理活动、触发特效', icon: '🎮' },
    { title: '展示端', path: '/display', desc: '大屏幕展示', icon: '📺' },
    { title: '手机端', path: '/', desc: '用户互动入口', icon: '📱' },
  ];

  return (
    <div style={{
      maxWidth: '900px', margin: '0 auto', padding: '30px 20px',
      fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      color: '#e0e0e0', lineHeight: '1.8', background: '#0a0a1a', minHeight: '100vh',
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
          开幕式互动系统 · 操作指引
        </p>
      </header>

      {/* 快速跳转 */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={stitle}>快速跳转</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
          {links.map(link => (
            <a key={link.path} href={link.path} style={cardStyle}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{link.icon}</div>
              <h3 style={{ margin: '0 0 6px', color: '#40a9ff', fontSize: '15px' }}>{link.title}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{link.desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* 使用流程 */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={stitle}>📋 活动流程</h2>
        <div style={boxStyle}>
          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
            <li style={{ marginBottom: '10px' }}><strong>准备阶段</strong> — 控制台输入密码登录，大屏端打开 /display，确认连接成功（在线人数显示）</li>
            <li style={{ marginBottom: '10px' }}><strong>观众入场</strong> — 大屏展示二维码，观众扫码进入手机端，输入昵称并上传头像</li>
            <li style={{ marginBottom: '10px' }}><strong>开场前</strong> — 控制台点击「开场前」阶段，大屏显示粒子文字动画</li>
            <li style={{ marginBottom: '10px' }}><strong>互动环节</strong> — 观众发送弹幕和 Emoji，控制台可调节弹幕、清空弹幕</li>
            <li style={{ marginBottom: '10px' }}><strong>马赛克墙</strong> — 点击「马赛克预览」查看头像拼成的照片墙</li>
            <li style={{ marginBottom: '10px' }}><strong>启动仪式</strong> — 控制台点击「启跃·启动仪式」或启动倒计时，倒计时结束自动触发粒子碎裂</li>
            <li style={{ marginBottom: '10px' }}><strong>合影留念</strong> — 点击「重建」恢复粒子文字，点击「合影留念」结束</li>
          </ol>
        </div>
      </section>

      {/* 控制台操作 */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={stitle}>🎮 控制台操作</h2>
        <div style={boxStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr style={trStyle}><td style={tdLabel}>密码</td><td>首次访问需输入控制密码</td></tr>
              <tr style={trStyle}><td style={tdLabel}>阶段按钮</td><td>开场前 → 循迹·往届回顾 → 定航·赛道介绍 → 赋能·领导致辞 → 启跃·启动仪式 → 合影留念</td></tr>
              <tr style={trStyle}><td style={tdLabel}>碎裂 / 重建</td><td>手动触发粒子碎裂飞散，或重建恢复文字</td></tr>
              <tr style={trStyle}><td style={tdLabel}>模式切换</td><td>idle / shatter / rebuild / mosaic / danmaku</td></tr>
              <tr style={trStyle}><td style={tdLabel}>自定义文字</td><td>修改大屏粒子文字内容，回车确认</td></tr>
              <tr style={trStyle}><td style={tdLabel}>倒计时</td><td>设定秒数后启动倒计时，结束后自动碎裂；可随时取消</td></tr>
              <tr style={trStyle}><td style={tdLabel}>能量条</td><td>麦克风音量驱动，满值自动触发重建</td></tr>
              <tr style={trStyle}><td style={tdLabel}>弹幕管理</td><td>一键清空所有弹幕</td></tr>
              <tr style={trStyle}><td style={tdLabel}>马赛克预览</td><td>无头像时用 Emoji 填充预览效果</td></tr>
              <tr style={trStyle}><td style={tdLabel}>背景上传</td><td>上传自定义背景图替换大屏背景</td></tr>
              <tr style={trStyle}><td style={tdLabel}>导出用户</td><td>导出所有注册用户数据为 CSV 文件（含昵称、头像、弹幕数）</td></tr>
              <tr style={trStyle}><td style={tdLabel}>导出弹幕</td><td>导出所有弹幕记录为 CSV 文件（含内容、颜色、时间）</td></tr>
              <tr style={trStyle}><td style={tdLabel}>活动日志</td><td>右侧面板实时显示用户加入、弹幕、模式切换等活动记录，可清空</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 手机端操作 */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={stitle}>📱 手机端操作</h2>
        <div style={boxStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr style={trStyle}><td style={tdLabel}>扫码</td><td>用微信/浏览器扫描大屏二维码进入</td></tr>
              <tr style={trStyle}><td style={tdLabel}>注册</td><td>输入昵称（12字以内）点击「加入互动」</td></tr>
              <tr style={trStyle}><td style={tdLabel}>上传头像</td><td>点击头像区域，拍照或从相册选择，自动上传</td></tr>
              <tr style={trStyle}><td style={tdLabel}>发弹幕</td><td>底部输入框输入内容，选颜色，点击发送</td></tr>
              <tr style={trStyle}><td style={tdLabel}>发 Emoji</td><td>点击底部 Emoji 栏的图标直接发送</td></tr>
              <tr style={trStyle}><td style={tdLabel}>选颜色</td><td>点击输入框左侧色块切换弹幕颜色（6色可选）</td></tr>
              <tr style={trStyle}><td style={tdLabel}>当前状态</td><td>顶部显示当前大屏模式（待命/碎裂/马赛克等）</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 大屏端操作 */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={stitle}>📺 大屏端</h2>
        <div style={boxStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr style={trStyle}><td style={tdLabel}>打开方式</td><td>浏览器访问 /display，建议全屏（F11）</td></tr>
              <tr style={trStyle}><td style={tdLabel}>二维码</td><td>左下角浮动二维码，观众扫码加入</td></tr>
              <tr style={trStyle}><td style={tdLabel}>粒子文字</td><td>默认显示"AIGC 数字素养大赛"，控制台可改</td></tr>
              <tr style={trStyle}><td style={tdLabel}>弹幕</td><td>观众发送的弹幕自动飘过屏幕</td></tr>
              <tr style={trStyle}><td style={tdLabel}>Emoji</td><td>观众发送的 Emoji 从底部飘起</td></tr>
              <tr style={trStyle}><td style={tdLabel}>倒计时</td><td>控制台启动后大屏全屏显示倒计时数字</td></tr>
              <tr style={trStyle}><td style={tdLabel}>马赛克</td><td>观众头像/Emoji 拼成圆形马赛克墙</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* API 接口 */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={stitle}>🔌 API 接口</h2>
        <div style={boxStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '8px', color: '#40a9ff' }}>接口</th>
                <th style={{ textAlign: 'left', padding: '8px', color: '#40a9ff' }}>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr style={trStyle}><td style={tdCode}>GET /health</td><td>系统状态和运行时间</td></tr>
              <tr style={trStyle}><td style={tdCode}>GET /api/faces</td><td>所有已上传头像列表</td></tr>
              <tr style={trStyle}><td style={tdCode}>GET /api/danmaku/recent</td><td>最近弹幕记录</td></tr>
              <tr style={trStyle}><td style={tdCode}>POST /api/user/upload-face</td><td>上传头像（multipart，最大5MB）</td></tr>
              <tr style={trStyle}><td style={tdCode}>GET /api/system/state</td><td>当前系统状态（模式、能量、阈值）</td></tr>
              <tr style={trStyle}><td style={tdCode}>GET /api/stats</td><td>统计数据（在线人数、弹幕数、头像数）</td></tr>
              <tr style={trStyle}><td style={tdCode}>GET /api/export/users</td><td>导出用户数据 CSV（含头像、弹幕数）</td></tr>
              <tr style={trStyle}><td style={tdCode}>GET /api/export/danmaku</td><td>导出弹幕数据 CSV</td></tr>
              <tr style={trStyle}><td style={tdCode}>GET /api/logs</td><td>活动日志（可选 ?limit=50&type=xxx）</td></tr>
              <tr style={trStyle}><td style={tdCode}>DELETE /api/logs</td><td>清空活动日志（需认证）</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 常见问题 */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={stitle}>❓ 常见问题</h2>
        <div style={boxStyle}>
          <div style={{ fontSize: '14px' }}>
            <p><strong>Q: 手机端连不上服务器？</strong><br/>A: 确认手机和服务器在同一 WiFi，或通过域名访问。微信内置浏览器已兼容。</p>
            <p><strong>Q: 二维码加载不出来？</strong><br/>A: 内网环境可能无法访问外部 API，会降级显示文字链接。</p>
            <p style={{ margin: 0 }}><strong>Q: 控制台操作没反应？</strong><br/>A: 检查是否已输入密码认证，未认证的操作会被忽略。</p>
          </div>
        </div>
      </section>

      <footer style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px', padding: '20px 0' }}>
        © 2026 第三届 AIGC 数字素养大赛 · 开幕式互动系统
      </footer>
    </div>
  );
};

const stitle = {
  borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px',
  marginBottom: '0', fontSize: '18px', color: '#fff',
};
const cardStyle = {
  textDecoration: 'none', color: 'inherit', padding: '16px',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
  background: 'rgba(255,255,255,0.03)', transition: 'all 0.2s', display: 'block',
};
const boxStyle = {
  background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '0 0 12px 12px',
  border: '1px solid rgba(255,255,255,0.05)', borderTop: 'none',
};
const trStyle = { borderBottom: '1px solid rgba(255,255,255,0.05)' };
const tdLabel = { padding: '8px', color: '#40a9ff', fontWeight: '600', whiteSpace: 'nowrap', width: '120px' };
const tdCode = { padding: '8px', fontFamily: 'monospace', color: '#52c41a', whiteSpace: 'nowrap' };

export default Help;
