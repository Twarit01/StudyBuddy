import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate      = useNavigate()
  const canvasRef     = useRef(null)

  const [form, setForm]       = useState({ email:'', full_name:'', password:'', confirm:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // Canvas particle system
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.3,
      dx: (Math.random() - 0.5) * 0.25,
      dy: -Math.random() * 0.35 - 0.1,
      opacity: Math.random() * 0.45 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.pulse += 0.018
        p.x += p.dx; p.y += p.dy
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
    e.preventDefault(); setError(null)
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await register(form.email, form.full_name, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally { setLoading(false) }
  }

  const fields = [
    { label:'Full Name',        name:'full_name', type:'text',     placeholder:'Your name',            auto:'name' },
    { label:'Email Address',    name:'email',     type:'email',    placeholder:'you@example.com',      auto:'email' },
    { label:'Password',         name:'password',  type:'password', placeholder:'Min 6 characters',     auto:'new-password' },
    { label:'Confirm Password', name:'confirm',   type:'password', placeholder:'Repeat your password', auto:'new-password' },
  ]

  const perks = [
    { icon:'📄', text:'Upload unlimited study documents' },
    { icon:'🤖', text:'Ask questions, get cited answers' },
    { icon:'🎯', text:'Smart quizzes & mind maps' },
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
        .reg-left {
          flex: 1; display: flex; flex-direction: column;
          justify-content: center; padding: 60px;
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #0f0a1e 0%, #130d2b 40%, #0d1528 100%);
        }
        .reg-left::before {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 30% 40%, rgba(124,58,237,0.22) 0%, transparent 70%),
            radial-gradient(ellipse 50% 50% at 80% 20%, rgba(79,70,229,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 40% 50% at 10% 80%, rgba(167,139,250,0.1) 0%, transparent 60%);
          pointer-events: none;
          animation: regGlowPulse 6s ease-in-out infinite alternate;
        }
        @keyframes regGlowPulse { 0%{opacity:0.8} 100%{opacity:1.15} }

        /* Scanning beam */
        .reg-left::after {
          content: ''; position: absolute;
          top: 0; left: -60%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(167,139,250,0.04), transparent);
          animation: regScan 9s linear infinite;
          pointer-events: none;
        }
        @keyframes regScan { 0%{left:-60%} 100%{left:130%} }

        .reg-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          animation: regGridFade 4s ease-in-out infinite alternate;
        }
        @keyframes regGridFade { 0%{opacity:0.6} 100%{opacity:1} }

        .reg-orb {
          position: absolute; border-radius: 50%; filter: blur(70px);
          animation: regOrbFloat 9s ease-in-out infinite;
        }
        .reg-orb-1 { width:280px;height:280px;background:rgba(124,58,237,0.16);top:-60px;left:-60px;animation-delay:0s; }
        .reg-orb-2 { width:220px;height:220px;background:rgba(79,70,229,0.2);bottom:60px;right:-40px;animation-delay:-4s; }
        .reg-orb-3 { width:140px;height:140px;background:rgba(167,139,250,0.1);top:55%;left:30%;animation-delay:-6s; }
        @keyframes regOrbFloat {
          0%,100% { transform: translateY(0) scale(1) rotate(0deg); }
          33%      { transform: translateY(-16px) scale(1.04) rotate(1.5deg); }
          66%      { transform: translateY(-8px) scale(0.97) rotate(-1deg); }
        }

        /* Perk items */
        .perk-item {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 18px; border-radius: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          font-size: 13px; color: rgba(255,255,255,0.6);
          transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1);
          cursor: default; opacity: 0;
          animation: perkSlide 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
          position: relative; overflow: hidden;
        }
        .perk-item::after {
          content: ''; position: absolute;
          top: -50%; left: -75%; width: 50%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          transform: skewX(-20deg); transition: left 0.6s ease;
        }
        .perk-item:hover::after { left: 150%; }
        .perk-item:hover {
          background: rgba(124,58,237,0.12);
          border-color: rgba(124,58,237,0.3);
          color: rgba(255,255,255,0.85);
          transform: translateX(6px) scale(1.01);
          box-shadow: 0 4px 20px rgba(124,58,237,0.12);
        }
        @keyframes perkSlide {
          from { opacity:0; transform: translateX(-20px) scale(0.95); }
          to   { opacity:1; transform: none; }
        }
        .perk-icon {
          width:36px; height:36px; border-radius:9px; flex-shrink:0;
          background: linear-gradient(135deg,rgba(124,58,237,0.28),rgba(79,70,229,0.18));
          border: 1px solid rgba(124,58,237,0.28);
          display:flex; align-items:center; justify-content:center; font-size:16px;
          transition: transform 0.3s ease;
        }
        .perk-item:hover .perk-icon { transform: scale(1.15) rotate(-5deg); }

        /* ── Right panel ── */
        .reg-right {
          width: 500px; flex-shrink: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 40px 52px;
          background: #0a0a15;
          border-left: 1px solid rgba(255,255,255,0.06);
          position: relative; overflow: hidden;
        }
        .reg-right::before {
          content: ''; position: absolute; top: -200px; left: 50%;
          transform: translateX(-50%);
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(124,58,237,0.09) 0%, transparent 70%);
          pointer-events: none;
          animation: regRightGlow 5s ease-in-out infinite alternate;
        }
        @keyframes regRightGlow {
          0%   { opacity:0.6; transform: translateX(-50%) scale(0.95); }
          100% { opacity:1;   transform: translateX(-50%) scale(1.1); }
        }

        .reg-form-wrap {
          width:100%; max-width:380px;
          animation: regFormIn 0.65s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes regFormIn {
          from { opacity:0; transform: translateY(30px) scale(0.96); }
          to   { opacity:1; transform: none; }
        }

        /* Inputs */
        .auth-input {
          width:100%; background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.1); border-radius:12px;
          padding:13px 16px; color:#fff; font-size:15px; outline:none;
          transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1); font-family:inherit;
        }
        .auth-input:hover { border-color:rgba(255,255,255,0.2); }
        .auth-input:focus {
          border-color:rgba(124,58,237,0.8);
          background:rgba(124,58,237,0.07);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.15), 0 0 20px rgba(124,58,237,0.08);
          transform: scale(1.01);
        }
        .auth-input::placeholder { color:rgba(255,255,255,0.2); }

        .auth-label {
          display:block; font-size:12px; font-weight:600;
          color:rgba(255,255,255,0.45); margin-bottom:7px; letter-spacing:0.4px;
          transition: color 0.2s;
        }
        .field-wrap:focus-within .auth-label { color: #A78BFA; }

        /* Button */
        .submit-btn {
          width:100%; padding:15px; border:none; border-radius:12px;
          background:linear-gradient(135deg,#7C3AED,#6D28D9);
          color:#fff; font-size:15px; font-weight:700; font-family:inherit;
          cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
          transition:all 0.3s ease; box-shadow:0 4px 24px rgba(124,58,237,0.5);
          position:relative; overflow:hidden;
        }
        .submit-btn::after {
          content:''; position:absolute; top:0; left:-100%; width:100%; height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
          animation:regBtnShimmer 2.8s ease-in-out infinite;
        }
        @keyframes regBtnShimmer { 0%{left:-100%} 60%,100%{left:120%} }
        .submit-btn::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.1),transparent);
          opacity:0; transition:opacity 0.25s;
        }
        .submit-btn:hover:not(:disabled)::before { opacity:1; }
        .submit-btn:hover:not(:disabled) {
          transform:translateY(-2px) scale(1.01);
          box-shadow:0 10px 36px rgba(124,58,237,0.65);
        }
        .submit-btn:active:not(:disabled) { transform:translateY(0) scale(0.99); }
        .submit-btn:disabled { opacity:0.55; cursor:not-allowed; }
        .submit-btn:disabled::after { animation:none; }

        /* Badge */
        .badge {
          display:inline-flex; align-items:center; gap:6px;
          padding:4px 12px; border-radius:20px;
          background:rgba(124,58,237,0.15); border:1px solid rgba(124,58,237,0.35);
          font-size:11px; font-weight:600; color:#C4B5FD; margin-bottom:20px;
          animation:regBadgePop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;
        }
        @keyframes regBadgePop {
          from { opacity:0; transform:scale(0.7) translateY(-8px); }
          to   { opacity:1; transform:none; }
        }
        .badge-dot {
          width:6px; height:6px; border-radius:50%; background:#10B981;
          box-shadow:0 0 6px #10B981; animation:regDotPulse 2s ease-in-out infinite;
        }
        @keyframes regDotPulse {
          0%,100% { box-shadow:0 0 4px #10B981; transform:scale(1); }
          50%      { box-shadow:0 0 10px #10B981; transform:scale(1.3); }
        }

        .divider {
          display:flex; align-items:center; gap:12px;
          color:rgba(255,255,255,0.2); font-size:12px;
        }
        .divider::before,.divider::after {
          content:''; flex:1; height:1px; background:rgba(255,255,255,0.08);
        }

        /* Logo float */
        .logo-wrap { animation:regLogoFloat 4s ease-in-out infinite; }
        @keyframes regLogoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }

        /* Headline animations */
        .hl-1 { animation:regHlIn 0.65s cubic-bezier(0.34,1.56,0.64,1) 0.1s both; }
        .hl-2 { animation:regHlIn 0.55s ease 0.3s both; }
        @keyframes regHlIn {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:none; }
        }
        @keyframes regGradShift { 0%{background-position:0%} 100%{background-position:100%} }

        @keyframes spin { to{transform:rotate(360deg)} }

        @media (max-width:860px) { .reg-left{display:none} .reg-right{width:100%;border-left:none} }
      `}</style>

      {/* ── Left panel ── */}
      <div className="reg-left">
        <div className="reg-grid"/>
        <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }}/>
        <div className="reg-orb reg-orb-1"/>
        <div className="reg-orb reg-orb-2"/>
        <div className="reg-orb reg-orb-3"/>

        <div style={{ position:'relative', zIndex:1, maxWidth:440 }}>
          <div className="logo-wrap" style={{ marginBottom:36 }}>
            <img src="/studybuddy-logo.png" alt="StudyBuddy"
              style={{ width:180, height:'auto', objectFit:'contain' }}/>
          </div>

          <h2 className="hl-1" style={{ fontSize:36, fontWeight:900, color:'#fff', margin:'0 0 12px',
            lineHeight:1.2, letterSpacing:'-1px' }}>
            Join thousands of<br/>
            <span style={{ background:'linear-gradient(135deg,#A78BFA,#7C3AED,#C4B5FD)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              backgroundSize:'200%', animation:'regGradShift 4s linear infinite alternate' }}>
              smart students.
            </span>
          </h2>
          <p className="hl-2" style={{ fontSize:14, color:'rgba(255,255,255,0.4)', margin:'0 0 32px', lineHeight:1.7 }}>
            Upload your study material and let AI help you learn, quiz yourself, and master any subject.
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {perks.map((p, i) => (
              <div key={p.text} className="perk-item" style={{ animationDelay:`${0.3 + i * 0.1}s` }}>
                <div className="perk-icon">{p.icon}</div>
                <span>{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="reg-right">
        <div className="reg-form-wrap">

          <div className="badge">
            <div className="badge-dot"/>
            Create your free account
          </div>

          <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:'0 0 6px', letterSpacing:'-0.5px',
            animation:'regHlIn 0.5s ease 0.25s both' }}>
            Get started today
          </h1>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.38)', margin:'0 0 24px',
            animation:'regHlIn 0.5s ease 0.35s both' }}>
            Set up your account in under a minute
          </p>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:13 }}>

            {error && (
              <div style={{ padding:'11px 14px', borderRadius:11, fontSize:13,
                background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)',
                color:'#FCA5A5', display:'flex', alignItems:'flex-start', gap:9,
                animation:'regHlIn 0.3s ease both' }}>
                <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>⚠</span> {error}
              </div>
            )}

            {fields.map((field, i) => (
              <div key={field.name} className="field-wrap"
                style={{ animation:`regHlIn 0.5s ease ${0.38 + i * 0.08}s both` }}>
                <label className="auth-label">{field.label}</label>
                <input
                  type={field.type} name={field.name} value={form[field.name]}
                  onChange={handleChange} placeholder={field.placeholder}
                  autoComplete={field.auto} required className="auth-input"/>
              </div>
            ))}

            <button type="submit" disabled={loading} className="submit-btn"
              style={{ marginTop:4, animation:'regHlIn 0.5s ease 0.72s both' }}>
              {loading ? (
                <>
                  <div style={{ width:17, height:17, border:'2.5px solid rgba(255,255,255,0.3)',
                    borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                  Creating account...
                </>
              ) : <>Create account <span style={{ fontSize:16 }}>→</span></>}
            </button>

            <p style={{ margin:0, fontSize:11, textAlign:'center',
              color:'rgba(255,255,255,0.2)', lineHeight:1.5,
              animation:'regHlIn 0.5s ease 0.8s both' }}>
              By creating an account you agree to our Terms of Service and Privacy Policy
            </p>
          </form>

          <div className="divider" style={{ margin:'18px 0', animation:'regHlIn 0.5s ease 0.85s both' }}>or</div>

          <p style={{ textAlign:'center', fontSize:14, color:'rgba(255,255,255,0.35)', margin:0,
            animation:'regHlIn 0.5s ease 0.9s both' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color:'#A78BFA', fontWeight:700, textDecoration:'none', transition:'color 0.2s' }}
              onMouseEnter={e => e.target.style.color='#C4B5FD'}
              onMouseLeave={e => e.target.style.color='#A78BFA'}>
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
