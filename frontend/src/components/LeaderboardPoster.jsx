import React, { useRef, useCallback } from 'react'
import { Button, message as antMessage } from 'antd'
import { CameraOutlined } from '@ant-design/icons'

/**
 * 从签到排行榜数据生成分享海报（纯 Canvas 实现）
 */
export default function LeaderboardPoster({ leaderboard = [] }) {
  const canvasRef = useRef(null)

  const generatePoster = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const W = 800
    const top10 = leaderboard.slice(0, 10)
    const rowH = 64
    const headerH = 160
    const footerH = 80
    const H = headerH + top10.length * rowH + footerH + 40

    canvas.width = W
    canvas.height = H

    // 背景
    const bgGrad = ctx.createLinearGradient(0, 0, W, H)
    bgGrad.addColorStop(0, '#0a0a1a')
    bgGrad.addColorStop(0.5, '#1a1a2e')
    bgGrad.addColorStop(1, '#0d1b3e')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // 顶部装饰线
    const accentGrad = ctx.createLinearGradient(0, 0, W, 0)
    accentGrad.addColorStop(0, '#40a9ff')
    accentGrad.addColorStop(0.5, '#722ed1')
    accentGrad.addColorStop(1, '#eb2f96')
    ctx.fillStyle = accentGrad
    ctx.fillRect(0, 0, W, 4)

    // 标题区域
    ctx.textAlign = 'center'

    // 主标题
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 40px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    ctx.fillText('🏆 签到排行榜', W / 2, 72)

    // 副标题
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '16px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    const now = new Date()
    const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    ctx.fillText(`Top ${top10.length} · ${dateStr}`, W / 2, 108)

    // 分隔线
    ctx.strokeStyle = 'rgba(64,169,255,0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(40, 130)
    ctx.lineTo(W - 40, 130)
    ctx.stroke()

    // 表头
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '13px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    ctx.fillText('排名', 60, 155)
    ctx.fillText('昵称', 160, 155)
    ctx.textAlign = 'right'
    ctx.fillText('弹幕数', W - 60, 155)

    // 排名颜色
    const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32']
    const rankIcons = ['🥇', '🥈', '🥉']

    // 绘制用户行
    top10.forEach((user, i) => {
      const y = headerH + i * rowH
      const isTop3 = i < 3

      // 行背景
      if (isTop3) {
        ctx.fillStyle = `${rankColors[i]}08`
        ctx.fillRect(30, y, W - 60, rowH - 4)
        // 左侧装饰条
        ctx.fillStyle = rankColors[i]
        ctx.fillRect(30, y, 3, rowH - 4)
      }

      // 分隔线
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.beginPath()
        ctx.moveTo(50, y)
        ctx.lineTo(W - 50, y)
        ctx.stroke()
      }

      // 排名
      ctx.textAlign = 'center'
      if (isTop3) {
        ctx.font = '24px serif'
        ctx.fillText(rankIcons[i], 85, y + rowH / 2 + 8)
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.font = 'bold 16px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
        ctx.fillText(`#${i + 1}`, 85, y + rowH / 2 + 6)
      }

      // 昵称
      ctx.textAlign = 'left'
      ctx.fillStyle = isTop3 ? rankColors[i] : '#fff'
      ctx.font = `${isTop3 ? 'bold ' : ''}18px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
      const nickname = user.nickname || '匿名'
      const displayName = nickname.length > 10 ? nickname.slice(0, 10) + '…' : nickname
      ctx.fillText(displayName, 160, y + rowH / 2 + 6)

      // 弹幕数
      ctx.textAlign = 'right'
      ctx.fillStyle = isTop3 ? rankColors[i] : 'rgba(255,255,255,0.5)'
      ctx.font = `bold 16px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
      ctx.fillText(`${user.danmaku_count || 0}`, W - 60, y + rowH / 2 + 6)
    })

    // 底部水印区域
    const footerY = headerH + top10.length * rowH + 20

    // 分隔线
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath()
    ctx.moveTo(40, footerY)
    ctx.lineTo(W - 40, footerY)
    ctx.stroke()

    // 水印
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '14px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    ctx.fillText('AI素养大赛 · 开幕式互动系统', W / 2, footerY + 36)

    // 底部装饰线
    ctx.fillStyle = accentGrad
    ctx.fillRect(0, H - 3, W, 3)

    // 下载
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `签到排行榜_${dateStr.replace(/\//g, '')}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      antMessage.success('海报已保存')
    }, 'image/png')
  }, [leaderboard])

  if (leaderboard.length === 0) return null

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <Button
        icon={<CameraOutlined />}
        onClick={generatePoster}
        style={{
          borderRadius: 8,
          fontWeight: 600,
          background: 'linear-gradient(135deg, #40a9ff, #722ed1)',
          border: 'none',
          color: '#fff',
        }}
      >
        📸 生成海报
      </Button>
    </>
  )
}
