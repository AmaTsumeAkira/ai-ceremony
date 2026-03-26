import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import ShatterCanvas from '../components/ShatterCanvas';
import DanmakuLayer from '../components/DanmakuLayer';
import MosaicCanvas from '../components/MosaicCanvas';
import EmojiFloat from '../components/EmojiFloat';
import CountdownOverlay from '../components/CountdownOverlay';
import AnnouncementOverlay from '../components/AnnouncementOverlay';
import LuckyDrawOverlay from '../components/LuckyDrawOverlay';
import QRCode from 'qrcode';
import axios from 'axios';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`;

const JOIN_URL = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:${window.location.port || '6588'}`
  : `${window.location.protocol}//${window.location.hostname}:${window.location.port || '6588'}`;

const EMOJI_POOL = ['😀', '🎉', '🔥', '💯', '⭐', '🎊', '🚀', '💎', '🌟', '🎯', '🏆', '✨', '💫', '🎪', '🎭'];

// QR Code component using local qrcode library
function QRCodeDisplay({ url, size = 160 }) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      color: { dark: '#ffffff', light: '#00000000' },
    })
      .then(setDataUrl)
      .catch(() => setError(true));
  }, [url, size]);

  if (error) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 10,
        backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)',
        width: size, height: size + 30,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: '#40a9ff', fontSize: 13, textAlign: 'center', wordBreak: 'break-all' }}>{url}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 }}>浏览器访问加入</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
      {dataUrl && <img src={dataUrl} alt="QR Code" width={size} height={size} style={{ borderRadius: 6, display: 'block' }} />}
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 }}>扫码加入互动</div>
    </div>
  );
}

const AGENDA_LABELS = {
  welcome: '🎬 开场前',
  review: '📹 循迹·往届回顾',
  route: '🗺️ 定航·赛道介绍',
  inspire: '🎤 赋能·领导致辞',
  launch: '🚀 启跃·启动仪式',
  closing: '📸 合影留念',
};

export default function Display() {
  const { socket, connected } = useSocket();
  const [mode, setMode] = useState('idle');
  const [faces, setFaces] = useState([]);
  const [rebuildProgress, setRebuildProgress] = useState(0);
  const [particleText, setParticleText] = useState('AI');
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [agendaStage, setAgendaStage] = useState('');
  const [showQR, setShowQR] = useState(true);
  const [mosaicPreview, setMosaicPreview] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!socket) return;
    socket.emit('display:register');

    socket.on('mode:changed', (data) => { setMode(data.mode); });
    socket.on('shatter:start', () => { setMode('shatter'); });
    socket.on('shatter:progress', (progress) => { setRebuildProgress(typeof progress === 'number' ? progress : 0); });
    socket.on('face:new', () => { loadFaces(); });
    socket.on('mosaic:update', () => { setMode('mosaic'); });

    socket.on('display:text-changed', (data) => { setParticleText(data.text); });
    socket.on('display:background-changed', (data) => { setBackgroundUrl(data.url || ''); });

    socket.on('agenda:changed', (data) => {
      setAgendaStage(data.stage);
      setTimeout(() => setAgendaStage(''), 5000);
    });

    socket.on('display:mosaic-preview', (data) => { setMosaicPreview(!!data.enabled); });
    socket.on('control:users-count', (count) => { setOnlineCount(count); });

    socket.on('control:state', (state) => {
      if (state.mode) setMode(state.mode);
      if (state.particleText) setParticleText(state.particleText);
      if (state.background) setBackgroundUrl(state.background);
    });

    return () => {
      socket.off('mode:changed');
      socket.off('shatter:start');
      socket.off('shatter:progress');
      socket.off('face:new');
      socket.off('mosaic:update');
      socket.off('display:text-changed');
      socket.off('display:background-changed');
      socket.off('agenda:changed');
      socket.off('display:mosaic-preview');
      socket.off('control:state');
      socket.off('control:users-count');
    };
  }, [socket]);

  const loadFaces = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/faces`);
      setFaces(res.data);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { loadFaces(); }, []);

  const isMosaicMode = mode === 'mosaic' || mosaicPreview;

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#000', overflow: 'hidden',
      position: 'relative', cursor: 'none',
    }}>
      {/* Background */}
      {backgroundUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${backgroundUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3, zIndex: 0,
        }} />
      )}

      {/* Connection indicator + online count */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        zIndex: 1000, opacity: 0.6,
      }}>
        <span style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>
          👥 {onlineCount}
        </span>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: connected ? '#00ff88' : '#ff4444',
        }} />
      </div>

      {/* QR Code */}
      <div style={{
        position: 'absolute', bottom: 20, left: 20,
        zIndex: 50, opacity: showQR ? 0.8 : 0, transition: 'opacity 1s',
      }}>
        <QRCodeDisplay url={JOIN_URL} size={120} />
      </div>

      {/* ShatterCanvas */}
      {!isMosaicMode && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <ShatterCanvas mode={mode} rebuildProgress={rebuildProgress} particleText={particleText} />
        </div>
      )}

      {/* Mosaic — real or preview */}
      {isMosaicMode && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <MosaicCanvas faces={mosaicPreview ? [] : faces} emojiPreview={mosaicPreview} />
        </div>
      )}

      {/* Emoji float */}
      <EmojiFloat socket={socket} />

      {/* Danmaku */}
      {!isMosaicMode && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <DanmakuLayer socket={socket} mode={mode} />
        </div>
      )}

      {/* Agenda label */}
      {agendaStage && (
        <div style={{
          position: 'absolute', top: '20%', left: '50%',
          transform: 'translateX(-50%)', zIndex: 100,
          fontSize: 'clamp(32px, 8vw, 64px)', fontWeight: 900, color: '#fff',
          textShadow: '0 0 30px rgba(64,169,255,0.6), 0 2px 15px rgba(0,0,0,0.9)',
          letterSpacing: '0.2em', whiteSpace: 'nowrap', padding: '20px 60px',
          background: 'linear-gradient(90deg, transparent, rgba(0,123,255,0.2), transparent)',
          animation: 'fadeInScale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          {AGENDA_LABELS[agendaStage] || agendaStage}
        </div>
      )}

      {/* Countdown Overlay */}
      <CountdownOverlay socket={socket} />

      {/* Announcement Overlay */}
      <AnnouncementOverlay socket={socket} />

      {/* Lucky Draw Overlay */}
      <LuckyDrawOverlay socket={socket} />

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: translateX(-50%) scale(0.8); }
          to { opacity: 1; transform: translateX(-50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
