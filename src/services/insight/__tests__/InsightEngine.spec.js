import { describe, it, expect } from 'vitest'
import { InsightEngine } from '../InsightEngine.js'
import { INSIGHT_TYPES, MIN_CONFIDENCE_THRESHOLD } from '../insightRegistry.js'

describe('InsightEngine (Sprint 7B Validation Suite)', () => {
  const householdId = 'hh-test-validation'
  const todayStr = new Date().toISOString().slice(0, 10)

  it('returns empty array when householdId is missing', () => {
    const res = InsightEngine.generateInsights({})
    expect(res).toEqual([])
  })

  it('Scenario 1: Low Stock generates LOW_STOCK insight when below threshold', () => {
    const pantryItems = [
      { canonical_name: 'Olive Oil', quantity_grams: 150, low_stock_threshold: 200 },
    ]

    const res = InsightEngine.generateInsights({
      householdId,
      pantryItems,
      mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
    })

    const lowStockInsight = res.find((i) => i.insight_type === INSIGHT_TYPES.LOW_STOCK.type)
    expect(lowStockInsight).toBeDefined()
    expect(lowStockInsight.title).toContain('Olive Oil')
    expect(lowStockInsight.severity).toBe('warning')
    expect(lowStockInsight.confidence.score).toBeGreaterThanOrEqual(MIN_CONFIDENCE_THRESHOLD)
  })

  it('Scenario 2: Predicted Depletion generates LIKELY_DEPLETION insight', () => {
    const predictions = [
      {
        canonical_name: 'Basmati Rice',
        is_low_stock_risk: true,
        days_until_depletion: 2,
        predicted_depletion_date: '2026-08-13',
        confidence_score: 0.88,
      },
    ]

    const res = InsightEngine.generateInsights({
      householdId,
      predictions,
      mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
    })

    const depletionInsight = res.find((i) => i.insight_type === INSIGHT_TYPES.LIKELY_DEPLETION.type)
    expect(depletionInsight).toBeDefined()
    expect(depletionInsight.title).toContain('Basmati Rice')
    expect(depletionInsight.severity).toBe('critical')
  })

  it('Scenario 3: Ingredient Nearing Expiry generates USE_SOON insight', () => {
    const expiringBatches = [
      {
        id: 'batch-99',
        expiry_date: todayStr,
        remaining_grams: 500,
        inventory: { canonical_name: 'Milk', category: 'Dairy' },
      },
    ]

    const res = InsightEngine.generateInsights({
      householdId,
      expiringBatches,
      mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
    })

    const useSoon = res.find((i) => i.insight_type === INSIGHT_TYPES.USE_SOON.type)
    expect(useSoon).toBeDefined()
    expect(useSoon.evidence[0].source).toBe('pantry_batch')
  })

  it('Scenario 4: Dinner Not Planned generates DINNER_NOT_PLANNED insight', () => {
    const res = InsightEngine.generateInsights({
      householdId,
      mealLogs: [],
    })

    const dinnerInsight = res.find((i) => i.insight_type === INSIGHT_TYPES.DINNER_NOT_PLANNED.type)
    expect(dinnerInsight).toBeDefined()
    expect(dinnerInsight.title).toContain("Tonight's dinner")
  })

  it('Scenario 5: Ingredients Available generates INGREDIENTS_AVAILABLE_FOR_MEAL insight', () => {
    const recipes = [
      {
        id: 'rec-1',
        name: 'Paneer Butter Masala',
        base_servings: 2,
        ingredients: [
          { canonical_name: 'paneer', base_quantity_grams: 200 },
          { canonical_name: 'butter', base_quantity_grams: 50 },
        ],
      },
    ]
    const pantryItems = [
      { canonical_name: 'paneer', quantity_grams: 400 },
      { canonical_name: 'butter', quantity_grams: 100 },
    ]

    const res = InsightEngine.generateInsights({
      householdId,
      recipes,
      pantryItems,
      mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
    })

    const readyRecipeInsight = res.find(
      (i) => i.insight_type === INSIGHT_TYPES.INGREDIENTS_AVAILABLE_FOR_MEAL.type
    )
    expect(readyRecipeInsight).toBeDefined()
    expect(readyRecipeInsight.suggested_next_step.actionProposal.capabilityId).toBe('planner.add_meal')
  })

  it('Scenario 6: Shopping Gap generates SHOPPING_GAP insight when 3+ items low stock', () => {
    const predictions = [
      { canonical_name: 'Rice', is_low_stock_risk: true, days_until_depletion: 2 },
      { canonical_name: 'Wheat', is_low_stock_risk: true, days_until_depletion: 1 },
      { canonical_name: 'Sugar', is_low_stock_risk: true, days_until_depletion: 3 },
    ]

    const res = InsightEngine.generateInsights({
      householdId,
      predictions,
      mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
    })

    const gapInsight = res.find((i) => i.insight_type === INSIGHT_TYPES.SHOPPING_GAP.type)
    expect(gapInsight).toBeDefined()
  })

  it('Scenario 7: New Ingredient Discovered generates PANTRY_DIVERSITY_CHANGE insight', () => {
    const observations = [
      { id: 'obs-1', observation_type: 'NEW_INGREDIENT_DISCOVERED', canonical_name: 'Tofu' },
    ]

    const res = InsightEngine.generateInsights({
      householdId,
      observations,
      mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
    })

    const diversityInsight = res.find(
      (i) => i.insight_type === INSIGHT_TYPES.PANTRY_DIVERSITY_CHANGE.type
    )
    expect(diversityInsight).toBeDefined()
    expect(diversityInsight.title).toContain('Tofu')
  })

  // False Positive Scenarios
  describe('False Positive Testing (System Remains Silent)', () => {
    it('remains silent when dinner is already planned', () => {
      const res = InsightEngine.generateInsights({
        householdId,
        mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
      })

      const dinnerInsight = res.find((i) => i.insight_type === INSIGHT_TYPES.DINNER_NOT_PLANNED.type)
      expect(dinnerInsight).toBeUndefined()
    })

    it('remains silent when stock is sufficient and predictions have zero risk', () => {
      const pantryItems = [{ canonical_name: 'Rice', quantity_grams: 5000, low_stock_threshold: 500 }]
      const predictions = [
        { canonical_name: 'Rice', is_low_stock_risk: false, days_until_depletion: 45, confidence_score: 0.9 },
      ]

      const res = InsightEngine.generateInsights({
        householdId,
        pantryItems,
        predictions,
        mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
      })

      const depletionInsight = res.find((i) => i.insight_type === INSIGHT_TYPES.LIKELY_DEPLETION.type)
      const lowStockInsight = res.find((i) => i.insight_type === INSIGHT_TYPES.LOW_STOCK.type)
      expect(depletionInsight).toBeUndefined()
      expect(lowStockInsight).toBeUndefined()
    })

    it('suppresses insights with confidence score below threshold floor (0.60)', () => {
      const predictions = [
        {
          canonical_name: 'Spice X',
          is_low_stock_risk: true,
          days_until_depletion: 2,
          confidence_score: 0.40, // Below 0.60
        },
      ]

      const res = InsightEngine.generateInsights({
        householdId,
        predictions,
        mealLogs: [{ date: todayStr, meal_type: 'dinner', status: 'planned' }],
      })

      const lowConfInsight = res.find((i) => i.related_entities?.canonicalName === 'Spice X')
      expect(lowConfInsight).toBeUndefined()
    })
  })
})
