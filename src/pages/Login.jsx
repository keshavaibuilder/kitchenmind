import { useState } from 'react'
import { AuthService } from '@/services/AuthService'

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.5 36.1 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  )
}

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')

    try {
      await AuthService.signInWithGoogle()
    } catch (err) {
      console.error('Google sign-in failed:', err)
      setError('Unable to sign in with Google. Please try again.')
      setLoading(false)
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

        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in securely with your Google account.</p>

          {error && <p className="text-red-500 text-xs mb-4">{error}</p>}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white border border-gray-200 text-[#1E3A5F] font-semibold text-sm disabled:opacity-60 active:scale-95 transition-transform flex items-center justify-center gap-3 shadow-sm"
          >
            <GoogleIcon />
            {loading ? 'Connecting…' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </div>
  )
}
