// InventoryTool (§3.3) — wraps InventoryService.getInventory(), unchanged from the browser app,
// just called with a per-request-scoped client instead of the browser singleton.
import { InventoryService } from '@/services/InventoryService.js'
import type { ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

export interface InventoryToolInput {
  filter?: { lowStockOnly?: boolean; category?: string }
  limit?: number
}

interface InventoryItemView {
  canonical_name: string
  category: string | null
  quantity_grams: number
  display_unit: string
  low_stock_threshold: number
  is_low_stock: boolean
}

export interface InventoryToolOutput {
  items: InventoryItemView[]
  totalItems: number
  showing: number
  truncated: boolean
  summary?: string
}

export async function inventoryTool(
  input: InventoryToolInput,
  ctx: ToolContext
): Promise<ToolResult<InventoryToolOutput>> {
  try {
    // deno-lint-ignore no-explicit-any
    const rows: any[] = await InventoryService.getInventory(ctx.householdId, ctx.client)

    let items: InventoryItemView[] = rows.map((r) => ({
      canonical_name: r.canonical_name,
      category: r.category ?? null,
      quantity_grams: Number(r.quantity_grams),
      display_unit: r.display_unit,
      low_stock_threshold: Number(r.low_stock_threshold),
      is_low_stock: Number(r.quantity_grams) <= Number(r.low_stock_threshold),
    }))

    if (input?.filter?.lowStockOnly) items = items.filter((i) => i.is_low_stock)
    if (input?.filter?.category) {
      const wanted = input.filter.category.toLowerCase()
      items = items.filter((i) => (i.category || '').toLowerCase() === wanted)
    }

    const totalItems = items.length
    // Objective 5: Enforce upper bound (max_rows cap: default 50 from registry, or explicit input limit)
    const maxRows = Math.min(Math.max(Number(input?.limit) || 50, 1), 50)
    let truncated = false

    if (items.length > maxRows) {
      items = items.slice(0, maxRows)
      truncated = true
    }

    // Token budget guard: cap items so JSON serialization fits within capability token budget (approx 1500 tokens ~ 8000 chars)
    const maxCharBudget = 8000
    while (items.length > 1 && JSON.stringify(items).length > maxCharBudget) {
      items.pop()
      truncated = true
    }

    const showing = items.length
    const summary = truncated
      ? `Showing ${showing} of ${totalItems} inventory items (truncated to fit runtime context budget).`
      : `Total ${showing} inventory items.`

    return okResult({ items, totalItems, showing, truncated, summary }, 'inventory')
  } catch (err) {
    return errResult('INVENTORY_TOOL_FAILED', err instanceof Error ? err.message : String(err), 'inventory')
  }
}
