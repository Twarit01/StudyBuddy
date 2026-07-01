import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useXP } from '../context/XPContext'

const NAV_ITEMS = [
  { path:'/dashboard',  icon:'🏠', label:'Home' },
  { path:'/chat',       icon:'💬', label:'AI Chat', dot:true },
  { path:'/quiz',       icon:'🎯', label:'Quizzes' },
  { path:'/flashcards', icon:'🃏', label:'Flashcards' },
  { path:'/documents',  icon:'📄', label:'Documents' },
  { path:'/progress',   icon:'📊', label:'Analytics' },
  { path:'/revision',   icon:'📅', label:'Planner' },
]

// Level titles — cosmetic labels that scale with level
const LEVEL_TITLES = [
  { max: 3,  title: 'Novice' },
  { max: 6,  title: 'Learner' },
  { max: 10, title: 'Scholar I' },
  { max: 15, title: 'Scholar II' },
  { max: 22, title: 'Scholar III' },
  { max: 30, title: 'Expert' },
  { max: 999, title: 'Master' },
]
const titleForLevel = (level) => (LEVEL_TITLES.find(t => level <= t.max) || LEVEL_TITLES[LEVEL_TITLES.length-1]).title

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { xp, loading: xpLoading } = useXP()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')

  const handleToggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebarCollapsed', String(next))
  }

  const initials = user?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || 'U'
  const levelTitle = titleForLevel(xp.level || 1)
  const progressPct = xpLoading ? 0 : Math.min(100, xp.xp_progress_pct || 0)

  return (
    <aside style={{
      width: collapsed ? 76 : 220,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0E0E1A',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      <style>{`
        .sb-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border-radius: 14px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          transition: all 0.2s ease;
          white-space: nowrap;
          overflow: hidden;
        }
        .sb-nav-item:hover {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.85);
        }
        .sb-nav-item.active {
          background: rgba(124,58,237,0.25);
          color: #C4B5FD;
        }
        .sb-icon {
          font-size: 17px;
          flex-shrink: 0;
          width: 22px;
          text-align: center;
        }
        .sb-toggle-btn {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          cursor: pointer;
          color: rgba(255,255,255,0.5);
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .sb-toggle-btn:hover {
          background: rgba(124,58,237,0.25);
          color: #C4B5FD;
          border-color: rgba(124,58,237,0.4);
        }
        @keyframes xpBarFill { from { width: 0% } }
      `}</style>

      {/* Persistent toggle button — ALWAYS visible, floats on the edge of the sidebar */}
      <button
        onClick={handleToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute',
          top: 22,
          right: collapsed ? -12 : -12,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#1A1A2D',
          border: '1px solid rgba(255,255,255,0.12)',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#7C3AED'
          e.currentTarget.style.color = '#fff'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = '#1A1A2D'
          e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
        }}
      >
        {collapsed ? '›' : '‹'}
      </button>

      {/* Logo */}
      <div
        style={{
          padding: collapsed ? "20px 0 16px" : "20px 16px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {!collapsed && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                overflow: "hidden",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/studybuddy-logo.png"
                alt="StudyBuddy Logo"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "-0.2px",
                }}
              >
                StudyBuddy
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                AI Learning
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/studybuddy-logo.png"
              alt="StudyBuddy Logo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        )}
      </div>

      {/* XP bar — real data */}
      {!collapsed && (
        <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:22, height:22, borderRadius:6, background:'linear-gradient(135deg,#F59E0B,#EF4444)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff' }}>
                {xp.level || 1}
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{levelTitle}</span>
            </div>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>
              {xpLoading ? '···' : `${xp.xp_into_level} / ${xp.xp_needed_for_next}`}
            </span>
          </div>
          <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:4, overflow:'hidden' }}>
            <div style={{
              height:'100%', width:`${progressPct}%`,
              background:'linear-gradient(90deg,#7C3AED,#22D3EE)', borderRadius:4,
              transition:'width 0.6s ease',
              animation:'xpBarFill 0.6s ease',
            }} />
          </div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.28)', marginTop:5 }}>
            {xpLoading ? 'Loading XP…' : `${(xp.total_xp || 0).toLocaleString()} total XP`}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex:1, overflowY:'auto', padding:'10px 8px', display:'flex', flexDirection:'column', gap:2 }}>
        {NAV_ITEMS.map(item => (
          <NavLink key={item.path} to={item.path} title={collapsed ? item.label : undefined}
            className={({ isActive }) => `sb-nav-item${isActive ? ' active' : ''}`}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span className="sb-icon">{item.icon}</span>
              {item.dot && (
                <div style={{ position:'absolute', top:-1, right:-2, width:6, height:6, borderRadius:'50%', background:'#10B981', border:'1.5px solid #0E0E1A' }} />
              )}
            </div>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Streak nudge — real data */}
      {!collapsed && (
        <div style={{ margin:'0 8px 8px', padding:'12px 14px',
          background: xp.current_streak > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
          border: xp.current_streak > 0 ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)',
          borderRadius:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>
                {xp.current_streak > 0 ? `${xp.current_streak}-Day Streak! 🔥` : 'No streak yet'}
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2 }}>
                {xp.current_streak > 0 ? 'Study today to keep it' : 'Study today to start one'}
              </div>
            </div>
            <div style={{ width:28, height:28, borderRadius:8,
              background: xp.current_streak > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
              {xp.current_streak > 0 ? '🔥' : '💤'}
            </div>
          </div>
        </div>
      )}

      {/* User */}
      <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        {collapsed ? (
          <div style={{ width:'100%', display:'flex', justifyContent:'center', padding:'8px 0' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff' }}>
              {initials}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 8px' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>
              {initials}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.full_name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
            </div>
            <button onClick={logout} title="Logout" style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.25)', fontSize:14, padding:'2px', flexShrink:0, transition:'color 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.color='#F87171'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.25)'}>
              ⇥
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}