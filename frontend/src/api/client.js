import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT token to every request automatically
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// If token expires, clear session and redirect to login
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem('token')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Only redirect if the user had an active session (token expired mid-session)
      // Don't redirect on a plain login attempt failure — let the login page handle it
      const isLoginRoute = error.config?.url?.includes('/auth/login')
      if (hadToken && !isLoginRoute) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default client