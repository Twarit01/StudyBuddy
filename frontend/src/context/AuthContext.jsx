import { createContext, useState, useEffect, useContext } from 'react'
import { getMe, login as loginApi, register as registerApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // On app load, validate any stored session before trusting it.
  useEffect(() => {
    let cancelled = false

    const restoreSession = async () => {
      const savedToken = localStorage.getItem('token')
      if (!savedToken) {
        if (!cancelled) setLoading(false)
        return
      }

      try {
        const currentUser = await getMe()
        if (cancelled) return

        setToken(savedToken)
        setUser(currentUser)
        localStorage.setItem('user', JSON.stringify(currentUser))
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')

        if (cancelled) return
        setToken(null)
        setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email, password) => {
    const data = await loginApi(email, password)

    setToken(data.access_token)
    setUser(data.user)

    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    // Clear any stale chat session from a previous user on this browser
    localStorage.removeItem('chat_session_id')

    return data
  }

  const register = async (email, fullName, password) => {
    const data = await registerApi(email, fullName, password)

    setToken(data.access_token)
    setUser(data.user)

    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))

    return data
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('chat_session_id')
    window.location.href = '/login'
  }

  const isAuthenticated = !!token

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      register,
      logout,
      isAuthenticated
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}

export default AuthContext
