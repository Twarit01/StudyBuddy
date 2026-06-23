import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const navSections = [
  {
    label: 'Learning',
    items: [
      { path: '/documents',  icon: 'ti-folder',         label: 'Documents' },
      { path: '/chat',       icon: 'ti-message-circle', label: 'Chat Assistant' },
      { path: '/flashcards', icon: 'ti-cards',          label: 'Flashcards' },
      { path: '/quiz',       icon: 'ti-pencil',         label: 'Quizzes' },
      { path: '/revision',   icon: 'ti-list-check',     label: 'Smart Revision' },
    ]
  },
  {
    label: 'Analytics',
    items: [
      { path: '/progress',   icon: 'ti-chart-bar',      label: 'Progress' },
    ]
  },
]

export default function Sidebar() {
  const { user, logout }        = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')

  const handleToggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebarCollapsed', String(next))
  }

  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full overflow-hidden transition-all duration-200 bg-white dark:bg-[#0D1220] border-r border-[#F1F5F9] dark:border-[#1F2937]"
      style={{ width: collapsed ? 68 : 240 }}
    >
      {/* Logo + collapse toggle */}
      <div className={`flex items-center py-5 border-b border-[#F1F5F9] dark:border-[#1F2937] ${collapsed ? 'px-3 justify-center' : 'px-5 justify-between'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/studybuddy-logo.png" alt="StudyBuddy" className="w-full h-full object-cover" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-sm text-[#0F172A] dark:text-[#F1F5F9] truncate" style={{ letterSpacing: '-0.2px' }}>StudyBuddy</div>
              <div className="text-xs text-[#94A3B8] dark:text-slate-500 truncate">AI Assistant</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={handleToggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-slate-100 dark:hover:bg-[#1F2937] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Collapse sidebar"
          >
            <i className="ti ti-layout-sidebar-left-collapse" style={{ fontSize: 17 }} aria-hidden="true"></i>
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={handleToggle}
          className="mx-auto mt-3 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#1F2937] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          title="Expand sidebar"
        >
          <i className="ti ti-layout-sidebar-left-expand" style={{ fontSize: 17 }} aria-hidden="true"></i>
        </button>
      )}

      {/* Nav */}
      <nav className={`py-4 flex flex-col gap-4 flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'}`}>
        <div>
          <NavLink
            to="/dashboard"
            title={collapsed ? 'Dashboard' : undefined}
            className={({ isActive }) => `nav-item w-full mb-0.5 ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <i className="ti ti-home flex-shrink-0" style={{ fontSize: 17 }} aria-hidden="true"></i>
            {!collapsed && <span>Dashboard</span>}
          </NavLink>
        </div>

        {navSections.map(section => (
          <div key={section.label}>
            {!collapsed && <p className="text-label px-3 mb-2 text-[#CBD5E1] dark:text-slate-600">{section.label}</p>}
            {collapsed && <div className="h-px bg-[#F1F5F9] dark:bg-[#1F2937] mx-2 mb-2" />}
            <div className="flex flex-col gap-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  <i className={`ti ${item.icon} flex-shrink-0`} style={{ fontSize: 17 }} aria-hidden="true"></i>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className={`py-4 flex flex-col gap-1 border-t border-[#F1F5F9] dark:border-[#1F2937] ${collapsed ? 'px-2' : 'px-3'}`}>
        <button
          onClick={toggleTheme}
          title={collapsed ? (isDark ? 'Light mode' : 'Dark mode') : undefined}
          className={`nav-item w-full text-left ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <i className={`ti ${isDark ? 'ti-sun' : 'ti-moon'} flex-shrink-0`} style={{ fontSize: 17 }} aria-hidden="true"></i>
          {!collapsed && <span className="text-sm">{isDark ? 'Light mode' : 'Dark mode'}</span>}
        </button>

        <div className={`flex items-center gap-2.5 py-2 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#141B2D] ${collapsed ? 'px-0 justify-center' : 'px-3'}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
            title={collapsed ? user?.full_name : undefined}
          >
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate text-[#0F172A] dark:text-[#F1F5F9]">{user?.full_name}</div>
                <div className="text-[10px] truncate text-[#94A3B8] dark:text-slate-500">{user?.email}</div>
              </div>
              <button onClick={logout} title="Logout" className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                <i className="ti ti-logout" style={{ fontSize: 15 }} aria-hidden="true"></i>
              </button>
            </>
          )}
        </div>

        {collapsed && (
          <button onClick={logout} title="Logout" className="nav-item w-full justify-center px-0 mt-1 text-slate-400 hover:text-red-500">
            <i className="ti ti-logout" style={{ fontSize: 17 }} aria-hidden="true"></i>
          </button>
        )}
      </div>
    </aside>
  )
}
