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
    { label: 'Full name',        name: 'full_name', type: 'text',     placeholder: 'Twarit Sharma' },
    { label: 'Email',            name: 'email',     type: 'email',    placeholder: 'you@example.com' },
    { label: 'Password',         name: 'password',  type: 'password', placeholder: 'Min 6 characters' },
    { label: 'Confirm password', name: 'confirm',   type: 'password', placeholder: '••••••••' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F8FAFC' }}>
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 4px 16px rgba(79,70,229,0.25)' }}>
            <i className="ti ti-book-2 text-white" style={{ fontSize: 22 }} aria-hidden="true"></i>
          </div>
          <h1 className="text-heading text-[#0F172A]">Create account</h1>
          <p className="text-body mt-1" style={{ color: '#64748B' }}>Start studying smarter with AI</p>
        </div>

        <div className="card-elevated p-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                <i className="ti ti-alert-circle flex-shrink-0" style={{ fontSize: 16 }} aria-hidden="true"></i>
                {error}
              </div>
            )}
            {fields.map(field => (
              <div key={field.name} className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: '#64748B' }}>{field.label}</label>
                <input
                  type={field.type} name={field.name} value={form[field.name]}
                  onChange={handleChange} placeholder={field.placeholder} required
                  className="input-field text-sm"
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

        <p className="text-center text-sm mt-6" style={{ color: '#64748B' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-medium" style={{ color: '#4F46E5' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}