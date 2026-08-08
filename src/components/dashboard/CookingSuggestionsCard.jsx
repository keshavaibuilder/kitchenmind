import { useNavigate } from 'react-router-dom'

/**
 * Two deterministic buckets (see dashboardInsights.deriveCookingSuggestions) — not a scored
 * recommendation engine.
 */
export default function CookingSuggestionsCard({ suggestions }) {
  const navigate = useNavigate()
  const { readyToCook, useItUp } = suggestions

  if (readyToCook.length === 0 && useItUp.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Cooking Suggestions</p>
        <p className="text-sm text-gray-400">No recipe matches your current pantry yet — add more recipes or stock up.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Cooking Suggestions</p>
      {readyToCook.length > 0 && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-[#1A7A4A] mb-1.5">✓ Ready to cook now</p>
          <div className="flex flex-col gap-1.5">
            {readyToCook.map(({ recipe }) => (
              <button
                key={recipe.id}
                onClick={() => navigate(`/recipe/${recipe.id}`)}
                className="text-left text-sm text-gray-700 active:text-[#2E86AB] transition-colors"
              >
                {recipe.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {useItUp.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#B7950B] mb-1.5">⚠ Use it up soon</p>
          <div className="flex flex-col gap-1.5">
            {useItUp.map(({ recipe }) => (
              <button
                key={recipe.id}
                onClick={() => navigate(`/recipe/${recipe.id}`)}
                className="text-left text-sm text-gray-700 active:text-[#2E86AB] transition-colors"
              >
                {recipe.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
