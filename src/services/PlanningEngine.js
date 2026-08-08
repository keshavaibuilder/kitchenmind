/**
 * PlanningEngine — Smart Meal Planner & Shopping Intelligence (Phase 5B).
 *
 * Deliberately NOT a Supabase-calling "service" like the rest of src/services/ — it is a pure
 * computation module (no I/O), taking data usePlanner.js has already fetched via EXISTING
 * services and deriving meal/shopping suggestions from it. It lives under src/services/ (rather
 * than src/utils/) because the phase brief names it explicitly; internally it follows the exact
 * same "pure derivation over pre-fetched aggregated data" pattern as
 * src/utils/dashboardInsights.js (Phase 5A), and reuses that file directly rather than
 * reimplementing availability/depletion/scoring logic:
 *
 *   - Waste reduction & "no shopping needed" candidates -> dashboardInsights.deriveCookingSuggestions
 *   - Expiring-ingredient awareness                      -> dashboardInsights.deriveExpiryRisk
 *   - Low-stock awareness                                -> dashboardInsights.deriveLowStockPredictions
 *   - Base shopping list (item/quantity/brand/confidence) -> dashboardInsights.deriveShoppingIntelligence
 *   - Ingredient availability math                        -> ingredientAvailability.computeIngredientAvailability
 *   - Recipe scaling                                      -> RecipeService.scaleRecipeIngredients
 *
 * No new scoring/prediction algorithm is introduced for confidence or depletion — every
 * confidence value here is either copied through from an existing prediction/profile row, or
 * derived from a simple, disclosed sample-count heuristic for day-of-week pattern matching
 * (the only genuinely new signal in this file).
 */
import { RecipeService } from './RecipeService.js'
import { computeIngredientAvailability, summarizeAvailability } from '../utils/ingredientAvailability.js'
import {
  deriveCookingSuggestions,
  deriveExpiryRisk,
  deriveLowStockPredictions,
  deriveShoppingIntelligence,
} from '../utils/dashboardInsights.js'
import { WEEKDAYS } from '../utils/formatters.js'

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner']

// ── Date helpers (local to this module — narrow, single-purpose use) ──────
function toDateOnly(d) {
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return toDateOnly(d)
}
function weekdayName(dateStr) {
  return WEEKDAYS[new Date(dateStr).getDay()]
}
function formatDateLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Builds the shared context object every generation function below consumes. Call once per
 * usePlanner render (memoized there) — every field here is data ALREADY fetched by existing
 * services, nothing here performs I/O.
 *
 * @param {Object} raw
 * @param {Array} raw.recipes
 * @param {Array} raw.inventoryItems
 * @param {Array} raw.predictions - prediction_cache rows (PredictionService.getHouseholdPredictions)
 * @param {Array} raw.consumptionProfiles - ConsumptionProfileService.getAllProfiles
 * @param {Array} raw.expiringBatches - InventoryService.getExpiringBatches
 * @param {Object|null} raw.householdProfile - HouseholdIntelligenceService.getHouseholdProfile
 * @param {Object|null} raw.preferences - HouseholdService.getPreferences
 * @param {Array} raw.upcomingMealLogs - MealLogService.getMealLogs for [today, today+6]
 * @param {Array} raw.recentMealLogs - MealLogService.getMealHistory (cooked, recent) — recipes embedded
 * @param {string} [raw.today] - YYYY-MM-DD, defaults to now
 */
export function buildPlanningContext(raw) {
  const today = raw.today || toDateOnly(new Date())
  const expiryRisk = deriveExpiryRisk(raw.expiringBatches || [])
  const lowStock = deriveLowStockPredictions(raw.predictions || [])
  const expiringCanonicalNames = new Set(expiryRisk.map((e) => e.canonicalName.toLowerCase()))
  const lowStockCanonicalNames = new Set(lowStock.map((l) => l.canonicalName.toLowerCase()))
  const recentlyCookedRecipeIds = new Set((raw.recentMealLogs || []).slice(0, 5).map((m) => m.recipe_id).filter(Boolean))

  return {
    today,
    recipes: raw.recipes || [],
    inventoryItems: raw.inventoryItems || [],
    predictions: raw.predictions || [],
    consumptionProfiles: raw.consumptionProfiles || [],
    expiringBatches: raw.expiringBatches || [],
    expiryRisk,
    lowStock,
    expiringCanonicalNames,
    lowStockCanonicalNames,
    householdProfile: raw.householdProfile || null,
    preferences: raw.preferences || null,
    upcomingMealLogs: raw.upcomingMealLogs || [],
    recentMealLogs: raw.recentMealLogs || [],
    recentlyCookedRecipeIds,
  }
}

// ── Preference filtering ───────────────────────────────────────────────────
/**
 * Hard filters only — never a scoring signal, since dietary restrictions aren't negotiable.
 * `non_veg_days` is read as "non-veg is permitted on these days" (empty/unset = no restriction
 * configured, not "always restricted" — the safer default for households that never set this).
 */
export function filterRecipesByPreferences(recipes, preferences, weekday) {
  if (!preferences) return recipes
  const nonVegDays = new Set((preferences.non_veg_days || []).map(String))
  const excludedVeg = new Set((preferences.excluded_vegetables || []).map((v) => String(v).toLowerCase()))
  const nonVegAllowedToday = nonVegDays.size === 0 || nonVegDays.has(weekday)

  return recipes.filter((recipe) => {
    if (recipe.is_vegetarian === false && !nonVegAllowedToday) return false
    if (excludedVeg.size > 0 && Array.isArray(recipe.ingredients)) {
      const hasExcluded = recipe.ingredients.some((ing) => excludedVeg.has((ing.canonical_name || '').toLowerCase()))
      if (hasExcluded) return false
    }
    return true
  })
}

// ── Day-of-week pattern (the one genuinely new heuristic in this file) ────
/**
 * Sample-count-based, same spirit as ConsumptionProfileService's confidence formula (more
 * observations -> higher confidence, capped below 1.0) — not a new kind of model.
 */
function dayOfWeekBoost(recipe, weekday, recentMealLogs) {
  const sameWeekday = recentMealLogs.filter((m) => m.recipe_id && m.cooked_at && weekdayName(m.cooked_at) === weekday)
  const exact = sameWeekday.filter((m) => m.recipe_id === recipe.id)
  const sameCuisine = recipe.cuisine ? sameWeekday.filter((m) => m.recipes?.cuisine === recipe.cuisine) : []

  if (exact.length >= 2) {
    return {
      score: 35,
      confidence: Math.min(0.95, 0.5 + exact.length * 0.15),
      reason: { code: 'DAY_PATTERN', text: `You usually cook ${recipe.name} on ${weekday}s` },
    }
  }
  if (sameCuisine.length >= 2) {
    return {
      score: 15,
      confidence: Math.min(0.85, 0.4 + sameCuisine.length * 0.1),
      reason: { code: 'DAY_PATTERN_CUISINE', text: `You often cook ${recipe.cuisine} food on ${weekday}s` },
    }
  }
  return null
}

// ── Meal candidate scoring ─────────────────────────────────────────────────
/**
 * @returns {{recipe, score, reasons, confidence, availability, availabilitySummary, requiresShopping, missingIngredients}}
 */
export function scoreMealCandidate(recipe, weekday, ctx) {
  const required = RecipeService.scaleRecipeIngredients(recipe, recipe.base_servings)
  const availability = computeIngredientAvailability(required, ctx.inventoryItems)
  const summary = summarizeAvailability(availability)

  let score = 0
  let confidence = 0.5
  const reasons = []

  const usesExpiring = required.filter((r) => ctx.expiringCanonicalNames.has((r.canonical_name || '').toLowerCase()))
  if (usesExpiring.length > 0) {
    score += 50
    confidence = Math.max(confidence, 0.9)
    reasons.push({
      code: 'EXPIRING_INGREDIENT',
      text: `Uses ${usesExpiring.map((u) => u.canonical_name).join(', ')} expiring soon`,
    })
  }

  if (summary.missing === 0 && summary.low === 0) {
    score += 30
    confidence = Math.max(confidence, 0.85)
    reasons.push({ code: 'NO_SHOPPING', text: 'Everything you need is already in stock' })
  } else if (summary.missing > 0 && summary.missing <= 2) {
    score += 10
    reasons.push({ code: 'MINIMAL_SHOPPING', text: `Just needs ${summary.missing} more ingredient${summary.missing === 1 ? '' : 's'}` })
  }

  const pattern = dayOfWeekBoost(recipe, weekday, ctx.recentMealLogs)
  if (pattern) {
    score += pattern.score
    confidence = Math.max(confidence, pattern.confidence)
    reasons.push(pattern.reason)
  }

  if (ctx.recentlyCookedRecipeIds.has(recipe.id)) {
    score -= 40 // variety: deprioritize very recent repeats without hard-excluding them
  }

  if (reasons.length === 0) {
    // Never show an unexplained suggestion — always have a baseline reason.
    reasons.push({ code: 'CANDIDATE_MATCH', text: `Matches your ${recipe.meal_type} recipes` })
  }

  return {
    recipe,
    score,
    reasons,
    confidence,
    availability,
    availabilitySummary: summary,
    requiresShopping: summary.missing > 0 || summary.low > 0,
    missingIngredients: availability.filter((a) => a.status !== 'available'),
  }
}

function rankCandidates(recipes, weekday, ctx, excludeIds = new Set()) {
  return recipes
    .filter((r) => !excludeIds.has(r.id))
    .map((r) => scoreMealCandidate(r, weekday, ctx))
    .sort((a, b) => b.score - a.score)
}

// ── Today's Plan ────────────────────────────────────────────────────────────
/**
 * @param {ReturnType<typeof buildPlanningContext>} ctx
 * @param {{ [mealType: string]: Set<string> }} [excludedByMealType] - recipe ids to skip (dismissed/regenerated this session)
 * @returns {{ [mealType: string]: { status: 'planned'|'cooked'|'skipped'|'suggested'|'no_options', mealLog?, suggestion?, alternates? } }}
 */
export function generateTodaysPlan(ctx, excludedByMealType = {}) {
  const weekday = weekdayName(ctx.today)
  const plan = {}

  for (const mealType of MEAL_SLOTS) {
    const existing = ctx.upcomingMealLogs.find((m) => m.date === ctx.today && m.meal_type === mealType)
    if (existing) {
      plan[mealType] = { status: existing.status, mealLog: existing }
      continue
    }

    const pool = filterRecipesByPreferences(
      ctx.recipes.filter((r) => r.meal_type === mealType),
      ctx.preferences,
      weekday
    )
    const ranked = rankCandidates(pool, weekday, ctx, excludedByMealType[mealType])
    plan[mealType] = ranked.length > 0
      ? { status: 'suggested', suggestion: ranked[0], alternates: ranked.slice(1, 4) }
      : { status: 'no_options' }
  }

  return plan
}

// ── This Week Preview ───────────────────────────────────────────────────────
/**
 * @param {ReturnType<typeof buildPlanningContext>} ctx
 * @param {number} [days=7]
 * @returns {Array<{ date, weekday, dateLabel, meals: { [mealType]: {...} } }>}
 */
export function generateWeekPreview(ctx, days = 7) {
  const usedThisWeek = new Set()
  const weekPlan = []

  for (let i = 0; i < days; i++) {
    const date = addDays(ctx.today, i)
    const weekday = weekdayName(date)
    const dayPlan = { date, weekday, dateLabel: formatDateLabel(date), meals: {} }

    for (const mealType of MEAL_SLOTS) {
      const existing = ctx.upcomingMealLogs.find((m) => m.date === date && m.meal_type === mealType)
      if (existing) {
        dayPlan.meals[mealType] = { status: existing.status, mealLog: existing }
        if (existing.recipe_id) usedThisWeek.add(existing.recipe_id)
        continue
      }

      const pool = filterRecipesByPreferences(
        ctx.recipes.filter((r) => r.meal_type === mealType),
        ctx.preferences,
        weekday
      )
      const ranked = rankCandidates(pool, weekday, ctx)
      // Prefer a recipe not already used elsewhere this week (variety optimization); fall back
      // to the top-ranked one if that's the only option (a small household recipe catalogue
      // shouldn't produce empty slots just to avoid a repeat).
      const fresh = ranked.find((c) => !usedThisWeek.has(c.recipe.id))
      const picked = fresh || ranked[0]

      if (picked) {
        usedThisWeek.add(picked.recipe.id)
        dayPlan.meals[mealType] = { status: 'suggested', suggestion: picked }
      } else {
        dayPlan.meals[mealType] = { status: 'no_options' }
      }
    }

    weekPlan.push(dayPlan)
  }

  return weekPlan
}

// ── Shopping Intelligence ───────────────────────────────────────────────────
function priorityFromDays(days) {
  if (days <= 2) return 'HIGH'
  if (days <= 5) return 'MEDIUM'
  return 'LOW'
}

function buildDepletionReason(canonicalName, daysUntilDepletion) {
  if (daysUntilDepletion <= 0) return `${canonicalName} stock is out or nearly out`
  if (daysUntilDepletion <= 3) return `${canonicalName} stock will run out in ${daysUntilDepletion} day${daysUntilDepletion === 1 ? '' : 's'}`
  return `${canonicalName} stock is sufficient for ${daysUntilDepletion} more days`
}

function buildPurchaseWindow(daysUntilDepletion, shoppingFrequencyDays, today) {
  const freq = shoppingFrequencyDays || 7
  if (daysUntilDepletion <= 2) return { label: 'Buy now', urgent: true }
  if (daysUntilDepletion <= freq) return { label: `Buy by ${formatDateLabel(addDays(today, daysUntilDepletion))}`, urgent: false }
  return { label: 'Can wait until your next regular shop', urgent: false }
}

/**
 * Ingredient gaps for meals already accepted into the plan (status='planned', upcoming) that
 * current inventory can't fully cover. Checked against current stock only, independently per
 * meal — does not simulate inventory being consumed by one planned meal before the next, which
 * would require assuming a cooking order across days that hasn't happened yet; see docs for why
 * this is a disclosed simplification rather than a deeper simulation.
 */
function computePlannedMealGaps(ctx) {
  const gaps = []
  const plannedWithRecipe = ctx.upcomingMealLogs.filter((m) => m.status === 'planned' && m.recipe_id)

  for (const mealLog of plannedWithRecipe) {
    const recipe = ctx.recipes.find((r) => r.id === mealLog.recipe_id)
    if (!recipe) continue
    const required = RecipeService.scaleRecipeIngredients(recipe, mealLog.headcount || recipe.base_servings)
    const availability = computeIngredientAvailability(required, ctx.inventoryItems)

    for (const item of availability) {
      if (item.shortfallGrams > 0 && !item.isOptional) {
        gaps.push({
          canonicalName: item.canonical_name,
          shortfallGrams: item.shortfallGrams,
          forRecipeName: recipe.name,
          forDate: mealLog.date,
        })
      }
    }
  }
  return gaps
}

/**
 * @param {ReturnType<typeof buildPlanningContext>} ctx
 * @returns {Array<{ category, items: Array<{canonicalName, suggestedGrams, reason, confidence, priority, purchaseWindow, preferredBrand}> }>}
 */
export function generateShoppingSuggestions(ctx) {
  const base = deriveShoppingIntelligence(ctx.predictions, ctx.consumptionProfiles, { withinDays: 7 })
  const categoryByName = new Map(ctx.consumptionProfiles.map((p) => [p.canonical_name.toLowerCase(), p.category || 'Miscellaneous']))
  const shoppingFrequencyDays = ctx.householdProfile?.shopping_frequency_days

  const byName = new Map()

  for (const item of base) {
    byName.set(item.canonicalName.toLowerCase(), {
      canonicalName: item.canonicalName,
      suggestedGrams: item.suggestedPurchaseGrams,
      preferredBrand: item.preferredBrand,
      confidence: item.confidence,
      priority: priorityFromDays(item.daysUntilDepletion),
      reason: buildDepletionReason(item.canonicalName, item.daysUntilDepletion),
      purchaseWindow: buildPurchaseWindow(item.daysUntilDepletion, shoppingFrequencyDays, ctx.today),
      category: categoryByName.get(item.canonicalName.toLowerCase()) || 'Miscellaneous',
    })
  }

  for (const gap of computePlannedMealGaps(ctx)) {
    const key = gap.canonicalName.toLowerCase()
    const existing = byName.get(key)
    const reason = `Needed for ${gap.forRecipeName}, planned ${formatDateLabel(gap.forDate)}`
    if (existing) {
      // A planned-meal need reinforces an existing depletion-based suggestion — surface both
      // reasons rather than silently picking one.
      existing.reason = `${existing.reason}; ${reason.toLowerCase()}`
      existing.priority = 'HIGH'
    } else {
      byName.set(key, {
        canonicalName: gap.canonicalName,
        suggestedGrams: gap.shortfallGrams,
        preferredBrand: null,
        confidence: 0.95, // a planned recipe's ingredient list is a fact, not a prediction
        priority: 'HIGH',
        reason,
        purchaseWindow: { label: `Buy before ${formatDateLabel(gap.forDate)}`, urgent: true },
        category: categoryByName.get(key) || 'Miscellaneous',
      })
    }
  }

  const grouped = new Map()
  for (const item of byName.values()) {
    if (!grouped.has(item.category)) grouped.set(item.category, [])
    grouped.get(item.category).push(item)
  }

  const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  return Array.from(grouped.entries())
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]),
    }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

// Re-exported for callers that want the raw Phase 5A waste/no-shopping buckets directly
// (e.g. a "Recipes that reduce food waste" list without the day-of-week ranking above).
export { deriveCookingSuggestions }
