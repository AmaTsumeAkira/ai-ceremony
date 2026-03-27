import React, { useState, useEffect, useRef } from 'react'
import { Card, Tag } from 'antd'
import { TrophyOutlined } from '@ant-design/icons'
import axios from 'axios'
import { API_BASE } from '../config'

const MEDAL_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32']
const MEDAL_EMOJI = ['🥇', '🥈', '🥉']

export default function DanmakuLeaderboard({ socket }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(false)

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${API_BASE}/api/danmaku/leaderboard?limit=10`)
      setLeaderboard(res.data)
    } catch (e) { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadLeaderboard() }, [])

  // Refresh on new danmaku
  useEffect(() => {
    if (!socket) return
    let debounce = null
    const refresh = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(loadLeaderboard, 3000)
    }
    socket.on('danmaku:new', refresh)
    socket.on('danmaku:cleared', () => setLeaderboard([]))
    return () => {
      socket.off('danmaku:new', refresh)
      socket.off('danmaku:cleared')
      if (debounce) clearTimeout(debounce)
    }
  }, [socket])

  return (
    <Card
      title={<span>🏆 弹幕排行榜</span>}
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
                {user.danmaku_count} 条
              </Tag>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
