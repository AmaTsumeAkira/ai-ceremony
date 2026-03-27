import React, { useEffect, useRef, useState, useCallback } from 'react'

const DANMAKU_SPEED_MIN = 100 // px/s
const DANMAKU_SPEED_MAX = 200
const DANMAKU_FONT_MIN = 32
const DANMAKU_FONT_MAX = 48
const LANE_HEIGHT = 56
const PINNED_DURATION = 3000 // 精选弹幕高亮展示时长 ms

export default function DanmakuLayer({ socket, mode }) {
  const containerRef = useRef(null)
  const [danmakus, setDanmakus] = useState([])
  const idCounterRef = useRef(0)
  const activeRef = useRef([])

  // Pinned danmaku state — gold highlight display
  const [pinnedDanmaku, setPinnedDanmaku] = useState(null)

  // Add a new danmaku
  const addDanmaku = useCallback((data) => {
    const id = ++idCounterRef.current
    const speed = DANMAKU_SPEED_MIN + Math.random() * (DANMAKU_SPEED_MAX - DANMAKU_SPEED_MIN)
    const fontSize = DANMAKU_FONT_MIN + Math.random() * (DANMAKU_FONT_MAX - DANMAKU_FONT_MIN)
    const containerHeight = containerRef.current?.clientHeight || 800
    const laneCount = Math.floor(containerHeight / LANE_HEIGHT)
    const lane = Math.floor(Math.random() * laneCount)
    const top = lane * LANE_HEIGHT + 10

    const danmaku = {
      id,
      text: data.text || data.content || '',
      color: data.color || '#40a9ff',
      fontSize,
      speed,
      top,
      createdAt: Date.now(),
    }

    activeRef.current.push(danmaku)
    setDanmakus([...activeRef.current])

    // Auto-remove after animation
    const containerWidth = containerRef.current?.clientWidth || 1920
    const duration = (containerWidth + 500) / speed * 1000
    setTimeout(() => {
      activeRef.current = activeRef.current.filter(d => d.id !== id)
      setDanmakus([...activeRef.current])
    }, duration + 500)
  }, [])

  // Socket listener
  useEffect(() => {
    if (!socket) return

    const handleDanmaku = (data) => {
      addDanmaku(data)
    }

    const handleClear = () => {
      activeRef.current = []
      setDanmakus([])
    }

    // Handle pinned danmaku — show gold highlight overlay
    const handlePinned = (data) => {
      setPinnedDanmaku(data)
      setTimeout(() => setPinnedDanmaku(null), PINNED_DURATION)
    }

    socket.on('danmaku:new', handleDanmaku)
    socket.on('danmaku:cleared', handleClear)
    socket.on('danmaku:pinned', handlePinned)

    return () => {
      socket.off('danmaku:new', handleDanmaku)
      socket.off('danmaku:cleared', handleClear)
      socket.off('danmaku:pinned', handlePinned)
    }
  }, [socket, addDanmaku])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = []
    }
  }, [])

  const containerWidth = containerRef.current?.clientWidth || 1920

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {danmakus.map((d) => {
        const duration = (containerWidth + 500) / d.speed
        return (
          <div
            key={d.id}
            style={{
              position: 'absolute',
              top: `${d.top}px`,
              left: '100%',
              whiteSpace: 'nowrap',
              fontSize: `${d.fontSize}px`,
              fontWeight: '700',
              color: d.color,
              textShadow: `
                -1px -1px 2px rgba(0,0,0,0.8),
                1px -1px 2px rgba(0,0,0,0.8),
                -1px 1px 2px rgba(0,0,0,0.8),
                1px 1px 2px rgba(0,0,0,0.8),
                0 0 10px ${d.color}40
              `,
              animation: `danmakuScroll ${duration}s linear forwards`,
              willChange: 'transform',
              letterSpacing: '1px',
            }}
          >
            {d.text}
          </div>
        )
      })}

      {/* Pinned danmaku — gold highlight overlay at center */}
      {pinnedDanmaku && (
        <div
          key={`pinned-${pinnedDanmaku.id}-${Date.now()}`}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            padding: '24px 60px',
            background: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,140,0,0.15))',
            border: '3px solid #ffd700',
            borderRadius: 20,
            boxShadow: '0 0 40px rgba(255,215,0,0.5), 0 0 80px rgba(255,215,0,0.2), inset 0 0 30px rgba(255,215,0,0.1)',
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
            animation: 'pinnedAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), pinnedFadeOut 0.6s ease-in 2.4s forwards',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{
            fontSize: 14,
            color: '#ffd700',
            fontWeight: 600,
            marginBottom: 8,
            letterSpacing: '2px',
            textShadow: '0 0 10px rgba(255,215,0,0.6)',
          }}>
            ⭐ 精选弹幕
          </div>
          <div style={{
            fontSize: 'clamp(28px, 6vw, 56px)',
            fontWeight: 900,
            color: '#fff',
            textShadow: '0 0 20px rgba(255,215,0,0.8), 0 2px 10px rgba(0,0,0,0.5)',
            letterSpacing: '2px',
          }}>
            {pinnedDanmaku.content}
          </div>
          <div style={{
            fontSize: 14,
            color: 'rgba(255,215,0,0.7)',
            marginTop: 8,
          }}>
            —— {pinnedDanmaku.nickname}
          </div>
        </div>
      )}

      <style>{`
        @keyframes danmakuScroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(-100vw - 500px));
          }
        }
        @keyframes pinnedAppear {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.6);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        @keyframes pinnedFadeOut {
          from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          to {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.05);
          }
        }
      `}</style>
    </div>
  )
}
