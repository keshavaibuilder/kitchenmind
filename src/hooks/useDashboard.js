import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '@/store/authStore'
import { useInventory } from '@/hooks/useInventory'
import { useRecipes, useRecentlyCookedRecipes } from '@/hooks/useRecipes'
import { useMealHistory } from '@/hooks/useMealHistory'
import { HouseholdService } from '@/services/HouseholdService'
import { PredictionService } from '@/services/PredictionService'
import { HouseholdIntelligenceService } from '@/services/HouseholdIntelligenceService'
import { ConsumptionProfileService } from '@/services/ConsumptionProfileService'
import { InventoryService } from '@/services/InventoryService'
import { AIObservationService } from '@/services/AIObservationService'
import {
  derivePantryHealth,
  deriveLowStockPredictions,
  deriveExpiryRisk,
  deriveShoppingIntelligence,
  deriveCookingSuggestions,
  derivePantryInsights,
  deriveHouseholdTrends,
  deriveObservationTimeline,
  deriveHouseholdSnapshot,
  deriveQuickActions,
} from '../utils/dashboardInsights.js'

const EMPTY_ARRAY = []

/**
 * Kitchen Intelligence Dashboard data hook.
 *
 * Fires a small FIXED set of aggregated queries (one per data source, each returning every
 * relevant row for the household in a single round trip — never one query per ingredient/recipe/
 * batch) and derives all 10 dashboard modules from them via useMemo. Reuses existing hooks/cache
 * keys (useInventory, useRecipes, useMealHistory) rather than re-fetching what other pages
 * already loaded.
 */
export function useDashboard() {
  const { household_id } = useAuthStore()

  const { items: inventoryItems, isLoading: inventoryLoading } = useInventory()
  const { recipes, isLoading: recipesLoading } = useRecipes()
  const { recipes: recentlyCookedRecipes } = useRecentlyCookedRecipes(5)
  const { mealLogs: recentMealLogs } = useMealHistory()

  const householdQuery = useQuery({
    queryKey: ['household', household_id],
    queryFn: () => HouseholdService.getHouseholdDetails(household_id),
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

  const observationsQuery = useQuery({
    queryKey: ['observations', household_id],
    queryFn: () => AIObservationService.getRecentObservations(household_id, 20),
    enabled: !!household_id,
  })

  // Stable references when a query's data is still undefined, so downstream useMemo hooks
  // don't recompute every render on a fresh [] identity.
  const predictions = predictionsQuery.data ?? EMPTY_ARRAY
  const householdProfile = householdProfileQuery.data ?? null
  const consumptionProfiles = consumptionProfilesQuery.data ?? EMPTY_ARRAY
  const expiringBatches = expiringBatchesQuery.data ?? EMPTY_ARRAY
  const observations = observationsQuery.data ?? EMPTY_ARRAY

  const pantryHealth = useMemo(() => derivePantryHealth(predictions), [predictions])
  const lowStock = useMemo(() => deriveLowStockPredictions(predictions), [predictions])
  const expiryRisk = useMemo(() => deriveExpiryRisk(expiringBatches), [expiringBatches])
  const shoppingIntelligence = useMemo(
    () => deriveShoppingIntelligence(predictions, consumptionProfiles),
    [predictions, consumptionProfiles]
  )

  const atRiskCanonicalNames = useMemo(
    () => [...lowStock.map((l) => l.canonicalName), ...expiryRisk.map((e) => e.canonicalName)],
    [lowStock, expiryRisk]
  )

  const cookingSuggestions = useMemo(
    () => deriveCookingSuggestions(recipes, inventoryItems, atRiskCanonicalNames),
    [recipes, inventoryItems, atRiskCanonicalNames]
  )

  const pantryInsights = useMemo(
    () => derivePantryInsights(householdProfile, consumptionProfiles),
    [householdProfile, consumptionProfiles]
  )

  const householdTrends = useMemo(() => {
    const base = deriveHouseholdTrends(householdProfile, consumptionProfiles)
    return { ...base, lastCookedAt: recentMealLogs[0]?.cooked_at ?? null }
  }, [householdProfile, consumptionProfiles, recentMealLogs])

  const observationTimeline = useMemo(() => deriveObservationTimeline(observations), [observations])

  const snapshot = useMemo(
    () =>
      deriveHouseholdSnapshot({
        householdName: householdQuery.data?.name,
        pantryHealth,
        lowStockCount: lowStock.length,
        expiryRiskCount: expiryRisk.length,
        shoppingFrequencyDays: householdProfile?.shopping_frequency_days ?? null,
        recentlyCookedCount: recentlyCookedRecipes.length,
      }),
    [householdQuery.data, pantryHealth, lowStock, expiryRisk, householdProfile, recentlyCookedRecipes]
  )

  const quickActions = useMemo(
    () =>
      deriveQuickActions({
        lowStockCount: lowStock.length,
        expiryRiskCount: expiryRisk.length,
        readyToCookCount: cookingSuggestions.readyToCook.length,
      }),
    [lowStock, expiryRisk, cookingSuggestions]
  )

  const isLoading =
    inventoryLoading ||
    recipesLoading ||
    householdQuery.isLoading ||
    predictionsQuery.isLoading ||
    householdProfileQuery.isLoading ||
    consumptionProfilesQuery.isLoading ||
    expiringBatchesQuery.isLoading ||
    observationsQuery.isLoading

  const isError =
    predictionsQuery.isError ||
    householdProfileQuery.isError ||
    consumptionProfilesQuery.isError ||
    expiringBatchesQuery.isError ||
    observationsQuery.isError

  function refetch() {
    householdQuery.refetch()
    predictionsQuery.refetch()
    householdProfileQuery.refetch()
    consumptionProfilesQuery.refetch()
    expiringBatchesQuery.refetch()
    observationsQuery.refetch()
  }

  return {
    isLoading,
    isError,
    refetch,
    snapshot,
    pantryHealth,
    lowStock,
    expiryRisk,
    shoppingIntelligence,
    cookingSuggestions,
    pantryInsights,
    householdTrends,
    observationTimeline,
    quickActions,
    household_id,
    inventoryItems,
    predictions,
    expiringBatches,
    recentMealLogs,
    recipes,
    observations,
  }
}
