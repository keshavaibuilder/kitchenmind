import { MealLogService } from './MealLogService.js'
import { InventoryService } from './InventoryService.js'
import { normalizeError } from '../utils/errors.js'

// In-memory idempotency cache to prevent duplicate executions across double clicks / network retries
const executedActionTokens = new Set()
const executingActionTokens = new Set()

export const ActionExecutionService = {
  /**
   * Executes a user-confirmed AI action payload using authorized domain services/RPCs.
   *
   * @param {Object} params
   * @param {string} params.householdId - Authenticated household UUID
   * @param {Object} params.actionProposal - ActionProposal structure
   * @param {Object} [params.queryClient] - React Query client for cache invalidation
   * @returns {Promise<{ success: boolean, alreadyExecuted?: boolean, result?: any, error?: any }>}
   */
  async executeAction({ householdId, actionProposal, queryClient }) {
    if (!householdId) {
      throw normalizeError('Missing household_id for action execution', 'ACTION_EXECUTION_UNAUTHORIZED')
    }

    if (!actionProposal || !actionProposal.capabilityId || !actionProposal.payload) {
      throw normalizeError('Invalid action proposal payload', 'ACTION_PAYLOAD_INVALID')
    }

    const { capabilityId, payload } = actionProposal
    const actionToken = `${householdId}:${capabilityId}:${JSON.stringify(payload)}`

    // 1. Idempotency Check: Already executed
    if (executedActionTokens.has(actionToken)) {
      return {
        success: true,
        alreadyExecuted: true,
        message: 'Action was already executed successfully.',
      }
    }

    // 2. Idempotency Check: Currently executing
    if (executingActionTokens.has(actionToken)) {
      throw normalizeError('Action execution is already in progress', 'ACTION_DUPLICATE_EXECUTION')
    }

    executingActionTokens.add(actionToken)

    try {
      let executionResult = null

      // 3. Capability Dispatch to Authorized Service / RPC
      switch (capabilityId) {
        case 'meal.mark_cooked': {
          if (!payload.mealLogId) {
            throw normalizeError('Missing mealLogId in payload', 'ACTION_PAYLOAD_INVALID')
          }
          executionResult = await MealLogService.markAsCooked(
            householdId,
            payload.mealLogId,
            payload.requiredIngredients || []
          )
          break
        }

        case 'meal.cook_now': {
          if (!payload.recipeId) {
            throw normalizeError('Missing recipeId in payload', 'ACTION_PAYLOAD_INVALID')
          }
          executionResult = await MealLogService.cookRecipeNow(householdId, {
            recipeId: payload.recipeId,
            mealType: payload.mealType || 'dinner',
            servings: payload.servings || 1,
            requiredIngredients: payload.requiredIngredients || [],
          })
          break
        }

        case 'planner.add_meal': {
          if (!payload.recipeId || !payload.date || !payload.mealType) {
            throw normalizeError('Missing required fields for planning meal', 'ACTION_PAYLOAD_INVALID')
          }
          executionResult = await MealLogService.createMealLog(householdId, {
            recipe_id: payload.recipeId,
            date: payload.date,
            meal_type: payload.mealType,
            headcount: payload.headcount || 1,
            notes: payload.notes || '',
            status: 'planned',
          })
          break
        }

        case 'inventory.add_item': {
          if (!payload.canonicalName || !payload.quantityGrams) {
            throw normalizeError('Missing canonicalName or quantityGrams', 'ACTION_PAYLOAD_INVALID')
          }
          executionResult = await InventoryService.addOrUpdateItem(householdId, {
            canonicalName: payload.canonicalName,
            quantityGrams: payload.quantityGrams,
            category: payload.category || 'Pantry',
            lowStockThresholdGrams: payload.lowStockThresholdGrams || 500,
          })
          break
        }

        case 'memory.save': {
          if (!payload.memoryKey || !payload.memoryValue) {
            throw normalizeError('Missing memoryKey or memoryValue', 'ACTION_PAYLOAD_INVALID')
          }
          const { MemoryService } = await import('./MemoryService.js')
          executionResult = await MemoryService.saveMemory(householdId, payload)
          break
        }

        case 'memory.delete': {
          if (!payload.memoryId && !payload.memoryKey) {
            throw normalizeError('Missing memoryId or memoryKey', 'ACTION_PAYLOAD_INVALID')
          }
          const { MemoryService } = await import('./MemoryService.js')
          if (payload.memoryId) {
            executionResult = await MemoryService.deleteMemory(householdId, payload.memoryId)
          } else {
            const memories = await MemoryService.loadMemories(householdId)
            const target = memories.find((m) => m.memory_key === payload.memoryKey)
            if (target) {
              executionResult = await MemoryService.deleteMemory(householdId, target.id)
            } else {
              executionResult = { success: true, message: 'Memory key not found or already deleted' }
            }
          }
          break
        }

        default:
          throw normalizeError(`Unsupported write capability "${capabilityId}"`, 'ACTION_CAPABILITY_UNSUPPORTED')
      }

      // 4. Mark action token as executed
      executedActionTokens.add(actionToken)

      // 5. Invalidate relevant React Query caches if queryClient supplied
      if (queryClient && typeof queryClient.invalidateQueries === 'function') {
        queryClient.invalidateQueries({ queryKey: ['inventory'] })
        queryClient.invalidateQueries({ queryKey: ['meal_log'] })
        queryClient.invalidateQueries({ queryKey: ['meal_history'] })
        queryClient.invalidateQueries({ queryKey: ['planner'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['copilot_memories'] })
      }

      return {
        success: true,
        alreadyExecuted: false,
        result: executionResult,
      }
    } catch (err) {
      throw normalizeError(err, 'ACTION_EXECUTION_FAILED')
    } finally {
      executingActionTokens.delete(actionToken)
    }
  },

  /**
   * Resets execution tokens (primarily for unit test cleanups)
   */
  _resetTokens() {
    executedActionTokens.clear()
    executingActionTokens.clear()
  },
}
