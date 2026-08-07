import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { RecipeService } from '@/services/RecipeService'
import { MealLogService } from '@/services/MealLogService'
import useAuthStore from '@/store/authStore'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 12
const FAVORITES_KEY_PREFIX = 'kitchenmind:favoriteRecipes:'

function loadFavoriteIds(householdId) {
  if (!householdId || typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY_PREFIX + householdId)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function persistFavoriteIds(householdId, idSet) {
  if (!householdId || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAVORITES_KEY_PREFIX + householdId, JSON.stringify(Array.from(idSet)))
  } catch {
    // localStorage can throw in private-browsing/quota-exceeded contexts — favorites are a
    // nice-to-have, not a data-integrity concern, so this is safe to swallow.
  }
}

/**
 * Recipe favorites are NOT a backend concept (no `favorites` table — deliberately not adding
 * one for a UI-only preference; see docs/09 §7.3). Stored per-household in localStorage, so
 * they don't sync across devices. Kept as a separate hook from useRecipes so pages can favorite
 * a recipe without depending on the paginated library query being active.
 */
export function useFavoriteRecipes() {
  const { household_id } = useAuthStore()
  const [favoriteIds, setFavoriteIds] = useState(() => loadFavoriteIds(household_id))

  useEffect(() => {
    setFavoriteIds(loadFavoriteIds(household_id))
  }, [household_id])

  const toggleFavorite = useCallback(
    (recipeId) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (next.has(recipeId)) next.delete(recipeId)
        else next.add(recipeId)
        persistFavoriteIds(household_id, next)
        return next
      })
    },
    [household_id]
  )

  const favoritesQuery = useQuery({
    queryKey: ['favoriteRecipes', household_id, Array.from(favoriteIds).sort().join(',')],
    queryFn: () => RecipeService.getRecipesByIds(Array.from(favoriteIds)),
    enabled: !!household_id && favoriteIds.size > 0,
  })

  return {
    favoriteIds,
    isFavorite: (recipeId) => favoriteIds.has(recipeId),
    toggleFavorite,
    favoriteRecipes: favoriteIds.size > 0 ? favoritesQuery.data ?? [] : [],
    isLoading: favoriteIds.size > 0 && favoritesQuery.isLoading,
  }
}

/**
 * Recently-cooked recipes, most recent first — derived from real meal_log history
 * (status='cooked'), not a UI-only concept like favorites.
 */
export function useRecentlyCookedRecipes(limit = 10) {
  const { household_id } = useAuthStore()

  const idsQuery = useQuery({
    queryKey: ['recentlyCookedRecipeIds', household_id, limit],
    queryFn: () => MealLogService.getRecentlyCookedRecipeIds(household_id, limit),
    enabled: !!household_id,
  })

  const ids = idsQuery.data ?? []
  const recipesQuery = useQuery({
    queryKey: ['recentlyCookedRecipes', household_id, ids.join(',')],
    queryFn: () => RecipeService.getRecipesByIds(ids),
    enabled: !!household_id && ids.length > 0,
  })

  return {
    recipes: ids.length > 0 ? recipesQuery.data ?? [] : [],
    isLoading: idsQuery.isLoading || (ids.length > 0 && recipesQuery.isLoading),
  }
}

/**
 * Main Recipe Library query: global + household recipes, filtered and infinitely paginated.
 * @param {{ mealType?, cuisine?, isVegetarian?, search? }} filters
 */
export function useRecipes(filters = {}) {
  const { household_id } = useAuthStore()
  const { mealType, cuisine, isVegetarian, search } = filters

  const query = useInfiniteQuery({
    queryKey: ['recipes', household_id, mealType ?? null, cuisine ?? null, isVegetarian ?? null, search ?? ''],
    queryFn: ({ pageParam }) =>
      RecipeService.getRecipes(household_id, {
        mealType,
        cuisine,
        isVegetarian,
        search,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined),
    enabled: !!household_id,
  })

  const recipes = (query.data?.pages ?? []).flatMap((page) => page.recipes)

  return {
    recipes,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  }
}

/**
 * @param {string} recipeId
 */
export function useRecipeById(recipeId) {
  const query = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => RecipeService.getRecipeById(recipeId),
    enabled: !!recipeId,
  })
  return { recipe: query.data ?? null, isLoading: query.isLoading, isError: query.isError, error: query.error, refetch: query.refetch }
}

/**
 * Recipe CRUD mutations (create/update/delete/duplicate), separated from useRecipeById so the
 * Editor page doesn't need to be viewing a specific recipe to create a new one.
 */
export function useRecipeMutations() {
  const queryClient = useQueryClient()
  const { household_id } = useAuthStore()

  function invalidateRecipeLists() {
    queryClient.invalidateQueries({ queryKey: ['recipes', household_id] })
  }

  return {
    createRecipe: async (payload) => {
      const recipe = await RecipeService.createCustomRecipe(household_id, payload)
      invalidateRecipeLists()
      return recipe
    },
    updateRecipe: async (recipeId, updates) => {
      const recipe = await RecipeService.updateRecipe(household_id, recipeId, updates)
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] })
      invalidateRecipeLists()
      return recipe
    },
    deleteRecipe: async (recipeId) => {
      const result = await RecipeService.deleteRecipe(household_id, recipeId)
      invalidateRecipeLists()
      return result
    },
    duplicateRecipe: async (sourceRecipe) => {
      const recipe = await RecipeService.duplicateRecipe(household_id, sourceRecipe)
      invalidateRecipeLists()
      return recipe
    },
  }
}
