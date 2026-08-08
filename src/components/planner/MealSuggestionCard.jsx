import { useNavigate } from 'react-router-dom'
import ReasonChips from './ReasonChips'

const MEAL_EMOJI = { breakfast: '🍳', lunch: '🍛', dinner: '🍲' }
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

/**
 * Renders one Today's Plan slot in whichever state it's actually in — already planned/cooked/
 * skipped (a real meal_log row), a suggestion awaiting a decision, or no candidates found.
 */
export default function MealSuggestionCard({ mealType, slot, recipeById, onAccept, onDismiss, onRegenerate, isAccepting }) {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl" aria-hidden="true">
          {MEAL_EMOJI[mealType]}
        </span>
        <p className="text-sm font-bold text-[#1E3A5F]">{MEAL_LABEL[mealType]}</p>
      </div>

      {slot.status === 'planned' && (
        <PlannedState recipe={recipeById.get(slot.mealLog.recipe_id)} onView={() => navigate(`/recipe/${slot.mealLog.recipe_id}`)} />
      )}
      {slot.status === 'cooked' && <CookedState recipe={recipeById.get(slot.mealLog.recipe_id)} />}
      {slot.status === 'skipped' && <p className="text-sm text-gray-400">Skipped today</p>}
      {slot.status === 'no_options' && (
        <p className="text-sm text-gray-400">No recipe matches right now — try adding more {mealType} recipes.</p>
      )}
      {slot.status === 'suggested' && (
        <SuggestedState
          suggestion={slot.suggestion}
          onView={() => navigate(`/recipe/${slot.suggestion.recipe.id}`)}
          onAccept={() => onAccept(mealType, slot.suggestion)}
          onDismiss={() => onDismiss(mealType, slot.suggestion.recipe.id)}
          onRegenerate={() => onRegenerate(mealType, slot.suggestion.recipe.id)}
          isAccepting={isAccepting}
        />
      )}
    </div>
  )
}

function PlannedState({ recipe, onView }) {
  return (
    <div>
      <button onClick={onView} className="text-sm font-semibold text-[#2E86AB] text-left">
        {recipe?.name || 'Planned meal'}
      </button>
      <p className="text-xs text-gray-400 mt-1">✓ Planned</p>
    </div>
  )
}

function CookedState({ recipe }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#1E3A5F]">{recipe?.name || 'Meal'}</p>
      <p className="text-xs text-[#1A7A4A] mt-1">✓ Cooked today</p>
    </div>
  )
}

function SuggestedState({ suggestion, onView, onAccept, onDismiss, onRegenerate, isAccepting }) {
  return (
    <div>
      <button onClick={onView} className="text-sm font-semibold text-[#2E86AB] text-left mb-1.5">
        {suggestion.recipe.name}
      </button>
      <ReasonChips reasons={suggestion.reasons} confidence={suggestion.confidence} />
      <div className="flex gap-2 mt-3">
        <button
          onClick={onAccept}
          disabled={isAccepting}
          className="flex-1 h-9 rounded-xl bg-[#1E3A5F] text-white text-xs font-semibold disabled:opacity-50 active:scale-95 transition-transform"
        >
          {isAccepting ? 'Adding…' : 'Accept'}
        </button>
        <button
          onClick={onRegenerate}
          className="h-9 px-3 rounded-xl border-2 border-gray-200 text-gray-500 text-xs font-semibold active:scale-95 transition-transform"
          aria-label="Show a different suggestion"
          title="Regenerate"
        >
          ↻
        </button>
        <button
          onClick={onDismiss}
          className="h-9 px-3 rounded-xl border-2 border-gray-200 text-gray-500 text-xs font-semibold active:scale-95 transition-transform"
          aria-label="Dismiss this suggestion"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
