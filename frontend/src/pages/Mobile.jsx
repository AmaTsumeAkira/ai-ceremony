import React, { useState, useEffect, useRef } from 'react'
import { Input, Button, message as antMessage, ConfigProvider, theme, Tag } from 'antd'
import {
  SendOutlined,
  UploadOutlined,
  CheckCircleFilled,
  MessageOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import { useSocket } from '../hooks/useSocket'
import FaceUploader from '../components/FaceUploader'

const COLORS = [
  { name: '冰蓝', value: '#40a9ff' },
  { name: '极光绿', value: '#52c41a' },
  { name: '活力橙', value: '#fa8c16' },
  { name: '梦幻紫', value: '#722ed1' },
  { name: '樱花粉', value: '#eb2f96' },
  { name: '炽焰红', value: '#f5222d' },
]

const EMOJIS = ['🔥', '❤️', '👏', '🎉', '😂', '🤩', '💯', '✨', '🚀', '👍']

const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`

export default function Mobile() {
  const { socket, connected, emit } = useSocket()
  const [nickname, setNickname] = useState('')
  const [registered, setRegistered] = useState(false)
  const [danmakuText, setDanmakuText] = useState('')
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value)
  const [currentMode, setCurrentMode] = useState('idle')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [sending, setSending] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [userId, setUserId] = useState(null)
  const inputRef = useRef(null)
  const [flyAnim, setFlyAnim] = useState(false)
  const hasJoinedRef = useRef(false)

  // Nickname edit state
  const [editingNickname, setEditingNickname] = useState(false)
  const [newNickname, setNewNickname] = useState('')

  // Poll state
  const [activePoll, setActivePoll] = useState(null)
  const [votedPollId, setVotedPollId] = useState(null)
  const [pollResults, setPollResults] = useState(null)

  // Blessing state
  const [blessingText, setBlessingText] = useState('')
  const [sendingBlessing, setSendingBlessing] = useState(false)

  // System message state
  const [systemMsg, setSystemMsg] = useState(null)

  // Recent danmaku preview state
  const [recentDanmaku, setRecentDanmaku] = useState([])

  // Listen for mode changes
  useEffect(() => {
    if (!socket) return
    const handleMode = (data) => {
      setCurrentMode(data.mode || 'idle')
    }
    const handleState = (state) => {
      if (state.mode) setCurrentMode(state.mode)
    }
    const handleJoined = (data) => {
      if (data?.id) {
        setUserId(data.id)
        localStorage.setItem('ceremony_userId', String(data.id))
      }
    }
    const handleReconnected = (data) => {
      if (data?.id) {
        setUserId(data.id)
        setRegistered(true)
        antMessage.success('已恢复连接')
      }
    }
    socket.on('mode:changed', handleMode)
    socket.on('control:state', handleState)
    socket.on('user:joined', handleJoined)
    socket.on('user:reconnected', handleReconnected)

    // Poll listeners
    const handlePollCreated = (data) => { setActivePoll(data); setPollResults(null); setVotedPollId(null); }
    const handlePollResults = (data) => { if (data) { setPollResults(data); setActivePoll(data); } }
    const handlePollClosed = (data) => { if (data) setPollResults(data); setActivePoll(prev => prev ? { ...prev, status: 'closed' } : null); }
    const handlePollHidden = () => { setActivePoll(null); setPollResults(null); setVotedPollId(null); }
    const handlePollActive = (data) => { if (data && data.status === 'active') { setActivePoll(data); setPollResults(data); } else if (data && data.status === 'closed') { setPollResults(data); } else { setActivePoll(null); setPollResults(null); } }
    const handlePollVoted = (data) => { if (data) setVotedPollId(data.pollId); }

    socket.on('poll:created', handlePollCreated)
    socket.on('poll:results', handlePollResults)
    socket.on('poll:closed', handlePollClosed)
    socket.on('poll:hidden', handlePollHidden)
    socket.on('poll:active', handlePollActive)
    socket.on('poll:voted', handlePollVoted)

    // System message listener
    socket.on('system:message', (data) => {
      setSystemMsg(data.text)
    })

    // Nickname change result
    socket.on('user:nickname-changed', (data) => {
      if (data.ok) {
        setNickname(data.nickname)
        localStorage.setItem('ai_ceremony_nickname', data.nickname)
        setEditingNickname(false)
        antMessage.success('昵称修改成功！')
      } else {
        antMessage.error(data.message || '修改失败')
      }
    })

    // Blessing sent result
    socket.on('blessing:sent', () => {
      antMessage.success('🎊 祝福已发送！')
    })

    // Blessing cleared (consistency — clear local state if needed)
    const handleBlessingCleared = () => {
      setBlessingText('')
    }
    socket.on('blessing:cleared', handleBlessingCleared)

    // Recent danmaku preview
    const handleDanmakuNew = (data) => {
      const entry = {
        id: `${data.nickname}_${data.content}_${Date.now()}`,
        nickname: data.nickname || '匿名',
        content: data.content,
        color: data.color || '#40a9ff',
        ts: Date.now(),
      }
      setRecentDanmaku(prev => [...prev.slice(-4), entry])
      setTimeout(() => {
        setRecentDanmaku(prev => prev.filter(d => d.id !== entry.id))
      }, 5000)
    }
    const handleDanmakuCleared = () => {
      setRecentDanmaku([])
    }
    socket.on('danmaku:new', handleDanmakuNew)
    socket.on('danmaku:cleared', handleDanmakuCleared)

    // Request current poll on connect
    socket.emit('poll:get-active')

    return () => {
      socket.off('mode:changed', handleMode)
      socket.off('control:state', handleState)
      socket.off('user:joined', handleJoined)
      socket.off('user:reconnected', handleReconnected)
      socket.off('poll:created', handlePollCreated)
      socket.off('poll:results', handlePollResults)
      socket.off('poll:closed', handlePollClosed)
      socket.off('poll:hidden', handlePollHidden)
      socket.off('poll:active', handlePollActive)
      socket.off('poll:voted', handlePollVoted)
      socket.off('system:message')
      socket.off('user:nickname-changed')
      socket.off('blessing:cleared', handleBlessingCleared)
      socket.off('danmaku:new', handleDanmakuNew)
      socket.off('danmaku:cleared', handleDanmakuCleared)
    }
  }, [socket])

  // Auto-dismiss system message after 8 seconds
  useEffect(() => {
    if (!systemMsg) return
    const timer = setTimeout(() => setSystemMsg(null), 8000)
    return () => clearTimeout(timer)
  }, [systemMsg])

  const handleRegister = () => {
    if (!nickname.trim()) {
      antMessage.warning('请输入昵称')
      return
    }
    if (socket?.connected) {
      emit('user:join', { nickname: nickname.trim() })
      setRegistered(true)
      localStorage.setItem('ai_ceremony_nickname', nickname.trim())
      antMessage.success('注册成功！')
    } else {
      antMessage.error('未连接到服务器')
    }
  }

  // Reset hasJoinedRef only on actual disconnect (socket event), not on every re-render
  useEffect(() => {
    if (!socket) return
    const handleDisconnect = () => {
      hasJoinedRef.current = false
    }
    socket.on('disconnect', handleDisconnect)
    return () => {
      socket.off('disconnect', handleDisconnect)
    }
  }, [socket])

  // Auto-register if previously registered (only once per connection)
  useEffect(() => {
    if (!connected || hasJoinedRef.current) return
    const saved = localStorage.getItem('ai_ceremony_nickname')
    const savedUserId = localStorage.getItem('ceremony_userId')
    if (saved && savedUserId) {
      setNickname(saved)
      setUserId(Number(savedUserId))
      emit('user:join', { nickname: saved, reconnectUserId: Number(savedUserId) })
      setRegistered(true)
      hasJoinedRef.current = true
    } else if (saved) {
      setNickname(saved)
      emit('user:join', { nickname: saved })
      setRegistered(true)
      hasJoinedRef.current = true
    }
  }, [connected, emit])

  const handleSendDanmaku = () => {
    if (!danmakuText.trim()) return
    if (!connected) { antMessage.warning('连接断开，请稍候...'); return }
    setSending(true)
    setFlyAnim(true)
    emit('danmaku:send', {
      content: danmakuText.trim(),
      color: selectedColor,
    })
    setDanmakuText('')
    setTimeout(() => {
      setSending(false)
      setFlyAnim(false)
    }, 500)
  }

  const handleSendEmoji = (emoji) => {
    if (!connected) { antMessage.warning('连接断开，请稍候...'); return }
    emit('emoji:send', { emoji })
  }

  const handleAvatarUploaded = (url) => {
    setAvatarUrl(url)
  }

  const handleVote = (pollId, optionIndex) => {
    if (!connected) { antMessage.warning('连接断开，请稍候...'); return }
    emit('poll:vote', { pollId, optionIndex })
    setVotedPollId(pollId)
  }

  const handleSendBlessing = () => {
    if (!blessingText.trim()) return
    if (!connected) { antMessage.warning('连接断开，请稍候...'); return }
    setSendingBlessing(true)
    emit('blessing:send', { content: blessingText.trim() })
    setBlessingText('')
    setTimeout(() => setSendingBlessing(false), 1000)
  }

  const handleChangeNickname = () => {
    if (!newNickname.trim()) { antMessage.warning('请输入新昵称'); return }
    if (newNickname.trim() === nickname) { setEditingNickname(false); return }
    if (!connected) { antMessage.warning('连接断开，请稍候...'); return }
    emit('user:change-nickname', { nickname: newNickname.trim() })
  }

  const getModeLabel = (mode) => {
    const labels = {
      idle: '待命中',
      speaker: '🎤 讲者模式',
      climax: '🔥 高潮模式',
      shatter: '💥 破碎进行中',
      rebuild: '🔨 重建进行中',
      danmaku: '💬 弹幕模式',
      mosaic: '🧩 马赛克模式',
    }
    return labels[mode] || '待命中'
  }

  const getModeColor = (mode) => {
    const colors = {
      idle: '#666',
      speaker: '#722ed1',
      climax: '#f5222d',
      shatter: '#f5222d',
      rebuild: '#52c41a',
      danmaku: '#40a9ff',
      mosaic: '#722ed1',
    }
    return colors[mode] || '#666'
  }

  // Registration screen
  if (!registered) {
    return (
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <div style={styles.registerContainer}>
          <div style={styles.registerCard}>
            <div style={styles.logoArea}>
              <div style={styles.logoGlow}>
                <span style={styles.logoText}>AI</span>
              </div>
              <h1 style={styles.title}>素养大赛</h1>
              <p style={styles.subtitle}>开幕式互动系统</p>
            </div>
            <div style={styles.registerForm}>
              <Input
                placeholder="请输入你的昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onPressEnter={handleRegister}
                size="large"
                style={styles.input}
                maxLength={12}
                prefix={<MessageOutlined style={{ color: '#666' }} />}
              />
              <Button
                type="primary"
                size="large"
                block
                onClick={handleRegister}
                style={styles.registerBtn}
                disabled={!connected}
              >
                {connected ? '加入互动' : '连接中...'}
              </Button>
            </div>
            <div style={styles.statusDot}>
              <span style={{
                ...styles.dot,
                background: connected ? '#52c41a' : '#f5222d'
              }} />
              <span style={styles.statusText}>
                {connected ? '服务器已连接' : '正在连接服务器...'}
              </span>
            </div>
          </div>
        </div>
      </ConfigProvider>
    )
  }

  // Main mobile UI
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span
              style={{ ...styles.nickname, cursor: 'pointer' }}
              onClick={() => { setNewNickname(nickname); setEditingNickname(true) }}
              title="点击修改昵称"
            >
              👤 {nickname} ✏️
            </span>
          </div>
          <div style={styles.headerRight}>
            <span style={{
              ...styles.modeTag,
              background: getModeColor(currentMode) + '20',
              color: getModeColor(currentMode),
              border: `1px solid ${getModeColor(currentMode)}40`,
            }}>
              {getModeLabel(currentMode)}
            </span>
          </div>
        </div>

        {/* Nickname Edit Modal */}
        {editingNickname && (
          <div style={styles.modalOverlay} onClick={() => setEditingNickname(false)}>
            <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: '#fff', margin: '0 0 16px', fontSize: 18, textAlign: 'center' }}>修改昵称</h3>
              <Input
                placeholder="输入新昵称"
                value={newNickname}
                onChange={e => setNewNickname(e.target.value)}
                onPressEnter={handleChangeNickname}
                maxLength={12}
                size="large"
                style={{ marginBottom: 16 }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <Button block onClick={() => setEditingNickname(false)}>取消</Button>
                <Button type="primary" block onClick={handleChangeNickname}>确认修改</Button>
              </div>
            </div>
          </div>
        )}

        {/* System Message */}
        {systemMsg && (
          <div
            style={styles.systemMsg}
            onClick={() => setSystemMsg(null)}
          >
            <span style={{ marginRight: 8 }}>💬</span>
            <span style={{ flex: 1 }}>{systemMsg}</span>
            <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>✕</span>
          </div>
        )}

        {/* Avatar Section */}
        <div style={styles.avatarSection}>
          <FaceUploader
            nickname={nickname}
            userId={userId}
            avatarUrl={avatarUrl}
            onUploaded={handleAvatarUploaded}
          />

          {/* Poll Voting */}
          {activePoll && activePoll.status === 'active' && (
            <div style={styles.pollContainer}>
              <div style={styles.pollHeader}>
                <span style={{ fontSize: 20 }}>📊</span>
                <span style={styles.pollQuestion}>{activePoll.question}</span>
              </div>
              {votedPollId === activePoll.id ? (
                <div style={styles.pollResults}>
                  {activePoll.options.map((opt, i) => {
                    const count = pollResults ? (pollResults.votes[i] || 0) : 0;
                    const pct = pollResults && pollResults.totalVotes > 0 ? Math.round((count / pollResults.totalVotes) * 100) : 0;
                    return (
                      <div key={i} style={styles.pollResultRow}>
                        <div style={styles.pollResultBar}>
                          <div style={{
                            ...styles.pollResultFill,
                            width: `${pct}%`,
                          }} />
                          <span style={styles.pollResultText}>{opt}</span>
                        </div>
                        <span style={styles.pollResultPct}>{pct}%</span>
                      </div>
                    );
                  })}
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                    共 {pollResults ? pollResults.totalVotes : activePoll.totalVotes} 人投票
                  </div>
                </div>
              ) : (
                <div style={styles.pollOptions}>
                  {activePoll.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleVote(activePoll.id, i)}
                      style={styles.pollOptionBtn}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Poll ended */}
          {pollResults && (!activePoll || activePoll.status === 'closed') && (
            <div style={styles.pollContainer}>
              <div style={styles.pollHeader}>
                <span style={{ fontSize: 20 }}>📊</span>
                <span style={styles.pollQuestion}>{pollResults.question}</span>
                <Tag color="default" style={{ fontSize: 11 }}>已结束</Tag>
              </div>
              <div style={styles.pollResults}>
                {pollResults.options.map((opt, i) => {
                  const count = pollResults.votes[i] || 0;
                  const pct = pollResults.totalVotes > 0 ? Math.round((count / pollResults.totalVotes) * 100) : 0;
                  return (
                    <div key={i} style={styles.pollResultRow}>
                      <div style={styles.pollResultBar}>
                        <div style={{ ...styles.pollResultFill, width: `${pct}%` }} />
                        <span style={styles.pollResultText}>{opt}</span>
                      </div>
                      <span style={styles.pollResultPct}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Blessing Wall Input */}
        <div style={styles.blessingSection}>
          <div style={styles.blessingHeader}>
            <span style={{ fontSize: 18 }}>🎊</span>
            <span style={styles.blessingTitle}>送祝福</span>
          </div>
          <div style={styles.blessingInputRow}>
            <Input
              placeholder="写下你的祝福..."
              value={blessingText}
              onChange={(e) => setBlessingText(e.target.value)}
              onPressEnter={handleSendBlessing}
              maxLength={80}
              style={styles.blessingInput}
              disabled={sendingBlessing}
            />
            <Button
              type="primary"
              onClick={handleSendBlessing}
              loading={sendingBlessing}
              style={styles.blessingSendBtn}
            >
              发送
            </Button>
          </div>
        </div>

        {/* Recent Danmaku Preview */}
        {recentDanmaku.length > 0 && (
          <div style={styles.recentDanmaku}>
            <div style={styles.recentDanmakuHeader}>
              <span style={{ fontSize: 14 }}>💬</span>
              <span style={styles.recentDanmakuTitle}>最近弹幕</span>
            </div>
            {recentDanmaku.map((d) => (
              <div key={d.id} style={{ ...styles.recentDanmakuItem, borderLeftColor: d.color }}>
                <span style={styles.recentDanmakuNick}>{d.nickname}</span>
                <span style={styles.recentDanmakuContent}>{d.content}</span>
              </div>
            ))}
          </div>
        )}

        {/* Danmaku Input Area */}
        <div style={styles.danmakuArea}>
          {/* Emoji Bar */}
          <div style={styles.emojiBar}>
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => handleSendEmoji(e)}
                style={styles.emojiBtn}
                disabled={!connected}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Color Picker */}
          {showColorPicker && (
            <div style={styles.colorPicker}>
              {COLORS.map((c) => (
                <div
                  key={c.value}
                  onClick={() => {
                    setSelectedColor(c.value)
                    setShowColorPicker(false)
                  }}
                  style={{
                    ...styles.colorDot,
                    background: c.value,
                    transform: selectedColor === c.value ? 'scale(1.3)' : 'scale(1)',
                    boxShadow: selectedColor === c.value ? `0 0 12px ${c.value}` : 'none',
                  }}
                  title={c.name}
                />
              ))}
            </div>
          )}

          <div style={styles.inputRow}>
            <div
              onClick={() => setShowColorPicker(!showColorPicker)}
              style={{
                ...styles.colorBtn,
                background: selectedColor,
                boxShadow: `0 0 10px ${selectedColor}40`,
              }}
            />
            <Input
              ref={inputRef}
              placeholder="输入弹幕内容..."
              value={danmakuText}
              onChange={(e) => setDanmakuText(e.target.value)}
              onPressEnter={handleSendDanmaku}
              style={styles.danmakuInput}
              maxLength={100}
              disabled={sending}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendDanmaku}
              loading={sending}
              style={{
                ...styles.sendBtn,
                animation: flyAnim ? 'flyOut 0.5s ease-out' : 'none',
              }}
            />
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}

const styles = {
  registerContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #0d1b3e 100%)',
    padding: '20px',
  },
  registerCard: {
    width: '100%',
    maxWidth: '380px',
    textAlign: 'center',
  },
  logoArea: {
    marginBottom: '48px',
  },
  logoGlow: {
    width: '100px',
    height: '100px',
    borderRadius: '24px',
    background: 'linear-gradient(135deg, #40a9ff, #722ed1, #eb2f96)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    boxShadow: '0 0 40px rgba(64, 169, 255, 0.3), 0 0 80px rgba(114, 46, 209, 0.2)',
  },
  logoText: {
    fontSize: '36px',
    fontWeight: '900',
    color: '#fff',
    letterSpacing: '2px',
    textShadow: '0 2px 10px rgba(0,0,0,0.3)',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 8px',
    letterSpacing: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '2px',
  },
  registerForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    height: '48px',
    fontSize: '16px',
  },
  registerBtn: {
    height: '48px',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #40a9ff, #722ed1)',
    border: 'none',
    boxShadow: '0 4px 20px rgba(64, 169, 255, 0.3)',
  },
  statusDot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '24px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
  statusText: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
  },

  // Main UI
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(0,0,0,0.3)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  nickname: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  headerRight: {},
  modeTag: {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontWeight: '500',
  },
  systemMsg: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    margin: '0 16px',
    marginTop: '8px',
    background: 'rgba(19, 194, 194, 0.15)',
    border: '1px solid rgba(19, 194, 194, 0.3)',
    borderRadius: '12px',
    color: '#13c2c2',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    animation: 'slideUp 0.3s ease-out',
  },
  avatarSection: {
    flex: 1,
    padding: '20px 16px',
    overflow: 'auto',
  },
  danmakuArea: {
    position: 'sticky',
    bottom: 0,
    padding: '12px 16px',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
    background: 'rgba(10, 10, 26, 0.95)',
    backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  colorPicker: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '12px',
    padding: '8px 0',
    animation: 'slideUp 0.3s ease-out',
  },
  colorDot: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  inputRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  colorBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s',
  },
  danmakuInput: {
    flex: 1,
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    height: '40px',
  },
  sendBtn: {
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #40a9ff, #722ed1)',
    border: 'none',
    flexShrink: 0,
  },
  emojiBar: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  emojiBtn: {
    fontSize: '24px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.15s, background 0.15s',
    padding: 0,
  },
  pollContainer: {
    marginTop: 20,
    padding: '16px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    border: '1px solid rgba(64,169,255,0.2)',
  },
  pollHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 14,
  },
  pollQuestion: {
    fontSize: 16, fontWeight: 700, color: '#fff', flex: 1,
  },
  pollOptions: {
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  pollOptionBtn: {
    padding: '12px 16px',
    fontSize: 15, fontWeight: 600,
    color: '#fff',
    background: 'rgba(64,169,255,0.15)',
    border: '1px solid rgba(64,169,255,0.3)',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
  pollResults: {
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  pollResultRow: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  pollResultBar: {
    flex: 1, position: 'relative',
    height: 36, borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  pollResultFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    background: 'linear-gradient(90deg, rgba(64,169,255,0.4), rgba(114,46,209,0.3))',
    borderRadius: 8,
    transition: 'width 0.5s ease',
  },
  pollResultText: {
    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
    fontSize: 14, fontWeight: 600, color: '#fff',
    zIndex: 1,
  },
  pollResultPct: {
    fontSize: 14, fontWeight: 700, color: '#40a9ff',
    width: 40, textAlign: 'right', flexShrink: 0,
  },
  modalOverlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
  },
  modalCard: {
    width: '85%', maxWidth: 360, padding: '24px 20px',
    background: 'linear-gradient(135deg, #1a1a2e, #0d1b3e)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },

  // Blessing section
  blessingSection: {
    marginTop: 16,
    padding: '14px 16px',
    background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,100,50,0.04))',
    borderRadius: 16,
    border: '1px solid rgba(255,215,0,0.15)',
  },
  blessingHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginBottom: 12,
  },
  blessingTitle: {
    fontSize: 15, fontWeight: 700, color: '#ffd700',
    letterSpacing: '1px',
  },
  blessingInputRow: {
    display: 'flex', gap: 10,
  },
  blessingInput: {
    flex: 1,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,215,0,0.15)',
    height: 40,
  },
  blessingSendBtn: {
    borderRadius: 20,
    fontWeight: 600,
    background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
    border: 'none',
    color: '#000',
  },

  // Recent danmaku preview
  recentDanmaku: {
    marginTop: 16,
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  recentDanmakuHeader: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginBottom: 8,
  },
  recentDanmakuTitle: {
    fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
    letterSpacing: '1px',
  },
  recentDanmakuItem: {
    display: 'flex', gap: 8, alignItems: 'baseline',
    padding: '6px 8px',
    marginBottom: 4,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    borderLeft: '3px solid #40a9ff',
    animation: 'slideUp 0.3s ease-out',
  },
  recentDanmakuNick: {
    fontSize: 12, color: 'rgba(255,255,255,0.5)',
    fontWeight: 500, flexShrink: 0,
    maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  recentDanmakuContent: {
    fontSize: 13, color: '#fff', flex: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
}
