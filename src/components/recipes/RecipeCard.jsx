import { useNavigate } from 'react-router-dom'

const MEAL_EMOJI = {
  breakfast: '🍳',
  lunch: '🍛',
  dinner: '🍲',
  snack: '🥪',
  tiffin: '🍱',
}

/**
 * @param {Object} recipe
 * @param {boolean} [isFavorite]
 * @param {(recipeId: string) => void} [onToggleFavorite]
 */
export default function RecipeCard({ recipe, isFavorite, onToggleFavorite }) {
  const navigate = useNavigate()
  const emoji = MEAL_EMOJI[recipe.meal_type] || '🍽️'
  const totalTime = (recipe.prep_time_mins || 0) + (recipe.cook_time_mins || 0)

  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => navigate(`/recipe/${recipe.id}`)}
        className="block w-full text-left active:scale-95 transition-transform"
      >
        <div className="relative w-full h-28 bg-gradient-to-br from-blue-50 to-gray-50 flex items-center justify-center">
          {recipe.image_url ? (
            <img src={recipe.image_url} alt={recipe.name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">{emoji}</span>
          )}
          {recipe.household_id && (
            <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#1E3A5F]/90 text-white">
              Custom
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold text-[#1E3A5F] truncate">{recipe.name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{recipe.cuisine || 'Recipe'}</p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {totalTime > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                ⏱ {totalTime}m
              </span>
            )}
            {recipe.difficulty && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                {recipe.difficulty}
              </span>
            )}
            {typeof recipe.is_vegetarian === 'boolean' && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  recipe.is_vegetarian ? 'bg-green-100 text-[#1A7A4A]' : 'bg-red-100 text-[#C0392B]'
                }`}
              >
                {recipe.is_vegetarian ? 'Veg' : 'Non-Veg'}
              </span>
            )}
          </div>
        </div>
      </button>

      {onToggleFavorite && (
        <button
          onClick={() => onToggleFavorite(recipe.id)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-sm shadow-sm active:scale-90 transition-transform"
          aria-label={isFavorite ? `Remove ${recipe.name} from favorites` : `Add ${recipe.name} to favorites`}
          aria-pressed={Boolean(isFavorite)}
        >
          {isFavorite ? '⭐' : '☆'}
        </button>
      )}
    </div>
  )
}
