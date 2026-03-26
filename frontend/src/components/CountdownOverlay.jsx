import React, { useState, useEffect, useRef } from 'react';

export default function CountdownOverlay({ socket }) {
  const [active, setActive] = useState(false);
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleCountdown = (data) => {
      const { seconds } = data;
      if (seconds > 0) {
        setActive(true);
        setCurrent(seconds);

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
          setCurrent(prev => {
            if (prev <= 1) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
              // 倒计时结束，通知服务端触发 shatter
              setTimeout(() => {
                setActive(false);
                socket.emit('display:countdown-done');
              }, 800);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    const handleCancel = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setActive(false);
    };

    socket.on('display:countdown', handleCountdown);
    socket.on('display:countdown-cancel', handleCancel);

    return () => {
      socket.off('display:countdown', handleCountdown);
      socket.off('display:countdown-cancel', handleCancel);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [socket]);

  if (!active && current === 0) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        fontSize: 'clamp(120px, 40vw, 400px)',
        fontWeight: 900,
        color: '#fff',
        textShadow: `
          0 0 60px rgba(64, 169, 255, 0.8),
          0 0 120px rgba(114, 46, 209, 0.5),
          0 0 200px rgba(235, 47, 150, 0.3)
        `,
        animation: 'countdownPulse 1s ease-in-out infinite',
        userSelect: 'none',
        letterSpacing: '0.05em',
      }}>
        {current}
        <span style={{ fontSize: 'clamp(30px, 10vw, 100px)', opacity: 0.6, marginLeft: '0.05em' }}>秒</span>
      </div>
      <style>{`
        @keyframes countdownPulse {
          0% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
