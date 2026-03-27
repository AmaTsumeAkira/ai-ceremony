import React, { useState, useEffect } from 'react'
import { Card, Button, Space, Tag, Input } from 'antd'
import { QrcodeOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'
import QRCode from 'qrcode'
import axios from 'axios'
import { API_BASE } from '../config'

const JOIN_URL = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:${window.location.port || '6588'}`
  : `${window.location.protocol}//${window.location.hostname}:${window.location.port || '6588'}`

export default function JoinQRCode({ socket }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(JOIN_URL, {
      width: 200,
      margin: 2,
      color: { dark: '#ffffff', light: '#00000000' },
    })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!socket) return
    const handleCount = (count) => setOnlineCount(count)
    socket.on('control:users-count', handleCount)
    return () => socket.off('control:users-count', handleCount)
  }, [socket])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JOIN_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for non-HTTPS environments
      const input = document.createElement('input')
      input.value = JOIN_URL
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card
      title={<span><QrcodeOutlined /> 签到二维码</span>}
      size="small"
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        {qrDataUrl && (
          <div style={{
            display: 'inline-block',
            padding: 12,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: 12,
          }}>
            <img
              src={qrDataUrl}
              alt="Join QR Code"
              width={180}
              height={180}
              style={{ display: 'block', borderRadius: 8 }}
            />
          </div>
        )}
        <div style={{ marginBottom: 8 }}>
          <Tag color="blue" style={{ fontSize: 13 }}>
            👥 在线 {onlineCount} 人
          </Tag>
        </div>
        <Input
          value={JOIN_URL}
          readOnly
          size="small"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            textAlign: 'center',
            fontSize: 12,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 8,
          }}
          addonAfter={
            <Button
              type="text"
              size="small"
              icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
              onClick={handleCopy}
              style={{ border: 'none', padding: '0 4px' }}
            />
          }
        />
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          扫码或输入网址加入互动
        </div>
      </div>
    </Card>
  )
}
