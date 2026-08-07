import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { MealLogService } from '@/services/MealLogService'
import useAuthStore from '@/store/authStore'

const PAGE_SIZE = 15

/**
 * Last-cooked summary for a single recipe (Recipe Detail's "Cooking history / Last cooked").
 * Separate from useCookMeal so viewing a recipe doesn't also fetch inventory/members.
 * @param {string} recipeId
 */
export function useRecipeCookingHistory(recipeId) {
  const { household_id } = useAuthStore()
  const query = useQuery({
    queryKey: ['mealHistory', household_id, 'recipe', recipeId],
    queryFn: () => MealLogService.getMealHistory(household_id, { recipeId, limit: 5 }),
    enabled: !!household_id && !!recipeId,
  })
  const mealLogs = query.data?.mealLogs ?? []
  return {
    recentCooks: mealLogs,
    lastCookedAt: mealLogs[0]?.cooked_at ?? null,
    isLoading: query.isLoading,
  }
}

/**
 * Meal History module: cooked meal_log entries, paginated, most recent first.
 */
export function useMealHistory() {
  const { household_id } = useAuthStore()

  const query = useInfiniteQuery({
    queryKey: ['mealHistory', household_id],
    queryFn: ({ pageParam }) => MealLogService.getMealHistory(household_id, { limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined),
    enabled: !!household_id,
  })

  const mealLogs = (query.data?.pages ?? []).flatMap((page) => page.mealLogs)

  return {
    mealLogs,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  }
}

/**
 * Ingredient-level deduction detail for a single meal history entry (expanded on demand,
 * not fetched for every row in the list).
 * @param {string} mealLogId
 */
export function useMealDeductions(mealLogId) {
  const query = useQuery({
    queryKey: ['stockDeductions', mealLogId],
    queryFn: () => MealLogService.getStockDeductionsForMeal(mealLogId),
    enabled: !!mealLogId,
  })
  return { deductions: query.data ?? [], isLoading: query.isLoading }
}
