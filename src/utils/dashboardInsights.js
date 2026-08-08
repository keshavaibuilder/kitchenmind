/**
 * Kitchen Intelligence Dashboard — pure insight derivation.
 *
 * Every function here takes data that has ALREADY been fetched (by useDashboard, via a small
 * fixed set of aggregated service calls) and derives one dashboard module's view model. No I/O,
 * no new prediction/scoring logic — depletion scoring reuses PredictionService.
 * calculatePantryHealthScore, recipe-vs-inventory matching reuses RecipeService.
 * scaleRecipeIngredients + ingredientAvailability.js, exactly as Phase 4A/4C already built them.
 */
import { PredictionService } from '../services/PredictionService.js'
import { RecipeService } from '../services/RecipeService.js'
import { computeIngredientAvailability, summarizeAvailability } from './ingredientAvailability.js'

// ── 1. Pantry Health ──────────────────────────────────────────────────────
export function derivePantryHealth(predictions = []) {
  const score = PredictionService.calculatePantryHealthScore(
    predictions.map((p) => ({ daysUntilDepletion: p.days_until_depletion }))
  )
  let label = 'Needs attention'
  if (score >= 80) label = 'Great'
  else if (score >= 50) label = 'OK'

  return {
    score,
    label,
    trackedIngredients: predictions.length,
    atRiskCount: predictions.filter((p) => p.is_low_stock_risk).length,
  }
}

// ── 2. Low Stock Predictions ──────────────────────────────────────────────
export function deriveLowStockPredictions(predictions = []) {
  return predictions
    .filter((p) => p.is_low_stock_risk)
    .slice()
    .sort((a, b) => a.days_until_depletion - b.days_until_depletion)
    .map((p) => ({
      canonicalName: p.canonical_name,
      daysUntilDepletion: p.days_until_depletion,
      predictedDepletionDate: p.predicted_depletion_date,
      confidence: p.confidence_score,
    }))
}

// ── 3. Expiry Risk ─────────────────────────────────────────────────────────
export function deriveExpiryRisk(expiringBatches = []) {
  const today = new Date().toISOString().slice(0, 10)
  return expiringBatches
    .map((b) => {
      const daysUntilExpiry = Math.ceil((new Date(b.expiry_date) - new Date(today)) / 86_400_000)
      return {
        batchId: b.id,
        canonicalName: b.inventory?.canonical_name || 'Unknown item',
        category: b.inventory?.category || 'Miscellaneous',
        remainingGrams: Number(b.remaining_grams) || 0,
        expiryDate: b.expiry_date,
        daysUntilExpiry,
        isExpired: daysUntilExpiry < 0,
      }
    })
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
}

// ── 4. Shopping Intelligence ───────────────────────────────────────────────
export function deriveShoppingIntelligence(predictions = [], consumptionProfiles = [], { withinDays = 5 } = {}) {
  const profileByName = new Map(consumptionProfiles.map((p) => [p.canonical_name.toLowerCase(), p]))

  return predictions
    .filter((p) => p.days_until_depletion <= withinDays)
    .slice()
    .sort((a, b) => a.days_until_depletion - b.days_until_depletion)
    .map((p) => {
      const profile = profileByName.get((p.canonical_name || '').toLowerCase())
      return {
        canonicalName: p.canonical_name,
        daysUntilDepletion: p.days_until_depletion,
        suggestedPurchaseGrams: profile?.avg_purchase_grams ?? null,
        preferredBrand: profile?.preferred_brand ?? null,
        confidence: p.confidence_score,
      }
    })
}

// ── 5. Cooking Suggestions ─────────────────────────────────────────────────
/**
 * Two deterministic buckets — not a scored recommendation engine:
 * - readyToCook: recipes whose base-servings ingredient list is fully covered by current stock.
 * - useItUp: recipes that call for an ingredient that's currently at-risk (low stock or
 *   expiring soon), surfaced as a waste-reduction nudge.
 */
export function deriveCookingSuggestions(recipes = [], inventoryItems = [], atRiskCanonicalNames = [], { maxSuggestions = 5 } = {}) {
  const atRiskSet = new Set(atRiskCanonicalNames.map((n) => (n || '').toLowerCase()))
  const readyToCook = []
  const useItUp = []

  for (const recipe of recipes) {
    const required = RecipeService.scaleRecipeIngredients(recipe, recipe.base_servings)
    if (required.length === 0) continue

    const availability = computeIngredientAvailability(required, inventoryItems)
    const summary = summarizeAvailability(availability)

    if (summary.missing === 0 && summary.low === 0) {
      readyToCook.push({ recipe, availabilitySummary: summary })
    }

    if (required.some((r) => atRiskSet.has((r.canonical_name || '').toLowerCase()))) {
      useItUp.push({ recipe, availabilitySummary: summary })
    }
  }

  return {
    readyToCook: readyToCook.slice(0, maxSuggestions),
    useItUp: useItUp.slice(0, maxSuggestions),
  }
}

// ── 6. Pantry Insights ─────────────────────────────────────────────────────
export function derivePantryInsights(householdProfile, consumptionProfiles = []) {
  const mostConsumed = consumptionProfiles
    .slice()
    .sort((a, b) => (b.consumption_velocity_g_per_day || 0) - (a.consumption_velocity_g_per_day || 0))
    .slice(0, 5)
    .map((p) => ({ canonicalName: p.canonical_name, velocityGramsPerDay: p.consumption_velocity_g_per_day }))

  return {
    pantryDiversityScore: householdProfile?.pantry_diversity_score ?? 0,
    topCategories: householdProfile?.top_categories ?? [],
    preferredShoppingDay: householdProfile?.preferred_shopping_day ?? null,
    mostConsumedIngredients: mostConsumed,
  }
}

// ── 7. Household Trends ────────────────────────────────────────────────────
export function deriveHouseholdTrends(householdProfile, consumptionProfiles = []) {
  const daysSinceLastAnalyzed = householdProfile?.last_analyzed_at
    ? Math.floor((Date.now() - new Date(householdProfile.last_analyzed_at).getTime()) / 86_400_000)
    : null

  return {
    shoppingFrequencyDays: householdProfile?.shopping_frequency_days ?? null,
    totalBillsAnalyzed: householdProfile?.total_bills_analyzed ?? 0,
    daysSinceLastAnalyzed,
    ingredientsWithStableProfile: consumptionProfiles.filter((p) => (p.confidence_score || 0) >= 0.7).length,
    totalTrackedIngredients: consumptionProfiles.length,
  }
}

// ── 8. AI Observation Timeline ─────────────────────────────────────────────
const OBSERVATION_LABELS = {
  NEW_INGREDIENT_DISCOVERED: 'New ingredient',
  UNUSUAL_PURCHASE_QUANTITY: 'Unusual quantity',
  DUPLICATE_PURCHASE: 'Duplicate purchase',
  LOW_STOCK_AFTER_PURCHASE: 'Low stock',
  FIRST_PURCHASE: 'First purchase',
  CATEGORY_GROWTH: 'Category growth',
  PANTRY_DIVERSITY: 'Milestone',
}

export function deriveObservationTimeline(observations = []) {
  return observations.map((o) => ({
    id: o.id,
    type: o.observation_type,
    label: OBSERVATION_LABELS[o.observation_type] || o.observation_type,
    canonicalName: o.canonical_name,
    message: o.details?.message || '',
    createdAt: o.created_at,
  }))
}

// ── 9. Household Snapshot ──────────────────────────────────────────────────
export function deriveHouseholdSnapshot({
  householdName,
  pantryHealth,
  lowStockCount = 0,
  expiryRiskCount = 0,
  shoppingFrequencyDays = null,
  recentlyCookedCount = 0,
} = {}) {
  return {
    householdName: householdName || 'Your Kitchen',
    pantryHealthScore: pantryHealth?.score ?? null,
    pantryHealthLabel: pantryHealth?.label ?? null,
    lowStockCount,
    expiryRiskCount,
    shoppingFrequencyDays,
    recentlyCookedCount,
  }
}

// ── 10. Quick Actions ──────────────────────────────────────────────────────
export function deriveQuickActions({ lowStockCount = 0, expiryRiskCount = 0, readyToCookCount = 0 } = {}) {
  const actions = []
  if (lowStockCount > 0) {
    actions.push({
      id: 'restock',
      label: `Restock ${lowStockCount} low item${lowStockCount === 1 ? '' : 's'}`,
      path: '/scan',
      emoji: '📷',
    })
  }
  if (expiryRiskCount > 0) {
    actions.push({
      id: 'expiry',
      label: `${expiryRiskCount} item${expiryRiskCount === 1 ? '' : 's'} expiring soon`,
      path: '/inventory',
      emoji: '⏳',
    })
  }
  if (readyToCookCount > 0) {
    actions.push({
      id: 'cook',
      label: `${readyToCookCount} recipe${readyToCookCount === 1 ? '' : 's'} ready to cook`,
      path: '/recipes',
      emoji: '🍳',
    })
  }
  actions.push({ id: 'browse', label: 'Browse recipes', path: '/recipes', emoji: '📖' })
  actions.push({ id: 'kitchen', label: 'View kitchen', path: '/inventory', emoji: '🧺' })
  return actions.slice(0, 4)
}
