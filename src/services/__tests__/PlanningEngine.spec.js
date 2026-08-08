import { describe, it, expect } from 'vitest'
import {
  buildPlanningContext,
  filterRecipesByPreferences,
  scoreMealCandidate,
  generateTodaysPlan,
  generateWeekPreview,
  generateShoppingSuggestions,
} from '../PlanningEngine.js'

// Computed the same way the module itself derives a weekday name, so these tests are correct
// regardless of the test runner's system timezone (new Date('YYYY-MM-DD').getDay() is a UTC
// parse read back in local time — a pre-existing, codebase-wide convention, e.g.
// HouseholdIntelligenceService — not something reintroduced or newly relied on here).
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function weekdayOf(dateStr) {
  return WEEKDAYS[new Date(dateStr).getDay()]
}

const TODAY = '2026-08-10'
const TODAY_WEEKDAY = weekdayOf(TODAY)

function recipe(overrides) {
  return {
    id: 'r1',
    name: 'Dal Tadka',
    meal_type: 'lunch',
    cuisine: 'North Indian',
    base_servings: 4,
    is_vegetarian: true,
    ingredients: [{ canonical_name: 'Toor Dal', base_quantity_grams: 200 }],
    ...overrides,
  }
}

describe('filterRecipesByPreferences', () => {
  it('passes everything through when there are no preferences', () => {
    const recipes = [recipe({ is_vegetarian: false })]
    expect(filterRecipesByPreferences(recipes, null, TODAY_WEEKDAY)).toHaveLength(1)
  })

  it('treats an empty non_veg_days as "no restriction configured", not "always restricted"', () => {
    const recipes = [recipe({ is_vegetarian: false })]
    expect(filterRecipesByPreferences(recipes, { non_veg_days: [] }, TODAY_WEEKDAY)).toHaveLength(1)
  })

  it('excludes non-vegetarian recipes on a day not listed in non_veg_days', () => {
    const otherDay = WEEKDAYS.find((d) => d !== TODAY_WEEKDAY)
    const recipes = [recipe({ id: 'nonveg', is_vegetarian: false }), recipe({ id: 'veg', is_vegetarian: true })]
    const result = filterRecipesByPreferences(recipes, { non_veg_days: [otherDay] }, TODAY_WEEKDAY)
    expect(result.map((r) => r.id)).toEqual(['veg'])
  })

  it('allows non-vegetarian recipes on a listed non_veg_day', () => {
    const recipes = [recipe({ id: 'nonveg', is_vegetarian: false })]
    const result = filterRecipesByPreferences(recipes, { non_veg_days: [TODAY_WEEKDAY] }, TODAY_WEEKDAY)
    expect(result).toHaveLength(1)
  })

  it('excludes recipes containing an excluded vegetable', () => {
    const recipes = [
      recipe({ id: 'has-brinjal', ingredients: [{ canonical_name: 'Brinjal', base_quantity_grams: 200 }] }),
      recipe({ id: 'no-brinjal', ingredients: [{ canonical_name: 'Toor Dal', base_quantity_grams: 200 }] }),
    ]
    const result = filterRecipesByPreferences(recipes, { excluded_vegetables: ['Brinjal'] }, TODAY_WEEKDAY)
    expect(result.map((r) => r.id)).toEqual(['no-brinjal'])
  })
})

describe('scoreMealCandidate', () => {
  it('boosts and explains a recipe that uses an expiring ingredient', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      inventoryItems: [{ canonical_name: 'Toor Dal', quantity_grams: 1000, low_stock_threshold: 100 }],
      expiringBatches: [{ id: 'b1', remaining_grams: 200, expiry_date: '2026-08-11', inventory: { canonical_name: 'Toor Dal', category: 'Staples' } }],
    })
    const result = scoreMealCandidate(recipe(), TODAY_WEEKDAY, ctx)
    expect(result.reasons.some((r) => r.code === 'EXPIRING_INGREDIENT')).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('explains a fully-stocked recipe as needing no shopping', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      inventoryItems: [{ canonical_name: 'Toor Dal', quantity_grams: 1000, low_stock_threshold: 100 }],
    })
    const result = scoreMealCandidate(recipe(), TODAY_WEEKDAY, ctx)
    expect(result.reasons.some((r) => r.code === 'NO_SHOPPING')).toBe(true)
    expect(result.requiresShopping).toBe(false)
  })

  it('explains a recipe missing ingredients as needing minimal or unspecified shopping, never silently', () => {
    const ctx = buildPlanningContext({ today: TODAY, inventoryItems: [] })
    const result = scoreMealCandidate(recipe(), TODAY_WEEKDAY, ctx)
    expect(result.requiresShopping).toBe(true)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('recognizes a day-of-week cooking pattern from meal history', () => {
    const recentMealLogs = [
      { recipe_id: 'r1', cooked_at: `${TODAY}T12:00:00Z`, recipes: { cuisine: 'North Indian' } },
      { recipe_id: 'r1', cooked_at: addWeeks(TODAY, -1), recipes: { cuisine: 'North Indian' } },
    ]
    const ctx = buildPlanningContext({ today: TODAY, inventoryItems: [], recentMealLogs })
    const result = scoreMealCandidate(recipe({ id: 'r1' }), TODAY_WEEKDAY, ctx)
    expect(result.reasons.some((r) => r.code === 'DAY_PATTERN')).toBe(true)
  })

  it('never returns a suggestion with zero reasons', () => {
    const ctx = buildPlanningContext({ today: TODAY, inventoryItems: [] })
    const result = scoreMealCandidate(recipe({ ingredients: [] }), TODAY_WEEKDAY, ctx)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('deprioritizes (lower score) a recipe cooked very recently, without excluding it outright', () => {
    const ctx = buildPlanningContext({ today: TODAY, inventoryItems: [], recentMealLogs: [] })
    const freshScore = scoreMealCandidate(recipe({ id: 'fresh' }), TODAY_WEEKDAY, ctx).score

    const ctxWithRecent = buildPlanningContext({
      today: TODAY,
      inventoryItems: [],
      recentMealLogs: [{ recipe_id: 'repeat', cooked_at: `${TODAY}T08:00:00Z` }],
    })
    const repeatScore = scoreMealCandidate(recipe({ id: 'repeat' }), TODAY_WEEKDAY, ctxWithRecent).score
    expect(repeatScore).toBeLessThan(freshScore)
  })
})

function addWeeks(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n * 7)
  return d.toISOString()
}

describe('generateTodaysPlan', () => {
  it('passes through an already-planned or cooked meal instead of generating a new suggestion', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      recipes: [recipe({ meal_type: 'lunch' })],
      inventoryItems: [],
      upcomingMealLogs: [{ id: 'm1', date: TODAY, meal_type: 'lunch', recipe_id: 'r1', status: 'planned' }],
    })
    const plan = generateTodaysPlan(ctx)
    expect(plan.lunch).toMatchObject({ status: 'planned' })
  })

  it('generates a ranked suggestion when nothing is planned yet', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      recipes: [recipe({ meal_type: 'lunch' })],
      inventoryItems: [{ canonical_name: 'Toor Dal', quantity_grams: 1000, low_stock_threshold: 100 }],
    })
    const plan = generateTodaysPlan(ctx)
    expect(plan.lunch.status).toBe('suggested')
    expect(plan.lunch.suggestion.recipe.id).toBe('r1')
  })

  it('reports no_options when no candidate recipes exist for a slot', () => {
    const ctx = buildPlanningContext({ today: TODAY, recipes: [], inventoryItems: [] })
    const plan = generateTodaysPlan(ctx)
    expect(plan.breakfast.status).toBe('no_options')
  })

  it('excludes a dismissed/regenerated recipe id from the ranking', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      recipes: [recipe({ id: 'r1', meal_type: 'lunch' }), recipe({ id: 'r2', meal_type: 'lunch', name: 'Rajma' })],
      inventoryItems: [],
    })
    const plan = generateTodaysPlan(ctx, { lunch: new Set(['r1']) })
    expect(plan.lunch.suggestion.recipe.id).toBe('r2')
  })

  it('applies dietary preferences to suggestions, not just to already-planned meals', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      recipes: [recipe({ id: 'nonveg', meal_type: 'lunch', is_vegetarian: false })],
      inventoryItems: [],
      preferences: { non_veg_days: [WEEKDAYS.find((d) => d !== TODAY_WEEKDAY)] },
    })
    const plan = generateTodaysPlan(ctx)
    expect(plan.lunch.status).toBe('no_options')
  })
})

describe('generateWeekPreview', () => {
  it('optimizes for variety: does not repeat the same recipe every day when an alternative exists', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      recipes: [recipe({ id: 'a', meal_type: 'lunch', name: 'Dal' }), recipe({ id: 'b', meal_type: 'lunch', name: 'Rajma' })],
      inventoryItems: [],
    })
    const week = generateWeekPreview(ctx, 3)
    const lunchPicks = week.map((d) => d.meals.lunch.suggestion?.recipe.id)
    expect(new Set(lunchPicks).size).toBeGreaterThan(1)
  })

  it('passes through already-planned meals within the week window', () => {
    const futureDate = '2026-08-12'
    const ctx = buildPlanningContext({
      today: TODAY,
      recipes: [recipe({ meal_type: 'dinner' })],
      inventoryItems: [],
      upcomingMealLogs: [{ id: 'm1', date: futureDate, meal_type: 'dinner', recipe_id: 'r1', status: 'planned' }],
    })
    const week = generateWeekPreview(ctx, 7)
    const day = week.find((d) => d.date === futureDate)
    expect(day.meals.dinner.status).toBe('planned')
  })
})

describe('generateShoppingSuggestions', () => {
  it('explains depletion-based suggestions with a days-remaining reason, priority, and purchase window', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      predictions: [{ canonical_name: 'Rice', days_until_depletion: 5, is_low_stock_risk: false, confidence_score: 0.8 }],
      consumptionProfiles: [{ canonical_name: 'Rice', category: 'Staples', avg_purchase_grams: 1000, preferred_brand: 'India Gate' }],
    })
    const grouped = generateShoppingSuggestions(ctx)
    const staples = grouped.find((g) => g.category === 'Staples')
    expect(staples.items[0]).toMatchObject({ canonicalName: 'Rice', priority: 'MEDIUM' })
    expect(staples.items[0].reason).toMatch(/5 more days/)
  })

  it('marks urgent items (<=2 days) as HIGH priority with a "buy now" window', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      predictions: [{ canonical_name: 'Onion', days_until_depletion: 1, is_low_stock_risk: true, confidence_score: 0.9 }],
      consumptionProfiles: [{ canonical_name: 'Onion', category: 'Fresh & Vegetables' }],
    })
    const grouped = generateShoppingSuggestions(ctx)
    const item = grouped.find((g) => g.category === 'Fresh & Vegetables').items[0]
    expect(item.priority).toBe('HIGH')
    expect(item.purchaseWindow.urgent).toBe(true)
  })

  it('adds a HIGH-priority entry for an ingredient a planned meal needs that inventory cannot cover', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      recipes: [recipe({ id: 'r1', ingredients: [{ canonical_name: 'Toor Dal', base_quantity_grams: 500 }] })],
      inventoryItems: [],
      upcomingMealLogs: [{ id: 'm1', date: TODAY, meal_type: 'lunch', recipe_id: 'r1', status: 'planned', headcount: 4 }],
    })
    const grouped = generateShoppingSuggestions(ctx)
    const item = grouped.flatMap((g) => g.items).find((i) => i.canonicalName === 'Toor Dal')
    expect(item.priority).toBe('HIGH')
    expect(item.reason).toMatch(/Needed for/)
  })

  it('merges a planned-meal need into an existing depletion-based suggestion rather than duplicating it', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      recipes: [recipe({ id: 'r1', ingredients: [{ canonical_name: 'Toor Dal', base_quantity_grams: 500 }] })],
      inventoryItems: [],
      predictions: [{ canonical_name: 'Toor Dal', days_until_depletion: 4, is_low_stock_risk: false, confidence_score: 0.7 }],
      consumptionProfiles: [{ canonical_name: 'Toor Dal', category: 'Staples' }],
      upcomingMealLogs: [{ id: 'm1', date: TODAY, meal_type: 'lunch', recipe_id: 'r1', status: 'planned', headcount: 4 }],
    })
    const grouped = generateShoppingSuggestions(ctx)
    const matches = grouped.flatMap((g) => g.items).filter((i) => i.canonicalName === 'Toor Dal')
    expect(matches).toHaveLength(1)
    expect(matches[0].priority).toBe('HIGH')
  })

  it('groups items by category, sorted alphabetically, with HIGH-priority items first within a group', () => {
    const ctx = buildPlanningContext({
      today: TODAY,
      predictions: [
        // 6 days: LOW priority (>5d) but still inside deriveShoppingIntelligence's 7-day window —
        // a value >7 would be silently excluded from the base list entirely, not just deprioritized.
        { canonical_name: 'Salt', days_until_depletion: 6, is_low_stock_risk: false, confidence_score: 0.6 },
        { canonical_name: 'Onion', days_until_depletion: 1, is_low_stock_risk: true, confidence_score: 0.9 },
      ],
      consumptionProfiles: [
        { canonical_name: 'Salt', category: 'Staples' },
        { canonical_name: 'Onion', category: 'Staples' },
      ],
    })
    const grouped = generateShoppingSuggestions(ctx)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].items.map((i) => i.canonicalName)).toEqual(['Onion', 'Salt'])
  })
})
