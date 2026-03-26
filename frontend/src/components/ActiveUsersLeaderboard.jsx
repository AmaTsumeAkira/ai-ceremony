import React, { useState, useEffect } from 'react'
import { Card, Tag } from 'antd'
import axios from 'axios'

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`

const MEDAL_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32']
const MEDAL_EMOJI = ['🥇', '🥈', '🥉']

export default function ActiveUsersLeaderboard({ socket }) {
  const [leaderboard, setLeaderboard] = useState([])

  const loadLeaderboard = async () => {
    try {
      const pwd = sessionStorage.getItem('ceremony_password')
      const headers = pwd ? { Authorization: `Bearer ${pwd}` } : {}
      const res = await axios.get(`${API_BASE}/api/leaderboard/active-users?limit=10`, { headers })
      setLeaderboard(res.data)
    } catch (e) { /* ignore */ }
  }

  useEffect(() => { loadLeaderboard() }, [])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadLeaderboard, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card
      title={<span>🔥 活跃用户排行榜</span>}
      size="small"
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
      }}
      extra={
        <Tag color="blue" style={{ cursor: 'pointer' }} onClick={loadLeaderboard}>
          刷新
        </Tag>
      }
    >
      {leaderboard.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0', fontSize: 13 }}>
          暂无数据
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {leaderboard.map((user, index) => (
            <div
              key={user.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px',
                background: index < 3
                  ? `linear-gradient(90deg, ${MEDAL_COLORS[index]}15, transparent)`
                  : 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                border: index < 3 ? `1px solid ${MEDAL_COLORS[index]}30` : '1px solid transparent',
              }}
            >
              {/* Rank */}
              <span style={{
                width: '28px', textAlign: 'center',
                fontSize: index < 3 ? '18px' : '14px',
                color: index < 3 ? MEDAL_COLORS[index] : 'rgba(255,255,255,0.4)',
                fontWeight: index < 3 ? '700' : '400',
                flexShrink: 0,
              }}>
                {index < 3 ? MEDAL_EMOJI[index] : `#${index + 1}`}
              </span>

              {/* Avatar */}
              {user.face_url ? (
                <img
                  src={user.face_url.startsWith('http') ? user.face_url : `${API_BASE}${user.face_url}`}
                  alt={user.nickname}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    objectFit: 'cover', flexShrink: 0,
                    border: index < 3 ? `2px solid ${MEDAL_COLORS[index]}` : '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>
                  👤
                </div>
              )}

              {/* Name */}
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: index < 3 ? '#fff' : 'rgba(255,255,255,0.7)',
                fontWeight: index < 3 ? '600' : '400',
                fontSize: 14,
              }}>
                {user.nickname}
              </span>

              {/* Count */}
              <Tag
                color={index < 3 ? ['gold', 'default', 'orange'][index] : 'default'}
                style={{ margin: 0, fontWeight: '600' }}
              >
                {user.total_interactions} 次
              </Tag>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
