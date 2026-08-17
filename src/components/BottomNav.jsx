import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuthService } from '@/services/AuthService'

const TABS = [
  { label: 'Home',      emoji: '🏠', path: '/'          },
  { label: 'Copilot',   emoji: '✨', path: '/copilot', matchPrefixes: ['/copilot'] },
  { label: 'Scan',      emoji: '📷', path: '/scan'       },
  { label: 'Recipes',   emoji: '🥘', path: '/recipes', matchPrefixes: ['/recipes', '/recipe/'] },
  { label: 'Inventory', emoji: '📦', path: '/inventory'  },
  { label: 'Insights',  emoji: '🧠', path: '/dashboard'  },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  // Auth state clearing + redirect to /login is handled entirely by useAuth.js's
  // SIGNED_OUT listener once Supabase's session actually clears — this only triggers that.
  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await AuthService.signOut()
    } catch (err) {
      console.error('Sign out failed:', err)
      setSigningOut(false)
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 shadow-lg z-40 flex">
      <div className="flex-1 flex">
        {TABS.map((tab) => {
          const prefixes = tab.matchPrefixes || [tab.path]
          const active = tab.path === '/'
            ? location.pathname === '/'
            : prefixes.some((p) => location.pathname.startsWith(p))
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors
                ${active ? 'text-[#2E86AB]' : 'text-gray-400'}`}
            >
              <span className="text-xl leading-none">{tab.emoji}</span>
              <span className={`text-[10px] font-semibold ${active ? 'text-[#2E86AB]' : 'text-gray-400'}`}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute bottom-0 mb-0 w-6 h-0.5 bg-[#2E86AB] rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        aria-label="Sign out"
        className="flex flex-col items-center justify-center gap-0.5 px-3 border-l border-gray-100 text-gray-400 disabled:opacity-50 transition-colors"
      >
        <span className="text-xl leading-none">🚪</span>
        <span className="text-[10px] font-semibold whitespace-nowrap">
          {signingOut ? 'Signing out…' : 'Sign out'}
        </span>
      </button>
    </nav>
  )
}
