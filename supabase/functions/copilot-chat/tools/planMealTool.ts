import type { ActionProposal, ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

interface PlanMealInput {
  recipeId: string
  date: string
  mealType: string
  headcount?: number
  notes?: string
}

export async function planMealTool(
  input: PlanMealInput,
  ctx: ToolContext
): Promise<ToolResult<ActionProposal>> {
  if (!input || !input.recipeId || !input.date || !input.mealType) {
    return errResult('INVALID_INPUT', 'Missing recipeId, date, or mealType', 'meal_log')
  }

  try {
    const { data: recipe, error } = await ctx.client
      .from('recipes')
      .select('id, name')
      .eq('id', input.recipeId)
      .maybeSingle()

    if (error || !recipe) {
      return errResult('RECIPE_NOT_FOUND', `Recipe "${input.recipeId}" not found`, 'recipes')
    }

    const headcount = input.headcount || 1

    const proposal: ActionProposal = {
      capabilityId: 'planner.add_meal',
      actionName: 'Schedule Planned Meal',
      payload: {
        recipeId: recipe.id,
        date: input.date,
        mealType: input.mealType,
        headcount,
        notes: input.notes || '',
      },
      preview: {
        action: `Schedule "${recipe.name}" for ${input.date} (${input.mealType})`,
        affectedItems: [recipe.name],
        quantities: [`Headcount: ${headcount}`],
        householdImpact: `Adds planned meal to household planner calendar for ${input.date}.`,
        expectedResult: `Meal entry created in planner with status PLANNED. No stock deducted until cooked.`,
        irreversible: false,
      },
    }

    return okResult(proposal, 'meal_log')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errResult('PLAN_MEAL_PREPARE_FAILED', msg, 'meal_log')
  }
}
