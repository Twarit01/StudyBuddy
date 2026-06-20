import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const navItems = [
  { path: '/dashboard',  icon: 'ti-home',           label: 'Dashboard' },
  { path: '/documents',  icon: 'ti-folder',         label: 'Documents' },
  { path: '/chat',       icon: 'ti-message-circle', label: 'Chat' },
  { path: '/flashcards', icon: 'ti-cards',          label: 'Flashcards' },
  { path: '/quiz',       icon: 'ti-pencil',         label: 'Quizzes' },
  { path: '/progress',   icon: 'ti-chart-bar',      label: 'Progress' },
]

export default function Sidebar() {
  const { user, logout }        = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full overflow-hidden transition-colors duration-200"
      style={{
        background: isDark ? '#111827' : '#ffffff',
        borderRight: isDark ? '1px solid #1E293B' : '1px solid #F1F5F9',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: isDark ? '1px solid #1E293B' : '1px solid #F1F5F9' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
          <i className="ti ti-book-2 text-white" style={{ fontSize: 16 }} aria-hidden="true"></i>
        </div>
        <div>
          <div className="font-semibold text-sm" style={{ color: isDark ? '#F8FAFC' : '#0F172A', letterSpacing: '-0.2px' }}>StudyBuddy</div>
          <div className="text-xs" style={{ color: isDark ? '#475569' : '#94A3B8' }}>AI Assistant</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-4 flex flex-col gap-0.5">
        <p className="text-label px-3 mb-2" style={{ color: isDark ? '#475569' : '#CBD5E1' }}>Navigation</p>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <i className={`ti ${item.icon}`} style={{ fontSize: 17 }} aria-hidden="true"></i>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Bottom */}
      <div className="px-3 py-4 flex flex-col gap-1" style={{ borderTop: isDark ? '1px solid #1E293B' : '1px solid #F1F5F9' }}>
        <button
          onClick={toggleTheme}
          className="nav-item w-full text-left"
        >
          <i className={`ti ${isDark ? 'ti-sun' : 'ti-moon'}`} style={{ fontSize: 17 }} aria-hidden="true"></i>
          <span className="text-sm">{isDark ? 'Light mode' : 'Dark mode'}</span>
        </button>

        <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-xl"
          style={{ background: isDark ? '#1E293B' : '#F8FAFC' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: isDark ? '#F8FAFC' : '#0F172A' }}>{user?.full_name}</div>
            <div className="text-[10px] truncate" style={{ color: isDark ? '#475569' : '#94A3B8' }}>{user?.email}</div>
          </div>
          <button onClick={logout} title="Logout"
            className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
            <i className="ti ti-logout" style={{ fontSize: 15 }} aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </aside>
  )
}