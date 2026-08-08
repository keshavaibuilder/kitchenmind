import { useLocation, useNavigate } from 'react-router-dom'

const TABS = [
  { label: 'Home',      emoji: '🏠', path: '/'          },
  { label: 'Scan',      emoji: '📷', path: '/scan'       },
  // "Meals" now opens the Recipe Workspace (Phase 4C) — the central cooking experience.
  // /meals itself stays reserved for a future meal-planner calendar (out of scope for 4C).
  // matchPrefixes covers both /recipes (library) and /recipe/:id (detail, singular route).
  { label: 'Recipes',   emoji: '🥘', path: '/recipes', matchPrefixes: ['/recipes', '/recipe/'] },
  { label: 'Inventory', emoji: '📦', path: '/inventory'  },
  // Phase 5A: Kitchen Intelligence Dashboard — additive, doesn't touch the existing Home screen.
  { label: 'Insights',  emoji: '🧠', path: '/dashboard'  },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 shadow-lg z-40 flex">
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
    </nav>
  )
}
