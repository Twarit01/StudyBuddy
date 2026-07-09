import { useEffect, useRef } from 'react'

/**
 * AnimatedBackground — floating particles, pulsing orbs, grid overlay
 * and a scanning beam. Drop this anywhere and it fills its parent.
 * The parent must have `position: relative` and `overflow: hidden`.
 */
export default function AnimatedBackground({ particleCount = 60, opacity = 1 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const particles = Array.from({ length: particleCount }, () => ({
      x:       Math.random(),
      y:       Math.random(),
      r:       Math.random() * 1.4 + 0.3,
      dx:      (Math.random() - 0.5) * 0.0003,
      dy:      -(Math.random() * 0.0004 + 0.0001),
      opacity: Math.random() * 0.45 + 0.1,
      pulse:   Math.random() * Math.PI * 2,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const w = canvas.width, h = canvas.height
      particles.forEach(p => {
        p.pulse += 0.018
        p.x += p.dx; p.y += p.dy
        if (p.y < -5 / h) { p.y = 1 + 5 / h; p.x = Math.random() }
        if (p.x < 0) p.x = 1
        if (p.x > 1) p.x = 0
        const alpha = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse))
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(167,139,250,${alpha * opacity})`
        ctx.fill()
      })
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [particleCount, opacity])

  return (
    <>
      <style>{`
        @keyframes ab-orb-float {
          0%,100% { transform: translateY(0) scale(1) rotate(0deg); }
          33%      { transform: translateY(-22px) scale(1.05) rotate(1.5deg); }
          66%      { transform: translateY(-10px) scale(0.97) rotate(-1deg); }
        }
        @keyframes ab-scan {
          0%   { left: -60%; }
          100% { left: 130%; }
        }
        @keyframes ab-glow-pulse {
          0%,100% { opacity: 0.7; }
          50%      { opacity: 1.1; }
        }
        @keyframes ab-grid-fade {
          0%   { opacity: 0.55; }
          100% { opacity: 0.9; }
        }
      `}</style>

      {/* Canvas particles */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* Radial glow blobs */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(ellipse 70% 55% at 15% 25%, rgba(124,58,237,0.18) 0%, transparent 70%),
          radial-gradient(ellipse 55% 50% at 85% 75%, rgba(79,70,229,0.16) 0%, transparent 65%),
          radial-gradient(ellipse 40% 40% at 55% 10%, rgba(167,139,250,0.10) 0%, transparent 60%)
        `,
        animation: 'ab-glow-pulse 7s ease-in-out infinite alternate',
      }}/>

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(124,58,237,0.055) 1px, transparent 1px),
          linear-gradient(90deg, rgba(124,58,237,0.055) 1px, transparent 1px)
        `,
        backgroundSize: '44px 44px',
        animation: 'ab-grid-fade 5s ease-in-out infinite alternate',
      }}/>

      {/* Floating orbs */}
      {[
        { w:320, h:320, bg:'rgba(124,58,237,0.14)', top:'-90px',  left:'-70px',   delay:'0s',  blur:70 },
        { w:240, h:240, bg:'rgba(79,70,229,0.18)',  bottom:'60px', right:'-50px',  delay:'-3s', blur:65 },
        { w:180, h:180, bg:'rgba(167,139,250,0.11)',top:'45%',    right:'18%',     delay:'-5s', blur:55 },
        { w:130, h:130, bg:'rgba(109,40,217,0.14)', bottom:'25%', left:'25%',      delay:'-7s', blur:50 },
      ].map((orb, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: orb.w, height: orb.h,
          top: orb.top, bottom: orb.bottom,
          left: orb.left, right: orb.right,
          borderRadius: '50%',
          background: orb.bg,
          filter: `blur(${orb.blur}px)`,
          pointerEvents: 'none', zIndex: 0,
          animation: `ab-orb-float ${8 + i * 1.5}s ease-in-out infinite`,
          animationDelay: orb.delay,
        }}/>
      ))}

      {/* Scanning beam */}
      <div style={{
        position: 'absolute', top: 0, left: '-60%',
        width: '60%', height: '100%', zIndex: 0, pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.04), transparent)',
        animation: 'ab-scan 10s linear infinite',
      }}/>
    </>
  )
}
