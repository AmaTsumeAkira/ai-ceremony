import React, { useState, useEffect } from 'react'
import { Card, Tag } from 'antd'
import { TrophyOutlined, UserOutlined } from '@ant-design/icons'
import axios from 'axios'
import { API_BASE } from '../config'

const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];
const RANK_ICONS = ['🥇', '🥈', '🥉'];

export default function CheckinLeaderboard({ socket }) {
  const [leaderboard, setLeaderboard] = useState([])

  const loadData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/leaderboard/checkin?limit=15`)
      setLeaderboard(res.data || [])
    } catch (e) { /* ignore */ }
  }

  useEffect(() => { loadData() }, [])

  // 实时更新：新用户签到时刷新排行榜
  useEffect(() => {
    if (!socket) return
    const refresh = () => setTimeout(loadData, 1500)
    socket.on('user:joined', refresh)
    socket.on('user:reconnected', refresh)
    return () => {
      socket.off('user:joined', refresh)
      socket.off('user:reconnected', refresh)
    }
  }, [socket])

  return (
    <Card
      title={<span><TrophyOutlined /> 签到排行榜</span>}
      size="small"
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
      }}
      extra={
        <Tag color="gold" style={{ cursor: 'pointer' }} onClick={loadData}>
          刷新
        </Tag>
      }
    >
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 10 }}>
        按签到先后排名 · 共 {leaderboard.length} 人签到
      </div>
      {leaderboard.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
          暂无签到记录
        </div>
      ) : (
        <div style={{ maxHeight: 400, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          {leaderboard.map((user) => {
            const isTop3 = user.rank <= 3;
            return (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  marginBottom: 4,
                  borderRadius: 8,
                  background: isTop3
                    ? `${RANK_COLORS[user.rank - 1]}10`
                    : 'rgba(255,255,255,0.02)',
                  border: isTop3
                    ? `1px solid ${RANK_COLORS[user.rank - 1]}30`
                    : '1px solid transparent',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* 排名 */}
                <div style={{
                  width: 32,
                  textAlign: 'center',
                  fontSize: isTop3 ? 20 : 14,
                  fontWeight: isTop3 ? 700 : 600,
                  color: isTop3 ? RANK_COLORS[user.rank - 1] : 'rgba(255,255,255,0.4)',
                  flexShrink: 0,
                }}>
                  {isTop3 ? RANK_ICONS[user.rank - 1] : `#${user.rank}`}
                </div>

                {/* 头像 */}
                <div style={{ flexShrink: 0 }}>
                  {user.face_url ? (
                    <img
                      src={user.face_url.startsWith('http') ? user.face_url : `${API_BASE}${user.face_url}`}
                      alt=""
                      style={{
                        width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
                        border: isTop3 ? `2px solid ${RANK_COLORS[user.rank - 1]}` : '1px solid rgba(255,255,255,0.1)',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      <UserOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />
                    </div>
                  )}
                </div>

                {/* 昵称 & 信息 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: isTop3 ? 700 : 500,
                    color: isTop3 ? RANK_COLORS[user.rank - 1] : '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {user.nickname}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    {user.created_at ? new Date(user.created_at).toLocaleTimeString('zh-CN', {
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    }) : ''}
                    {user.danmaku_count > 0 && (
                      <span style={{ marginLeft: 6 }}>
                        💬 {user.danmaku_count}
                      </span>
                    )}
                  </div>
                </div>

                {/* 签到速度 */}
                <div style={{
                  flexShrink: 0,
                  textAlign: 'right',
                }}>
                  <Tag
                    color={user.rank === 1 ? 'gold' : user.rank <= 3 ? 'blue' : 'default'}
                    style={{ fontSize: 11, margin: 0 }}
                  >
                    ⚡ {user.speed_label}
                  </Tag>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  )
}
