import React, { useEffect, useRef, useState, useCallback } from 'react'

const DANMAKU_SPEED_MIN = 100 // px/s
const DANMAKU_SPEED_MAX = 200
const DANMAKU_FONT_MIN = 32
const DANMAKU_FONT_MAX = 48
const LANE_HEIGHT = 56

export default function DanmakuLayer({ socket, mode }) {
  const containerRef = useRef(null)
  const [danmakus, setDanmakus] = useState([])
  const idCounterRef = useRef(0)
  const activeRef = useRef([])

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

    socket.on('danmaku:new', handleDanmaku)
    socket.on('danmaku:cleared', handleClear)

    return () => {
      socket.off('danmaku:new', handleDanmaku)
      socket.off('danmaku:cleared', handleClear)
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

      <style>{`
        @keyframes danmakuScroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(-100vw - 500px));
          }
        }
      `}</style>
    </div>
  )
}
