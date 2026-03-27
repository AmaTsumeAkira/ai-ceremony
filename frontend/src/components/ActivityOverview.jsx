import React, { useState, useEffect } from 'react'
import { Card, Tag, Tooltip } from 'antd'
import { BarChartOutlined, ClockCircleOutlined } from '@ant-design/icons'
import axios from 'axios'
import { API_BASE } from '../config'

const EVENT_COLORS = {
  user_join: '#40a9ff',
  face_upload: '#722ed1',
  danmaku: '#eb2f96',
  emoji_send: '#ffd700',
  blessing: '#ff8c00',
  poll_vote: '#13c2c2',
  mode_change: '#fa8c16',
  shatter: '#f5222d',
  other: '#666666',
}

const EVENT_LABELS = {
  user_join: '加入',
  face_upload: '头像',
  danmaku: '弹幕',
  emoji_send: 'Emoji',
  blessing: '祝福',
  poll_vote: '投票',
  mode_change: '模式',
  shatter: '碎裂',
}

export default function ActivityOverview({ socket }) {
  const [hourlyData, setHourlyData] = useState([])
  const [summary, setSummary] = useState({})
  const [totalEvents, setTotalEvents] = useState(0)
  const [authError, setAuthError] = useState(false)

  const loadData = async () => {
    try {
      const pwd = sessionStorage.getItem('ceremony_password')
      if (!pwd) {
        setAuthError(true)
        return
      }
      setAuthError(false)
      const headers = { Authorization: `Bearer ${pwd}` }
      const res = await axios.get(`${API_BASE}/api/logs?limit=500`, { headers })
      const logs = res.data || []

      // 按小时分组
      const hourMap = {}
      const summaryMap = {}
      let total = 0

      for (const log of logs) {
        if (!log.created_at) continue
        const d = new Date(log.created_at)
        const hour = `${d.getHours().toString().padStart(2, '0')}:00`
        if (!hourMap[hour]) hourMap[hour] = {}
        const type = log.event_type
        hourMap[hour][type] = (hourMap[hour][type] || 0) + 1
        summaryMap[type] = (summaryMap[type] || 0) + 1
        total++
      }

      // 转换为数组并排序
      const hours = Object.keys(hourMap).sort()
      const data = hours.map(h => ({ hour: h, events: hourMap[h], total: Object.values(hourMap[h]).reduce((a, b) => a + b, 0) }))

      setHourlyData(data)
      setSummary(summaryMap)
      setTotalEvents(total)
    } catch (e) {
      if (e.response?.status === 401) {
        setAuthError(true)
      }
    }
  }

  useEffect(() => { loadData() }, [])

  // 实时更新：监听新事件
  useEffect(() => {
    if (!socket) return
    const refresh = () => setTimeout(loadData, 2000)
    socket.on('danmaku:new', refresh)
    socket.on('user:joined', refresh)
    socket.on('face:new', refresh)
    return () => {
      socket.off('danmaku:new', refresh)
      socket.off('user:joined', refresh)
      socket.off('face:new', refresh)
    }
  }, [socket])

  const maxTotal = Math.max(...hourlyData.map(h => h.total), 1)

  return (
    <Card
      title={<span><BarChartOutlined /> 活动数据概览</span>}
      size="small"
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
      }}
      extra={
        <Tag color="geekblue" style={{ cursor: 'pointer' }} onClick={loadData}>
          刷新
        </Tag>
      }
    >
      {/* 总事件数和分类统计 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <ClockCircleOutlined style={{ color: '#40a9ff' }} />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>活动总计</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginLeft: 'auto' }}>{totalEvents}</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>条事件</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(summary)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([type, count]) => (
              <Tag
                key={type}
                color={EVENT_COLORS[type] || EVENT_COLORS.other}
                style={{ margin: 0, fontSize: 12 }}
              >
                {EVENT_LABELS[type] || type} {count}
              </Tag>
            ))}
        </div>
      </div>

      {/* 按小时柱状图 */}
      {hourlyData.length > 0 && (
        <div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8 }}>
            按时段活动分布
          </div>
          <div style={{
            display: 'flex', gap: 4, alignItems: 'flex-end',
            height: 80, padding: '0 4px',
          }}>
            {hourlyData.map((item) => (
              <Tooltip
                key={item.hour}
                title={
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.hour} · {item.total} 条</div>
                    {Object.entries(item.events)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <div key={type} style={{ fontSize: 12 }}>
                          <span style={{
                            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                            background: EVENT_COLORS[type] || EVENT_COLORS.other, marginRight: 6,
                          }} />
                          {EVENT_LABELS[type] || type}: {count}
                        </div>
                      ))}
                  </div>
                }
              >
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 2, cursor: 'pointer', minWidth: 0,
                }}>
                  {/* 堆叠柱子 */}
                  <div style={{
                    width: '100%', borderRadius: '3px 3px 0 0',
                    height: `${Math.max(6, (item.total / maxTotal) * 64)}px`,
                    background: (() => {
                      const topType = Object.entries(item.events).sort(([, a], [, b]) => b - a)[0]?.[0]
                      return `linear-gradient(180deg, ${EVENT_COLORS[topType] || '#40a9ff'}, ${EVENT_COLORS[topType] || '#40a9ff'}88)`
                    })(),
                    transition: 'height 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* 内部条纹显示多种事件类型 */}
                    {Object.entries(item.events).length > 1 && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: Object.entries(item.events)
                          .sort(([, a], [, b]) => b - a)
                          .slice(1)
                          .map(([type], i) =>
                            `repeating-linear-gradient(${45 + i * 30}deg, transparent, transparent 2px, ${EVENT_COLORS[type] || EVENT_COLORS.other}40 2px, ${EVENT_COLORS[type] || EVENT_COLORS.other}40 4px)`
                          ).join(', '),
                      }} />
                    )}
                  </div>
                  <span style={{
                    fontSize: 9, color: 'rgba(255,255,255,0.4)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}>
                    {item.hour}
                  </span>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {authError && (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
          请先完成认证以查看活动数据
        </div>
      )}
      {!authError && hourlyData.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
          暂无活动数据
        </div>
      )}
    </Card>
  )
}
