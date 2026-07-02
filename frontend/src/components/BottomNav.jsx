import { NavLink, useLocation } from 'react-router-dom'
import { useSidebar } from '../context/SidebarContext'

const NAV_ITEMS = [
  { path: '/dashboard',  icon: '🏠', label: 'Home' },
  { path: '/chat',       icon: '💬', label: 'Chat' },
  { path: '/quiz',       icon: '🎯', label: 'Quiz' },
  { path: '/flashcards', icon: '🃏', label: 'Cards' },
  { path: '/documents',  icon: '📄', label: 'Docs' },
]

export default function BottomNav() {
  const location = useLocation()
  const { toggle } = useSidebar()

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Mobile navigation">
      {NAV_ITEMS.map(item => {
        const isActive = location.pathname === item.path ||
          (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={`bottom-nav-item${isActive ? ' active' : ''}`}
            aria-label={item.label}
          >
            <span className="bnav-icon" role="img" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        )
      })}
      <button
        className="bottom-nav-item"
        onClick={toggle}
        aria-label="More navigation options"
        type="button"
      >
        <span className="bnav-icon" role="img" aria-hidden="true">☰</span>
        <span>More</span>
      </button>
    </nav>
  )
}
