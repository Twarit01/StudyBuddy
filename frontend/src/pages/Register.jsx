import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', full_name: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await register(form.email, form.full_name, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
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
          <h1 className="text-xl font-semibold text-ink-900 dark:text-white">Create account</h1>
          <p className="text-sm text-ink-500 mt-1">Start studying smarter with AI</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {[
            { label: 'Full name',         name: 'full_name', type: 'text',     placeholder: 'Twarit Sharma' },
            { label: 'Email',             name: 'email',     type: 'email',    placeholder: 'you@example.com' },
            { label: 'Password',          name: 'password',  type: 'password', placeholder: 'Min 6 characters' },
            { label: 'Confirm password',  name: 'confirm',   type: 'password', placeholder: '••••••••' },
          ].map(field => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-500">{field.label}</label>
              <input
                type={field.type} name={field.name}
                value={form[field.name]} onChange={handleChange}
                placeholder={field.placeholder} required
                className="bg-white dark:bg-[#1E293B] border border-surface-border dark:border-[#334155] rounded-xl px-4 py-2.5 text-sm text-ink-900 dark:text-white placeholder-ink-400 outline-none focus:border-primary-400 transition-colors shadow-soft"
              />
            </div>
          ))}
          <button
            type="submit" disabled={loading}
            className="mt-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
            ) : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-ink-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 dark:text-primary-300 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}