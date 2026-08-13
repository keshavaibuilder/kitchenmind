import type { ActionProposal, ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

interface MarkMealCookedInput {
  mealLogId: string
}

export async function markMealCookedTool(
  input: MarkMealCookedInput,
  ctx: ToolContext
): Promise<ToolResult<ActionProposal>> {
  if (!input || !input.mealLogId) {
    return errResult('INVALID_INPUT', 'Missing mealLogId', 'meal_log')
  }

  try {
    const { data: meal, error } = await ctx.client
      .from('meal_log')
      .select('id, date, meal_type, headcount, status, recipes(id, name)')
      .eq('id', input.mealLogId)
      .eq('household_id', ctx.householdId)
      .maybeSingle()

    if (error || !meal) {
      return errResult('MEAL_NOT_FOUND', `Planned meal log "${input.mealLogId}" not found for this household`, 'meal_log')
    }

    const recipeName = meal.recipes?.name || 'Planned Meal'

    const proposal: ActionProposal = {
      capabilityId: 'meal.mark_cooked',
      actionName: 'Mark Meal as Cooked',
      payload: {
        mealLogId: meal.id,
        recipeId: meal.recipes?.id ?? null,
      },
      preview: {
        action: `Mark "${recipeName}" (${meal.meal_type}) as cooked`,
        affectedItems: [recipeName],
        quantities: [`Headcount: ${meal.headcount || 1}`],
        householdImpact: `Deducts required ingredients for ${recipeName} from active inventory batches via FIFO order.`,
        expectedResult: 'Meal status transitions to COOKED and inventory balances update automatically.',
        irreversible: true,
      },
    }

    return okResult(proposal, 'meal_log')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errResult('MARK_COOKED_PREPARE_FAILED', msg, 'meal_log')
  }
}
