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
    try { await register(form.email, form.full_name, form.password); navigate('/dashboard') }
    catch (err) { setError(err.response?.data?.detail || 'Registration failed.') }
    finally { setLoading(false) }
  }

  const fields = [
    { label: 'Full name',        name: 'full_name', type: 'text',     placeholder: 'Your_Name' },
    { label: 'Email',            name: 'email',     type: 'email',    placeholder: 'you@example.com' },
    { label: 'Password',         name: 'password',  type: 'password', placeholder: 'Min 6 characters' },
    { label: 'Confirm password', name: 'confirm',   type: 'password', placeholder: '••••••••' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0B0F1A' }}>
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 overflow-hidden"
            style={{ boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
            <img src="/studybuddy-logo.png" alt="StudyBuddy" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-heading" style={{ color: '#F1F5F9' }}>Create account</h1>
          <p className="text-body mt-1" style={{ color: '#94A3B8' }}>Start studying smarter with AI</p>
        </div>

        <div className="p-7 rounded-2xl border" style={{ background: '#141B2D', borderColor: '#1F2937', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}>
                <i className="ti ti-alert-circle flex-shrink-0" style={{ fontSize: 16 }} aria-hidden="true"></i>
                {error}
              </div>
            )}
            {fields.map(field => (
              <div key={field.name} className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#94A3B8' }}>{field.label}</label>
                <input
                  type={field.type} name={field.name} value={form[field.name]}
                  onChange={handleChange} placeholder={field.placeholder} required
                  className="text-sm rounded-lg px-3.5 py-2.5 outline-none border transition-colors"
                  style={{ background: '#0B0F1A', borderColor: '#1F2937', color: '#F1F5F9' }}
                />
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary justify-center py-2.5 text-sm mt-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
                : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: '#94A3B8' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-medium" style={{ color: '#A5B4FC' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}