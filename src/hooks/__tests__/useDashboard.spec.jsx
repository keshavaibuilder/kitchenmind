import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDashboard } from '../useDashboard'

vi.mock('@/store/authStore', () => ({
  default: () => ({ household_id: 'hh_test' }),
}))

vi.mock('@/hooks/useInventory', () => ({
  useInventory: () => ({
    items: [
      { canonical_name: 'Toor Dal', quantity_grams: 1000, low_stock_threshold: 100 },
      { canonical_name: 'Salt', quantity_grams: 20, low_stock_threshold: 50 },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/hooks/useRecipes', () => ({
  useRecipes: () => ({
    recipes: [{ id: 'r1', name: 'Dal Tadka', base_servings: 4, ingredients: [{ canonical_name: 'Toor Dal', base_quantity_grams: 200 }] }],
    isLoading: false,
  }),
  useRecentlyCookedRecipes: () => ({ recipes: [], isLoading: false }),
}))

vi.mock('@/hooks/useMealHistory', () => ({
  useMealHistory: () => ({ mealLogs: [{ cooked_at: '2026-08-01T00:00:00Z' }], isLoading: false }),
}))

vi.mock('@/services/HouseholdService', () => ({
  HouseholdService: { getHouseholdDetails: vi.fn().mockResolvedValue({ name: 'The Sharmas' }) },
}))

// Only the I/O method is mocked — calculatePantryHealthScore stays real, so this test also
// verifies dashboardInsights.js is genuinely reusing PredictionService's own scoring formula.
vi.mock('@/services/PredictionService', async () => {
  const actual = await vi.importActual('@/services/PredictionService')
  return {
    PredictionService: {
      ...actual.PredictionService,
      getHouseholdPredictions: vi.fn().mockResolvedValue([
        { canonical_name: 'Salt', days_until_depletion: 2, is_low_stock_risk: true, predicted_depletion_date: '2026-08-09', confidence_score: 0.8 },
        { canonical_name: 'Toor Dal', days_until_depletion: 20, is_low_stock_risk: false, predicted_depletion_date: '2026-08-27', confidence_score: 0.9 },
      ]),
    },
  }
})

vi.mock('@/services/HouseholdIntelligenceService', () => ({
  HouseholdIntelligenceService: {
    getHouseholdProfile: vi.fn().mockResolvedValue({
      pantry_diversity_score: 5,
      shopping_frequency_days: 7,
      top_categories: [{ category: 'Staples', count: 3 }],
      preferred_shopping_day: 'Sunday',
      total_bills_analyzed: 3,
      last_analyzed_at: '2026-08-01T00:00:00Z',
    }),
  },
}))

vi.mock('@/services/ConsumptionProfileService', () => ({
  ConsumptionProfileService: {
    getAllProfiles: vi.fn().mockResolvedValue([{ canonical_name: 'Toor Dal', confidence_score: 0.9, consumption_velocity_g_per_day: 50 }]),
  },
}))

vi.mock('@/services/InventoryService', () => ({
  InventoryService: { getExpiringBatches: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@/services/AIObservationService', () => ({
  AIObservationService: { getRecentObservations: vi.fn().mockResolvedValue([]) },
}))

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useDashboard', () => {
  it('aggregates every data source into the 10 dashboard modules without extra network calls per item', async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.snapshot.householdName).toBe('The Sharmas')

    // 1 of 2 predictions has >= 7 days remaining -> 50, via the REAL PredictionService formula.
    expect(result.current.pantryHealth.score).toBe(50)

    expect(result.current.lowStock).toHaveLength(1)
    expect(result.current.lowStock[0].canonicalName).toBe('Salt')

    // Toor Dal: recipe needs 200g, inventory has 1000g with a 100g threshold -> ready to cook.
    expect(result.current.cookingSuggestions.readyToCook).toHaveLength(1)

    expect(result.current.pantryInsights.pantryDiversityScore).toBe(5)
    expect(result.current.householdTrends.totalBillsAnalyzed).toBe(3)
    expect(result.current.householdTrends.lastCookedAt).toBe('2026-08-01T00:00:00Z')
    expect(result.current.quickActions.length).toBeGreaterThan(0)
    expect(result.current.isError).toBe(false)
  })
})
