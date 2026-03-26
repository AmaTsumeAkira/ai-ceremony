import React, { useEffect, useState, useCallback, useRef } from 'react'

export default function EmojiFloat({ socket }) {
  const [emojis, setEmojis] = useState([])
  const idRef = useRef(0)

  const addEmoji = useCallback((data) => {
    const id = ++idRef.current
    const emoji = {
      id,
      text: data.emoji,
      nickname: data.nickname,
      x: (data.x || 0.2 + Math.random() * 0.6) * 100, // percent
      duration: 3 + Math.random() * 2, // 3-5s
      size: 32 + Math.random() * 24, // 32-56px
    }
    setEmojis(prev => [...prev, emoji])
    setTimeout(() => {
      setEmojis(prev => prev.filter(e => e.id !== id))
    }, emoji.duration * 1000 + 500)
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('emoji:float', addEmoji)
    return () => socket.off('emoji:float', addEmoji)
  }, [socket, addEmoji])

  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none', zIndex: 20,
      overflow: 'hidden',
    }}>
      {emojis.map(e => (
        <div
          key={e.id}
          style={{
            position: 'absolute',
            bottom: '-60px',
            left: `${e.x}%`,
            fontSize: `${e.size}px`,
            animation: `emojiRise ${e.duration}s ease-out forwards`,
            textAlign: 'center',
          }}
        >
          <div>{e.text}</div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.7)',
            marginTop: 2,
          }}>
            {e.nickname}
          </div>
        </div>
      ))}
      <style>{`
        @keyframes emojiRise {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          10% { transform: translateY(-10vh) scale(1); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-110vh) scale(1.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
