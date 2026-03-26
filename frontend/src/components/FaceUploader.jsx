import React, { useState, useRef } from 'react'
import { Button, message as antMessage, Progress } from 'antd'
import { CameraOutlined, CheckCircleFilled, UploadOutlined } from '@ant-design/icons'
import axios from 'axios'

const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`

export default function FaceUploader({ nickname, userId, avatarUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(avatarUrl || null)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef(null)
  const uploadingRef = useRef(false) // 防止重复上传

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 防止重复上传
    if (uploadingRef.current) return
    uploadingRef.current = true

    // Validate
    if (!file.type.startsWith('image/')) {
      antMessage.error('请选择图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      antMessage.error('图片不能超过 5MB')
      return
    }

    // Preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target.result)
    reader.readAsDataURL(file)

    // Upload
    setUploading(true)
    setProgress(0)
    try {
      const formData = new FormData()
      formData.append('face', file)
      formData.append('user_id', String(userId || ''))

      const res = await axios.post(`${SERVER_URL}/api/user/upload-face`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })

      const url = res.data.face_url
      onUploaded(url)
      antMessage.success('头像上传成功！')
    } catch (err) {
      console.error('Upload failed:', err)
      antMessage.error('上传失败，请重试')
    } finally {
      setUploading(false)
      setProgress(0)
      uploadingRef.current = false
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>📸 上传你的头像</div>
      <p style={styles.desc}>你的头像将出现在大屏的马赛克墙中</p>

      <div style={styles.avatarArea}>
        {previewUrl ? (
          <div style={styles.previewContainer}>
            <img src={previewUrl} alt="avatar" style={styles.previewImg} />
            <CheckCircleFilled style={styles.checkIcon} />
          </div>
        ) : (
          <div
            style={styles.placeholder}
            onClick={() => fileInputRef.current?.click()}
          >
            <CameraOutlined style={styles.placeholderIcon} />
            <span style={styles.placeholderText}>点击上传</span>
          </div>
        )}
      </div>

      {uploading && (
        <div style={styles.progressWrap}>
          <Progress
            percent={progress}
            size="small"
            strokeColor={{ '0%': '#40a9ff', '100%': '#722ed1' }}
            showInfo={false}
          />
          <span style={styles.progressText}>上传中 {progress}%</span>
        </div>
      )}

      <div style={styles.actions}>
        <Button
          icon={<UploadOutlined />}
          onClick={() => fileInputRef.current?.click()}
          loading={uploading}
          style={styles.uploadBtn}
          size="large"
        >
          {previewUrl ? '重新上传' : '选择图片'}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}

const styles = {
  container: {
    textAlign: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px',
  },
  desc: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: '20px',
  },
  avatarArea: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  previewContainer: {
    position: 'relative',
    width: '120px',
    height: '120px',
  },
  previewImg: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid rgba(64, 169, 255, 0.5)',
    boxShadow: '0 0 20px rgba(64, 169, 255, 0.2)',
  },
  checkIcon: {
    position: 'absolute',
    bottom: '0',
    right: '0',
    fontSize: '24px',
    color: '#52c41a',
    background: '#1a1a2e',
    borderRadius: '50%',
    padding: '2px',
  },
  placeholder: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '2px dashed rgba(255,255,255,0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s',
    background: 'rgba(255,255,255,0.03)',
  },
  placeholderIcon: {
    fontSize: '32px',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: '8px',
  },
  placeholderText: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.3)',
  },
  progressWrap: {
    marginBottom: '12px',
    textAlign: 'center',
  },
  progressText: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
  },
  actions: {},
  uploadBtn: {
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.8)',
    width: '200px',
  },
}
