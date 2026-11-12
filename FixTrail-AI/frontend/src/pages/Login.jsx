
import { useState } from 'react'
import { login, register } from '../services/api'

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'customer',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        await register(form)
      }

      const user = await login(form.email, form.password)
      onLogin(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8"
      >
        <h1 className="mb-2 text-3xl font-bold text-blue-400">
          FixTrail AI
        </h1>

        <p className="mb-8 text-slate-400">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </p>

        {isRegister && (
          <>
            <label className="mb-2 block text-sm">Full name</label>
            <input
              name="full_name"
              required
              value={form.full_name}
              onChange={update}
              className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              placeholder="Your name"
            />

            <label className="mb-2 block text-sm">Account type</label>
            <select
              name="role"
              value={form.role}
              onChange={update}
              className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            >
              <option value="customer">Customer</option>
              <option value="technician">Technician</option>
            </select>
          </>
        )}

        <label className="mb-2 block text-sm">Email</label>
        <input
          name="email"
          type="email"
          required
          value={form.email}
          onChange={update}
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          placeholder="you@example.com"
        />

        <label className="mb-2 block text-sm">Password</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={update}
          className="mb-5 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
          placeholder="Minimum 8 characters"
        />

        {error && (
          <p className="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 p-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Please wait...' : isRegister ? 'Create account' : 'Login'}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister)
            setError('')
          }}
          className="mt-5 w-full text-sm text-blue-400"
        >
          {isRegister
            ? 'Already have an account? Login'
            : 'New to FixTrail? Create account'}
        </button>
      </form>
    </div>
  )
}
