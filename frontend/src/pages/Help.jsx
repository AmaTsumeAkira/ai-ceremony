import React from 'react';

const Help = () => {
  const links = [
    { title: '控制台 (Control)', path: '/control', desc: '用于管理活动流程、触发特效、上传图片等。', icon: '🎮' },
    { title: '展示端 (Display)', path: '/display', desc: '在大屏幕上展示，包含弹幕层、碎裂效果等。', icon: '📺' },
    { title: '移动端 (Mobile)', path: '/', desc: '用户扫码进入的页面，可发送弹幕和表情。', icon: '📱' },
  ];

  const apiEndpoints = [
    { name: '健康检查', url: '/health' },
    { name: '上传测试', url: '/api/upload' },
  ];

  return (
    <div style={{
      maxWidth: '800px',
      margin: '40px auto',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#333',
      lineHeight: '1.6'
    }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#007bff' }}>AI 素养大赛开幕式互动系统</h1>
        <p style={{ color: '#666' }}>快速访问与系统说明</p>
      </header>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>快速跳转</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
          {links.map(link => (
            <a 
              key={link.path} 
              href={link.path} 
              style={{
                textDecoration: 'none',
                color: 'inherit',
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '12px',
                transition: 'all 0.2s',
                backgroundColor: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#007bff';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#ddd';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{link.icon}</div>
              <h3 style={{ margin: '0 0 10px 0', color: '#007bff' }}>{link.title}</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{link.desc}</p>
            </a>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>系统状态说明</h2>
        <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li><strong>WebSocket:</strong> 处于 {window.location.protocol === 'https:' ? '生产模式 (WSS)' : '开发模式 (WS)'}。</li>
            <li><strong>当前环境:</strong> {window.location.hostname}</li>
            <li><strong>后端接口:</strong> <code style={{ backgroundColor: '#eee', padding: '2px 4px', borderRadius: '4px' }}>{window.location.origin}/api</code></li>
          </ul>
        </div>
      </section>

      <footer style={{ textAlign: 'center', marginTop: '60px', color: '#999', fontSize: '14px' }}>
        &copy; 2026 AI 素养大赛 - 系统说明页
      </footer>
    </div>
  );
};

export default Help;
