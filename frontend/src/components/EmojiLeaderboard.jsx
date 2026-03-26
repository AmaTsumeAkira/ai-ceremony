import React, { useState, useEffect, useRef } from 'react'
import { Card, Tag, Progress } from 'antd'
import { SmileOutlined, FireOutlined } from '@ant-design/icons'
import axios from 'axios'

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`

export default function EmojiLeaderboard({ socket }) {
  const [stats, setStats] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadStats = async () => {
    try {
      setLoading(true)
      const pwd = sessionStorage.getItem('ceremony_password');
      const headers = pwd ? { Authorization: `Bearer ${pwd}` } : {};
      const res = await axios.get(`${API_BASE}/api/emoji/stats`, { headers })
      setStats(res.data.stats || [])
      setTotal(res.data.total || 0)
    } catch (e) { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadStats() }, [])

  // Real-time updates via socket
  useEffect(() => {
    if (!socket) return
    const handleStats = (data) => {
      setStats(data.stats || [])
      setTotal(data.total || 0)
    }
    socket.on('emoji:stats', handleStats)
    return () => socket.off('emoji:stats', handleStats)
  }, [socket])

  return (
    <Card
      title={<span><SmileOutlined /> Emoji 反应榜</span>}
      size="small"
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
      }}
      extra={
        <Tag color="purple" style={{ cursor: 'pointer' }} onClick={loadStats}>
          刷新
        </Tag>
      }
    >
      {stats.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0', fontSize: 13 }}>
          暂无 Emoji 数据
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              总计 <strong style={{ color: '#eb2f96' }}>{total}</strong> 个 Emoji
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stats.map((item, index) => {
              const percent = total > 0 ? Math.round((item.count / total) * 100) : 0
              return (
                <div
                  key={item.emoji}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '6px 10px',
                    background: index === 0
                      ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.15), transparent)'
                      : 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: index === 0 ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0, width: 32, textAlign: 'center' }}>
                    {item.emoji}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Progress
                      percent={percent}
                      size="small"
                      showInfo={false}
                      strokeColor={
                        index === 0 ? '#ffd700'
                        : index === 1 ? '#c0c0c0'
                        : index === 2 ? '#cd7f32'
                        : '#722ed1'
                      }
                      trailColor="rgba(255,255,255,0.06)"
                    />
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <Tag color={index === 0 ? 'gold' : index < 3 ? 'default' : 'default'} style={{ margin: 0 }}>
                      {item.count} 次
                    </Tag>
                  </div>
                </div>
              )
            })}
          </div>
          {total >= 50 && (
            <div style={{
              textAlign: 'center', marginTop: 12,
              color: '#ffd700', fontSize: 12,
              animation: 'pulse 1.5s infinite',
            }}>
              <FireOutlined /> Emoji 反应热烈！累计 {total} 次
            </div>
          )}
        </>
      )}
    </Card>
  )
}
