// ObservationTool (§3.3) — wraps AIObservationService.getRecentObservations().
import { AIObservationService } from '@/services/AIObservationService.js'
import type { ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

export interface ObservationToolInput {
  limit?: number
}

interface ObservationView {
  type: string
  canonical_name: string | null
  details: unknown
  created_at: string
}

export interface ObservationToolOutput {
  observations: ObservationView[]
}

export async function observationTool(
  input: ObservationToolInput,
  ctx: ToolContext
): Promise<ToolResult<ObservationToolOutput>> {
  try {
    const limit = Math.min(Math.max(Number(input?.limit) || 20, 1), 50)
    // deno-lint-ignore no-explicit-any
    const rows: any[] = await AIObservationService.getRecentObservations(ctx.householdId, limit, ctx.client)
    const observations: ObservationView[] = rows.map((r) => ({
      type: r.observation_type,
      canonical_name: r.canonical_name ?? null,
      details: r.details,
      created_at: r.created_at,
    }))
    return okResult({ observations }, 'ai_observations')
  } catch (err) {
    return errResult('OBSERVATION_TOOL_FAILED', err instanceof Error ? err.message : String(err), 'ai_observations')
  }
}
