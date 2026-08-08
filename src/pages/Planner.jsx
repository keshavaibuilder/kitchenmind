import { useNavigate } from 'react-router-dom'
import { usePlanner } from '../hooks/usePlanner'
import { MEAL_SLOTS } from '../services/PlanningEngine'
import MealSuggestionCard from '../components/planner/MealSuggestionCard'
import WeekPreviewStrip from '../components/planner/WeekPreviewStrip'
import ShoppingSuggestionGroup from '../components/planner/ShoppingSuggestionGroup'
import { PlannerSkeleton } from '../components/Skeleton'
import { useToast } from '../hooks/useToast'

/**
 * Smart Meal Planner & Shopping Intelligence — AI-assisted suggestions with an explicit reason
 * for every pick, not a drag-and-drop calendar or a manual checklist. All generation logic lives
 * in PlanningEngine.js (pure, reuses Phase 4A/4C/5A derivations); this page only renders it.
 */
export default function Planner() {
  const planner = usePlanner()
  const { showToast } = useToast()
  const navigate = useNavigate()

  if (planner.isLoading) {
    return <PlannerSkeleton />
  }

  if (planner.isError) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-lg font-bold text-[#1E3A5F] mb-2">Couldn't load your meal plan</h2>
          <button
            onClick={planner.refetch}
            className="h-12 px-6 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  async function handleAccept(mealType, suggestion) {
    try {
      await planner.acceptSuggestion(mealType, suggestion)
      showToast(`${suggestion.recipe.name} added to today's plan.`, { type: 'success' })
    } catch (err) {
      showToast(err.message || 'Could not add this to your plan.', { type: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] px-4 pt-8 pb-8 max-w-md mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-[#2E86AB] text-sm font-semibold" aria-label="Back">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-[#1E3A5F]">Meal Planner</h1>
        <button
          onClick={planner.refetch}
          className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
          aria-label="Refresh plan"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Today's Plan</p>
        <div className="space-y-3">
          {MEAL_SLOTS.map((mealType) => (
            <MealSuggestionCard
              key={mealType}
              mealType={mealType}
              slot={planner.todaysPlan[mealType]}
              recipeById={planner.recipeById}
              onAccept={handleAccept}
              onDismiss={planner.dismissSuggestion}
              onRegenerate={planner.regenerateSuggestion}
              isAccepting={planner.isAccepting}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">This Week</p>
        <WeekPreviewStrip weekPreview={planner.weekPreview} />
      </div>

      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Shopping Suggestions</p>
        {planner.shoppingSuggestions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm text-gray-400">Nothing predicted to buy soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {planner.shoppingSuggestions.map((group) => (
              <ShoppingSuggestionGroup key={group.category} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
