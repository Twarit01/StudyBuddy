import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const { isDark } = useTheme()

  const from = location.state?.from || '/dashboard'

  const [form, setForm]       = useState({ email:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

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

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background: isDark ? '#0C0C14' : '#F8FAFC',
      color: isDark ? '#fff' : '#0F172A',
      padding:'24px 16px',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      '--db-bg': isDark ? '#0C0C14' : '#F8FAFC',
      '--db-text': isDark ? '#fff' : '#0F172A',
      '--db-card-bg': isDark ? '#13131F' : '#ffffff',
      '--db-card-border': isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0',
      '--db-border': isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
      '--db-text-muted': isDark ? 'rgba(255,255,255,0.38)' : '#64748B',
      '--db-text-sub': isDark ? 'rgba(255,255,255,0.42)' : '#475569',
      '--db-hover-bg': isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
      '--db-accent': isDark ? '#C4B5FD' : '#7C3AED',
    }}>
      <style>{`
        .auth-input {
          width:100%; box-sizing:border-box;
          background:var(--db-hover-bg);
          border:1px solid var(--db-border);
          border-radius:12px; padding:13px 16px;
          color:var(--db-text); font-size:15px; outline:none;
          transition:border-color 0.2s, background 0.2s;
          font-family:inherit;
        }
        .auth-input:focus { border-color:rgba(124,58,237,0.7); background:rgba(124,58,237,0.07); }
        .auth-input::placeholder { color:var(--db-text-muted); }
        @keyframes spin   { to { transform:rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:none } }
      `}</style>

      <div style={{ width:'100%', maxWidth:400, animation:'fadeUp 0.35s ease' }}>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:32 }}>
          <img
            src="/studybuddy-logo.png"
            alt="StudyBuddy"
            style={{ width:200, height:'auto', marginBottom:20, objectFit:'contain' }}
          />
          <h1 style={{ fontSize:28, fontWeight:800, margin:'0 0 6px',
            letterSpacing:'-0.5px', color:'var(--db-text)' }}>Welcome back</h1>
          <p style={{ fontSize:14, color:'var(--db-text-sub)', margin:0 }}>
            Sign in to StudyBuddy AI
          </p>
          {from && from !== '/dashboard' && (
            <p style={{ fontSize:12, color:'#C4B5FD', margin:'8px 0 0',
              background:'rgba(124,58,237,0.15)', padding:'4px 12px',
              borderRadius:20, border:'1px solid rgba(124,58,237,0.3)' }}>
              → You'll be returned to <strong>{from}</strong>
            </p>
          )}
        </div>

        <div style={{
          background:'var(--db-card-bg)', border:'1px solid var(--db-card-border)',
          borderRadius:16, padding:32,
          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 4px 24px rgba(15,23,42,0.08)',
        }}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>

            {error && (
              <div style={{
                padding:'12px 16px', borderRadius:12, fontSize:14,
                background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)',
                color:'#FCA5A5', display:'flex', alignItems:'center', gap:9
              }}>
                <span style={{ fontSize:16, flexShrink:0 }}>⚠</span> {error}
              </div>
            )}

            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--db-text-muted)',
                letterSpacing:1, display:'block', marginBottom:8, textTransform:'uppercase' }}>
                Email
              </label>
              <input type="email" name="email" value={form.email}
                onChange={handleChange} placeholder="you@example.com"
                required autoComplete="email" className="auth-input"/>
            </div>

            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--db-text-muted)',
                letterSpacing:1, display:'block', marginBottom:8, textTransform:'uppercase' }}>
                Password
              </label>
              <input type="password" name="password" value={form.password}
                onChange={handleChange} placeholder="••••••••"
                required autoComplete="current-password" className="auth-input"/>
            </div>

            <button type="submit" disabled={loading} style={{
              width:'100%', padding:'14px 0', borderRadius:10, border:'none',
              background: loading ? 'rgba(124,58,237,0.5)' : 'linear-gradient(135deg,#7C3AED,#6D28D9)',
              color:'#fff', fontSize:15, fontWeight:700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:9,
              fontFamily:'inherit', marginTop:4,
              boxShadow: loading ? 'none' : '0 4px 20px rgba(124,58,237,0.45)',
              transition:'all 0.2s'
            }}>
              {loading ? (
                <>
                  <div style={{ width:17, height:17, border:'2.5px solid rgba(255,255,255,0.3)',
                    borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
                  Signing in...
                </>
              ) : `Sign in →`}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', fontSize:14, color:'var(--db-text-muted)', marginTop:24 }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color:'var(--db-accent)', fontWeight:700, textDecoration:'none' }}>
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}
