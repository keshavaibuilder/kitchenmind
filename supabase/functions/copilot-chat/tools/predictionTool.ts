// PredictionTool (§3.3) — wraps PredictionService.getHouseholdPredictions(), enriched with
// consumption velocity from ConsumptionProfileService (same join dashboardInsights.js/PlanningEngine
// already do client-side) since the design doc's output contract requires velocity_g_per_day
// alongside the cached prediction, and prediction_cache itself doesn't store velocity directly.
import { PredictionService } from '@/services/PredictionService.js'
import { ConsumptionProfileService } from '@/services/ConsumptionProfileService.js'
import type { ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

export interface PredictionToolInput {
  canonical_name?: string
}

interface PredictionView {
  canonical_name: string
  days_remaining: number
  depletion_date: string
  is_low_stock_risk: boolean
  velocity_g_per_day: number | null
  confidence: number
  stale: boolean
}

export interface PredictionToolOutput {
  predictions: PredictionView[]
}

export async function predictionTool(
  input: PredictionToolInput,
  ctx: ToolContext
): Promise<ToolResult<PredictionToolOutput>> {
  try {
    const [predictions, profiles] = await Promise.all([
      // deno-lint-ignore no-explicit-any
      PredictionService.getHouseholdPredictions(ctx.householdId, ctx.client) as Promise<any[]>,
      // deno-lint-ignore no-explicit-any
      ConsumptionProfileService.getAllProfiles(ctx.householdId, ctx.client) as Promise<any[]>,
    ])

    const velocityByName = new Map(
      profiles.map((p) => [String(p.canonical_name).toLowerCase(), Number(p.consumption_velocity_g_per_day)])
    )

    const now = Date.now()
    let rows = predictions.map((p) => {
      // §2 "the copilot must be the first consumer to check and respect" ttl_expires_at.
      const stale = p.ttl_expires_at ? new Date(p.ttl_expires_at).getTime() < now : false
      return {
        canonical_name: p.canonical_name,
        days_remaining: p.days_until_depletion,
        depletion_date: p.predicted_depletion_date,
        is_low_stock_risk: Boolean(p.is_low_stock_risk),
        velocity_g_per_day: velocityByName.get(String(p.canonical_name).toLowerCase()) ?? null,
        confidence: Number(p.confidence_score),
        stale,
      }
    })

    if (input?.canonical_name) {
      const wanted = input.canonical_name.toLowerCase()
      rows = rows.filter((r) => r.canonical_name.toLowerCase() === wanted)
    }

    const anyStale = rows.some((r) => r.stale)
    return okResult({ predictions: rows }, 'prediction_cache', anyStale ? { stale: true } : {})
  } catch (err) {
    return errResult('PREDICTION_TOOL_FAILED', err instanceof Error ? err.message : String(err), 'prediction_cache')
  }
}
