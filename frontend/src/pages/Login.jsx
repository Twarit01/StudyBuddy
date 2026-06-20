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
    setLoading(true); setError(null)
    try { await login(form.email, form.password); navigate('/dashboard') }
    catch (err) { setError(err.response?.data?.detail || 'Login failed. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F8FAFC' }}>
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 4px 16px rgba(79,70,229,0.25)' }}>
            <i className="ti ti-book-2 text-white" style={{ fontSize: 22 }} aria-hidden="true"></i>
          </div>
          <h1 className="text-heading text-[#0F172A]">Welcome back</h1>
          <p className="text-body mt-1" style={{ color: '#64748B' }}>Sign in to StudyBuddy</p>
        </div>

        <div className="card-elevated p-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                <i className="ti ti-alert-circle flex-shrink-0" style={{ fontSize: 16 }} aria-hidden="true"></i>
                {error}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: '#64748B' }}>Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="you@example.com" required className="input-field text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: '#64748B' }}>Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange}
                placeholder="••••••••" required className="input-field text-sm" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary justify-center py-2.5 text-sm mt-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
                : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: '#64748B' }}>
          Don't have an account?{' '}
          <Link to="/register" className="font-medium" style={{ color: '#4F46E5' }}>Sign up</Link>
        </p>
      </div>
    </div>
  )
}