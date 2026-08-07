import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes, useFavoriteRecipes, useRecentlyCookedRecipes } from '../hooks/useRecipes'
import RecipeCard from '../components/recipes/RecipeCard'
import InfiniteScrollSentinel from '../components/InfiniteScrollSentinel'
import { RecipeLibrarySkeletonGrid } from '../components/Skeleton'

const MEAL_TYPE_TABS = [
  { label: 'All', value: null },
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Snack', value: 'snack' },
  { label: 'Tiffin', value: 'tiffin' },
]

const VIEW_TABS = [
  { label: 'Browse', value: 'browse' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'Recently Cooked', value: 'recent' },
]

export default function RecipeLibrary() {
  const navigate = useNavigate()
  const [view, setView] = useState('browse')
  const [search, setSearch] = useState('')
  const [mealType, setMealType] = useState(null)
  const [vegFilter, setVegFilter] = useState(null) // null | true | false

  const browseFilters = useMemo(
    () => ({ search: search.trim() || undefined, mealType: mealType || undefined, isVegetarian: vegFilter ?? undefined }),
    [search, mealType, vegFilter]
  )

  const browse = useRecipes(browseFilters)
  const favorites = useFavoriteRecipes()
  const recent = useRecentlyCookedRecipes(20)

  const handleLoadMore = useCallback(() => {
    if (browse.hasNextPage && !browse.isFetchingNextPage) browse.fetchNextPage()
  }, [browse])

  const activeRecipes = view === 'browse' ? browse.recipes : view === 'favorites' ? favorites.favoriteRecipes : recent.recipes
  const isLoading = view === 'browse' ? browse.isLoading : view === 'favorites' ? favorites.isLoading : recent.isLoading

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col max-w-md mx-auto">
      {/* Sticky header */}
      <div className="sticky top-0 bg-[#F5F7FA] px-4 pt-8 pb-3 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[#1E3A5F]">Recipes</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/meals/history')}
              className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
              title="Meal history"
              aria-label="View meal history"
            >
              📖
            </button>
            <button
              onClick={() => navigate('/recipes/new')}
              className="h-9 px-3 rounded-xl bg-[#2E86AB] text-white text-sm font-semibold active:scale-95 transition-transform"
            >
              + New
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="w-full h-11 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
          />
        </div>

        {/* Browse / Favorites / Recently Cooked */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setView(tab.value)}
              className={`h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                view === tab.value ? 'bg-[#1E3A5F] text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {view === 'browse' && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 mt-1">
              {MEAL_TYPE_TABS.map((tab) => (
                <button
                  key={tab.label}
                  onClick={() => setMealType(tab.value)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                    mealType === tab.value ? 'bg-[#2E86AB] text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {[
                { label: 'All', value: null },
                { label: 'Veg', value: true },
                { label: 'Non-Veg', value: false },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setVegFilter(opt.value)}
                  className={`h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all active:scale-95 ${
                    vegFilter === opt.value ? 'bg-[#1A7A4A] text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {isLoading ? (
          <RecipeLibrarySkeletonGrid />
        ) : activeRecipes.length === 0 ? (
          <EmptyState view={view} onBrowse={() => setView('browse')} onNew={() => navigate('/recipes/new')} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {activeRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isFavorite={favorites.isFavorite(recipe.id)}
                  onToggleFavorite={favorites.toggleFavorite}
                />
              ))}
            </div>
            {view === 'browse' && <InfiniteScrollSentinel onIntersect={handleLoadMore} enabled={browse.hasNextPage} />}
            {view === 'browse' && browse.isFetchingNextPage && (
              <p className="text-center text-xs text-gray-400 py-3">Loading more…</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EmptyState({ view, onBrowse, onNew }) {
  if (view === 'favorites') {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">⭐</div>
        <p className="text-gray-500 text-sm mb-4">No favorites yet — tap the star on any recipe to save it here.</p>
        <button onClick={onBrowse} className="text-[#2E86AB] text-sm font-semibold underline">
          Browse recipes
        </button>
      </div>
    )
  }
  if (view === 'recent') {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">🕐</div>
        <p className="text-gray-500 text-sm mb-4">Nothing cooked yet — recipes you mark as cooked will show up here.</p>
        <button onClick={onBrowse} className="text-[#2E86AB] text-sm font-semibold underline">
          Browse recipes
        </button>
      </div>
    )
  }
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">🍽️</div>
      <p className="text-gray-500 text-sm mb-4">No recipes match your filters yet.</p>
      <button onClick={onNew} className="text-[#2E86AB] text-sm font-semibold underline">
        Create a custom recipe
      </button>
    </div>
  )
}
