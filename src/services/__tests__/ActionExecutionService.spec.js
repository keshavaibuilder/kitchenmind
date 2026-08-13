import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActionExecutionService } from '../ActionExecutionService.js'
import { MealLogService } from '../MealLogService.js'
import { InventoryService } from '../InventoryService.js'

vi.mock('../MealLogService.js', () => ({
  MealLogService: {
    markAsCooked: vi.fn(),
    cookRecipeNow: vi.fn(),
    createMealLog: vi.fn(),
  },
}))

vi.mock('../InventoryService.js', () => ({
  InventoryService: {
    addOrUpdateItem: vi.fn(),
  },
}))

describe('ActionExecutionService', () => {
  const householdId = 'hh-123'
  const mockQueryClient = {
    invalidateQueries: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ActionExecutionService._resetTokens()
  })

  it('executes meal.mark_cooked proposal via MealLogService.markAsCooked', async () => {
    MealLogService.markAsCooked.mockResolvedValue({
      success: true,
      mealLogId: 'ml-1',
      alreadyCooked: false,
      deductions: [],
    })

    const proposal = {
      capabilityId: 'meal.mark_cooked',
      actionName: 'Mark Meal as Cooked',
      payload: { mealLogId: 'ml-1', requiredIngredients: [{ canonical_name: 'Rice', quantity_grams: 500 }] },
      preview: { action: 'Mark Dal Tadka cooked' },
    }

    const res = await ActionExecutionService.executeAction({
      householdId,
      actionProposal: proposal,
      queryClient: mockQueryClient,
    })

    expect(res.success).toBe(true)
    expect(res.alreadyExecuted).toBe(false)
    expect(MealLogService.markAsCooked).toHaveBeenCalledWith(
      householdId,
      'ml-1',
      [{ canonical_name: 'Rice', quantity_grams: 500 }]
    )
    expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['meal_log'] })
  })

  it('executes meal.cook_now proposal via MealLogService.cookRecipeNow', async () => {
    MealLogService.cookRecipeNow.mockResolvedValue({
      success: true,
      mealLogId: 'ml-2',
    })

    const proposal = {
      capabilityId: 'meal.cook_now',
      actionName: 'Cook Recipe Now',
      payload: { recipeId: 'r-1', mealType: 'dinner', servings: 2 },
    }

    const res = await ActionExecutionService.executeAction({
      householdId,
      actionProposal: proposal,
      queryClient: mockQueryClient,
    })

    expect(res.success).toBe(true)
    expect(MealLogService.cookRecipeNow).toHaveBeenCalledWith(householdId, {
      recipeId: 'r-1',
      mealType: 'dinner',
      servings: 2,
      requiredIngredients: [],
    })
  })

  it('executes planner.add_meal proposal via MealLogService.createMealLog', async () => {
    MealLogService.createMealLog.mockResolvedValue({
      id: 'ml-3',
      status: 'planned',
    })

    const proposal = {
      capabilityId: 'planner.add_meal',
      actionName: 'Schedule Planned Meal',
      payload: { recipeId: 'r-2', date: '2026-08-15', mealType: 'lunch', headcount: 3 },
    }

    const res = await ActionExecutionService.executeAction({
      householdId,
      actionProposal: proposal,
      queryClient: mockQueryClient,
    })

    expect(res.success).toBe(true)
    expect(MealLogService.createMealLog).toHaveBeenCalledWith(householdId, {
      recipe_id: 'r-2',
      date: '2026-08-15',
      meal_type: 'lunch',
      headcount: 3,
      notes: '',
      status: 'planned',
    })
  })

  it('executes inventory.add_item proposal via InventoryService.addOrUpdateItem', async () => {
    InventoryService.addOrUpdateItem.mockResolvedValue({
      id: 'inv-1',
      canonical_name: 'Paneer',
    })

    const proposal = {
      capabilityId: 'inventory.add_item',
      actionName: 'Add Stock',
      payload: { canonicalName: 'Paneer', quantityGrams: 500, category: 'Dairy' },
    }

    const res = await ActionExecutionService.executeAction({
      householdId,
      actionProposal: proposal,
      queryClient: mockQueryClient,
    })

    expect(res.success).toBe(true)
    expect(InventoryService.addOrUpdateItem).toHaveBeenCalledWith(householdId, {
      canonicalName: 'Paneer',
      quantityGrams: 500,
      category: 'Dairy',
      lowStockThresholdGrams: 500,
    })
  })

  it('enforces idempotency on duplicate execution token', async () => {
    MealLogService.markAsCooked.mockResolvedValue({ success: true, mealLogId: 'ml-1' })

    const proposal = {
      capabilityId: 'meal.mark_cooked',
      payload: { mealLogId: 'ml-1' },
    }

    const res1 = await ActionExecutionService.executeAction({ householdId, actionProposal: proposal })
    expect(res1.alreadyExecuted).toBe(false)

    // Second call with identical payload token
    const res2 = await ActionExecutionService.executeAction({ householdId, actionProposal: proposal })
    expect(res2.success).toBe(true)
    expect(res2.alreadyExecuted).toBe(true)
    expect(MealLogService.markAsCooked).toHaveBeenCalledTimes(1)
  })

  it('rejects execution when householdId is missing', async () => {
    const proposal = { capabilityId: 'meal.mark_cooked', payload: { mealLogId: 'ml-1' } }
    await expect(
      ActionExecutionService.executeAction({ householdId: null, actionProposal: proposal })
    ).rejects.toThrow('Missing household_id for action execution')
  })

  it('rejects invalid action proposal payload', async () => {
    await expect(
      ActionExecutionService.executeAction({ householdId, actionProposal: {} })
    ).rejects.toThrow('Invalid action proposal payload')
  })

  it('surfaces backend domain service failures cleanly', async () => {
    MealLogService.markAsCooked.mockRejectedValue(new Error('RPC mark_meal_cooked failed'))

    const proposal = { capabilityId: 'meal.mark_cooked', payload: { mealLogId: 'ml-99' } }

    await expect(
      ActionExecutionService.executeAction({ householdId, actionProposal: proposal })
    ).rejects.toThrow(/RPC mark_meal_cooked failed/)
  })
})
