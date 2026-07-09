import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useXP } from '../context/XPContext'
import { useSidebar } from '../context/SidebarContext'
import { useIsMobile } from '../hooks/useIsMobile'

const NAV_ITEMS = [
  { path:'/dashboard',  icon:'🏠', label:'Home' },
  { path:'/chat',       icon:'💬', label:'AI Chat', dot:true },
  { path:'/quiz',       icon:'🎯', label:'Quizzes' },
  { path:'/flashcards', icon:'🃏', label:'Flashcards' },
  { path:'/documents',  icon:'📄', label:'Documents' },
  { path:'/mindmap',    icon:'🕸️', label:'Mind Map' },
  { path:'/progress',   icon:'📊', label:'Analytics' },
  { path:'/revision',   icon:'📅', label:'Planner' },
]

const LEVEL_TITLES = [
  { max: 3,  title: 'Novice' },
  { max: 6,  title: 'Learner' },
  { max: 10, title: 'Scholar I' },
  { max: 15, title: 'Scholar II' },
  { max: 22, title: 'Scholar III' },
  { max: 30, title: 'Expert' },
  { max: 999, title: 'Master' },
]
const titleForLevel = (level) =>
  (LEVEL_TITLES.find(t => level <= t.max) || LEVEL_TITLES[LEVEL_TITLES.length - 1]).title

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { xp, loading: xpLoading } = useXP()
  const { collapsed, toggle: handleToggle } = useSidebar()
  const isMobile = useIsMobile()

  const initials =
    user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'
  const levelTitle = titleForLevel(xp.level || 1)
  const progressPct = xpLoading ? 0 : Math.min(100, xp.xp_progress_pct || 0)

  return (
    <>
      {/* Mobile backdrop — shown when sidebar is open on mobile */}
      {isMobile && !collapsed && (
        <div
          onClick={handleToggle}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 199,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* ── Hamburger button: only when sidebar is hidden on DESKTOP ─── */}
      {collapsed && !isMobile && (
        <button
          className="sb-hamburger-mobile"
          onClick={handleToggle}
          title="Open sidebar"
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 200,
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            backdropFilter: 'blur(8px)',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(124,58,237,0.18)'
            e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block',
              width: i === 1 ? 14 : 18,   /* middle line slightly shorter */
              height: 2,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.65)',
            }} />
          ))}
        </button>
      )}

      {/* ── Sidebar panel ─────────────────────────────────────────── */}
      <aside
        style={isMobile ? {
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100dvh',
          width: 260,
          zIndex: 200,
          transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#0E0E1A',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          boxShadow: collapsed ? 'none' : '4px 0 24px rgba(0,0,0,0.5)',
        } : {
          width: collapsed ? 0 : 220,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#0E0E1A',
          borderRight: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        }}
      >
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
          .sb-close-btn {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            cursor: pointer;
            color: rgba(255,255,255,0.4);
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            flex-shrink: 0;
            line-height: 1;
          }
          .sb-close-btn:hover {
            background: rgba(124,58,237,0.2);
            color: #C4B5FD;
            border-color: rgba(124,58,237,0.35);
          }
          @keyframes xpBarFill { from { width: 0% } }
        `}</style>

        {/* ── Header: logo + close button ──────────────────────── */}
        <div style={{
          padding: '12px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          minHeight: 60,
          gap: 8,
        }}>
          {/* Logo + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src="/studybuddy-logo.png"
                alt="StudyBuddy Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
                StudyBuddy
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                AI Learning
              </div>
            </div>
          </div>

          {/* Close / collapse button */}
          <button
            className="sb-close-btn"
            onClick={handleToggle}
            title="Collapse sidebar"
          >
            ‹
          </button>
        </div>

        {/* ── XP bar ────────────────────────────────────────────── */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#fff',
              }}>
                {xp.level || 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{levelTitle}</span>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {xpLoading ? '···' : `${xp.xp_into_level} / ${xp.xp_needed_for_next}`}
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progressPct}%`,
              background: 'linear-gradient(90deg,#7C3AED,#22D3EE)', borderRadius: 4,
              transition: 'width 0.6s ease', animation: 'xpBarFill 0.6s ease',
            }} />
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 5 }}>
            {xpLoading ? 'Loading XP…' : `${(xp.total_xp || 0).toLocaleString()} total XP`}
          </div>
        </div>

        {/* ── Nav ───────────────────────────────────────────────── */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sb-nav-item${isActive ? ' active' : ''}`}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="sb-icon">{item.icon}</span>
                {item.dot && (
                  <div style={{
                    position: 'absolute', top: -1, right: -2,
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#10B981', border: '1.5px solid #0E0E1A',
                  }} />
                )}
              </div>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ── Streak ────────────────────────────────────────────── */}
        <div style={{
          margin: '0 8px 8px', padding: '12px 14px',
          background: xp.current_streak > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
          border: xp.current_streak > 0 ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                {xp.current_streak > 0 ? `${xp.current_streak}-Day Streak! 🔥` : 'No streak yet'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {xp.current_streak > 0 ? 'Study today to keep it' : 'Study today to start one'}
              </div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: xp.current_streak > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>
              {xp.current_streak > 0 ? '🔥' : '💤'}
            </div>
          </div>
        </div>

        {/* ── User ──────────────────────────────────────────────── */}
        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 14, padding: '2px', flexShrink: 0, transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#F87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
            >
              ⇥
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}