import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : (window.location.protocol === 'https:' 
    ? `${window.location.protocol}//${window.location.host}` 
    : `${window.location.protocol}//${window.location.hostname}:6588`)

export function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const s = io(SERVER_URL, {
      // 微信内置浏览器可能阻止 WebSocket，允许 polling 降级
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      // 存储 userId 到 localStorage 用于断线重连恢复身份
      auth: {
        userId: localStorage.getItem('ceremony_userId') || null,
      },
    })

    socketRef.current = s
    setSocket(s)

    s.on('connect', () => {
      console.log('[Socket] Connected:', s.id)
      setConnected(true)
    })

    s.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
      setConnected(false)
    })

    s.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
    })

    return () => {
      s.disconnect()
      socketRef.current = null
      setSocket(null)
    }
  }, [])

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
      return true
    }
    return false
  }, [])

  return { socket, connected, emit }
}
