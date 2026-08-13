import type { ActionProposal, ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

interface CookRecipeNowInput {
  recipeId: string
  mealType?: string
  servings?: number
}

export async function cookRecipeNowTool(
  input: CookRecipeNowInput,
  ctx: ToolContext
): Promise<ToolResult<ActionProposal>> {
  if (!input || !input.recipeId) {
    return errResult('INVALID_INPUT', 'Missing recipeId', 'recipes')
  }

  try {
    const { data: recipe, error } = await ctx.client
      .from('recipes')
      .select('id, name, servings, recipe_ingredients(canonical_name, quantity_grams)')
      .eq('id', input.recipeId)
      .maybeSingle()

    if (error || !recipe) {
      return errResult('RECIPE_NOT_FOUND', `Recipe "${input.recipeId}" not found`, 'recipes')
    }

    const servings = input.servings || recipe.servings || 1
    const mealType = input.mealType || 'dinner'
    const ingredientNames = (recipe.recipe_ingredients || []).map(
      (ri: { canonical_name: string }) => ri.canonical_name
    )

    const proposal: ActionProposal = {
      capabilityId: 'meal.cook_now',
      actionName: 'Cook Recipe Now',
      payload: {
        recipeId: recipe.id,
        mealType,
        servings,
      },
      preview: {
        action: `Cook "${recipe.name}" now (${servings} servings)`,
        affectedItems: [recipe.name, ...ingredientNames],
        quantities: [`Servings: ${servings}`],
        householdImpact: `Creates a cooked meal record and deducts ingredients from pantry stock.`,
        expectedResult: `Meal logged as COOKED and inventory quantities reduced according to recipe proportions.`,
        irreversible: true,
      },
    }

    return okResult(proposal, 'recipes')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errResult('COOK_NOW_PREPARE_FAILED', msg, 'recipes')
  }
}
