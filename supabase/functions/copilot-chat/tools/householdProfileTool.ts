// HouseholdProfileTool (§3.3) — wraps HouseholdIntelligenceService.getHouseholdProfile(),
// ConsumptionProfileService.getAllProfiles(), and the new getSpendByMonth() aggregation (§2.9).
import { HouseholdIntelligenceService } from '@/services/HouseholdIntelligenceService.js'
import { ConsumptionProfileService } from '@/services/ConsumptionProfileService.js'
import type { ToolContext, ToolResult } from '../types.ts'
import { okResult, errResult } from '../types.ts'

export interface HouseholdProfileToolInput {
  months?: number
}

export interface HouseholdProfileToolOutput {
  pantry_diversity_score: number | null
  top_categories: Array<{ category: string; count: number }>
  shopping_frequency_days: number | null
  preferred_shopping_day: string | null
  consumption_profiles: Array<{ canonical_name: string; velocity_g_per_day: number; confidence: number }>
  spend_by_month?: Array<{ month: string; total: number }>
}

export async function householdProfileTool(
  input: HouseholdProfileToolInput,
  ctx: ToolContext
): Promise<ToolResult<HouseholdProfileToolOutput>> {
  try {
    const months = Math.min(Math.max(Number(input?.months) || 3, 1), 12)

    const [profile, consumptionProfiles, spendByMonth] = await Promise.all([
      // deno-lint-ignore no-explicit-any
      HouseholdIntelligenceService.getHouseholdProfile(ctx.householdId, ctx.client) as Promise<any>,
      // deno-lint-ignore no-explicit-any
      ConsumptionProfileService.getAllProfiles(ctx.householdId, ctx.client) as Promise<any[]>,
      // §3.3: omitted (not errored) if this degrades — caught independently below.
      HouseholdIntelligenceService.getSpendByMonth(ctx.householdId, months, ctx.client).catch(() => null),
    ])

    const output: HouseholdProfileToolOutput = {
      pantry_diversity_score: profile?.pantry_diversity_score ?? null,
      top_categories: profile?.top_categories ?? [],
      shopping_frequency_days: profile?.shopping_frequency_days ?? null,
      preferred_shopping_day: profile?.preferred_shopping_day ?? null,
      consumption_profiles: consumptionProfiles.map((p) => ({
        canonical_name: p.canonical_name,
        velocity_g_per_day: Number(p.consumption_velocity_g_per_day),
        confidence: Number(p.confidence_score),
      })),
    }
    if (spendByMonth && spendByMonth.length > 0) output.spend_by_month = spendByMonth

    return okResult(output, 'household_learning_profile')
  } catch (err) {
    return errResult('HOUSEHOLD_PROFILE_TOOL_FAILED', err instanceof Error ? err.message : String(err), 'household_learning_profile')
  }
}
