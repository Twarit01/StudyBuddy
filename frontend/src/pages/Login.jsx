import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted dark:bg-[#0F172A] flex items-center justify-center px-4 transition-colors duration-200">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center text-white mb-3">
            <i className="ti ti-book-2" style={{ fontSize: 24 }} aria-hidden="true"></i>
          </div>
          <h1 className="text-xl font-semibold text-ink-900 dark:text-white">Welcome back</h1>
          <p className="text-sm text-ink-500 mt-1">Sign in to StudyBuddy</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-500">Email</label>
            <input
              type="email" name="email" value={form.email}
              onChange={handleChange} placeholder="you@example.com" required
              className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl px-4 py-2.5 text-sm text-ink-900 dark:text-white placeholder-ink-400 outline-none focus:border-primary-400 transition-colors shadow-soft"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-500">Password</label>
            <input
              type="password" name="password" value={form.password}
              onChange={handleChange} placeholder="••••••••" required
              className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl px-4 py-2.5 text-sm text-ink-900 dark:text-white placeholder-ink-400 outline-none focus:border-primary-400 transition-colors shadow-soft"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="mt-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
            ) : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-ink-500 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 dark:text-primary-300 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}