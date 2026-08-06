import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setError('Something went wrong. Please try again.')
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand mark */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#1E3A5F] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🍲</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">KitchenMind</h1>
          <p className="text-sm text-gray-500 mt-1">Your smart kitchen companion</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="text-4xl mb-4">📬</div>
            <h2 className="text-lg font-semibold text-[#1E3A5F] mb-2">Check your email</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              We sent a sign-in link to <span className="font-medium text-[#1E3A5F]">{email}</span>.
              Tap it to enter your kitchen.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="mt-6 text-sm text-[#2E86AB] underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-lg font-semibold text-[#1E3A5F] mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500 mb-6">Enter your email — we'll send you a sign-in link. No password needed.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E86AB] text-sm"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-[#1E3A5F] text-white font-semibold text-sm disabled:opacity-60 active:scale-95 transition-transform"
              >
                {loading ? 'Sending…' : 'Send me a link'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
