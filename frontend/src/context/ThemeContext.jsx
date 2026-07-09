import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  // App is dark-mode only — always dark
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    // Always apply dark class — remove any stale 'light' from localStorage
    localStorage.setItem('theme', 'dark')
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }, [])

  const toggleTheme = () => setIsDark(prev => !prev)

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}