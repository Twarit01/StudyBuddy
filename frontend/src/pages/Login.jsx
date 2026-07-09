import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const canvasRef  = useRef(null)

  const from = location.state?.from || '/dashboard'

  const [form, setForm]       = useState({ email:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Canvas particle system
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const PARTICLE_COUNT = 55
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: -Math.random() * 0.4 - 0.1,
      opacity: Math.random() * 0.5 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.pulse += 0.02
        p.x += p.dx
        p.y += p.dy
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width }
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        const alpha = p.opacity * (0.7 + 0.3 * Math.sin(p.pulse))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(167,139,250,${alpha})`
        ctx.fill()
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      await login(form.email, form.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.')
    } finally { setLoading(false) }
  }

  const features = [
    { icon: '🤖', title: 'AI-Powered Answers', desc: 'Get instant answers from your uploaded documents' },
    { icon: '🧠', title: 'Smart Quizzes', desc: 'Auto-generated quizzes to test your knowledge' },
    { icon: '🗺️', title: 'Concept Mind Maps', desc: 'Visualize topic connections effortlessly' },
    { icon: '📈', title: 'Track Progress', desc: 'Monitor your learning journey with analytics' },
  ]

  return (
    <div style={{
      height: '100vh', display: 'flex', overflow: 'hidden',
      fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      background: '#080810',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }

        /* ── Left panel ── */
        .login-left {
          flex: 1; display: flex; flex-direction: column;
          justify-content: center; padding: 60px;
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #0f0a1e 0%, #130d2b 40%, #0d1528 100%);
          animation: bgShift 12s ease-in-out infinite alternate;
        }
        @keyframes bgShift {
          0%   { background-position: 0% 50%; filter: brightness(1); }
          50%  { filter: brightness(1.05); }
          100% { background-position: 100% 50%; filter: brightness(1); }
        }

        .login-left::before {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(124,58,237,0.25) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 80% 80%, rgba(79,70,229,0.2) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 60% 10%, rgba(167,139,250,0.1) 0%, transparent 60%);
          pointer-events: none;
          animation: glowPulse 6s ease-in-out infinite alternate;
        }
        @keyframes glowPulse {
          0%   { opacity: 0.8; }
          100% { opacity: 1.2; }
        }

        /* Scanning beam */
        .login-left::after {
          content: ''; position: absolute;
          top: 0; left: -100%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(167,139,250,0.04), transparent);
          animation: scanBeam 8s linear infinite;
          pointer-events: none;
        }
        @keyframes scanBeam { 0% { left: -60%; } 100% { left: 130%; } }

        .orb {
          position: absolute; border-radius: 50%; filter: blur(60px);
          animation: orbFloat 8s ease-in-out infinite;
        }
        .orb-1 { width:300px;height:300px;background:rgba(124,58,237,0.18);top:-80px;right:-60px;animation-delay:0s; }
        .orb-2 { width:200px;height:200px;background:rgba(79,70,229,0.22);bottom:80px;left:-40px;animation-delay:-3s; }
        .orb-3 { width:150px;height:150px;background:rgba(167,139,250,0.14);top:50%;right:20%;animation-delay:-5s; }
        @keyframes orbFloat {
          0%,100% { transform: translateY(0) scale(1) rotate(0deg); }
          33% { transform: translateY(-18px) scale(1.04) rotate(1deg); }
          66% { transform: translateY(-8px) scale(0.98) rotate(-1deg); }
        }

        .grid-overlay {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          animation: gridFade 4s ease-in-out infinite alternate;
        }
        @keyframes gridFade { 0%{opacity:0.7} 100%{opacity:1} }

        /* Feature cards */
        .feature-card {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 18px; border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
          cursor: default; opacity: 0;
          animation: cardSlideIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
          position: relative; overflow: hidden;
        }
        .feature-card::after {
          content: ''; position: absolute;
          top: -50%; left: -75%; width: 50%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          transform: skewX(-20deg);
          transition: left 0.6s ease;
        }
        .feature-card:hover::after { left: 150%; }
        .feature-card:hover {
          background: rgba(124,58,237,0.14);
          border-color: rgba(124,58,237,0.35);
          transform: translateX(6px) scale(1.01);
          box-shadow: 0 4px 20px rgba(124,58,237,0.15);
        }
        @keyframes cardSlideIn {
          from { opacity:0; transform: translateX(-20px) scale(0.95); }
          to   { opacity:1; transform: translateX(0) scale(1); }
        }

        .feature-icon {
          width:40px; height:40px; border-radius:10px;
          background: linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.2));
          border: 1px solid rgba(124,58,237,0.3);
          display:flex; align-items:center; justify-content:center;
          font-size:18px; flex-shrink:0;
          transition: transform 0.3s ease;
        }
        .feature-card:hover .feature-icon { transform: scale(1.15) rotate(-5deg); }

        /* ── Right panel ── */
        .login-right {
          width: 480px; flex-shrink: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 48px 52px;
          background: #0a0a15;
          border-left: 1px solid rgba(255,255,255,0.06);
          position: relative; overflow: hidden;
        }
        .login-right::before {
          content: ''; position: absolute; top: -200px; left: 50%;
          transform: translateX(-50%);
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%);
          pointer-events: none;
          animation: rightGlow 5s ease-in-out infinite alternate;
        }
        @keyframes rightGlow {
          0%   { opacity: 0.6; transform: translateX(-50%) scale(0.95); }
          100% { opacity: 1;   transform: translateX(-50%) scale(1.1); }
        }

        /* Form entrance */
        .form-wrap {
          width: 100%; max-width: 360px;
          animation: formEntrance 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes formEntrance {
          from { opacity:0; transform: translateY(28px) scale(0.97); }
          to   { opacity:1; transform: none; }
        }

        /* Inputs */
        .auth-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; padding: 15px 16px;
          color: #fff; font-size: 15px; outline: none;
          transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
          font-family: inherit;
        }
        .auth-input:hover { border-color: rgba(255,255,255,0.2); }
        .auth-input:focus {
          border-color: rgba(124,58,237,0.8);
          background: rgba(124,58,237,0.07);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.15), 0 0 24px rgba(124,58,237,0.1);
          transform: scale(1.01);
        }
        .auth-input::placeholder { color: rgba(255,255,255,0.22); }

        .auth-label {
          display: block; font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,0.5); margin-bottom: 8px; letter-spacing: 0.5px;
          transition: color 0.2s;
        }
        .field-wrap:focus-within .auth-label { color: #A78BFA; }

        /* Button */
        .submit-btn {
          width: 100%; padding: 15px; border: none; border-radius: 12px;
          background: linear-gradient(135deg, #7C3AED, #6D28D9);
          color: #fff; font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 24px rgba(124,58,237,0.5);
          position: relative; overflow: hidden;
        }
        /* Shimmer sweep */
        .submit-btn::after {
          content: ''; position: absolute;
          top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          animation: btnShimmer 2.5s ease-in-out infinite;
        }
        @keyframes btnShimmer { 0%{left:-100%} 60%,100%{left:120%} }
        .submit-btn::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
          opacity: 0; transition: opacity 0.25s;
        }
        .submit-btn:hover:not(:disabled)::before { opacity: 1; }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 10px 36px rgba(124,58,237,0.65);
        }
        .submit-btn:active:not(:disabled) { transform: translateY(0) scale(0.99); }
        .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .submit-btn:disabled::after { animation: none; }

        /* Badge */
        .badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 20px;
          background: rgba(124,58,237,0.15);
          border: 1px solid rgba(124,58,237,0.35);
          font-size: 11px; font-weight: 600; color: #C4B5FD;
          margin-bottom: 20px;
          animation: badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;
        }
        @keyframes badgePop {
          from { opacity:0; transform: scale(0.7) translateY(-8px); }
          to   { opacity:1; transform: none; }
        }
        .badge-dot {
          width:6px; height:6px; border-radius:50%; background:#10B981;
          box-shadow: 0 0 6px #10B981;
          animation: dotPulse 2s ease-in-out infinite;
        }
        @keyframes dotPulse {
          0%,100% { box-shadow: 0 0 4px #10B981; transform: scale(1); }
          50%      { box-shadow: 0 0 10px #10B981; transform: scale(1.3); }
        }

        .divider {
          display:flex; align-items:center; gap:12px;
          color:rgba(255,255,255,0.2); font-size:12px;
        }
        .divider::before,.divider::after {
          content:''; flex:1; height:1px; background:rgba(255,255,255,0.08);
        }

        /* Logo float */
        .logo-wrap { animation: logoFloat 4s ease-in-out infinite; }
        @keyframes logoFloat {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }

        /* Headline reveal */
        .headline-reveal {
          animation: headlineIn 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.15s both;
        }
        @keyframes headlineIn {
          from { opacity:0; transform: translateY(20px); }
          to   { opacity:1; transform: none; }
        }
        .headline-sub {
          animation: headlineIn 0.6s ease 0.3s both;
        }

        @keyframes spin { to { transform: rotate(360deg) } }

        @media (max-width:800px) {
          .login-left { display: none; }
          .login-right { width:100%; border-left:none; }
        }
      `}</style>

      {/* ── Left panel ── */}
      <div className="login-left">
        <div className="grid-overlay"/>
        <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }}/>
        <div className="orb orb-1"/>
        <div className="orb orb-2"/>
        <div className="orb orb-3"/>

        <div style={{ position:'relative', zIndex:1, maxWidth:460 }}>
          <div className="logo-wrap" style={{ marginBottom:36 }}>
            <img src="/studybuddy-logo.png" alt="StudyBuddy"
              style={{ width:180, height:'auto', objectFit:'contain' }}/>
          </div>

          <h2 className="headline-reveal" style={{ fontSize:38, fontWeight:900, color:'#fff', margin:'0 0 12px',
            lineHeight:1.15, letterSpacing:'-1px' }}>
            Study smarter,<br/>
            <span style={{ background:'linear-gradient(135deg,#A78BFA,#7C3AED,#C4B5FD)', WebkitBackgroundClip:'text',
              WebkitTextFillColor:'transparent', backgroundSize:'200%',
              animation:'gradShift 4s linear infinite alternate' }}>
              not harder.
            </span>
          </h2>
          <style>{`@keyframes gradShift { 0%{background-position:0%} 100%{background-position:100%} }`}</style>

          <p className="headline-sub" style={{ fontSize:15, color:'rgba(255,255,255,0.45)', margin:'0 0 36px', lineHeight:1.7 }}>
            Your AI-powered study companion that answers from your own documents and tracks your progress.
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {features.map((f, i) => (
              <div key={f.title} className="feature-card" style={{ animationDelay:`${0.35 + i * 0.1}s` }}>
                <div className="feature-icon">{f.icon}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:2 }}>{f.title}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right">
        <div className="form-wrap">

          <div className="badge">
            <div className="badge-dot"/>
            AI Study Companion
          </div>

          <h1 style={{ fontSize:26, fontWeight:800, color:'#fff', margin:'0 0 6px', letterSpacing:'-0.5px',
            animation:'headlineIn 0.5s ease 0.25s both' }}>
            Welcome back
          </h1>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', margin:'0 0 32px',
            animation:'headlineIn 0.5s ease 0.35s both' }}>
            Sign in to continue your learning journey
          </p>

          {from && from !== '/dashboard' && (
            <div style={{ marginBottom:20, padding:'10px 14px', borderRadius:10, fontSize:12,
              background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.3)', color:'#C4B5FD' }}>
              → You'll be returned to <strong>{from}</strong>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {error && (
              <div style={{ padding:'12px 16px', borderRadius:12, fontSize:13,
                background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)',
                color:'#FCA5A5', display:'flex', alignItems:'flex-start', gap:9,
                animation:'headlineIn 0.3s ease both' }}>
                <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>⚠</span> {error}
              </div>
            )}

            {[
              { name:'email',    label:'Email address', type:'email',    ph:'you@example.com',   auto:'email' },
              { name:'password', label:'Password',      type:'password', ph:'Enter your password', auto:'current-password' },
            ].map((f, i) => (
              <div key={f.name} className="field-wrap"
                style={{ animation:`headlineIn 0.5s ease ${0.4 + i * 0.1}s both` }}>
                <label className="auth-label">{f.label}</label>
                <input type={f.type} name={f.name} value={form[f.name]}
                  onChange={handleChange} placeholder={f.ph}
                  required autoComplete={f.auto} className="auth-input"/>
              </div>
            ))}

            <button type="submit" disabled={loading} className="submit-btn"
              style={{ marginTop:8, animation:'headlineIn 0.5s ease 0.6s both' }}>
              {loading ? (
                <>
                  <div style={{ width:17, height:17, border:'2.5px solid rgba(255,255,255,0.3)',
                    borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                  Signing in...
                </>
              ) : <>Sign in <span style={{ fontSize:16 }}>→</span></>}
            </button>
          </form>

          <div className="divider" style={{ margin:'24px 0', animation:'headlineIn 0.5s ease 0.7s both' }}>or</div>

          <p style={{ textAlign:'center', fontSize:14, color:'rgba(255,255,255,0.35)', margin:0,
            animation:'headlineIn 0.5s ease 0.75s both' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color:'#A78BFA', fontWeight:700, textDecoration:'none', transition:'color 0.2s' }}
              onMouseEnter={e => e.target.style.color='#C4B5FD'}
              onMouseLeave={e => e.target.style.color='#A78BFA'}>
              Create one free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
