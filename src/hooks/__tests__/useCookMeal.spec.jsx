import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCookMeal } from '../useCookMeal'
import { MealLogService } from '@/services/MealLogService'

vi.mock('@/store/authStore', () => ({
  default: () => ({ household_id: 'hh_test' }),
}))

vi.mock('@/hooks/useInventory', () => ({
  useInventory: () => ({
    items: [
      { canonical_name: 'Toor Dal', quantity_grams: 500, low_stock_threshold: 100 },
      { canonical_name: 'Onion', quantity_grams: 50, low_stock_threshold: 20 },
    ],
  }),
}))

vi.mock('@/services/HouseholdService', () => ({
  HouseholdService: {
    getMembers: vi.fn().mockResolvedValue([{ role: 'adult' }, { role: 'child' }]),
    getHouseholdDetails: vi.fn().mockResolvedValue({ roti_per_adult: 3, roti_per_child: 2 }),
  },
}))

vi.mock('@/services/MealLogService', () => ({
  MealLogService: {
    cookRecipeNow: vi.fn(),
  },
}))

const recipe = {
  id: 'r1',
  name: 'Dal Tadka',
  meal_type: 'lunch',
  base_servings: 4,
  ingredients: [
    { canonical_name: 'Toor Dal', base_quantity_grams: 200 },
    { canonical_name: 'Onion', base_quantity_grams: 100 },
  ],
}

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useCookMeal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MealLogService.cookRecipeNow.mockResolvedValue({ success: true, alreadyCooked: false, hasShortfall: false, deductions: [] })
  })

  it('scales recipe ingredients and computes availability against real inventory', () => {
    const { result } = renderHook(() => useCookMeal(recipe), { wrapper })

    expect(result.current.scaledIngredients).toEqual([
      { canonical_name: 'Toor Dal', quantity_grams: 200, is_optional: false },
      { canonical_name: 'Onion', quantity_grams: 100, is_optional: false },
    ])
    // Onion: need 100g, have 50g -> some stock but insufficient for the recipe, so 'low' (not
    // 'missing' — that status is reserved for zero stock, see ingredientAvailability.js).
    expect(result.current.availability.find((a) => a.canonical_name === 'Onion').status).toBe('low')
    // Toor Dal: need 200g, have 500g, threshold 100g -> comfortably available
    expect(result.current.availability.find((a) => a.canonical_name === 'Toor Dal').status).toBe('available')
  })

  it('recalculates scaled ingredients when servings changes', () => {
    const { result } = renderHook(() => useCookMeal(recipe), { wrapper })

    act(() => result.current.setServings(8)) // 2x base_servings of 4
    expect(result.current.scaledIngredients).toEqual([
      { canonical_name: 'Toor Dal', quantity_grams: 400, is_optional: false },
      { canonical_name: 'Onion', quantity_grams: 200, is_optional: false },
    ])
  })

  it('adds roti flour to required ingredients only once includeRoti is toggled on', async () => {
    const { result } = renderHook(() => useCookMeal(recipe), { wrapper })

    expect(result.current.requiredIngredients.some((i) => i.canonical_name === 'Wheat Flour')).toBe(false)

    act(() => result.current.setIncludeRoti(true))
    await waitFor(() => expect(result.current.rotiRequirement).not.toBeNull())

    // 1 adult (3 rotis) + 1 child (2 rotis) = 5 rotis, matching household defaults from the mock.
    expect(result.current.rotiRequirement.totalRotis).toBe(5)
    expect(result.current.requiredIngredients.some((i) => i.canonical_name === 'Wheat Flour')).toBe(true)
  })

  it('calls MealLogService.cookRecipeNow with the current household, recipe, and servings', async () => {
    const { result } = renderHook(() => useCookMeal(recipe), { wrapper })

    await act(async () => {
      await result.current.cookNow()
    })

    expect(MealLogService.cookRecipeNow).toHaveBeenCalledWith(
      'hh_test',
      expect.objectContaining({ recipeId: 'r1', mealType: 'lunch', servings: 4 })
    )
  })

  it('surfaces a rejected cook as cookError rather than throwing out of the hook', async () => {
    MealLogService.cookRecipeNow.mockRejectedValue(new Error('RPC failed'))
    const { result } = renderHook(() => useCookMeal(recipe), { wrapper })

    await act(async () => {
      await result.current.cookNow().catch(() => {})
    })

    await waitFor(() => expect(result.current.cookError).toBeTruthy())
  })
})
