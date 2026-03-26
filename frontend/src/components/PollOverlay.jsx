import React, { useState, useEffect, useRef } from 'react';

export default function PollOverlay({ socket }) {
  const [poll, setPoll] = useState(null);
  const [visible, setVisible] = useState(false);
  const [animatedVotes, setAnimatedVotes] = useState([]);
  const animRef = useRef(null);

  const BAR_COLORS = ['#40a9ff', '#722ed1', '#eb2f96', '#52c41a', '#fa8c16', '#ffd700'];

  // Smooth animation for vote bars
  useEffect(() => {
    if (!poll || !visible) return;
    const targetVotes = poll.votes || [];
    if (animatedVotes.length !== targetVotes.length) {
      setAnimatedVotes(targetVotes);
      return;
    }
    const animate = () => {
      setAnimatedVotes(prev => {
        const next = prev.map((v, i) => {
          const target = targetVotes[i] || 0;
          const diff = target - v;
          if (Math.abs(diff) < 0.5) return target;
            return v + diff * 0.15;
        });
        if (next.some((v, i) => Math.abs(v - (targetVotes[i] || 0)) >= 0.5)) {
          animRef.current = requestAnimationFrame(animate);
        }
        return next;
      });
    };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [poll?.votes, visible]);

  useEffect(() => {
    if (!socket) return;

    const handleCreated = (data) => {
      setPoll(data);
      setVisible(true);
      setAnimatedVotes(data.votes || data.options.map(() => 0));
    };

    const handleResults = (data) => {
      if (data) {
        setPoll(data);
        if (!visible) setVisible(true);
      }
    };

    const handleClosed = (data) => {
      if (data) setPoll(data);
    };

    const handleHidden = () => {
      setVisible(false);
    };

    const handleActive = (data) => {
      if (data && data.status === 'active') {
        setPoll(data);
        setVisible(true);
        setAnimatedVotes(data.votes || []);
      }
    };

    socket.on('poll:created', handleCreated);
    socket.on('poll:results', handleResults);
    socket.on('poll:closed', handleClosed);
    socket.on('poll:hidden', handleHidden);
    socket.on('poll:active', handleActive);

    // Request current active poll on mount
    socket.emit('poll:get-active');

    return () => {
      socket.off('poll:created', handleCreated);
      socket.off('poll:results', handleResults);
      socket.off('poll:closed', handleClosed);
      socket.off('poll:hidden', handleHidden);
      socket.off('poll:active', handleActive);
    };
  }, [socket]);

  if (!visible || !poll) return null;

  const maxVotes = Math.max(1, ...poll.votes);
  const isClosed = poll.status === 'closed';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 7000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(10px)',
      animation: 'pollFadeIn 0.5s ease-out',
    }}>
      <div style={{
        width: '80vw', maxWidth: 900,
        padding: '40px',
        background: 'linear-gradient(135deg, rgba(64,169,255,0.1), rgba(114,46,209,0.1))',
        border: '2px solid rgba(64,169,255,0.3)',
        borderRadius: 24,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 60px rgba(64,169,255,0.2)',
        animation: 'pollScaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {/* Title */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32,
        }}>
          <span style={{ fontSize: 36 }}>📊</span>
          <div>
            <div style={{
              fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 900, color: '#fff',
              textShadow: '0 0 20px rgba(64,169,255,0.5)',
              letterSpacing: '2px',
            }}>
              {poll.question}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 }}>
              {isClosed ? '投票已结束' : '请选择你的答案'} · 共 {poll.totalVotes} 人参与
            </div>
          </div>
        </div>

        {/* Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {poll.options.map((option, i) => {
            const voteCount = Math.round(animatedVotes[i] || 0);
            const percent = poll.totalVotes > 0 ? Math.round((voteCount / poll.totalVotes) * 100) : 0;
            const barWidth = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;
            return (
              <div key={i} style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <span style={{
                    fontSize: 'clamp(18px, 3vw, 28px)', fontWeight: 700, color: '#fff',
                    zIndex: 1, position: 'relative',
                  }}>
                    {option}
                  </span>
                  <span style={{
                    fontSize: 'clamp(16px, 2.5vw, 24px)', fontWeight: 700,
                    color: BAR_COLORS[i % BAR_COLORS.length],
                    zIndex: 1, position: 'relative',
                  }}>
                    {voteCount} 票 ({percent}%)
                  </span>
                </div>
                <div style={{
                  height: 'clamp(28px, 4vw, 48px)',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, ${BAR_COLORS[i % BAR_COLORS.length]}cc, ${BAR_COLORS[i % BAR_COLORS.length]}40)`,
                    borderRadius: 12,
                    transition: 'width 0.3s ease-out',
                    boxShadow: `0 0 20px ${BAR_COLORS[i % BAR_COLORS.length]}40`,
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Status */}
        {isClosed && (
          <div style={{
            textAlign: 'center', marginTop: 28,
            color: 'rgba(255,255,255,0.6)', fontSize: 16,
            letterSpacing: '4px',
          }}>
            🏆 投票结束
          </div>
        )}
      </div>

      <style>{`
        @keyframes pollFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pollScaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
