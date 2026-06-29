import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { path:'/dashboard',  icon:'🏠', label:'Home' },
  { path:'/chat',       icon:'💬', label:'AI Chat', dot:true },
  { path:'/quiz',       icon:'🎯', label:'Quizzes' },
  { path:'/flashcards', icon:'🃏', label:'Flashcards' },
  { path:'/documents',  icon:'📄', label:'Documents' },
  { path:'/progress',   icon:'📊', label:'Analytics' },
  { path:'/revision',   icon:'📅', label:'Planner' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')

  const handleToggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebarCollapsed', String(next))
  }

  const initials = user?.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || 'U'

  return (
    <aside style={{
      width: collapsed ? 68 : 220,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0E0E1A',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      <style>{`
        .sb-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          transition: all 0.15s;
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
      `}</style>

      {/* Logo */}
<div
  style={{
    padding: collapsed ? "20px 0 16px" : "20px 16px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
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
          src="/studybuddy-logo.png" // <-- Replace with your actual filename if different
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
        src="/studybuddy-logo.png" // <-- Replace with your actual filename if different
        alt="StudyBuddy Logo"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  )}

  {!collapsed && (
    <button
      onClick={handleToggle}
      title="Collapse"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "rgba(255,255,255,0.3)",
        padding: "4px",
        borderRadius: 6,
        fontSize: 16,
        display: "flex",
        alignItems: "center",
      }}
    >
      ‹
    </button>
  )}
</div>

      {/* XP bar */}
      {!collapsed && (
        <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:22, height:22, borderRadius:6, background:'linear-gradient(135deg,#F59E0B,#EF4444)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>⚡</div>
              <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Scholar II</span>
            </div>
            <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)' }}>2,340 / 3,000</span>
          </div>
          <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:4, overflow:'hidden' }}>
            <div style={{ height:'100%', width:'78%', background:'linear-gradient(90deg,#7C3AED,#22D3EE)', borderRadius:4 }} />
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


      {/* User */}
      <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        {collapsed ? (
          <button onClick={handleToggle} style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'8px 0', display:'flex', justifyContent:'center' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#7C3AED,#4F46E5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff' }}>
              {initials}
            </div>
          </button>
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