import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Button, Progress, Tag, Space } from 'antd'
import {
  TeamOutlined,
  MessageOutlined,
  SmileOutlined,
  PictureOutlined,
  DownloadOutlined,
  PieChartOutlined,
  TrophyOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import axios from 'axios'

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`

/**
 * 大会数据报告组件
 * 展示综合统计数据，支持导出 CSV
 */
export default function EventDashboard({ socket }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    danmakuCount: 0,
    emojiCount: 0,
    avatarCount: 0,
    blessingCount: 0,
    pollCount: 0,
    participationRate: 0,
  })
  const [topUsers, setTopUsers] = useState([])
  const [emojiBreakdown, setEmojiBreakdown] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const pwd = sessionStorage.getItem('ceremony_password')
      const headers = pwd ? { Authorization: `Bearer ${pwd}` } : {}

      const [usersRes, danmakuRes, emojiRes, stateRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users`),
        axios.get(`${API_BASE}/api/danmaku/recent`),
        axios.get(`${API_BASE}/api/emoji/stats`, { headers }).catch(() => ({ data: { stats: [], total: 0 } })),
        axios.get(`${API_BASE}/api/system/state`),
      ])

      const users = usersRes.data || []
      const danmaku = danmakuRes.data || []
      const emojiData = emojiRes.data || { stats: [], total: 0 }
      const withAvatar = users.filter(u => u.face_url).length
      const totalUsers = users.length
      const participationRate = totalUsers > 0
        ? Math.round(((danmaku.length + emojiData.total + withAvatar) / (totalUsers * 3)) * 100)
        : 0

      setStats({
        totalUsers,
        onlineUsers: 0, // will be updated by socket
        danmakuCount: danmaku.length,
        emojiCount: emojiData.total,
        avatarCount: withAvatar,
        blessingCount: 0,
        pollCount: 0,
        participationRate: Math.min(100, participationRate),
      })

      // Top 5 danmaku senders from recent
      const nickCount = {}
      for (const d of danmaku) {
        const nick = d.nickname || '匿名'
        nickCount[nick] = (nickCount[nick] || 0) + 1
      }
      const sorted = Object.entries(nickCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
      setTopUsers(sorted)

      // Emoji breakdown top 5
      setEmojiBreakdown((emojiData.stats || []).slice(0, 5))

      setLoading(false)
    } catch (e) {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
  }, [])

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return
    const handleUsersCount = (count) => {
      setStats(prev => ({ ...prev, onlineUsers: count }))
    }
    socket.on('control:users-count', handleUsersCount)
    return () => socket.off('control:users-count', handleUsersCount)
  }, [socket])

  // Export comprehensive event report as CSV
  const handleExportReport = async () => {
    try {
      const pwd = sessionStorage.getItem('ceremony_password')
      const headers = pwd ? { Authorization: `Bearer ${pwd}` } : {}

      const [usersRes, danmakuRes, emojiRes, checkinRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users`),
        axios.get(`${API_BASE}/api/danmaku/recent`),
        axios.get(`${API_BASE}/api/emoji/stats`, { headers }).catch(() => ({ data: { stats: [], total: 0 } })),
        axios.get(`${API_BASE}/api/leaderboard/checkin?limit=100`),
      ])

      const users = usersRes.data || []
      const danmaku = danmakuRes.data || []
      const emojiData = emojiRes.data || { stats: [], total: 0 }
      const checkin = checkinRes.data || []

      // Build CSV with multiple sheets of data
      let csv = '\uFEFF'

      // Section 1: Summary
      csv += '=== 大会数据报告 ===\n'
      csv += `报告生成时间,${new Date().toLocaleString('zh-CN')}\n`
      csv += `总注册用户,${users.length}\n`
      csv += `弹幕总数,${danmaku.length}\n`
      csv += `Emoji总数,${emojiData.total}\n`
      csv += `头像上传数,${users.filter(u => u.face_url).length}\n`
      csv += '\n'

      // Section 2: User details
      csv += '=== 用户明细 ===\n'
      csv += 'ID,昵称,有头像,注册时间\n'
      for (const u of users) {
        csv += `${u.id},"${(u.nickname || '').replace(/"/g, '""')}","${u.face_url ? '是' : '否'}","${u.created_at}"\n`
      }
      csv += '\n'

      // Section 3: Checkin ranking
      csv += '=== 签到排行榜 ===\n'
      csv += '排名,昵称,签到速度,弹幕数\n'
      for (const c of checkin) {
        csv += `${c.rank},"${(c.nickname || '').replace(/"/g, '""')}","${c.speed_label}",${c.danmaku_count}\n`
      }
      csv += '\n'

      // Section 4: Emoji breakdown
      if (emojiData.stats && emojiData.stats.length > 0) {
        csv += '=== Emoji 统计 ===\n'
        csv += 'Emoji,次数\n'
        for (const e of emojiData.stats) {
          csv += `"${e.emoji}",${e.count}\n`
        }
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `event_report_${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error('Export report failed:', e)
    }
  }

  return (
    <Card
      title={
        <span>
          <PieChartOutlined style={{ marginRight: 8, color: '#40a9ff' }} />
          大会数据报告
        </span>
      }
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
      }}
      size="small"
      extra={
        <Button
          size="small"
          icon={<DownloadOutlined />}
          onClick={handleExportReport}
          style={{ borderRadius: 6 }}
          type="primary"
        >
          导出报告
        </Button>
      }
      loading={loading}
    >
      {/* Key Metrics */}
      <Row gutter={[12, 12]}>
        <Col span={8}>
          <Statistic
            title="注册用户"
            value={stats.totalUsers}
            prefix={<TeamOutlined />}
            valueStyle={{ color: '#40a9ff', fontSize: 20 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="在线人数"
            value={stats.onlineUsers}
            prefix={<TeamOutlined />}
            valueStyle={{ color: '#52c41a', fontSize: 20 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="弹幕数"
            value={stats.danmakuCount}
            prefix={<MessageOutlined />}
            valueStyle={{ color: '#eb2f96', fontSize: 20 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Emoji"
            value={stats.emojiCount}
            prefix={<SmileOutlined />}
            valueStyle={{ color: '#ffd700', fontSize: 20 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="头像数"
            value={stats.avatarCount}
            prefix={<PictureOutlined />}
            valueStyle={{ color: '#722ed1', fontSize: 20 }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="参与率"
            value={stats.participationRate}
            suffix="%"
            prefix={<BarChartOutlined />}
            valueStyle={{
              color: stats.participationRate > 60 ? '#52c41a' :
                stats.participationRate > 30 ? '#fa8c16' : '#f5222d',
              fontSize: 20,
            }}
          />
        </Col>
      </Row>

      {/* Participation Progress */}
      <div style={{ marginTop: 16 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginBottom: 4,
          color: 'rgba(255,255,255,0.5)', fontSize: 12,
        }}>
          <span>互动参与度</span>
          <span>{stats.participationRate}%</span>
        </div>
        <Progress
          percent={stats.participationRate}
          strokeColor={{
            '0%': '#40a9ff',
            '50%': '#722ed1',
            '100%': '#eb2f96',
          }}
          size="small"
          showInfo={false}
        />
      </div>

      {/* Top Users Mini Table */}
      {topUsers.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
            color: 'rgba(255,255,255,0.6)', fontSize: 12,
          }}>
            <TrophyOutlined style={{ color: '#ffd700' }} />
            <span>弹幕活跃 Top 5</span>
          </div>
          {topUsers.map((user, i) => (
            <div key={user.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 0',
              borderBottom: i < topUsers.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <Tag
                color={i === 0 ? 'gold' : i === 1 ? 'default' : i === 2 ? 'orange' : 'blue'}
                style={{ minWidth: 24, textAlign: 'center', margin: 0 }}
              >
                {i + 1}
              </Tag>
              <span style={{
                flex: 1, color: '#fff', fontSize: 13,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.name}
              </span>
              <Tag color="purple" style={{ margin: 0 }}>{user.count} 条</Tag>
              <Progress
                percent={topUsers[0].count > 0 ? Math.round((user.count / topUsers[0].count) * 100) : 0}
                showInfo={false}
                strokeColor="#722ed1"
                size="small"
                style={{ width: 60, margin: 0 }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Emoji Breakdown */}
      {emojiBreakdown.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
            color: 'rgba(255,255,255,0.6)', fontSize: 12,
          }}>
            <SmileOutlined style={{ color: '#ffd700' }} />
            <span>Emoji 发送 Top 5</span>
          </div>
          <Row gutter={[8, 8]}>
            {emojiBreakdown.map((item, i) => (
              <Col span={12} key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <Tag color="gold" style={{ margin: 0 }}>{item.count}</Tag>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </Card>
  )
}
