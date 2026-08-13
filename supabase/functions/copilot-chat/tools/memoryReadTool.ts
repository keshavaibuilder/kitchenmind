import type { MemoryItem, ToolContext, ToolResult } from '../types.ts'
import { errResult, okResult } from '../types.ts'

export interface MemoryReadInput {
  memoryType?: 'preference' | 'restriction' | 'habit' | 'instruction' | 'context'
}

export async function memoryReadTool(
  input: MemoryReadInput,
  ctx: ToolContext
): Promise<ToolResult<{ memories: MemoryItem[]; count: number }>> {
  if (!ctx.householdId) {
    return errResult('UNAUTHORIZED', 'Missing household_id', 'copilot_memory')
  }

  try {
    const nowIso = new Date().toISOString()
    // deno-lint-ignore no-explicit-any
    let query: any = ctx.client
      .from('copilot_memory')
      .select('*')
      .eq('household_id', ctx.householdId)
      .eq('status', 'active')

    if (input && input.memoryType) {
      query = query.eq('memory_type', input.memoryType)
    }

    const { data, error } = await query
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('updated_at', { ascending: false })
      .limit(30)

    if (error) {
      return errResult('MEMORY_READ_FAILED', error.message, 'copilot_memory')
    }

    const memories: MemoryItem[] = data || []
    return okResult({ memories, count: memories.length }, 'copilot_memory')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errResult('MEMORY_READ_FAILED', msg, 'copilot_memory')
  }
}
