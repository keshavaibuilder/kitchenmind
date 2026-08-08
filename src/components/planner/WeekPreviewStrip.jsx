import { useNavigate } from 'react-router-dom'
import { MEAL_SLOTS } from '../../services/PlanningEngine.js'

const MEAL_EMOJI = { breakfast: '🍳', lunch: '🍛', dinner: '🍲' }

function slotLabel(meal) {
  if (meal.status === 'suggested') return meal.suggestion.recipe.name
  if (meal.status === 'planned') return 'Planned'
  if (meal.status === 'cooked') return 'Cooked'
  if (meal.status === 'skipped') return 'Skipped'
  return '—'
}

export default function WeekPreviewStrip({ weekPreview }) {
  const navigate = useNavigate()

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {weekPreview.map((day) => (
        <div key={day.date} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex-shrink-0 w-36">
          <p className="text-xs font-bold text-[#1E3A5F] mb-2">{day.dateLabel}</p>
          <div className="space-y-1.5">
            {MEAL_SLOTS.map((mealType) => {
              const meal = day.meals[mealType]
              const clickable = meal.status === 'suggested'
              return (
                <button
                  key={mealType}
                  onClick={() => clickable && navigate(`/recipe/${meal.suggestion.recipe.id}`)}
                  disabled={!clickable}
                  className="w-full flex items-center gap-1.5 text-left disabled:cursor-default"
                >
                  <span className="text-xs" aria-hidden="true">
                    {MEAL_EMOJI[mealType]}
                  </span>
                  <span className="text-[10px] text-gray-500 truncate">{slotLabel(meal)}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
