import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRecipeById, useRecipeMutations, useFavoriteRecipes } from '../hooks/useRecipes'
import { useRecipeCookingHistory } from '../hooks/useMealHistory'
import { RecipeService } from '@/services/RecipeService'
import { RecipeDetailSkeleton } from '../components/Skeleton'
import CookMealFlow from '../components/recipes/CookMealFlow'
import { useToast } from '../hooks/useToast'
import { formatRelativeTime } from '../utils/formatters.js'

const MEAL_EMOJI = { breakfast: '🍳', lunch: '🍛', dinner: '🍲', snack: '🥪', tiffin: '🍱' }

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recipe, isLoading, isError, refetch } = useRecipeById(id)
  const { recentCooks, lastCookedAt, isLoading: historyLoading } = useRecipeCookingHistory(id)
  const { deleteRecipe, duplicateRecipe } = useRecipeMutations()
  const { isFavorite, toggleFavorite } = useFavoriteRecipes()
  const { showToast } = useToast()

  const [cookFlowOpen, setCookFlowOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (isLoading) return <RecipeDetailSkeleton />

  if (isError || !recipe) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-lg font-bold text-[#1E3A5F] mb-2">Couldn't load this recipe</h2>
          <div className="flex flex-col gap-3 mt-6">
            <button onClick={() => refetch()} className="h-12 px-6 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform">
              Retry
            </button>
            <button onClick={() => navigate('/recipes')} className="text-[#2E86AB] text-sm font-semibold">
              ← Back to recipes
            </button>
          </div>
        </div>
      </div>
    )
  }

  const baseIngredients = RecipeService.scaleRecipeIngredients(recipe, recipe.base_servings)
  const isCustom = Boolean(recipe.household_id)
  const totalTime = (recipe.prep_time_mins || 0) + (recipe.cook_time_mins || 0)

  async function handleDuplicate() {
    try {
      const copy = await duplicateRecipe(recipe)
      showToast('Recipe duplicated — now editable as your own.', { type: 'success' })
      navigate(`/recipes/${copy.id}/edit`)
    } catch {
      showToast('Could not duplicate this recipe.', { type: 'error' })
    }
  }

  async function handleDelete() {
    try {
      await deleteRecipe(recipe.id)
      showToast('Recipe deleted.', { type: 'success' })
      navigate('/recipes')
    } catch {
      showToast('Could not delete this recipe.', { type: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] max-w-md mx-auto pb-28">
      {/* Header image / emoji */}
      <div className="relative w-full h-56 bg-gradient-to-br from-blue-50 to-gray-50 flex items-center justify-center">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.name} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="text-7xl">{MEAL_EMOJI[recipe.meal_type] || '🍽️'}</span>
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-sm active:scale-90 transition-transform"
          aria-label="Back"
        >
          ←
        </button>
        <button
          onClick={() => toggleFavorite(recipe.id)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-sm active:scale-90 transition-transform"
          aria-label={isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFavorite(recipe.id)}
        >
          {isFavorite(recipe.id) ? '⭐' : '☆'}
        </button>
      </div>

      <div className="px-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-[#1E3A5F] leading-snug">{recipe.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{recipe.cuisine || 'Recipe'}</p>
          </div>
          {isCustom && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#1E3A5F] text-white flex-shrink-0">Custom</span>
          )}
        </div>

        {recipe.description && <p className="text-sm text-gray-500 mt-3">{recipe.description}</p>}

        {/* Meta row */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <MetaTile label="Prep" value={recipe.prep_time_mins ? `${recipe.prep_time_mins}m` : '—'} />
          <MetaTile label="Cook" value={recipe.cook_time_mins ? `${recipe.cook_time_mins}m` : '—'} />
          <MetaTile label="Difficulty" value={recipe.difficulty || '—'} capitalize />
          <MetaTile label="Servings" value={recipe.base_servings} />
        </div>

        {/* Nutrition placeholder */}
        <div className="bg-white rounded-xl border border-gray-100 p-3 mt-4 flex items-center gap-2">
          <span className="text-lg">🍎</span>
          <p className="text-xs text-gray-400">Nutrition information coming soon</p>
        </div>

        {/* Cooking history */}
        <div className="mt-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Cooking history</p>
          {historyLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : recentCooks.length === 0 ? (
            <p className="text-sm text-gray-400">You haven't cooked this yet.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <p className="text-sm font-semibold text-[#1E3A5F]">Last cooked {formatRelativeTime(lastCookedAt).replace('Updated ', '')}</p>
              <p className="text-xs text-gray-400 mt-0.5">Cooked {recentCooks.length} time{recentCooks.length === 1 ? '' : 's'} recently · Average rating coming soon</p>
            </div>
          )}
        </div>

        {/* Ingredients (base servings) */}
        <div className="mt-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Ingredients <span className="normal-case text-gray-400">(for {recipe.base_servings} servings)</span>
          </p>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {baseIngredients.map((ing) => (
              <div key={ing.canonical_name} className="flex items-center justify-between px-4 h-11 text-sm">
                <span className="text-gray-700">
                  {ing.canonical_name}
                  {ing.is_optional && <span className="text-gray-400"> (optional)</span>}
                </span>
                <span className="text-gray-400">{ing.quantity_grams}g</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        {recipe.instructions && (
          <div className="mt-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Instructions</p>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{recipe.instructions}</p>
          </div>
        )}

        {/* Recipe management */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleDuplicate}
            className="flex-1 h-11 rounded-xl border-2 border-[#2E86AB] text-[#2E86AB] text-sm font-semibold active:scale-95 transition-transform"
          >
            Duplicate
          </button>
          {isCustom && (
            <button
              onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
              className="flex-1 h-11 rounded-xl border-2 border-[#2E86AB] text-[#2E86AB] text-sm font-semibold active:scale-95 transition-transform"
            >
              Edit
            </button>
          )}
          {isCustom &&
            (confirmingDelete ? (
              <button
                onClick={handleDelete}
                className="flex-1 h-11 rounded-xl bg-[#C0392B] text-white text-sm font-semibold active:scale-95 transition-transform"
              >
                Confirm delete
              </button>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex-1 h-11 rounded-xl border-2 border-gray-200 text-gray-500 text-sm font-semibold active:scale-95 transition-transform"
              >
                Delete
              </button>
            ))}
        </div>
      </div>

      {/* Sticky cook button */}
      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 pb-3">
        <button
          onClick={() => setCookFlowOpen(true)}
          className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold shadow-lg active:scale-95 transition-transform"
        >
          🍳 Cook This Recipe {totalTime > 0 ? `· ${totalTime}m` : ''}
        </button>
      </div>

      {cookFlowOpen && <CookMealFlow recipe={recipe} onClose={() => setCookFlowOpen(false)} />}
    </div>
  )
}

function MetaTile({ label, value, capitalize }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 py-2 text-center">
      <p className={`text-sm font-bold text-[#1E3A5F] ${capitalize ? 'capitalize' : ''}`}>{value}</p>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  )
}
