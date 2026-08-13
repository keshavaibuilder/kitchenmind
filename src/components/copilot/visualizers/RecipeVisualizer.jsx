import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function RecipeVisualizer({ recipes = [] }) {
  const navigate = useNavigate()
  if (!recipes || recipes.length === 0) return null

  return (
    <div className="my-3 p-3.5 bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-xl shadow-inner text-slate-100">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-700/50">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
          <span>🥘</span> Recipe Recommendations
        </span>
        <span className="text-[11px] text-slate-400 font-medium">
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
        </span>
      </div>

      <div className="space-y-2">
        {recipes.slice(0, 4).map((recipe, idx) => {
          const id = recipe.id || recipe.recipe_id
          const name = recipe.name || recipe.title || 'Recipe'
          const isVeg = recipe.is_vegetarian ?? true
          const cookTime = recipe.cook_time_mins || recipe.prep_time_mins || 20

          return (
            <div
              key={idx}
              className="p-3 bg-slate-900/60 border border-slate-700/60 rounded-lg hover:border-emerald-500/50 transition-all flex items-center justify-between group"
            >
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`w-2 h-2 rounded-full ${isVeg ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <h4 className="font-semibold text-xs text-slate-100 group-hover:text-emerald-300 transition-colors truncate">
                    {name}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>⏱ {cookTime} mins</span>
                  <span>•</span>
                  <span className="capitalize">{recipe.meal_type || 'Main Course'}</span>
                </p>
              </div>

              {id && (
                <button
                  onClick={() => navigate(`/recipe/${id}`)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-md transition-colors shrink-0"
                >
                  View
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
