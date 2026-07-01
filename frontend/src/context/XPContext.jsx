import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getXPSummary } from '../api/xp'
import { useAuth } from './AuthContext'

const XPContext = createContext(null)

export function XPProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [xp, setXP] = useState({
    total_xp: 0,
    level: 1,
    xp_into_level: 0,
    xp_needed_for_next: 300,
    xp_progress_pct: 0,
    current_streak: 0,
    longest_streak: 0,
    recent_events: [],
  })
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])
  const toastIdRef = useRef(0)

  const refreshXP = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const data = await getXPSummary()
      setXP(data)
    } catch (err) {
      console.error('Could not load XP summary', err)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) refreshXP()
    else setLoading(false)
  }, [isAuthenticated, refreshXP])

  /**
   * Show XP toasts for a list of xp_events returned from any backend action
   * (quiz submit, flashcard review, document upload, chat ask).
   * Also triggers a background refresh so sidebar/dashboard numbers update.
   */
  const showXPEvents = useCallback((events = []) => {
    const validEvents = (events || []).filter(e => e && e.awarded > 0)
    if (validEvents.length === 0) return

    validEvents.forEach((e, i) => {
      setTimeout(() => {
        const id = ++toastIdRef.current
        setToasts(prev => [...prev, {
          id,
          amount: e.awarded,
          label: e.label || 'XP earned',
          leveledUp: !!e.leveled_up,
          level: e.level,
        }])
        // Auto-dismiss after 3.2s
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id))
        }, 3200)
      }, i * 450) // stagger multiple toasts
    })

    // Refresh real numbers shortly after animation starts
    setTimeout(refreshXP, 600)
  }, [refreshXP])

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <XPContext.Provider value={{ xp, loading, refreshXP, showXPEvents, toasts, dismissToast }}>
      {children}
    </XPContext.Provider>
  )
}

export function useXP() {
  const ctx = useContext(XPContext)
  if (!ctx) throw new Error('useXP must be used within XPProvider')
  return ctx
}