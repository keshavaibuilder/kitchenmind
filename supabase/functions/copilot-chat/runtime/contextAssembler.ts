// Context Assembler (§1.5) — builds the small, cheap, always-injected "base context" block from
// parallel queries, reusing the same derivation dashboardInsights.js already uses for the
// Dashboard (derivePantryHealth), rather than inventing a second pantry-health formula.
import { HouseholdService } from '@/services/HouseholdService.js'
import { PredictionService } from '@/services/PredictionService.js'
import { MealLogService } from '@/services/MealLogService.js'
import { derivePantryHealth } from '@/utils/dashboardInsights.js'
import type { ToolContext } from '../types.ts'

export interface BaseContext {
  householdName: string
  memberCount: number
  pantryHealthScore: number | null
  pantryHealthLabel: string | null
  lowStockCount: number
  todaysMeals: Array<{ meal_type: string; status: string }>
  activeMemories: Array<{ memory_type: string; memory_key: string; memory_value: string; source: string }>
  asOf: string
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** §1.5 tier 1: always injected, every turn. Deliberately narrow — anything deeper is an
 * explicit tool call (§1.5 tier 2), never folded into this block, to keep the token budget
 * predictable (§4.3). */
export async function assembleBaseContext(ctx: ToolContext): Promise<BaseContext> {
  const today = toDateOnly(new Date())
  const nowIso = new Date().toISOString()

  const [household, members, predictions, todaysMealLogs, memoriesRes] = await Promise.all([
    HouseholdService.getHouseholdDetails(ctx.householdId, ctx.client).catch(() => null),
    HouseholdService.getMembers(ctx.householdId, ctx.client).catch(() => []),
    PredictionService.getHouseholdPredictions(ctx.householdId, ctx.client).catch(() => []),
    MealLogService.getMealLogs(ctx.householdId, { from: today, to: today }, ctx.client).catch(() => []),
    ctx.client
      .from('copilot_memory')
      .select('memory_type, memory_key, memory_value, source')
      .eq('household_id', ctx.householdId)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(15)
      .catch(() => ({ data: [] })),
  ])

  // deno-lint-ignore no-explicit-any
  const pantryHealth = derivePantryHealth(predictions as any[])
  const activeMemories = (memoriesRes && 'data' in memoriesRes && Array.isArray(memoriesRes.data)) ? memoriesRes.data : []

  return {
    householdName: (household as { name?: string } | null)?.name || 'the household',
    memberCount: (members as unknown[]).length,
    pantryHealthScore: pantryHealth.score,
    pantryHealthLabel: pantryHealth.label,
    lowStockCount: pantryHealth.atRiskCount,
    // deno-lint-ignore no-explicit-any
    todaysMeals: (todaysMealLogs as any[]).map((m) => ({ meal_type: m.meal_type, status: m.status })),
    // deno-lint-ignore no-explicit-any
    activeMemories: activeMemories.map((m: any) => ({
      memory_type: m.memory_type,
      memory_key: m.memory_key,
      memory_value: m.memory_value,
      source: m.source,
    })),
    asOf: new Date().toISOString(),
  }
}
