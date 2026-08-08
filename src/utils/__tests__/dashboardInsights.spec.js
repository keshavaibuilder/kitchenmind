import { describe, it, expect } from 'vitest'
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
} from '../dashboardInsights.js'

describe('derivePantryHealth', () => {
  it('reuses PredictionService.calculatePantryHealthScore and labels the result', () => {
    const predictions = [
      { canonical_name: 'Rice', days_until_depletion: 14, is_low_stock_risk: false },
      { canonical_name: 'Onion', days_until_depletion: 10, is_low_stock_risk: false },
      { canonical_name: 'Salt', days_until_depletion: 2, is_low_stock_risk: true },
      { canonical_name: 'Oil', days_until_depletion: 8, is_low_stock_risk: false },
    ]
    // 3 of 4 have >= 7 days remaining -> score 75, matching PredictionService's own formula.
    const result = derivePantryHealth(predictions)
    expect(result.score).toBe(75)
    expect(result.label).toBe('OK')
    expect(result.trackedIngredients).toBe(4)
    expect(result.atRiskCount).toBe(1)
  })

  it('labels a perfect score Great and an empty pantry as fully healthy (100)', () => {
    expect(derivePantryHealth([]).score).toBe(100)
    expect(derivePantryHealth([]).label).toBe('Great')
  })

  it('labels a low score Needs attention', () => {
    const predictions = [{ canonical_name: 'Salt', days_until_depletion: 1, is_low_stock_risk: true }]
    expect(derivePantryHealth(predictions).label).toBe('Needs attention')
  })
})

describe('deriveLowStockPredictions', () => {
  it('filters to only at-risk items, sorted soonest-first', () => {
    const predictions = [
      { canonical_name: 'Rice', days_until_depletion: 14, is_low_stock_risk: false },
      { canonical_name: 'Salt', days_until_depletion: 2, is_low_stock_risk: true, predicted_depletion_date: '2026-08-09', confidence_score: 0.8 },
      { canonical_name: 'Oil', days_until_depletion: 1, is_low_stock_risk: true, predicted_depletion_date: '2026-08-08', confidence_score: 0.7 },
    ]
    const result = deriveLowStockPredictions(predictions)
    expect(result.map((r) => r.canonicalName)).toEqual(['Oil', 'Salt'])
    expect(result[0].daysUntilDepletion).toBe(1)
  })

  it('returns an empty array when nothing is at risk', () => {
    expect(deriveLowStockPredictions([{ canonical_name: 'Rice', days_until_depletion: 20, is_low_stock_risk: false }])).toEqual([])
  })
})

describe('deriveExpiryRisk', () => {
  it('computes days until expiry and flags already-expired batches', () => {
    const today = new Date()
    const in3Days = new Date(today)
    in3Days.setDate(today.getDate() + 3)
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    const batches = [
      { id: 'b1', remaining_grams: 200, expiry_date: in3Days.toISOString().slice(0, 10), inventory: { canonical_name: 'Milk', category: 'Dairy' } },
      { id: 'b2', remaining_grams: 100, expiry_date: yesterday.toISOString().slice(0, 10), inventory: { canonical_name: 'Curd', category: 'Dairy' } },
    ]
    const result = deriveExpiryRisk(batches)
    // Sorted soonest/most-overdue first.
    expect(result[0].canonicalName).toBe('Curd')
    expect(result[0].isExpired).toBe(true)
    expect(result[1].canonicalName).toBe('Milk')
    expect(result[1].isExpired).toBe(false)
    expect(result[1].daysUntilExpiry).toBe(3)
  })

  it('returns an empty array (an honest "no data" state) when no batches are passed', () => {
    expect(deriveExpiryRisk([])).toEqual([])
  })
})

describe('deriveShoppingIntelligence', () => {
  it('enriches near-depletion predictions with consumption profile detail', () => {
    const predictions = [
      { canonical_name: 'Rice', days_until_depletion: 3, confidence_score: 0.8 },
      { canonical_name: 'Spices', days_until_depletion: 20, confidence_score: 0.5 },
    ]
    const profiles = [{ canonical_name: 'Rice', avg_purchase_grams: 1000, preferred_brand: 'India Gate' }]

    const result = deriveShoppingIntelligence(predictions, profiles, { withinDays: 5 })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ canonicalName: 'Rice', suggestedPurchaseGrams: 1000, preferredBrand: 'India Gate' })
  })

  it('falls back to nulls when no consumption profile exists for a near-depletion ingredient', () => {
    const result = deriveShoppingIntelligence([{ canonical_name: 'Ghee', days_until_depletion: 1, confidence_score: 0.6 }], [])
    expect(result[0].suggestedPurchaseGrams).toBeNull()
    expect(result[0].preferredBrand).toBeNull()
  })
})

describe('deriveCookingSuggestions', () => {
  const recipe = (overrides) => ({
    id: 'r1',
    name: 'Dal Tadka',
    base_servings: 4,
    ingredients: [{ canonical_name: 'Toor Dal', base_quantity_grams: 200 }],
    ...overrides,
  })

  it('buckets a recipe as ready-to-cook when inventory fully covers its base ingredients', () => {
    const result = deriveCookingSuggestions([recipe()], [{ canonical_name: 'Toor Dal', quantity_grams: 1000, low_stock_threshold: 100 }], [])
    expect(result.readyToCook).toHaveLength(1)
    expect(result.readyToCook[0].recipe.name).toBe('Dal Tadka')
  })

  it('does not bucket a recipe as ready-to-cook when an ingredient is missing', () => {
    const result = deriveCookingSuggestions([recipe()], [], [])
    expect(result.readyToCook).toHaveLength(0)
  })

  it('buckets a recipe under useItUp when it references an at-risk ingredient, regardless of stock', () => {
    const result = deriveCookingSuggestions([recipe()], [], ['Toor Dal'])
    expect(result.useItUp).toHaveLength(1)
  })

  it('skips recipes with no ingredients', () => {
    const result = deriveCookingSuggestions([recipe({ ingredients: [] })], [], [])
    expect(result.readyToCook).toHaveLength(0)
    expect(result.useItUp).toHaveLength(0)
  })
})

describe('derivePantryInsights', () => {
  it('reads diversity/categories/shopping-day straight from the household profile', () => {
    const profile = { pantry_diversity_score: 12, top_categories: [{ category: 'Staples', count: 5 }], preferred_shopping_day: 'Sunday' }
    const result = derivePantryInsights(profile, [{ canonical_name: 'Milk', consumption_velocity_g_per_day: 200 }])
    expect(result.pantryDiversityScore).toBe(12)
    expect(result.preferredShoppingDay).toBe('Sunday')
    expect(result.mostConsumedIngredients[0].canonicalName).toBe('Milk')
  })

  it('degrades to sensible defaults when there is no household profile yet', () => {
    const result = derivePantryInsights(null, [])
    expect(result.pantryDiversityScore).toBe(0)
    expect(result.topCategories).toEqual([])
  })
})

describe('deriveHouseholdTrends', () => {
  it('counts ingredients with a confidence-score >= 0.7 as "stable"', () => {
    const profiles = [
      { canonical_name: 'Rice', confidence_score: 0.9 },
      { canonical_name: 'Salt', confidence_score: 0.4 },
    ]
    const result = deriveHouseholdTrends({ shopping_frequency_days: 6.5, total_bills_analyzed: 10 }, profiles)
    expect(result.ingredientsWithStableProfile).toBe(1)
    expect(result.totalTrackedIngredients).toBe(2)
    expect(result.shoppingFrequencyDays).toBe(6.5)
  })
})

describe('deriveObservationTimeline', () => {
  it('maps raw ai_observations rows to display-ready entries', () => {
    const result = deriveObservationTimeline([
      { id: 'o1', observation_type: 'NEW_INGREDIENT_DISCOVERED', canonical_name: 'Paneer', details: { message: 'New ingredient "Paneer"' }, created_at: '2026-08-01T00:00:00Z' },
    ])
    expect(result[0]).toMatchObject({ id: 'o1', label: 'New ingredient', canonicalName: 'Paneer', message: 'New ingredient "Paneer"' })
  })

  it('falls back to the raw type as the label for an unrecognized observation type', () => {
    const result = deriveObservationTimeline([{ id: 'o2', observation_type: 'SOMETHING_NEW', details: {}, created_at: '2026-08-01T00:00:00Z' }])
    expect(result[0].label).toBe('SOMETHING_NEW')
  })
})

describe('deriveHouseholdSnapshot', () => {
  it('composes a compact summary from already-derived module data', () => {
    const result = deriveHouseholdSnapshot({
      householdName: 'The Sharmas',
      pantryHealth: { score: 82, label: 'Great' },
      lowStockCount: 2,
      expiryRiskCount: 1,
      shoppingFrequencyDays: 7,
      recentlyCookedCount: 3,
    })
    expect(result).toMatchObject({
      householdName: 'The Sharmas',
      pantryHealthScore: 82,
      pantryHealthLabel: 'Great',
      lowStockCount: 2,
      expiryRiskCount: 1,
    })
  })

  it('falls back to a generic household name when none is available', () => {
    expect(deriveHouseholdSnapshot({}).householdName).toBe('Your Kitchen')
  })
})

describe('deriveQuickActions', () => {
  it('prioritizes restock/expiry/cook actions when applicable, then fills remaining slots with fallback actions up to the cap of 4', () => {
    const actions = deriveQuickActions({ lowStockCount: 2, expiryRiskCount: 1, readyToCookCount: 3 })
    // restock, expiry, cook are all applicable (3 items) + one fallback slot filled by "browse" before the 4-item cap.
    expect(actions.map((a) => a.id)).toEqual(['restock', 'expiry', 'cook', 'browse'])
  })

  it('falls back to generic actions when nothing is actionable', () => {
    const actions = deriveQuickActions({})
    expect(actions.map((a) => a.id)).toEqual(['browse', 'kitchen'])
  })

  it('caps the action list at 4', () => {
    const actions = deriveQuickActions({ lowStockCount: 1, expiryRiskCount: 1, readyToCookCount: 1 })
    expect(actions.length).toBeLessThanOrEqual(4)
  })
})
