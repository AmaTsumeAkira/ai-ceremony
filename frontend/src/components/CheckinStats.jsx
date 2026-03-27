import React, { useState, useEffect } from 'react'
import { Card, Tag, Progress, Row, Col, Statistic } from 'antd'
import {
  UserOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  SmileOutlined,
  TeamOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import axios from 'axios'

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`

export default function CheckinStats({ socket }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    avatarUsers: 0,
    danmakuUsers: 0,
    emojiUsers: 0,
    totalDanmaku: 0,
    totalEmoji: 0,
    checkinRate: 0,
  })
  const [recentJoins, setRecentJoins] = useState([])

  const loadStats = async () => {
    try {
      const pwd = sessionStorage.getItem('ceremony_password')
      const headers = pwd ? { Authorization: `Bearer ${pwd}` } : {}
      const [usersRes, danmakuRes, emojiRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users`, { headers }),
        axios.get(`${API_BASE}/api/danmaku/leaderboard?limit=100`, { headers }),
        axios.get(`${API_BASE}/api/emoji/stats`, { headers }),
      ])

      const users = usersRes.data || []
      const totalUsers = users.length
      const avatarUsers = users.filter(u => u.face_url).length
      const checkinRate = totalUsers > 0 ? Math.round((avatarUsers / totalUsers) * 100) : 0

      const danmakuUsers = (danmakuRes.data || []).length
      const totalDanmaku = (danmakuRes.data || []).reduce((sum, u) => sum + (u.danmaku_count || 0), 0)

      const emojiData = emojiRes.data || {}
      const totalEmoji = emojiData.total || 0
      // 统计实际发送过 emoji 的用户数（从 API 返回的 stats 无法直接获取，用总数估算）
      const emojiUsers = totalEmoji > 0 ? Math.min(totalUsers, (emojiData.stats || []).reduce((s, e) => s + (e.count > 0 ? 1 : 0), 0)) : 0

      // 最近注册的用户（按时间倒序取最新5个）
      const sortedUsers = [...users].sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      )
      setRecentJoins(sortedUsers.slice(0, 5))

      setStats({
        totalUsers,
        avatarUsers,
        danmakuUsers,
        emojiUsers,
        totalDanmaku,
        totalEmoji,
        checkinRate,
      })
    } catch (e) { /* ignore */ }
  }

  useEffect(() => { loadStats() }, [])

  // 实时更新：监听新用户加入和头像上传
  useEffect(() => {
    if (!socket) return
    const refresh = () => {
      // 防抖：延迟刷新避免频繁请求
      setTimeout(loadStats, 1000)
    }
    socket.on('user:joined', refresh)
    socket.on('face:new', refresh)
    socket.on('danmaku:new', refresh)
    return () => {
      socket.off('user:joined', refresh)
      socket.off('face:new', refresh)
      socket.off('danmaku:new', refresh)
    }
  }, [socket])

  const getRateColor = (rate) => {
    if (rate >= 80) return '#52c41a'
    if (rate >= 50) return '#fa8c16'
    return '#f5222d'
  }

  return (
    <Card
      title={<span>📊 签到统计</span>}
      size="small"
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
      }}
      extra={
        <Tag color="cyan" style={{ cursor: 'pointer' }} onClick={loadStats}>
          刷新
        </Tag>
      }
    >
      {/* 签到完成率 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 8,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            <PictureOutlined /> 头像上传率
          </span>
          <span style={{ color: getRateColor(stats.checkinRate), fontWeight: 700, fontSize: 16 }}>
            {stats.checkinRate}%
          </span>
        </div>
        <Progress
          percent={stats.checkinRate}
          showInfo={false}
          strokeColor={getRateColor(stats.checkinRate)}
          trailColor="rgba(255,255,255,0.06)"
          size="small"
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4,
        }}>
          <span>已上传: {stats.avatarUsers}</span>
          <span>总注册: {stats.totalUsers}</span>
        </div>
      </div>

      {/* 统计数据网格 */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <div style={miniStatStyle}>
            <TeamOutlined style={{ color: '#40a9ff', fontSize: 16 }} />
            <div>
              <div style={miniStatValue}>{stats.totalUsers}</div>
              <div style={miniStatLabel}>注册用户</div>
            </div>
          </div>
        </Col>
        <Col span={12}>
          <div style={miniStatStyle}>
            <PictureOutlined style={{ color: '#722ed1', fontSize: 16 }} />
            <div>
              <div style={miniStatValue}>{stats.avatarUsers}</div>
              <div style={miniStatLabel}>已上传头像</div>
            </div>
          </div>
        </Col>
        <Col span={12}>
          <div style={miniStatStyle}>
            <MessageOutlined style={{ color: '#eb2f96', fontSize: 16 }} />
            <div>
              <div style={miniStatValue}>{stats.totalDanmaku}</div>
              <div style={miniStatLabel}>弹幕总数</div>
            </div>
          </div>
        </Col>
        <Col span={12}>
          <div style={miniStatStyle}>
            <SmileOutlined style={{ color: '#ffd700', fontSize: 16 }} />
            <div>
              <div style={miniStatValue}>{stats.totalEmoji}</div>
              <div style={miniStatLabel}>Emoji 总数</div>
            </div>
          </div>
        </Col>
      </Row>

      {/* 活跃度条形图 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8 }}>
          参与度分布
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 48 }}>
          {/* 注册 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width: '100%', borderRadius: '4px 4px 0 0',
              background: 'linear-gradient(180deg, #40a9ff, #1890ff)',
              height: `${Math.max(8, (stats.totalUsers / Math.max(stats.totalUsers, 1)) * 40)}px`,
              transition: 'height 0.5s ease',
            }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>注册</span>
          </div>
          {/* 头像 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width: '100%', borderRadius: '4px 4px 0 0',
              background: 'linear-gradient(180deg, #722ed1, #531dab)',
              height: `${Math.max(8, (stats.avatarUsers / Math.max(stats.totalUsers, 1)) * 40)}px`,
              transition: 'height 0.5s ease',
            }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>头像</span>
          </div>
          {/* 弹幕活跃 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width: '100%', borderRadius: '4px 4px 0 0',
              background: 'linear-gradient(180deg, #eb2f96, #c41d7f)',
              height: `${Math.max(8, (stats.danmakuUsers / Math.max(stats.totalUsers, 1)) * 40)}px`,
              transition: 'height 0.5s ease',
            }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>弹幕</span>
          </div>
          {/* Emoji */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{
              width: '100%', borderRadius: '4px 4px 0 0',
              background: 'linear-gradient(180deg, #ffd700, #d48806)',
              height: `${Math.max(8, (stats.emojiUsers / Math.max(stats.totalUsers, 1)) * 40)}px`,
              transition: 'height 0.5s ease',
            }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Emoji</span>
          </div>
        </div>
      </div>

      {/* 最近加入 */}
      {recentJoins.length > 0 && (
        <div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6 }}>
            最近加入
          </div>
          {recentJoins.map((user, i) => (
            <div key={user.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 0',
              borderBottom: i < recentJoins.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              {user.face_url ? (
                <img
                  src={user.face_url.startsWith('http') ? user.face_url : `${API_BASE}${user.face_url}`}
                  alt=""
                  style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <UserOutlined style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)', padding: 4,
                  fontSize: 12, color: 'rgba(255,255,255,0.4)',
                }} />
              )}
              <span style={{
                flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.nickname}
              </span>
              {user.face_url && (
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11 }} />
              )}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {user.created_at ? new Date(user.created_at).toLocaleTimeString('zh-CN', {
                  hour: '2-digit', minute: '2-digit',
                }) : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

const miniStatStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '8px 10px',
  background: 'rgba(255,255,255,0.03)',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.04)',
}
const miniStatValue = {
  fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.2,
}
const miniStatLabel = {
  fontSize: 10, color: 'rgba(255,255,255,0.4)',
}
