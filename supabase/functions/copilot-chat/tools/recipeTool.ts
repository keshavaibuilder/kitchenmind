// RecipeTool (§3.3) — wraps RecipeService.getRecipes/getRecipeById, composing
// ingredientAvailability.js for canCookNow mode exactly as the browser app's Recipe Detail page
// already does (§3.3 "composes with ingredientAvailability.js for a canCookNow mode").
import { RecipeService } from '@/services/RecipeService.js'
import { InventoryService } from '@/services/InventoryService.js'
import { computeIngredientAvailability } from '@/utils/ingredientAvailability.js'
import type { ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

export interface RecipeToolInput {
  query?: string
  mealType?: string
  canCookNow?: boolean
}

interface RecipeAvailabilityView {
  missing: string[]
  low: string[]
  shortfallGrams: Record<string, number>
  canCookFully: boolean
}

interface RecipeView {
  id: string
  name: string
  servings: number
  // deno-lint-ignore no-explicit-any
  ingredients: any[]
  availability?: RecipeAvailabilityView
}

export interface RecipeToolOutput {
  recipes: RecipeView[]
}

export async function recipeTool(input: RecipeToolInput, ctx: ToolContext): Promise<ToolResult<RecipeToolOutput>> {
  try {
    const { recipes } = await RecipeService.getRecipes(
      ctx.householdId,
      { search: input?.query, mealType: input?.mealType, limit: 10 },
      ctx.client
    )

    // deno-lint-ignore no-explicit-any
    let inventoryItems: any[] = []
    if (input?.canCookNow) {
      inventoryItems = await InventoryService.getInventory(ctx.householdId, ctx.client)
    }

    // deno-lint-ignore no-explicit-any
    const views: RecipeView[] = recipes.map((r: any) => {
      const view: RecipeView = {
        id: r.id,
        name: r.name,
        servings: r.base_servings,
        ingredients: r.ingredients ?? [],
      }
      if (input?.canCookNow) {
        const required = RecipeService.scaleRecipeIngredients(r, r.base_servings)
        const availability = computeIngredientAvailability(required, inventoryItems)
        const shortfallGrams: Record<string, number> = {}
        const missing: string[] = []
        const low: string[] = []
        for (const row of availability) {
          if (row.status === 'missing') missing.push(row.canonical_name)
          if (row.status === 'low') low.push(row.canonical_name)
          if (row.shortfallGrams > 0) shortfallGrams[row.canonical_name] = row.shortfallGrams
        }
        view.availability = {
          missing,
          low,
          shortfallGrams,
          canCookFully: availability.every((a) => a.isOptional || a.status !== 'missing'),
        }
      }
      return view
    })

    // §3.3: no matching recipe -> ok:true, empty array — never invent one outside the catalogue.
    return okResult({ recipes: views }, 'recipes')
  } catch (err) {
    return errResult('RECIPE_TOOL_FAILED', err instanceof Error ? err.message : String(err), 'recipes')
  }
}
