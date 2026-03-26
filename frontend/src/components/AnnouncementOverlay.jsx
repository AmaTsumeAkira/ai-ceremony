import React, { useState, useEffect, useRef } from 'react';

export default function AnnouncementOverlay({ socket }) {
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleAnnouncement = (data) => {
      setText(data.text);
      setActive(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setActive(false);
      }, (data.duration || 5) * 1000);
    };

    const handleCancel = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setActive(false);
    };

    socket.on('display:announcement', handleAnnouncement);
    socket.on('display:announcement-cancel', handleCancel);

    return () => {
      socket.off('display:announcement', handleAnnouncement);
      socket.off('display:announcement-cancel', handleCancel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [socket]);

  if (!active) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      animation: 'announcementFadeIn 0.4s ease-out',
    }}>
      <div style={{
        maxWidth: '80vw',
        padding: '40px 60px',
        background: 'linear-gradient(135deg, rgba(235, 47, 150, 0.15), rgba(64, 169, 255, 0.15))',
        border: '2px solid rgba(235, 47, 150, 0.4)',
        borderRadius: 24,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 60px rgba(235, 47, 150, 0.3), 0 0 120px rgba(64, 169, 255, 0.15)',
        textAlign: 'center',
        animation: 'announcementScaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 36px)',
          fontWeight: 700,
          color: '#eb2f96',
          letterSpacing: '4px',
          marginBottom: 16,
          textTransform: 'uppercase',
        }}>
          📢 公告
        </div>
        <div style={{
          fontSize: 'clamp(28px, 5vw, 56px)',
          fontWeight: 900,
          color: '#fff',
          textShadow: '0 0 30px rgba(64, 169, 255, 0.5), 0 2px 15px rgba(0,0,0,0.8)',
          lineHeight: 1.4,
          letterSpacing: '2px',
          wordBreak: 'break-all',
        }}>
          {text}
        </div>
      </div>
      <style>{`
        @keyframes announcementFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes announcementScaleIn {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
