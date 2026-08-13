// Shared context-building helper for PlannerTool and ShoppingTool — both are thin wrappers
// around PlanningEngine (§3.3, §3.4), which is a pure computation module requiring the same
// pre-fetched raw inputs (§1.1 principle #2: reuse the service layer, don't replace it). Mirrors
// exactly what usePlanner.js does client-side, just with a per-request-scoped client.
import { RecipeService } from '@/services/RecipeService.js'
import { InventoryService } from '@/services/InventoryService.js'
import { PredictionService } from '@/services/PredictionService.js'
import { ConsumptionProfileService } from '@/services/ConsumptionProfileService.js'
import { HouseholdIntelligenceService } from '@/services/HouseholdIntelligenceService.js'
import { HouseholdService } from '@/services/HouseholdService.js'
import { MealLogService } from '@/services/MealLogService.js'
import { buildPlanningContext } from '@/services/PlanningEngine.js'
import type { ToolContext } from '../types.ts'

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// deno-lint-ignore no-explicit-any
export async function fetchPlanningContext(ctx: ToolContext): Promise<any> {
  const today = toDateOnly(new Date())
  const rangeEnd = toDateOnly(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000))

  const [
    recipesResult,
    inventoryItems,
    predictions,
    consumptionProfiles,
    expiringBatches,
    householdProfile,
    preferences,
    upcomingMealLogs,
    mealHistoryResult,
  ] = await Promise.all([
    RecipeService.getRecipes(ctx.householdId, { limit: 200 }, ctx.client),
    InventoryService.getInventory(ctx.householdId, ctx.client),
    PredictionService.getHouseholdPredictions(ctx.householdId, ctx.client),
    ConsumptionProfileService.getAllProfiles(ctx.householdId, ctx.client),
    InventoryService.getExpiringBatches(ctx.householdId, { withinDays: 7, client: ctx.client }),
    HouseholdIntelligenceService.getHouseholdProfile(ctx.householdId, ctx.client),
    HouseholdService.getPreferences(ctx.householdId, ctx.client),
    MealLogService.getMealLogs(ctx.householdId, { from: today, to: rangeEnd }, ctx.client),
    MealLogService.getMealHistory(ctx.householdId, { limit: 20, client: ctx.client }),
  ])

  return buildPlanningContext({
    today,
    recipes: recipesResult.recipes,
    inventoryItems,
    predictions,
    consumptionProfiles,
    expiringBatches,
    householdProfile,
    preferences,
    upcomingMealLogs,
    recentMealLogs: mealHistoryResult.mealLogs,
  })
}
