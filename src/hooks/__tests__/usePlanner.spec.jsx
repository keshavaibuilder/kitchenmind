import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePlanner } from '../usePlanner'
import { MealLogService } from '@/services/MealLogService'

vi.mock('@/store/authStore', () => ({
  default: () => ({ household_id: 'hh_test' }),
}))

vi.mock('@/hooks/useInventory', () => ({
  useInventory: () => ({
    items: [{ canonical_name: 'Toor Dal', quantity_grams: 1000, low_stock_threshold: 100 }],
    isLoading: false,
  }),
}))

vi.mock('@/hooks/useMealHistory', () => ({
  useMealHistory: () => ({ mealLogs: [], isLoading: false }),
}))

vi.mock('@/services/RecipeService', async () => {
  const actual = await vi.importActual('@/services/RecipeService')
  return {
    RecipeService: {
      ...actual.RecipeService,
      getRecipes: vi.fn().mockResolvedValue({
        recipes: [
          {
            id: 'r1',
            name: 'Dal Tadka',
            meal_type: 'lunch',
            cuisine: 'North Indian',
            base_servings: 4,
            is_vegetarian: true,
            ingredients: [{ canonical_name: 'Toor Dal', base_quantity_grams: 200 }],
          },
        ],
        hasMore: false,
      }),
    },
  }
})

vi.mock('@/services/MealLogService', () => ({
  MealLogService: {
    getMealLogs: vi.fn().mockResolvedValue([]),
    createMealLog: vi.fn().mockResolvedValue({ id: 'm1', status: 'planned' }),
  },
}))

vi.mock('@/services/HouseholdService', () => ({
  HouseholdService: { getPreferences: vi.fn().mockResolvedValue(null) },
}))

vi.mock('@/services/PredictionService', () => ({
  PredictionService: { getHouseholdPredictions: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@/services/HouseholdIntelligenceService', () => ({
  HouseholdIntelligenceService: { getHouseholdProfile: vi.fn().mockResolvedValue(null) },
}))

vi.mock('@/services/ConsumptionProfileService', () => ({
  ConsumptionProfileService: { getAllProfiles: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@/services/InventoryService', () => ({
  InventoryService: { getExpiringBatches: vi.fn().mockResolvedValue([]) },
}))

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('usePlanner', () => {
  beforeEach(() => vi.clearAllMocks())

  it('aggregates data into today\'s plan, week preview, and shopping suggestions', async () => {
    const { result } = renderHook(() => usePlanner(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.todaysPlan.lunch.status).toBe('suggested')
    expect(result.current.todaysPlan.lunch.suggestion.recipe.name).toBe('Dal Tadka')
    expect(result.current.weekPreview).toHaveLength(7)
    expect(Array.isArray(result.current.shoppingSuggestions)).toBe(true)
    expect(result.current.recipeById.get('r1').name).toBe('Dal Tadka')
  })

  it('accepting a suggestion calls MealLogService.createMealLog with the recipe and meal type', async () => {
    const { result } = renderHook(() => usePlanner(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.acceptSuggestion('lunch', result.current.todaysPlan.lunch.suggestion)
    })

    expect(MealLogService.createMealLog).toHaveBeenCalledWith(
      'hh_test',
      expect.objectContaining({ meal_type: 'lunch', recipe_id: 'r1' })
    )
  })

  it('dismissing a suggestion removes it from the ranked candidates for that slot', async () => {
    const { result } = renderHook(() => usePlanner(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.todaysPlan.lunch.status).toBe('suggested')

    act(() => result.current.dismissSuggestion('lunch', 'r1'))

    await waitFor(() => expect(result.current.todaysPlan.lunch.status).toBe('no_options'))
  })
})
