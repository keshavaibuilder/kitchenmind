// MealHistoryTool (§3.3) — wraps MealLogService.getMealHistory/getStockDeductionsForMeal. The
// mealLogId input mode surfaces the ingredient-level deduction audit trail for one cooked meal
// (e.g. "how much rice did tonight's dal use").
import { MealLogService } from '@/services/MealLogService.js'
import type { ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

export interface MealHistoryToolInput {
  days?: number
  mealType?: string
  mealLogId?: string
}

interface MealView {
  id: string
  date: string
  meal_type: string
  recipe_name: string | null
  headcount: number
  status: string
}

interface DeductionView {
  canonical_name: string
  grams_deducted: number
}

export interface MealHistoryToolOutput {
  meals: MealView[]
  deductions?: DeductionView[]
}

export async function mealHistoryTool(
  input: MealHistoryToolInput,
  ctx: ToolContext
): Promise<ToolResult<MealHistoryToolOutput>> {
  try {
    const days = Math.min(Math.max(Number(input?.days) || 30, 1), 365)
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { mealLogs } = await MealLogService.getMealHistory(ctx.householdId, {
      limit: 50,
      client: ctx.client,
    })

    // deno-lint-ignore no-explicit-any
    const meals: MealView[] = (mealLogs as any[])
      .filter((m) => m.date >= since)
      .filter((m) => !input?.mealType || m.meal_type === input.mealType)
      .map((m) => ({
        id: m.id,
        date: m.date,
        meal_type: m.meal_type,
        recipe_name: m.recipes?.name ?? null,
        headcount: m.headcount,
        status: m.status,
      }))

    const output: MealHistoryToolOutput = { meals }

    if (input?.mealLogId) {
      // deno-lint-ignore no-explicit-any
      const rows: any[] = await MealLogService.getStockDeductionsForMeal(input.mealLogId, ctx.client)
      output.deductions = rows.map((r) => ({
        canonical_name: r.inventory?.canonical_name ?? 'unknown',
        grams_deducted: Number(r.grams_deducted),
      }))
    }

    return okResult(output, 'meal_log')
  } catch (err) {
    return errResult('MEAL_HISTORY_TOOL_FAILED', err instanceof Error ? err.message : String(err), 'meal_log')
  }
}
