import React, { useState, useEffect, useRef, useCallback } from 'react';

const EMOJI_CELEBRATE = ['🎉', '🎊', '✨', '🌟', '💫', '🏆', '🎯', '💎'];

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`;

export default function LuckyDrawOverlay({ socket }) {
  const [active, setActive] = useState(false);
  const [winners, setWinners] = useState([]);
  const [phase, setPhase] = useState('spinning'); // spinning | reveal | done
  const [displayNickname, setDisplayNickname] = useState('');
  const spinRef = useRef(null);
  const allUsersRef = useRef([]);
  const autoCloseRef = useRef(null);

  const handleClose = useCallback(() => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    autoCloseRef.current = null;
    setActive(false);
    setWinners([]);
    setPhase('spinning');
    setDisplayNickname('');
  }, []);

  // Fetch all users for spinning effect
  useEffect(() => {
    fetch(`${API_BASE}/api/users`)
      .then(r => r.json())
      .then(data => { allUsersRef.current = data; })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleDraw = (data) => {
      const { winners: w } = data;
      if (!w || w.length === 0) return;

      setWinners(w);
      setActive(true);
      setPhase('spinning');

      // Spinning effect: rapidly show random names
      let spinCount = 0;
      const maxSpins = 30;
      const allNicknames = allUsersRef.current.map(u => u.nickname).filter(Boolean);

      if (spinRef.current) clearInterval(spinRef.current);

      // Use recursive setTimeout for dynamically increasing delay
      const doSpin = () => {
        spinCount++;
        if (spinCount >= maxSpins) {
          spinRef.current = null;
          setPhase('reveal');
          setTimeout(() => setPhase('done'), 100);
          return;
        }
        // Show random name during spin
        if (allNicknames.length > 0) {
          const randName = allNicknames[Math.floor(Math.random() * allNicknames.length)];
          setDisplayNickname(randName);
        }
        // Gradually slow down: 80ms → ~480ms
        const delay = 80 + spinCount * 15;
        spinRef.current = setTimeout(doSpin, delay);
      };
      doSpin();
    };

    socket.on('display:lucky-draw', handleDraw);
    return () => {
      socket.off('display:lucky-draw', handleDraw);
      if (spinRef.current) clearTimeout(spinRef.current);
    };
  }, [socket]);

  // 30秒自动关闭
  useEffect(() => {
    if (phase === 'done' && active) {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
      autoCloseRef.current = setTimeout(() => {
        handleClose();
      }, 30000);
    }
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [phase, active, handleClose]);

  if (!active) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.88)',
      backdropFilter: 'blur(12px)',
      animation: 'luckyFadeIn 0.5s ease-out',
    }}>
      {/* Title */}
      <div style={{
        fontSize: 'clamp(24px, 5vw, 48px)',
        fontWeight: 900,
        color: '#fff',
        letterSpacing: '8px',
        marginBottom: '40px',
        textShadow: '0 0 40px rgba(255, 200, 0, 0.6)',
      }}>
        🎲 幸运抽奖
      </div>

      {/* Spinning phase */}
      {phase === 'spinning' && (
        <div style={{
          fontSize: 'clamp(48px, 12vw, 120px)',
          fontWeight: 900,
          color: '#ffd700',
          textShadow: '0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 215, 0, 0.4)',
          letterSpacing: '4px',
          animation: 'luckyPulse 0.2s ease-in-out infinite',
          minHeight: '1.2em',
        }}>
          {displayNickname || '???'}
        </div>
      )}

      {/* Reveal phase */}
      {(phase === 'reveal' || phase === 'done') && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
          animation: 'luckyReveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          {winners.map((w, i) => (
            <div key={w.id} style={{
              display: 'flex', alignItems: 'center', gap: '20px',
              padding: '20px 40px',
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 100, 0, 0.1))',
              border: '2px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '20px',
              boxShadow: '0 0 40px rgba(255, 215, 0, 0.3)',
              animation: `luckyReveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.2}s both`,
            }}>
              {w.face_url ? (
                <img
                  src={w.face_url.startsWith('http') ? w.face_url : `${API_BASE}${w.face_url}`}
                  alt={w.nickname}
                  style={{
                    width: 80, height: 80, borderRadius: '50%',
                    border: '3px solid #ffd700',
                    objectFit: 'cover',
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                  }}
                />
              ) : (
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36,
                }}>
                  🏆
                </div>
              )}
              <div>
                <div style={{
                  fontSize: 'clamp(28px, 6vw, 56px)',
                  fontWeight: 900,
                  color: '#ffd700',
                  textShadow: '0 0 20px rgba(255, 215, 0, 0.6)',
                }}>
                  {w.nickname}
                </div>
                {winners.length > 1 && (
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 4 }}>
                    第 {i + 1} 位幸运儿
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Congrats text */}
          <div style={{
            fontSize: 'clamp(18px, 3vw, 32px)',
            color: 'rgba(255,255,255,0.7)',
            marginTop: '20px',
            letterSpacing: '4px',
          }}>
            {EMOJI_CELEBRATE.slice(0, 5).join(' ')} 恭喜中奖！ {EMOJI_CELEBRATE.slice(5).join(' ')}
          </div>

          {/* 关闭按钮（仅 done 阶段显示） */}
          {phase === 'done' && (
            <button
              onClick={handleClose}
              style={{
                marginTop: '30px',
                padding: '12px 40px',
                fontSize: '18px',
                fontWeight: 600,
                color: '#fff',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '24px',
                cursor: 'pointer',
                letterSpacing: '2px',
                transition: 'all 0.3s',
              }}
            >
              ✕ 关闭（30秒后自动关闭）
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes luckyFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes luckyPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes luckyReveal {
          from { transform: scale(0.5) translateY(30px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
