import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ConfigProvider,
  theme,
  Button,
  Slider,
  InputNumber,
  Input,
  Segmented,
  Progress,
  Card,
  Statistic,
  Row,
  Col,
  Tag,
  Space,
  message as antMessage,
} from 'antd'
import {
  ThunderboltOutlined,
  ReloadOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  DeleteOutlined,
  DashboardOutlined,
  TeamOutlined,
  PictureOutlined,
  MessageOutlined,
  FireOutlined,
  UploadOutlined,
  ClearOutlined,
  LockOutlined,
  DownloadOutlined,
  StarOutlined,
} from '@ant-design/icons'
import { useSocket } from '../hooks/useSocket'
import DanmakuLeaderboard from '../components/DanmakuLeaderboard'
import EmojiLeaderboard from '../components/EmojiLeaderboard'
import ActiveUsersLeaderboard from '../components/ActiveUsersLeaderboard'
import CheckinStats from '../components/CheckinStats'
import CheckinLeaderboard from '../components/CheckinLeaderboard'
import ActivityOverview from '../components/ActivityOverview'
import LeaderboardPoster from '../components/LeaderboardPoster'
import JoinQRCode from '../components/JoinQRCode'
import EventDashboard from '../components/EventDashboard'
import axios from 'axios'

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`

const MODES = [
  { label: '空闲', value: 'idle' },
  { label: '讲者', value: 'speaker' },
  { label: '高潮', value: 'climax' },
  { label: '破碎', value: 'shatter' },
  { label: '弹幕', value: 'danmaku' },
  { label: '马赛克', value: 'mosaic' },
]

const AGENDA_STAGES = [
  { key: 'welcome',  label: '开场前',        emoji: '🎬', color: '#40a9ff' },
  { key: 'review',   label: '循迹·往届回顾', emoji: '📹', color: '#13c2c2' },
  { key: 'route',    label: '定航·赛道介绍', emoji: '🗺️', color: '#722ed1' },
  { key: 'inspire',  label: '赋能·领导致辞', emoji: '🎤', color: '#eb2f96' },
  { key: 'launch',   label: '启跃·启动仪式', emoji: '🚀', color: '#f5222d' },
  { key: 'closing',  label: '合影留念',      emoji: '📸', color: '#52c41a' },
]

export default function Control() {
  const { socket, connected, emit } = useSocket()

  // Auth state
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  // State
  const [currentMode, setCurrentMode] = useState('idle')
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [avatarCount, setAvatarCount] = useState(0)
  const [danmakuCount, setDanmakuCount] = useState(0)
  const [rebuildProgress, setRebuildProgress] = useState(0)
  const [micEnabled, setMicEnabled] = useState(false)
  const [shoutThreshold, setShoutThreshold] = useState(50)
  const [energyThreshold, setEnergyThreshold] = useState(1000)
  const [currentVolume, setCurrentVolume] = useState(0)
  const [volumeBars, setVolumeBars] = useState(Array(20).fill(0))
  const [particleText, setParticleText] = useState('')
  const [backgroundUrl, setBackgroundUrl] = useState('')

  // Countdown state
  const [countdownSeconds, setCountdownSeconds] = useState(5)
  const [countdownActive, setCountdownActive] = useState(false)

  // Mosaic preview state
  const [mosaicPreview, setMosaicPreview] = useState(false)

  // Lucky draw state
  const [drawCount, setDrawCount] = useState(1)
  const [drawSpinning, setDrawSpinning] = useState(false)

  // Announcement state
  const [announcementText, setAnnouncementText] = useState('')
  const [announcementDuration, setAnnouncementDuration] = useState(5)
  const [announcementActive, setAnnouncementActive] = useState(false)

  // System message state
  const [systemMessage, setSystemMessage] = useState('')

  // Activity log state
  const [activityLogs, setActivityLogs] = useState([])

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [activePoll, setActivePoll] = useState(null)
  const [pollResults, setPollResults] = useState(null)

  // Leaderboard data for poster generation
  const [leaderboardData, setLeaderboardData] = useState([])

  // Danmaku list for pin feature
  const [danmakuList, setDanmakuList] = useState([])
  const [pinnedHistory, setPinnedHistory] = useState([])

  // Audio refs
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const micStreamRef = useRef(null)
  const animFrameRef = useRef(null)
  const lastSendTimeRef = useRef(0)
  const shoutThresholdRef = useRef(shoutThreshold)
  const energyThresholdRef = useRef(energyThreshold)

  // Keep refs in sync
  useEffect(() => { shoutThresholdRef.current = shoutThreshold }, [shoutThreshold])
  useEffect(() => { energyThresholdRef.current = energyThreshold }, [energyThreshold])

  // File input ref for background upload
  const bgFileRef = useRef(null)

  // ========== Auth ==========
  useEffect(() => {
    const saved = sessionStorage.getItem('ceremony_password')
    if (saved) {
      setPassword(saved)
    }
    setAuthChecked(true)
  }, [])

  useEffect(() => {
    if (!socket || !authChecked) return

    const handleAuthResult = (data) => {
      if (data.ok) {
        setAuthenticated(true)
        sessionStorage.setItem('ceremony_password', password)
        antMessage.success('认证成功')
      } else {
        setAuthenticated(false)
        sessionStorage.removeItem('ceremony_password')
        antMessage.error(data.message || '密码错误')
      }
    }

    const handleRegistered = (data) => {
      if (data.authenticated) {
        setAuthenticated(true)
      }
    }

    socket.on('control:auth-result', handleAuthResult)
    socket.on('control:registered', handleRegistered)

    // Check saved password on connect
    const saved = sessionStorage.getItem('ceremony_password')
    if (saved) {
      socket.emit('control:auth', { password: saved })
    }

    return () => {
      socket.off('control:auth-result', handleAuthResult)
      socket.off('control:registered', handleRegistered)
    }
  }, [socket, authChecked])

  const handleLogin = () => {
    if (!password.trim()) {
      antMessage.warning('请输入密码')
      return
    }
    emit('control:auth', { password: password.trim() })
  }

  // ========== Socket listeners ==========
  useEffect(() => {
    if (!socket) return

    const handleState = (state) => {
      if (state.mode) setCurrentMode(state.mode)
      if (state.threshold) setEnergyThreshold(Number(state.threshold))
      if (state.energy !== undefined && state.threshold) {
        setRebuildProgress(Number(state.energy) / Number(state.threshold) * 100)
      } else if (state.energy !== undefined) {
        setRebuildProgress(Number(state.energy) / 1000 * 100)
      }
      if (state.particleText) setParticleText(state.particleText)
      if (state.background !== undefined) setBackgroundUrl(state.background)
    }

    const handleMode = (data) => { setCurrentMode(data.mode) }
    const handleProgress = (progress) => { setRebuildProgress(typeof progress === 'number' ? progress : 0) }
    const handleUsersCount = (count) => { setOnlineUsers(count) }
    const handleShatterStart = () => { setCurrentMode('shatter') }

    socket.on('control:state', handleState)
    socket.on('mode:changed', handleMode)
    socket.on('shatter:progress', handleProgress)
    socket.on('control:users-count', handleUsersCount)
    socket.on('shatter:start', handleShatterStart)

    // Poll listeners
    const handlePollCreated = (data) => { setActivePoll(data); setPollResults(null); }
    const handlePollResults = (data) => { if (data) setPollResults(data); }
    const handlePollClosed = (data) => { if (data) { setPollResults(data); setActivePoll(prev => prev ? { ...prev, status: 'closed' } : null); } }
    const handlePollActive = (data) => { if (data) { setActivePoll(data); setPollResults(data); } else { setActivePoll(null); setPollResults(null); } }

    socket.on('poll:created', handlePollCreated)
    socket.on('poll:results', handlePollResults)
    socket.on('poll:closed', handlePollClosed)
    socket.on('poll:active', handlePollActive)

    // Danmaku listeners for pin feature
    const handleDanmakuNew = (data) => {
      setDanmakuList(prev => {
        const next = [...prev, { ...data, _key: `${data.id}_${Date.now()}` }]
        return next.slice(-50) // keep last 50
      })
    }
    const handleDanmakuCleared = () => { setDanmakuList([]) }

    socket.on('danmaku:new', handleDanmakuNew)
    socket.on('danmaku:cleared', handleDanmakuCleared)

    socket.emit('control:register')
    socket.emit('poll:get-active')

    return () => {
      socket.off('control:state', handleState)
      socket.off('mode:changed', handleMode)
      socket.off('shatter:progress', handleProgress)
      socket.off('control:users-count', handleUsersCount)
      socket.off('shatter:start', handleShatterStart)
      socket.off('poll:created', handlePollCreated)
      socket.off('poll:results', handlePollResults)
      socket.off('poll:closed', handlePollClosed)
      socket.off('poll:active', handlePollActive)
      socket.off('danmaku:new', handleDanmakuNew)
      socket.off('danmaku:cleared', handleDanmakuCleared)
    }
  }, [socket])

  // Load initial stats + logs
  useEffect(() => {
    const loadStats = async () => {
      try {
        const pwd = sessionStorage.getItem('ceremony_password');
        const headers = pwd ? { Authorization: `Bearer ${pwd}` } : {};
        const [statsRes, stateRes] = await Promise.all([
          axios.get(`${API_BASE}/api/stats`, { headers }),
          axios.get(`${API_BASE}/api/system/state`),
        ])
        const stats = statsRes.data
        setOnlineUsers(stats.online || 0)
        setAvatarCount(stats.faces || 0)
        setDanmakuCount(stats.danmaku || 0)
        if (stateRes.data.mode) setCurrentMode(stateRes.data.mode)
        if (stateRes.data.threshold) setEnergyThreshold(Number(stateRes.data.threshold))
      } catch (e) { /* ignore */ }
    }
    const loadLogs = async () => {
      try {
        const pwd = sessionStorage.getItem('ceremony_password');
        const headers = pwd ? { Authorization: `Bearer ${pwd}` } : {};
        const res = await axios.get(`${API_BASE}/api/logs?limit=50`, { headers })
        setActivityLogs(res.data)
      } catch (e) { /* ignore */ }
    }
    const loadLeaderboard = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/leaderboard/checkin?limit=10`)
        setLeaderboardData(res.data || [])
      } catch (e) { /* ignore */ }
    }
    const loadRecentDanmaku = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/danmaku/recent`)
        setDanmakuList((res.data || []).map(d => ({ ...d, _key: `${d.id}_${d.created_at}` })))
      } catch (e) { /* ignore */ }
    }
    loadStats()
    loadLogs()
    loadLeaderboard()
    loadRecentDanmaku()
  }, [])

  // ========== Mic ==========
  const readVolume = useCallback(() => {
    if (!analyserRef.current) return
    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)
    const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length
    const normalized = Math.round((avg / 255) * 100)
    setCurrentVolume(normalized)
    const bars = []
    const step = Math.floor(dataArray.length / 20)
    for (let i = 0; i < 20; i++) {
      const slice = dataArray.slice(i * step, (i + 1) * step)
      const barAvg = slice.reduce((s, v) => s + v, 0) / slice.length
      bars.push(Math.round((barAvg / 255) * 100))
    }
    setVolumeBars(bars)
    // 节流：每 100ms 最多发送一次，避免高频发包
    const now = Date.now()
    if (socket?.connected && now - lastSendTimeRef.current >= 100) {
      lastSendTimeRef.current = now
      socket.emit('control:voice-level', { level: normalized, threshold: shoutThresholdRef.current })
    }
    animFrameRef.current = requestAnimationFrame(readVolume)
  }, [socket])

  const toggleMic = async () => {
    if (micEnabled) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop())
      if (audioContextRef.current) audioContextRef.current.close()
      setMicEnabled(false)
      setCurrentVolume(0)
      setVolumeBars(Array(20).fill(0))
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        micStreamRef.current = stream
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyserRef.current = analyser
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        setMicEnabled(true)
        readVolume()
        antMessage.success('麦克风已开启')
      } catch (err) {
        antMessage.error('无法访问麦克风')
      }
    }
  }

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop())
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [])

  // ========== Actions ==========
  const handleShatter = () => { emit('control:shatter'); antMessage.info('💥 破碎指令已发送') }
  const handleRebuild = () => { emit('control:rebuild'); antMessage.info('🔨 重建指令已发送') }
  const handleClearDanmaku = () => { emit('control:clear-danmaku'); antMessage.info('🧹 弹幕已清空') }
  const handleModeChange = (mode) => { setCurrentMode(mode); emit('control:set-mode', { mode }); antMessage.success(`模式切换: ${MODES.find(m => m.value === mode)?.label}`) }
  const handleSetText = () => { if (!particleText.trim()) return; emit('control:set-text', { text: particleText.trim() }); antMessage.success(`粒子文字已更新`) }
  const handleAgenda = (stage) => { emit('control:set-agenda', { stage }); antMessage.success(`阶段切换: ${AGENDA_STAGES.find(s => s.key === stage)?.label}`) }

  const handleCountdown = () => {
    emit('control:countdown', { seconds: countdownSeconds })
    setCountdownActive(true)
    antMessage.info(`⏱️ ${countdownSeconds} 秒倒计时已开始`)
    setTimeout(() => setCountdownActive(false), countdownSeconds * 1000 + 1000)
  }

  const handleCountdownCancel = () => {
    emit('control:countdown-cancel')
    setCountdownActive(false)
    antMessage.warning('⏱️ 倒计时已取消')
  }

  const handleMosaicPreview = (enabled) => {
    setMosaicPreview(enabled)
    emit('control:mosaic-preview', { enabled })
    antMessage.success(enabled ? '马赛克预览已开启' : '马赛克预览已关闭')
  }

  const handleBackgroundUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await axios.post(`${API_BASE}/api/upload-background`, formData)
      setBackgroundUrl(res.data.url)
      antMessage.success('背景图片已上传并应用')
    } catch (err) {
      antMessage.error('上传失败: ' + (err.response?.data?.error || err.message))
    }
    e.target.value = ''
  }

  const handleClearBackground = () => {
    emit('control:set-background', { url: '' })
    setBackgroundUrl('')
    antMessage.success('背景已清除')
  }

  const handleAnnouncement = () => {
    if (!announcementText.trim()) {
      antMessage.warning('请输入公告内容')
      return
    }
    emit('control:announcement', { text: announcementText.trim(), duration: announcementDuration })
    setAnnouncementActive(true)
    antMessage.success('📢 公告已发送到大屏')
    setTimeout(() => setAnnouncementActive(false), announcementDuration * 1000 + 1000)
  }

  const handleAnnouncementCancel = () => {
    emit('control:announcement-cancel')
    setAnnouncementActive(false)
    antMessage.warning('📢 公告已取消')
  }

  const handleSendSystemMessage = () => {
    if (!systemMessage.trim()) {
      antMessage.warning('请输入系统消息内容')
      return
    }
    emit('control:system-message', { text: systemMessage.trim() })
    setSystemMessage('')
    antMessage.success('💬 系统消息已发送到所有手机端')
  }

  const handleLuckyDraw = () => {
    emit('control:lucky-draw', { count: drawCount })
    setDrawSpinning(true)
    antMessage.info(`🎲 抽奖已启动（${drawCount} 位幸运儿）`)
    setTimeout(() => setDrawSpinning(false), 5000)
  }

  const downloadCSV = async (url, filename) => {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ceremony_password')}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
      return true
    } catch (err) {
      antMessage.error('导出失败: ' + err.message)
      return false
    }
  }

  const handleExportUsers = async () => {
    if (!authenticated) { antMessage.warning('请先完成认证'); return }
    if (await downloadCSV(`${API_BASE}/api/export/users`, `users_export_${Date.now()}.csv`)) {
      antMessage.success('用户数据已导出')
    }
  }

  const handleExportDanmaku = async () => {
    if (!authenticated) { antMessage.warning('请先完成认证'); return }
    if (await downloadCSV(`${API_BASE}/api/export/danmaku`, `danmaku_export_${Date.now()}.csv`)) {
      antMessage.success('弹幕数据已导出')
    }
  }

  const handleExportCheckin = async () => {
    if (!authenticated) { antMessage.warning('请先完成认证'); return }
    if (await downloadCSV(`${API_BASE}/api/export/checkin`, `checkin_export_${Date.now()}.csv`)) {
      antMessage.success('签到记录已导出')
    }
  }

  const handlePinDanmaku = (danmaku) => {
    emit('control:pin-danmaku', { danmakuId: danmaku.id })
    setPinnedHistory(prev => [{
      id: danmaku.id,
      nickname: danmaku.nickname || '匿名',
      content: danmaku.content,
      color: danmaku.color,
      pinned_at: new Date().toISOString(),
    }, ...prev].slice(0, 20))
    antMessage.success('⭐ 弹幕已精选！')
  }

  const getModeColor = (mode) => {
    const colors = { idle: '#666', speaker: '#722ed1', climax: '#f5222d', shatter: '#f5222d', rebuild: '#52c41a', danmaku: '#40a9ff', mosaic: '#722ed1' }
    return colors[mode] || '#666'
  }

  const formatLogEntry = (log) => {
    const data = (() => { try { return JSON.parse(log.event_data || '{}') } catch { return {} } })()
    const time = log.created_at ? new Date(log.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
    const labels = {
      user_join: { icon: '👤', text: `${data.nickname || '用户'} 加入`, color: '#40a9ff' },
      face_upload: { icon: '📸', text: `${data.nickname || '用户'} 上传头像`, color: '#722ed1' },
      danmaku: { icon: '💬', text: `${data.nickname || '匿名'}: ${data.content || ''}`, color: '#eb2f96' },
      emoji_send: { icon: '😀', text: `${data.nickname || '匿名'} 发送 ${data.emoji || ''}`, color: '#ffd700' },
      nickname_change: { icon: '✏️', text: `${data.old || ''} → ${data.new || ''}`, color: '#13c2c2' },
      mode_change: { icon: '🔄', text: `模式切换: ${data.mode || ''}`, color: '#fa8c16' },
      shatter: { icon: '💥', text: '粒子碎裂触发', color: '#f5222d' },
      rebuild: { icon: '🔨', text: '粒子重建触发', color: '#52c41a' },
      agenda: { icon: '📋', text: `阶段: ${data.label || ''}`, color: '#13c2c2' },
      countdown: { icon: '⏱️', text: `${data.seconds || 0}s 倒计时开始`, color: '#40a9ff' },
      announcement: { icon: '📢', text: `公告: ${data.text || ''}`, color: '#eb2f96' },
      lucky_draw: { icon: '🎲', text: `抽奖: ${(data.winners || []).join(', ')} 中奖`, color: '#ffd700' },
      poll_created: { icon: '📊', text: `发起投票: ${data.question || ''}`, color: '#40a9ff' },
      poll_vote: { icon: '🗳️', text: `${data.nickname || '用户'} 投票: ${data.option || ''}`, color: '#40a9ff' },
      poll_closed: { icon: '📊', text: '投票已关闭', color: '#40a9ff' },
      system_message: { icon: '💬', text: `系统消息: ${data.text || ''}`, color: '#40a9ff' },
      blessing: { icon: '🎊', text: `${data.nickname || '用户'} 送祝福: ${data.content || ''}`, color: '#ffd700' },
      blessing_clear: { icon: '🧹', text: '祝福墙已清空', color: '#ffd700' },
    }
    const info = labels[log.event_type] || { icon: '📌', text: log.event_type, color: '#666' }
    return { ...info, time }
  }

  const handleClearLogs = async () => {
    try {
      await axios.delete(`${API_BASE}/api/logs`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ceremony_password')}` },
      })
      setActivityLogs([])
      antMessage.success('活动日志已清空')
    } catch (e) {
      antMessage.error('清空失败')
    }
  }

  // ========== Poll Actions ==========
  const handleCreatePoll = () => {
    const cleanOptions = pollOptions.filter(o => o.trim())
    if (!pollQuestion.trim()) { antMessage.warning('请输入投票问题'); return }
    if (cleanOptions.length < 2) { antMessage.warning('至少需要 2 个选项'); return }
    emit('control:create-poll', { question: pollQuestion.trim(), options: cleanOptions })
    setPollQuestion('')
    setPollOptions(['', ''])
    antMessage.success('投票已发起')
  }

  const handleClosePoll = () => {
    emit('control:close-poll')
    antMessage.info('投票已关闭')
  }

  const handleHidePoll = () => {
    emit('control:hide-poll')
    setActivePoll(null)
    setPollResults(null)
    antMessage.info('投票已从大屏移除')
  }

  const addPollOption = () => {
    if (pollOptions.length < 6) setPollOptions([...pollOptions, ''])
  }

  const removePollOption = (index) => {
    if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, i) => i !== index))
  }

  const updatePollOption = (index, value) => {
    const next = [...pollOptions]
    next[index] = value
    setPollOptions(next)
  }

  // ========== Periodic log refresh ==========
  useEffect(() => {
    if (!authenticated) return
    let retryCount = 0
    const maxRetries = 3
    const interval = setInterval(async () => {
      try {
        const pwd = sessionStorage.getItem('ceremony_password');
        const headers = pwd ? { Authorization: `Bearer ${pwd}` } : {};
        const res = await axios.get(`${API_BASE}/api/logs?limit=50`, { headers })
        setActivityLogs(res.data)
        retryCount = 0 // 重置重试计数
      } catch (e) {
        if (e.response?.status === 401) {
          // Token 过期，停止刷新并要求重新认证
          clearInterval(interval)
          setAuthenticated(false)
          sessionStorage.removeItem('ceremony_password')
          antMessage.error('认证已过期，请重新输入密码')
        } else {
          retryCount++
          if (retryCount >= maxRetries) {
            clearInterval(interval)
            antMessage.warning('日志刷新失败次数过多，已停止自动刷新')
          }
        }
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [authenticated])

  // ========== Auth Screen ==========
  if (!authenticated) {
    return (
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Card style={{
            width: 380, background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
          }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <LockOutlined style={{ fontSize: 48, color: '#40a9ff', marginBottom: 16 }} />
              <h2 style={{ color: '#fff', margin: '16px 0 4px' }}>控制台验证</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>请输入管理员密码</p>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Input.Password
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={handleLogin}
                size="large"
                prefix={<LockOutlined />}
              />
              <Button
                type="primary"
                onClick={handleLogin}
                block
                size="large"
                style={{ borderRadius: 8 }}
              >
                验证
              </Button>
            </Space>
          </Card>
        </div>
      </ConfigProvider>
    )
  }

  // ========== Main Control Panel ==========
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <DashboardOutlined style={styles.headerIcon} />
          <span style={styles.headerTitle}>AI 素养大赛 · 控制台</span>
          <Tag color={connected ? 'green' : 'red'} style={styles.connTag}>
            {connected ? '● 已连接' : '○ 断开'}
          </Tag>
        </div>

        <div style={styles.body}>
          {/* Left Panel */}
          <div style={styles.leftPanel}>
            {/* Mode Switch */}
            <Card title="🎮 模式切换" style={styles.card} size="small">
              <Segmented
                options={MODES}
                value={currentMode}
                onChange={handleModeChange}
                block
                size="large"
              />
            </Card>

            {/* Agenda Stages */}
            <Card title="📋 主持稿环节" style={styles.card} size="small">
              <Row gutter={[8, 8]}>
                {AGENDA_STAGES.map(s => (
                  <Col span={8} key={s.key}>
                    <Button
                      block
                      onClick={() => handleAgenda(s.key)}
                      style={{
                        ...styles.actionBtn,
                        borderColor: s.color,
                        color: s.color,
                        height: 48,
                      }}
                    >
                      {s.emoji} {s.label}
                    </Button>
                  </Col>
                ))}
              </Row>
            </Card>

            {/* Quick Actions */}
            <Card title="⚡ 快捷操作" style={styles.card} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Row gutter={12}>
                  <Col span={12}>
                    <Button danger icon={<ThunderboltOutlined />} onClick={handleShatter} block size="large" style={styles.actionBtn}>
                      破碎触发
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={handleRebuild} block size="large" style={{ ...styles.actionBtn, background: '#52c41a' }}>
                      手动重建
                    </Button>
                  </Col>
                </Row>
                <Button icon={<DeleteOutlined />} onClick={handleClearDanmaku} block style={styles.actionBtn}>
                  🧹 清空弹幕
                </Button>
                <Button icon={<DeleteOutlined />} onClick={() => { emit('control:clear-blessings'); antMessage.info('🎊 祝福墙已清空') }} block style={styles.actionBtn}>
                  🎊 清空祝福墙
                </Button>
                <Row gutter={12}>
                  <Col span={12}>
                    <Button icon={<DownloadOutlined />} onClick={handleExportUsers} block style={styles.actionBtn}>
                      📋 导出用户
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button icon={<DownloadOutlined />} onClick={handleExportDanmaku} block style={styles.actionBtn}>
                      💬 导出弹幕
                    </Button>
                  </Col>
                </Row>
                <Button icon={<DownloadOutlined />} onClick={handleExportCheckin} block style={styles.actionBtn} type="dashed">
                  📊 批量导出签到记录
                </Button>
              </Space>
            </Card>

            {/* Countdown Control */}
            <Card title="⏱️ 倒计时控制" style={styles.card} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div style={styles.sliderLabel}>
                  <span>倒计时秒数</span>
                  <Tag color="blue">{countdownSeconds}s</Tag>
                </div>
                {/* 快捷预设按钮 */}
                <Row gutter={[6, 6]}>
                  {[5, 10, 15, 30, 45, 60].map(sec => (
                    <Col span={8} key={sec}>
                      <Button
                        size="small"
                        type={countdownSeconds === sec ? 'primary' : 'default'}
                        onClick={() => setCountdownSeconds(sec)}
                        block
                        style={{ borderRadius: 6 }}
                      >
                        {sec}秒
                      </Button>
                    </Col>
                  ))}
                </Row>
                <Slider
                  min={1}
                  max={60}
                  value={countdownSeconds}
                  onChange={setCountdownSeconds}
                  trackStyle={{ background: 'linear-gradient(90deg, #40a9ff, #f5222d)' }}
                />
                <Row gutter={12}>
                  <Col span={12}>
                    <Button
                      type="primary"
                      onClick={handleCountdown}
                      disabled={countdownActive}
                      block
                      size="large"
                      style={styles.actionBtn}
                    >
                      {countdownActive ? '倒计时中...' : '▶ 开始倒计时'}
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      danger
                      onClick={handleCountdownCancel}
                      disabled={!countdownActive}
                      block
                      size="large"
                      style={styles.actionBtn}
                    >
                      ✖ 取消倒计时
                    </Button>
                  </Col>
                </Row>
              </Space>
            </Card>

            {/* Mic Control */}
            <Card title="🎤 麦克风控制" style={styles.card} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Button
                  icon={micEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                  onClick={toggleMic}
                  type={micEnabled ? 'primary' : 'default'}
                  danger={micEnabled}
                  block
                  size="large"
                  style={styles.actionBtn}
                >
                  {micEnabled ? '关闭麦克风' : '开启麦克风'}
                </Button>
                <div>
                  <div style={styles.sliderLabel}>
                    <span>🎯 喊叫阈值</span>
                    <Tag color="blue">{shoutThreshold}</Tag>
                  </div>
                  <Slider min={0} max={100} value={shoutThreshold} onChange={setShoutThreshold} trackStyle={{ background: 'linear-gradient(90deg, #40a9ff, #f5222d)' }} />
                </div>
                <div>
                  <div style={styles.sliderLabel}><span>⚡ 能量阈值</span></div>
                  <InputNumber value={energyThreshold} onChange={(v) => { setEnergyThreshold(v); if (v > 0) emit('control:set-energy-threshold', { value: v }); }} min={1} max={10000} style={{ width: '100%' }} />
                </div>
              </Space>
            </Card>
          </div>

          {/* Right Panel */}
          <div style={styles.rightPanel}>
            {/* QR Code */}
            <JoinQRCode socket={socket} />

            {/* Stats */}
            <Card title="📊 实时状态" style={styles.card} size="small">
              <Row gutter={[16, 16]}>
                <Col span={12}><Statistic title="在线用户" value={onlineUsers} prefix={<TeamOutlined />} valueStyle={{ color: '#40a9ff' }} /></Col>
                <Col span={12}><Statistic title="已上传头像" value={avatarCount} prefix={<PictureOutlined />} valueStyle={{ color: '#722ed1' }} /></Col>
                <Col span={12}><Statistic title="弹幕总数" value={danmakuCount} prefix={<MessageOutlined />} valueStyle={{ color: '#eb2f96' }} /></Col>
                <Col span={12}><Statistic title="当前模式" value={MODES.find(m => m.value === currentMode)?.label} prefix={<FireOutlined />} valueStyle={{ color: getModeColor(currentMode) }} /></Col>
              </Row>
            </Card>

            {/* Check-in Stats */}
            <CheckinStats socket={socket} />

            {/* Event Dashboard */}
            <EventDashboard socket={socket} />

            {/* Check-in Leaderboard */}
            <CheckinLeaderboard socket={socket} />
            <div style={{ textAlign: 'right' }}>
              <LeaderboardPoster leaderboard={leaderboardData} />
            </div>

            {/* Activity Overview */}
            <ActivityOverview socket={socket} />

            {/* Active Users Leaderboard */}
            <ActiveUsersLeaderboard socket={socket} />

            {/* Rebuild Progress */}
            <Card title="🔨 重建进度" style={styles.card} size="small">
              <Progress percent={rebuildProgress} status={rebuildProgress === 100 ? 'success' : 'active'} strokeColor={{ '0%': '#40a9ff', '50%': '#722ed1', '100%': '#eb2f96' }} />
            </Card>

            {/* Danmaku Leaderboard */}
            <DanmakuLeaderboard socket={socket} />

            {/* Emoji Leaderboard */}
            <EmojiLeaderboard socket={socket} />

            {/* Danmaku Pin Panel */}
            <Card title="⭐ 弹幕精选" style={styles.card} size="small">
              <div style={{ maxHeight: 400, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                {danmakuList.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
                    暂无弹幕
                  </div>
                ) : (
                  danmakuList.slice().reverse().map((d) => (
                    <div key={d._key} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div style={{
                        width: 4, height: 28, borderRadius: 2,
                        background: d.color || '#40a9ff', flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          {d.nickname || '匿名'}
                        </div>
                        <div style={{
                          fontSize: 13, color: '#fff',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {d.content}
                        </div>
                      </div>
                      <Button
                        size="small"
                        type="text"
                        icon={<StarOutlined />}
                        onClick={() => handlePinDanmaku(d)}
                        style={{ color: '#ffd700', flexShrink: 0 }}
                        title="精选此弹幕"
                      />
                    </div>
                  ))
                )}
              </div>
              {pinnedHistory.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,215,0,0.15)', paddingTop: 8 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,215,0,0.6)', marginBottom: 6 }}>
                    已精选 ({pinnedHistory.length})
                  </div>
                  {pinnedHistory.slice(0, 5).map((p, i) => (
                    <div key={`${p.id}_${i}`} style={{
                      display: 'flex', gap: 6, alignItems: 'center',
                      padding: '4px 0', fontSize: 12,
                    }}>
                      <span style={{ color: '#ffd700' }}>⭐</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0, maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.nickname}
                      </span>
                      <span style={{ color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Volume Visualizer */}
            <Card title="🎙️ 实时音量" style={styles.card} size="small">
              <div style={styles.volumeContainer}>
                {volumeBars.map((bar, i) => (
                  <div key={i} style={{
                    ...styles.volumeBar,
                    height: `${Math.max(4, bar)}%`,
                    background: bar > 80 ? '#f5222d' : bar > 50 ? '#fa8c16' : `hsl(${200 + i * 4}, 80%, 55%)`,
                    opacity: micEnabled ? 1 : 0.3,
                  }} />
                ))}
              </div>
              <div style={styles.volumeLabel}>
                当前音量: <strong style={{ color: '#40a9ff' }}>{currentVolume}</strong>
                {micEnabled ? '' : ' (麦克风未开启)'}
              </div>
            </Card>

            {/* Particle Text */}
            <Card title="✏️ 粒子文字" style={styles.card} size="small">
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="输入大屏粒子文字"
                  value={particleText}
                  onChange={(e) => setParticleText(e.target.value)}
                  onPressEnter={handleSetText}
                  maxLength={20}
                />
                <Button type="primary" onClick={handleSetText}>更新</Button>
              </Space.Compact>
            </Card>

            {/* Background Upload */}
            <Card title="🖼️ 大屏背景" style={styles.card} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Row gutter={8}>
                  <Col span={14}>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() => bgFileRef.current?.click()}
                      block
                      style={styles.actionBtn}
                    >
                      上传背景图片
                    </Button>
                    <input
                      ref={bgFileRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleBackgroundUpload}
                    />
                  </Col>
                  <Col span={10}>
                    <Button
                      icon={<ClearOutlined />}
                      onClick={handleClearBackground}
                      block
                      style={styles.actionBtn}
                    >
                      清除背景
                    </Button>
                  </Col>
                </Row>
                {backgroundUrl && (
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4, wordBreak: 'break-all' }}>
                    当前: {backgroundUrl}
                  </div>
                )}
              </Space>
            </Card>

            {/* Announcement */}
            <Card title="📢 公告弹窗" style={styles.card} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
                  发送公告消息到大屏幕，全屏显示
                </p>
                <Input.TextArea
                  placeholder="输入公告内容..."
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  maxLength={100}
                  rows={2}
                  style={{ borderRadius: 8 }}
                />
                <div style={styles.sliderLabel}>
                  <span>显示时长</span>
                  <Tag color="blue">{announcementDuration}s</Tag>
                </div>
                <Slider
                  min={3}
                  max={15}
                  value={announcementDuration}
                  onChange={setAnnouncementDuration}
                  trackStyle={{ background: 'linear-gradient(90deg, #40a9ff, #eb2f96)' }}
                />
                <Row gutter={8}>
                  <Col span={announcementActive ? 14 : 24}>
                    <Button
                      type="primary"
                      onClick={handleAnnouncement}
                      disabled={announcementActive}
                      block
                      size="large"
                      style={{ ...styles.actionBtn, background: '#eb2f96' }}
                    >
                      {announcementActive ? '📢 显示中...' : '📢 发送公告'}
                    </Button>
                  </Col>
                  {announcementActive && (
                    <Col span={10}>
                      <Button
                        danger
                        onClick={handleAnnouncementCancel}
                        block
                        size="large"
                        style={styles.actionBtn}
                      >
                        ✖ 取消
                      </Button>
                    </Col>
                  )}
                </Row>
              </Space>
            </Card>

            {/* System Message */}
            <Card title="💬 系统消息" style={styles.card} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
                  向所有手机端发送系统提示消息，显示在用户界面顶部
                </p>
                <Input.TextArea
                  placeholder="输入系统消息内容..."
                  value={systemMessage}
                  onChange={(e) => setSystemMessage(e.target.value)}
                  maxLength={200}
                  rows={2}
                  style={{ borderRadius: 8 }}
                />
                <Button
                  type="primary"
                  onClick={handleSendSystemMessage}
                  block
                  size="large"
                  style={{ ...styles.actionBtn, background: '#13c2c2' }}
                >
                  💬 发送系统消息
                </Button>
              </Space>
            </Card>

            {/* Mosaic Preview */}
            <Card title="🧩 马赛克预览" style={styles.card} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
                  预览模式使用 Emoji 代替人脸，无需用户上传头像
                </p>
                <Row gutter={8}>
                  <Col span={12}>
                    <Button
                      type={mosaicPreview ? 'default' : 'primary'}
                      onClick={() => handleMosaicPreview(false)}
                      block
                      style={styles.actionBtn}
                    >
                      🎭 真实模式
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      type={mosaicPreview ? 'primary' : 'default'}
                      onClick={() => handleMosaicPreview(true)}
                      block
                      style={styles.actionBtn}
                    >
                      😀 Emoji 预览
                    </Button>
                  </Col>
                </Row>
              </Space>
            </Card>

            {/* Lucky Draw */}
            <Card title="🎲 幸运抽奖" style={styles.card} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
                  从已注册用户中随机抽取幸运观众
                </p>
                <div style={styles.sliderLabel}>
                  <span>抽奖人数</span>
                  <Tag color="gold">{drawCount} 人</Tag>
                </div>
                <Slider
                  min={1}
                  max={10}
                  value={drawCount}
                  onChange={setDrawCount}
                  trackStyle={{ background: 'linear-gradient(90deg, #ffd700, #ff8c00)' }}
                />
                <Button
                  type="primary"
                  onClick={handleLuckyDraw}
                  disabled={drawSpinning}
                  block
                  size="large"
                  style={{
                    ...styles.actionBtn,
                    background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
                    border: 'none',
                    color: '#000',
                    fontWeight: 800,
                  }}
                >
                  {drawSpinning ? '🎲 抽奖进行中...' : '🎲 开始抽奖'}
                </Button>
              </Space>
            </Card>

            {/* Real-time Poll */}
            <Card title="📊 实时投票" style={styles.card} size="small">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {activePoll && activePoll.status === 'active' ? (
                  <>
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ color: '#40a9ff', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                        📌 {activePoll.question}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                        共 {activePoll.totalVotes || 0} 人投票
                      </div>
                      {pollResults && pollResults.options.map((opt, i) => {
                        const count = pollResults.votes[i] || 0;
                        const pct = pollResults.totalVotes > 0 ? Math.round((count / pollResults.totalVotes) * 100) : 0;
                        return (
                          <div key={i} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#fff', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                            <Tag color="blue">{count} ({pct}%)</Tag>
                          </div>
                        );
                      })}
                    </div>
                    <Row gutter={8}>
                      <Col span={12}>
                        <Button danger onClick={handleClosePoll} block style={styles.actionBtn}>关闭投票</Button>
                      </Col>
                      <Col span={12}>
                        <Button onClick={handleHidePoll} block style={styles.actionBtn}>移除显示</Button>
                      </Col>
                    </Row>
                  </>
                ) : (
                  <>
                    <Input
                      placeholder="投票问题"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      maxLength={50}
                    />
                    {pollOptions.map((opt, i) => (
                      <Row key={i} gutter={8} align="middle">
                        <Col flex="auto">
                          <Input
                            placeholder={`选项 ${i + 1}`}
                            value={opt}
                            onChange={(e) => updatePollOption(i, e.target.value)}
                            maxLength={30}
                          />
                        </Col>
                        {pollOptions.length > 2 && (
                          <Col>
                            <Button size="small" danger onClick={() => removePollOption(i)}>✕</Button>
                          </Col>
                        )}
                      </Row>
                    ))}
                    {pollOptions.length < 6 && (
                      <Button type="dashed" onClick={addPollOption} block size="small">+ 添加选项</Button>
                    )}
                    <Button type="primary" onClick={handleCreatePoll} block size="large"
                      style={{ ...styles.actionBtn, background: '#40a9ff' }}>
                      🚀 发起投票
                    </Button>
                    {activePoll && activePoll.status === 'closed' && (
                      <Button onClick={handleHidePoll} block size="small">移除大屏显示</Button>
                    )}
                  </>
                )}
              </Space>
            </Card>

            {/* Activity Log */}
            <Card
              title="📜 活动日志"
              style={styles.card}
              size="small"
              extra={
                <Button size="small" onClick={handleClearLogs} danger style={{ borderRadius: 6 }}>
                  清空
                </Button>
              }
            >
              <div style={styles.logContainer}>
                {activityLogs.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
                    暂无活动记录
                  </div>
                ) : (
                  activityLogs.map((log) => {
                    const entry = formatLogEntry(log)
                    return (
                      <div key={log.id} style={styles.logEntry}>
                        <span style={styles.logTime}>{entry.time}</span>
                        <span style={{ ...styles.logIcon }}>{entry.icon}</span>
                        <span style={{ ...styles.logText, color: entry.color }}>
                          {entry.text.length > 40 ? entry.text.slice(0, 40) + '...' : entry.text}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%)',
    padding: '16px',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 20px', background: 'rgba(0,0,0,0.4)',
    borderRadius: '12px', marginBottom: '16px',
    backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.06)',
  },
  headerIcon: { fontSize: '24px', color: '#40a9ff' },
  headerTitle: { fontSize: '20px', fontWeight: '700', color: '#fff', flex: 1, letterSpacing: '2px' },
  connTag: { borderRadius: '20px' },
  body: { display: 'flex', gap: '16px', minHeight: 'calc(100vh - 100px)', overflowY: 'auto', flexWrap: 'wrap' },
  leftPanel: { flex: '1', minWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' },
  rightPanel: { flex: '1', minWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' },
  card: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' },
  actionBtn: { borderRadius: '8px', fontWeight: '600', height: '44px' },
  sliderLabel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' },
  volumeContainer: { display: 'flex', gap: '3px', alignItems: 'flex-end', height: '100px', justifyContent: 'center', padding: '8px 0' },
  volumeBar: { width: '12px', borderRadius: '3px 3px 0 0', transition: 'height 0.1s ease-out', minHeight: '4px' },
  volumeLabel: { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '8px' },
  logContainer: { maxHeight: '300px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' },
  logEntry: { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' },
  logTime: { color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'monospace', flexShrink: 0, width: '65px' },
  logIcon: { flexShrink: 0, fontSize: '14px' },
  logText: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}
