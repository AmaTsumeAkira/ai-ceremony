import React, { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'

const PARTICLE_COUNT = 6000

// Generate particle positions from text
function generateTextParticles(text, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#fff'

  // 自适应字号：根据文字长度动态调整
  const baseFontSize = Math.floor(height * 0.5)
  let fontSize = baseFontSize
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Source Han Sans CN", "WenQuanYi Micro Hei", sans-serif`

  // 确保文字不超过画布宽度的 90%
  const maxWidth = width * 0.9
  let measured = ctx.measureText(text)
  if (measured.width > maxWidth) {
    fontSize = Math.floor(fontSize * (maxWidth / measured.width))
    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Source Han Sans CN", "WenQuanYi Micro Hei", sans-serif`
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 长文字自动换行处理
  if (text.length > 6) {
    const mid = Math.ceil(text.length / 2)
    const line1 = text.slice(0, mid)
    const line2 = text.slice(mid)
    const lineGap = fontSize * 1.25
    ctx.fillText(line1, width / 2, height / 2 - lineGap / 2, maxWidth)
    ctx.fillText(line2, width / 2, height / 2 + lineGap / 2, maxWidth)
  } else {
    ctx.fillText(text, width / 2, height / 2, maxWidth)
  }

  const imageData = ctx.getImageData(0, 0, width, height)
  const pixels = imageData.data
  const points = []

  const step = 3
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      if (pixels[i] > 128) {
        points.push({
          x: (x / width - 0.5) * 18,
          y: -(y / height - 0.5) * 9,
          z: (Math.random() - 0.5) * 0.5,
        })
      }
    }
  }
  return points
}

export default function ShatterCanvas({ mode, rebuildProgress, particleText = 'AI', visible = true }) {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const particlesRef = useRef(null)
  const animFrameRef = useRef(null)
  const stateRef = useRef('idle') // idle, shattering, rebuilding
  const progressRef = useRef(0)
  const textRef = useRef(particleText)
  const clockRef = useRef(new THREE.Clock())
  const visibleRef = useRef(visible)

  // Update visibility ref
  useEffect(() => { visibleRef.current = visible }, [visible])

  useEffect(() => {
    if (!containerRef.current) return
    // 防止 StrictMode 重复初始化
    if (rendererRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100)
    camera.position.z = 6
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 1)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Generate particles — use larger canvas for better quality
    const textPoints = generateTextParticles(particleText, 1024, 512)
    const count = Math.min(PARTICLE_COUNT, textPoints.length)

    const positions = new Float32Array(count * 3)
    const targets = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    const colorA = new THREE.Color('#40a9ff')
    const colorB = new THREE.Color('#722ed1')
    const colorC = new THREE.Color('#eb2f96')

    for (let i = 0; i < count; i++) {
      const p = textPoints[i]
      const i3 = i * 3

      // Target = text position
      targets[i3] = p.x
      targets[i3 + 1] = p.y
      targets[i3 + 2] = p.z

      // Start at target
      positions[i3] = p.x
      positions[i3 + 1] = p.y
      positions[i3 + 2] = p.z

      // Velocity
      velocities[i3] = 0
      velocities[i3 + 1] = 0
      velocities[i3 + 2] = 0

      // Color gradient
      const t = i / count
      const color = t < 0.5
        ? colorA.clone().lerp(colorB, t * 2)
        : colorB.clone().lerp(colorC, (t - 0.5) * 2)
      colors[i3] = color.r
      colors[i3 + 1] = color.g
      colors[i3 + 2] = color.b

      sizes[i] = 0.03 + Math.random() * 0.04
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    // Shader material for round particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * 300.0 * (3.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          vAlpha = 0.8;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.2, d) * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const particles = new THREE.Points(geometry, material)
    scene.add(particles)
    particlesRef.current = { geometry, material, targets, velocities, count }

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate)
      // 隐藏时跳过渲染节省 GPU
      if (!visibleRef.current) return
      const delta = clockRef.current.getDelta()
      const time = clockRef.current.getElapsedTime()

      material.uniforms.uTime.value = time
      const pos = geometry.attributes.position.array

      if (stateRef.current === 'shattering') {
        // Shatter: give random velocity with friction decay
        let allGone = true
        for (let i = 0; i < count; i++) {
          const i3 = i * 3
          if (velocities[i3] === 0 && velocities[i3 + 1] === 0) {
            const angle = Math.random() * Math.PI * 2
            const speed = 2 + Math.random() * 4
            const phi = Math.random() * Math.PI
            velocities[i3] = Math.sin(phi) * Math.cos(angle) * speed
            velocities[i3 + 1] = Math.sin(phi) * Math.sin(angle) * speed
            velocities[i3 + 2] = Math.cos(phi) * speed * 0.5
          }
          // Apply friction decay
          const friction = 0.97
          velocities[i3] *= friction
          velocities[i3 + 1] *= friction
          velocities[i3 + 2] *= friction

          pos[i3] += velocities[i3] * delta
          pos[i3 + 1] += velocities[i3 + 1] * delta
          pos[i3 + 2] += velocities[i3 + 2] * delta

          // Check if particle is still moving or within visible range
          const distFromCenter = Math.sqrt(pos[i3] ** 2 + pos[i3 + 1] ** 2 + pos[i3 + 2] ** 2)
          const speed = Math.sqrt(velocities[i3] ** 2 + velocities[i3 + 1] ** 2 + velocities[i3 + 2] ** 2)
          if (speed > 0.01 || distFromCenter < 20) {
            allGone = false
          }
        }
        // If all particles are far away and barely moving, stop updating
        if (allGone) {
          stateRef.current = 'idle'
        }
        geometry.attributes.position.needsUpdate = true
      } else if (stateRef.current === 'rebuilding') {
        // Rebuild: move toward target
        let settled = 0
        for (let i = 0; i < count; i++) {
          const i3 = i * 3
          const dx = targets[i3] - pos[i3]
          const dy = targets[i3 + 1] - pos[i3 + 1]
          const dz = targets[i3 + 2] - pos[i3 + 2]
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

          if (dist < 0.05) {
            pos[i3] = targets[i3]
            pos[i3 + 1] = targets[i3 + 1]
            pos[i3 + 2] = targets[i3 + 2]
            velocities[i3] = 0
            velocities[i3 + 1] = 0
            velocities[i3 + 2] = 0
            settled++
          } else {
            const speed = 3 + Math.random() * 0.5
            pos[i3] += (dx / dist) * speed * delta
            pos[i3 + 1] += (dy / dist) * speed * delta
            pos[i3 + 2] += (dz / dist) * speed * delta
          }
        }
        progressRef.current = Math.round((settled / count) * 100)
        geometry.attributes.position.needsUpdate = true
      } else {
        // Idle: gentle float
        for (let i = 0; i < count; i++) {
          const i3 = i * 3
          pos[i3] = targets[i3] + Math.sin(time * 0.5 + i * 0.01) * 0.02
          pos[i3 + 1] = targets[i3 + 1] + Math.cos(time * 0.3 + i * 0.02) * 0.02
        }
        geometry.attributes.position.needsUpdate = true
      }

      // Subtle camera movement
      camera.position.x = Math.sin(time * 0.1) * 0.3
      camera.position.y = Math.cos(time * 0.15) * 0.2
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }

    animate()

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      renderer.dispose()
      material.dispose()
      geometry.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  // React to mode changes
  useEffect(() => {
    if (mode === 'shatter') {
      stateRef.current = 'shattering'
    } else if (mode === 'rebuild') {
      stateRef.current = 'rebuilding'
      // Reset velocities for smooth rebuild
      const p = particlesRef.current
      if (p) {
        for (let i = 0; i < p.count; i++) {
          const i3 = i * 3
          p.velocities[i3] = 0
          p.velocities[i3 + 1] = 0
          p.velocities[i3 + 2] = 0
        }
      }
    } else {
      stateRef.current = 'idle'
    }
  }, [mode])

  // React to particleText changes — regenerate targets without remounting
  useEffect(() => {
    textRef.current = particleText
    const p = particlesRef.current
    if (!p || !rendererRef.current) return

    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight
    const textPoints = generateTextParticles(particleText, 1024, 512)
    const count = Math.min(PARTICLE_COUNT, textPoints.length)

    // Update targets and velocities
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const tp = textPoints[i]
      p.targets[i3] = tp.x
      p.targets[i3 + 1] = tp.y
      p.targets[i3 + 2] = tp.z
    }

    // Trigger rebuild animation to morph into new text
    stateRef.current = 'rebuilding'
    for (let i = 0; i < p.count; i++) {
      const i3 = i * 3
      p.velocities[i3] = 0
      p.velocities[i3 + 1] = 0
      p.velocities[i3 + 2] = 0
    }
  }, [particleText])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#000',
      }}
    />
  )
}
