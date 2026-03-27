import React, { useState, useEffect, useRef } from 'react';

/**
 * 祝福墙组件 — 大屏端展示
 * 祝福消息从底部缓缓升起，显示一段时间后消失
 */
export default function BlessingWall({ socket }) {
  const [blessings, setBlessings] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleNew = (blessing) => {
      setBlessings(prev => {
        // 最多同时显示 8 条
        const next = [...prev, blessing];
        if (next.length > 8) next.shift();
        return next;
      });

      // 8 秒后自动移除
      setTimeout(() => {
        setBlessings(prev => prev.filter(b => b.id !== blessing.id));
      }, 8000);
    };

    const handleCleared = () => {
      setBlessings([]);
    };

    const handleRecent = (rows) => {
      // 只取最近 5 条显示
      if (rows && rows.length > 0) {
        setBlessings(rows.slice(-5));
        setTimeout(() => setBlessings([]), 10000);
      }
    };

    socket.on('blessing:new', handleNew);
    socket.on('blessing:cleared', handleCleared);
    socket.on('blessing:recent', handleRecent);

    return () => {
      socket.off('blessing:new', handleNew);
      socket.off('blessing:cleared', handleCleared);
      socket.off('blessing:recent', handleRecent);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket]);

  if (blessings.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      right: 20,
      top: '10%',
      bottom: '10%',
      width: 'clamp(280px, 25vw, 400px)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      gap: 12,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {blessings.map((b, i) => (
        <div
          key={b.id}
          style={{
            padding: '14px 20px',
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(255, 100, 50, 0.08))',
            border: '1px solid rgba(255, 215, 0, 0.25)',
            borderRadius: 16,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(255, 215, 0, 0.15)',
            animation: 'blessingSlideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
          }}>
            <span style={{ fontSize: 16 }}>🎊</span>
            <span style={{
              fontSize: 13, fontWeight: 600, color: '#ffd700',
              letterSpacing: '1px',
            }}>
              {b.nickname}
            </span>
          </div>
          <div style={{
            fontSize: 16, fontWeight: 600, color: '#fff',
            lineHeight: 1.5,
            textShadow: '0 1px 8px rgba(0,0,0,0.5)',
            wordBreak: 'break-all',
          }}>
            {b.content}
          </div>
        </div>
      ))}
      <style>{`
        @keyframes blessingSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
