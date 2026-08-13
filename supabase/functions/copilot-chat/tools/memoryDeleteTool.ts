import type { ActionProposal, ToolContext, ToolResult } from '../types.ts'
import { errResult, okResult } from '../types.ts'

export interface MemoryDeleteInput {
  memoryId?: string
  memoryKey?: string
}

export async function memoryDeleteTool(
  input: MemoryDeleteInput,
  ctx: ToolContext
): Promise<ToolResult<ActionProposal>> {
  if (!ctx.householdId) {
    return errResult<ActionProposal>('UNAUTHORIZED', 'Missing household_id', 'copilot_memory')
  }
  if (!input || (!input.memoryId && !input.memoryKey)) {
    return errResult<ActionProposal>('INVALID_INPUT', 'Must provide memoryId or memoryKey to delete', 'copilot_memory')
  }

  let memoryId = input.memoryId
  let memoryKey = input.memoryKey || 'memory_entry'
  let memoryValue = 'Selected memory entry'

  if (ctx.client && (input.memoryId || input.memoryKey)) {
    try {
      // deno-lint-ignore no-explicit-any
      let query: any = ctx.client
        .from('copilot_memory')
        .select('id, memory_key, memory_value')
        .eq('household_id', ctx.householdId)
        .neq('status', 'deleted')

      if (input.memoryId) query = query.eq('id', input.memoryId)
      else if (input.memoryKey) query = query.eq('memory_key', input.memoryKey)

      const { data } = await query.maybeSingle()
      if (data) {
        memoryId = data.id
        memoryKey = data.memory_key
        memoryValue = data.memory_value
      }
    } catch {
      // Degrade gracefully if DB lookup fails
    }
  }

  const proposal: ActionProposal = {
    capabilityId: 'memory.delete',
    actionName: 'Delete Remembered Memory',
    payload: {
      memoryId: memoryId || null,
      memoryKey,
    },
    preview: {
      action: `Delete memory: "${memoryValue}" (${memoryKey})`,
      affectedItems: [memoryKey],
      quantities: ['REMOVE'],
      householdImpact: `KitchenMind will no longer consider this memory during meal suggestions.`,
      expectedResult: `Memory entry deleted from household memory store.`,
      irreversible: false,
    },
  }

  return okResult(proposal, 'copilot_memory')
}
