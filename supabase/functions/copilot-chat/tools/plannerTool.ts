// PlannerTool (§3.3) — wraps PlanningEngine.generateTodaysPlan/generateWeekPreview. Preserves the
// disclosed score+reasons[] shape verbatim (§3.3, §4.6) — the copilot must surface `reasons`, not
// paraphrase them.
import { generateTodaysPlan, generateWeekPreview } from '@/services/PlanningEngine.js'
import type { ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'
import { fetchPlanningContext } from './_planningContext.ts'

export interface PlannerToolInput {
  scope: 'today' | 'week'
}

export interface PlannerToolOutput {
  // PlanningEngine's plan shape is a heterogeneous object (scope=today) or array (scope=week) of
  // plain JS structures with no exported TS types — `unknown` here is honest, not a cop-out;
  // downstream consumers (JSON serialization, the Trust Model's ledger scan) don't need
  // type-safety on this blob, only the flattened `reasons` below do.
  plan: unknown
  reasons: string[]
}

export async function plannerTool(input: PlannerToolInput, ctx: ToolContext): Promise<ToolResult<PlannerToolOutput>> {
  try {
    const planningCtx = await fetchPlanningContext(ctx)
    const plan = input?.scope === 'week' ? generateWeekPreview(planningCtx) : generateTodaysPlan(planningCtx)

    // Flatten every candidate's reasons into one array so the Trust Model / citation layer has a
    // single, checkable list of the disclosed rationale behind whatever the LLM surfaces (§4.6).
    const reasons: string[] = []
    // deno-lint-ignore no-explicit-any
    const collect = (entry: any) => {
      if (entry?.suggestion?.reasons) reasons.push(...entry.suggestion.reasons.map((r: { text: string }) => r.text))
    }
    if (Array.isArray(plan)) {
      // deno-lint-ignore no-explicit-any
      for (const day of plan as any[]) for (const meal of Object.values(day.meals ?? {})) collect(meal)
    } else {
      for (const meal of Object.values(plan)) collect(meal)
    }

    return okResult({ plan, reasons }, 'planning_engine')
  } catch (err) {
    return errResult('PLANNER_TOOL_FAILED', err instanceof Error ? err.message : String(err), 'planning_engine')
  }
}
