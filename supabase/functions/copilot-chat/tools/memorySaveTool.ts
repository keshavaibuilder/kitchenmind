import type { ActionProposal, ToolContext, ToolResult } from '../types.ts'
import { errResult, okResult } from '../types.ts'

export interface MemorySaveInput {
  memoryKey: string
  memoryValue: string
  memoryType?: 'preference' | 'restriction' | 'habit' | 'instruction' | 'context'
  expiresAt?: string
}

export function memorySaveTool(
  input: MemorySaveInput,
  ctx: ToolContext
): Promise<ToolResult<ActionProposal>> {
  if (!ctx.householdId) {
    return Promise.resolve(errResult<ActionProposal>('UNAUTHORIZED', 'Missing household_id', 'copilot_memory'))
  }
  if (!input || !input.memoryKey || !input.memoryValue) {
    return Promise.resolve(errResult<ActionProposal>('INVALID_INPUT', 'Missing memoryKey or memoryValue', 'copilot_memory'))
  }

  const memoryType = input.memoryType || 'preference'

  const proposal: ActionProposal = {
    capabilityId: 'memory.save',
    actionName: 'Remember Preference / Instruction',
    payload: {
      memoryKey: input.memoryKey,
      memoryValue: input.memoryValue,
      memoryType,
      expiresAt: input.expiresAt || null,
      source: 'user_explicit',
    },
    preview: {
      action: `Save long-term memory: "${input.memoryValue}"`,
      affectedItems: [input.memoryKey],
      quantities: [memoryType.toUpperCase()],
      householdImpact: `KitchenMind will remember this ${memoryType} and consider it when providing suggestions.`,
      expectedResult: `Added to explicit household memories under key "${input.memoryKey}".`,
      irreversible: false,
    },
  }

  return Promise.resolve(okResult(proposal, 'copilot_memory'))
}
