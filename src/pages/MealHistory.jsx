import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMealHistory, useMealDeductions } from '../hooks/useMealHistory'
import InfiniteScrollSentinel from '../components/InfiniteScrollSentinel'
import { formatGrams } from '../utils/formatters.js'

const MEAL_EMOJI = { breakfast: '🍳', lunch: '🍛', dinner: '🍲', snack: '🥪', tiffin: '🍱' }

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function MealHistory() {
  const navigate = useNavigate()
  const { mealLogs, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } = useMealHistory()
  const [expandedId, setExpandedId] = useState(null)

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col max-w-md mx-auto">
      <div className="sticky top-0 bg-[#F5F7FA] px-4 pt-8 pb-4 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="text-[#2E86AB] text-sm font-semibold" aria-label="Back">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Meal History</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-center text-sm text-[#C0392B] py-12">Couldn't load meal history.</p>
        ) : mealLogs.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-gray-500 text-sm mb-4">No meals cooked yet — your cooking log will show up here.</p>
            <button onClick={() => navigate('/recipes')} className="text-[#2E86AB] text-sm font-semibold underline">
              Browse recipes
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {mealLogs.map((meal) => (
                <MealHistoryRow
                  key={meal.id}
                  meal={meal}
                  expanded={expandedId === meal.id}
                  onToggle={() => setExpandedId((prev) => (prev === meal.id ? null : meal.id))}
                />
              ))}
            </div>
            <InfiniteScrollSentinel onIntersect={handleLoadMore} enabled={hasNextPage} />
            {isFetchingNextPage && <p className="text-center text-xs text-gray-400 py-3">Loading more…</p>}
          </>
        )}
      </div>
    </div>
  )
}

function MealHistoryRow({ meal, expanded, onToggle }) {
  const { deductions, isLoading } = useMealDeductions(expanded ? meal.id : null)
  const recipeName = meal.recipes?.name || meal.custom_meal_name || 'Meal'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 text-left active:bg-gray-50 transition-colors">
        <span className="text-2xl flex-shrink-0">{MEAL_EMOJI[meal.meal_type] || '🍽️'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1E3A5F] truncate">{recipeName}</p>
          <p className="text-[11px] text-gray-400">
            {formatDateTime(meal.cooked_at)} · {meal.headcount || 1} servings
          </p>
        </div>
        <span className="text-gray-300">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-50 pt-2">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Ingredients consumed</p>
          {isLoading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : deductions.length === 0 ? (
            <p className="text-xs text-gray-400">No deduction record for this meal.</p>
          ) : (
            <div className="space-y-1">
              {deductions.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{d.inventory?.canonical_name || 'Ingredient'}</span>
                  <span className="text-gray-400">{formatGrams(d.grams_deducted)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-300 mt-3 italic">AI observations for this meal — coming soon</p>
        </div>
      )}
    </div>
  )
}
