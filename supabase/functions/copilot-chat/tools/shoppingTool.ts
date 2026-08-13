// ShoppingTool (§3.3) — wraps PlanningEngine.generateShoppingSuggestions().
import { generateShoppingSuggestions } from '@/services/PlanningEngine.js'
import type { ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'
import { fetchPlanningContext } from './_planningContext.ts'

export type ShoppingToolInput = Record<string, never>

interface ShoppingSuggestionView {
  canonicalName: string
  reason: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ShoppingToolOutput {
  suggestions: ShoppingSuggestionView[]
}

export async function shoppingTool(_input: ShoppingToolInput, ctx: ToolContext): Promise<ToolResult<ShoppingToolOutput>> {
  try {
    const planningCtx = await fetchPlanningContext(ctx)
    const grouped = generateShoppingSuggestions(planningCtx)

    const suggestions: ShoppingSuggestionView[] = []
    // deno-lint-ignore no-explicit-any
    for (const category of grouped as any[]) {
      for (const item of category.items) {
        suggestions.push({ canonicalName: item.canonicalName, reason: item.reason, priority: item.priority })
      }
    }

    return okResult({ suggestions }, 'planning_engine')
  } catch (err) {
    return errResult('SHOPPING_TOOL_FAILED', err instanceof Error ? err.message : String(err), 'planning_engine')
  }
}
