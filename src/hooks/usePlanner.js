import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useAuthStore from '@/store/authStore'
import { useInventory } from '@/hooks/useInventory'
import { useMealHistory } from '@/hooks/useMealHistory'
import { RecipeService } from '@/services/RecipeService'
import { MealLogService } from '@/services/MealLogService'
import { HouseholdService } from '@/services/HouseholdService'
import { PredictionService } from '@/services/PredictionService'
import { HouseholdIntelligenceService } from '@/services/HouseholdIntelligenceService'
import { ConsumptionProfileService } from '@/services/ConsumptionProfileService'
import { InventoryService } from '@/services/InventoryService'
import { buildPlanningContext, generateTodaysPlan, generateWeekPreview, generateShoppingSuggestions } from '@/services/PlanningEngine'

const EMPTY_ARRAY = []
const PLAN_DAYS = 7

function toDateOnly(d) {
  return d.toISOString().slice(0, 10)
}

/**
 * Smart Meal Planner & Shopping Intelligence data hook.
 *
 * Query keys for predictions/householdProfile/consumptionProfiles/expiringBatches deliberately
 * match useDashboard.js's exactly, and `preferences` matches useHousehold.js's — visiting the
 * Dashboard or completing onboarding already warms these caches for the Planner, and vice versa.
 * `mealLogs` (upcoming planned/cooked meals for the visible window) is the one genuinely new
 * aggregated query this hook adds.
 */
export function usePlanner() {
  const { household_id } = useAuthStore()
  const queryClient = useQueryClient()
  const today = useMemo(() => toDateOnly(new Date()), [])
  const rangeEnd = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + (PLAN_DAYS - 1))
    return toDateOnly(d)
  }, [today])

  // Dismissed-this-session / regenerated candidates, per meal slot. Deliberately NOT persisted
  // (unlike Favorites) — a dismissal means "not today," not "never suggest again forever."
  const [excludedByMealType, setExcludedByMealType] = useState({})

  const { items: inventoryItems, isLoading: inventoryLoading } = useInventory()
  const { mealLogs: recentMealLogs, isLoading: historyLoading } = useMealHistory()

  const recipesQuery = useQuery({
    queryKey: ['planner-recipes', household_id],
    queryFn: async () => (await RecipeService.getRecipes(household_id, { limit: 60 })).recipes,
    enabled: !!household_id,
  })

  const predictionsQuery = useQuery({
    queryKey: ['predictions', household_id],
    queryFn: () => PredictionService.getHouseholdPredictions(household_id),
    enabled: !!household_id,
  })

  const householdProfileQuery = useQuery({
    queryKey: ['householdProfile', household_id],
    queryFn: () => HouseholdIntelligenceService.getHouseholdProfile(household_id),
    enabled: !!household_id,
  })

  const consumptionProfilesQuery = useQuery({
    queryKey: ['consumptionProfiles', household_id],
    queryFn: () => ConsumptionProfileService.getAllProfiles(household_id),
    enabled: !!household_id,
  })

  const expiringBatchesQuery = useQuery({
    queryKey: ['expiringBatches', household_id],
    queryFn: () => InventoryService.getExpiringBatches(household_id, { withinDays: 7 }),
    enabled: !!household_id,
  })

  const preferencesQuery = useQuery({
    queryKey: ['preferences', household_id],
    queryFn: () => HouseholdService.getPreferences(household_id),
    enabled: !!household_id,
  })

  const mealLogsQuery = useQuery({
    queryKey: ['mealLogs', household_id, today, rangeEnd],
    queryFn: () => MealLogService.getMealLogs(household_id, { from: today, to: rangeEnd }),
    enabled: !!household_id,
  })

  const context = useMemo(
    () =>
      buildPlanningContext({
        today,
        recipes: recipesQuery.data ?? EMPTY_ARRAY,
        inventoryItems,
        predictions: predictionsQuery.data ?? EMPTY_ARRAY,
        consumptionProfiles: consumptionProfilesQuery.data ?? EMPTY_ARRAY,
        expiringBatches: expiringBatchesQuery.data ?? EMPTY_ARRAY,
        householdProfile: householdProfileQuery.data ?? null,
        preferences: preferencesQuery.data ?? null,
        upcomingMealLogs: mealLogsQuery.data ?? EMPTY_ARRAY,
        recentMealLogs,
      }),
    [
      today,
      recipesQuery.data,
      inventoryItems,
      predictionsQuery.data,
      consumptionProfilesQuery.data,
      expiringBatchesQuery.data,
      householdProfileQuery.data,
      preferencesQuery.data,
      mealLogsQuery.data,
      recentMealLogs,
    ]
  )

  // getMealLogs() (unlike getMealHistory()) doesn't embed the recipe, so components resolving a
  // 'planned'/'cooked' slot's mealLog.recipe_id need this lookup.
  const recipeById = useMemo(() => new Map(context.recipes.map((r) => [r.id, r])), [context.recipes])

  const todaysPlan = useMemo(() => generateTodaysPlan(context, excludedByMealType), [context, excludedByMealType])
  const weekPreview = useMemo(() => generateWeekPreview(context, PLAN_DAYS), [context])
  const shoppingSuggestions = useMemo(() => generateShoppingSuggestions(context), [context])

  const acceptMutation = useMutation({
    mutationFn: ({ mealType, suggestion, date }) =>
      MealLogService.createMealLog(household_id, {
        date: date || today,
        meal_type: mealType,
        recipe_id: suggestion.recipe.id,
        headcount: suggestion.recipe.base_servings,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealLogs', household_id] })
      queryClient.invalidateQueries({ queryKey: ['mealHistory', household_id] })
    },
  })

  const excludeCandidate = useCallback((mealType, recipeId) => {
    setExcludedByMealType((prev) => {
      const next = new Set(prev[mealType] || [])
      next.add(recipeId)
      return { ...prev, [mealType]: next }
    })
  }, [])

  const isLoading =
    inventoryLoading ||
    historyLoading ||
    recipesQuery.isLoading ||
    predictionsQuery.isLoading ||
    householdProfileQuery.isLoading ||
    consumptionProfilesQuery.isLoading ||
    expiringBatchesQuery.isLoading ||
    preferencesQuery.isLoading ||
    mealLogsQuery.isLoading

  const isError =
    recipesQuery.isError ||
    predictionsQuery.isError ||
    consumptionProfilesQuery.isError ||
    expiringBatchesQuery.isError ||
    mealLogsQuery.isError

  function refetch() {
    recipesQuery.refetch()
    predictionsQuery.refetch()
    householdProfileQuery.refetch()
    consumptionProfilesQuery.refetch()
    expiringBatchesQuery.refetch()
    preferencesQuery.refetch()
    mealLogsQuery.refetch()
  }

  return {
    isLoading,
    isError,
    refetch,
    todaysPlan,
    weekPreview,
    shoppingSuggestions,
    recipeById,
    acceptSuggestion: (mealType, suggestion, date) => acceptMutation.mutateAsync({ mealType, suggestion, date }),
    isAccepting: acceptMutation.isPending,
    // Dismiss and Regenerate share one mechanism: exclude this candidate from the ranked pool
    // for its slot and let generateTodaysPlan/generateWeekPreview pick the next best one.
    dismissSuggestion: (mealType, recipeId) => excludeCandidate(mealType, recipeId),
    regenerateSuggestion: (mealType, recipeId) => excludeCandidate(mealType, recipeId),
  }
}
