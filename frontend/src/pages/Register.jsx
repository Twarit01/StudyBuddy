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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f13] flex items-center justify-center px-4 transition-colors duration-200">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7c6af7] to-[#5de0b0] flex items-center justify-center text-2xl mb-3">
            🧠
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">Start studying smarter with AI</p>
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
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{field.label}</label>
              <input
                type={field.type} name={field.name}
                value={form[field.name]} onChange={handleChange}
                placeholder={field.placeholder} required
                className="bg-white dark:bg-[#18181f] border border-gray-300 dark:border-[#333344] rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-[#7c6af7] transition-colors"
              />
            </div>
          ))}
          <button
            type="submit" disabled={loading}
            className="mt-2 bg-[#7c6af7] hover:bg-[#6b5ce7] disabled:opacity-50 text-white font-medium rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
            ) : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#7c6af7] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}