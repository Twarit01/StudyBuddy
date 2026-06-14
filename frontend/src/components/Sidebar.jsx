import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const navItems = [
  { path: '/dashboard',  icon: 'ti-home',          label: 'Dashboard' },
  { path: '/documents',  icon: 'ti-folder',        label: 'Documents' },
  { path: '/chat',       icon: 'ti-message-circle',label: 'Chat Assistant' },
  { path: '/flashcards', icon: 'ti-cards',         label: 'Flashcards' },
  { path: '/quiz',       icon: 'ti-pencil',        label: 'Quizzes' },
  { path: '/progress',   icon: 'ti-chart-bar',     label: 'Progress' },
]

export default function Sidebar() {
  const { user, logout }        = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()

  return (
    <aside className="w-60 flex-shrink-0 bg-white dark:bg-[#15151f] border-r border-surface-border dark:border-[#334155] flex flex-col h-full overflow-hidden transition-colors duration-200">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white">
          <i className="ti ti-book-2" style={{ fontSize: 18 }} aria-hidden="true"></i>
        </div>
        <div>
          <div className="text-sm font-semibold text-ink-900 dark:text-white">StudyBuddy AI</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 flex flex-col gap-1 mt-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-100
              ${isActive
                ? 'bg-primary-50 dark:bg-primary-600/15 text-primary-700 dark:text-primary-300'
                : 'text-ink-500 dark:text-gray-400 hover:bg-surface-muted dark:hover:bg-[#1E293B] hover:text-ink-900 dark:hover:text-gray-200'
              }`
            }
          >
            <i className={`ti ${item.icon}`} style={{ fontSize: 18 }} aria-hidden="true"></i>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-surface-border dark:border-[#334155] flex flex-col gap-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-500 dark:text-gray-400 hover:bg-surface-muted dark:hover:bg-[#1E293B] hover:text-ink-900 dark:hover:text-gray-200 transition-colors"
        >
          <i className={`ti ${isDark ? 'ti-sun' : 'ti-moon'}`} style={{ fontSize: 18 }} aria-hidden="true"></i>
          <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
        </button>

        <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{user?.full_name}</div>
            <div className="text-xs text-ink-400 truncate">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="text-ink-400 hover:text-red-500 transition-colors flex-shrink-0"
            title="Logout"
          >
            <i className="ti ti-logout" style={{ fontSize: 16 }} aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </aside>
  )
}