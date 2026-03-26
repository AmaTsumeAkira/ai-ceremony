import React, { useRef, useEffect, useState } from 'react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:6588'
  : `${window.location.protocol}//${window.location.hostname}:6588`;

const EMOJI_POOL = ['😀', '🎉', '🔥', '💯', '⭐', '🎊', '🚀', '💎', '🌟', '🎯', '🏆', '✨', '💫', '🎪', '🎭'];

export default function MosaicCanvas({ faces, emojiPreview = false }) {
  const canvasRef = useRef(null);
  const [loadedImages, setLoadedImages] = useState([]);
  const animFrameRef = useRef(null);
  const positionsRef = useRef([]);

  // Load face images (only if not emoji preview)
  useEffect(() => {
    if (emojiPreview) return;
    if (!faces || faces.length === 0) return;

    const images = [];
    let loaded = 0;
    let failed = 0;

    faces.forEach((face, i) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        images[i] = img;
        loaded++;
        if (loaded + failed >= faces.length) {
          setLoadedImages(images.filter(Boolean));
        }
      };
      img.onerror = () => {
        failed++;
        // 用 null 占位，渲染时跳过
        images[i] = null;
        if (loaded + failed >= faces.length) {
          setLoadedImages(images.filter(Boolean));
        }
      };
      img.src = face.face_url.startsWith('http') ? face.face_url : `${API_BASE}${face.face_url}`;
    });

    if (faces.length === 0) setLoadedImages([]);
  }, [faces, emojiPreview]);

  // Render mosaic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // resize 后重置位置以便重新计算
      positionsRef.current = [];
    };
    resize();
    window.addEventListener('resize', resize);

    // For emoji preview, generate emoji cells
    const cellCount = emojiPreview ? 80 : loadedImages.length;

    // Grid layout
    const cols = Math.ceil(Math.sqrt(cellCount * (canvas.width / canvas.height)));
    const rows = Math.ceil(cellCount / cols);
    const cellW = canvas.width / Math.max(cols, 1);
    const cellH = canvas.height / Math.max(rows, 1);
    const cellSize = Math.min(cellW, cellH);
    const padding = 4;

    // Init positions
    if (positionsRef.current.length !== cellCount) {
      positionsRef.current = Array.from({ length: cellCount }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
          tx: col * cellW + (cellW - cellSize) / 2,
          ty: row * cellH + (cellH - cellSize) / 2,
          x: Math.random() * canvas.width * 2 - canvas.width / 2,
          y: Math.random() * canvas.height * 2 - canvas.height / 2,
          rotation: (Math.random() - 0.5) * Math.PI,
          emoji: EMOJI_POOL[i % EMOJI_POOL.length],
        };
      });
    }

    let time = 0;

    const draw = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (cellCount === 0) {
        ctx.fillStyle = '#333';
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('等待用户上传头像...', canvas.width / 2, canvas.height / 2);
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      time += 0.02;

      for (let i = 0; i < cellCount; i++) {
        const pos = positionsRef.current[i];
        if (!pos) continue;

        // Animate position
        pos.x += (pos.tx - pos.x) * 0.03;
        pos.y += (pos.ty - pos.y) * 0.03;
        pos.rotation += (0 - pos.rotation) * 0.02;

        const size = cellSize - padding * 2;

        ctx.save();
        ctx.translate(pos.x + cellSize / 2, pos.y + cellSize / 2);
        ctx.rotate(pos.rotation + Math.sin(time + i * 0.3) * 0.02);

        // Circular clip area
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.clip();

        if (emojiPreview) {
          // Draw emoji as circular tile
          ctx.fillStyle = '#111';
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.font = `${size * 0.6}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pos.emoji, 0, 0);
        } else {
          // Draw face image
          const img = loadedImages[i];
          if (img) {
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
          }
        }

        // Border glow
        const glowColor = emojiPreview
          ? `rgba(255, 200, 0, ${0.3 + Math.sin(time + i) * 0.15})`
          : `rgba(0, 255, 136, ${0.3 + Math.sin(time + i) * 0.15})`;
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      }

      // Title
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.15;
      ctx.fillText('AI', canvas.width / 2, canvas.height / 2 + 24);
      ctx.globalAlpha = 1;

      // Subtitle
      ctx.fillStyle = '#666';
      ctx.font = '20px sans-serif';
      const subtitle = emojiPreview
        ? `Emoji 预览模式 · ${cellCount} 个像素`
        : `每个人都是像素 · ${loadedImages.length} 位参与者`;
      ctx.fillText(subtitle, canvas.width / 2, canvas.height - 40);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [loadedImages, emojiPreview]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%', height: '100%',
        display: 'block', background: '#000',
      }}
    />
  );
}
