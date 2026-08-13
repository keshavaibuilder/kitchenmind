// Telemetry (Sprint 6B scope) — structured JSON log lines, captured by whatever log sink the
// Supabase Edge Function runtime forwards stdout to. No dashboards/metrics-vendor integration
// this sprint — a documented, deliberate scope trim (see docs/21_..._DESIGN.md §7.6 and the
// Sprint 6B implementation summary), not an oversight. Never logs message content — only
// structural/numeric fields, so no user-authored text passes through telemetry (the "No PII"
// requirement).
import type { TrustVerdict } from '../types.ts'

// Rough, documented-as-approximate $/1M-token rates for cost estimation only — NOT used for
// billing, just a per-turn order-of-magnitude signal in telemetry (§7.3/§9.2 "cost per
// interaction"). Update alongside actual provider pricing when deploying.
const APPROX_COST_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  gemini: { input: 0.15, output: 0.6 },
  groq: { input: 0.59, output: 0.79 },
  sambanova: { input: 0.6, output: 1.2 },
}

function estimateCostUsd(providerName: string, inputTokens: number, outputTokens: number): number {
  const key = providerName.split(':')[0]
  const rates = APPROX_COST_PER_1M_TOKENS[key] ?? { input: 0.5, output: 1.0 }
  return Number(((inputTokens * rates.input + outputTokens * rates.output) / 1_000_000).toFixed(6))
}

export interface TurnTelemetry {
  requestId: string
  householdId: string
  provider: string
  toolCallCount: number
  toolTimingsMs: number[]
  latencyMs: number
  inputTokens: number
  outputTokens: number
  trustVerdict: TrustVerdict
  repairCount: number
  blocked: boolean
}

export function emitTurnTelemetry(t: TurnTelemetry) {
  const payload = {
    event: 'copilot_turn',
    timestamp: new Date().toISOString(),
    requestId: t.requestId,
    householdId: t.householdId,
    provider: t.provider,
    toolCallCount: t.toolCallCount,
    toolTimingsMs: t.toolTimingsMs.map((ms) => Math.round(ms)),
    latencyMs: Math.round(t.latencyMs),
    inputTokens: t.inputTokens,
    outputTokens: t.outputTokens,
    estimatedCostUsd: estimateCostUsd(t.provider, t.inputTokens, t.outputTokens),
    trustVerdict: t.trustVerdict,
    repairCount: t.repairCount,
    blocked: t.blocked,
  }
  console.log(`[COPILOT_TELEMETRY]`, JSON.stringify(payload))
}

export function emitToolTelemetry(args: {
  requestId: string
  householdId: string
  capabilityId: string
  durationMs: number
  status: 'success' | 'error' | 'timeout'
}) {
  console.log('[COPILOT_TELEMETRY]', JSON.stringify({
    event: 'copilot_tool_call',
    timestamp: new Date().toISOString(),
    ...args,
    durationMs: Math.round(args.durationMs),
  }))
}

export function emitErrorTelemetry(args: { requestId: string; householdId?: string; code: string; message: string }) {
  console.error('[COPILOT_TELEMETRY]', JSON.stringify({
    event: 'copilot_error',
    timestamp: new Date().toISOString(),
    ...args,
  }))
}

export function emitFailoverTelemetry(args: {
  requestId: string
  householdId?: string
  fromProvider: string
  toProvider: string
  error: string
}) {
  console.log('[COPILOT_TELEMETRY]', JSON.stringify({
    event: 'copilot_provider_failover',
    timestamp: new Date().toISOString(),
    ...args,
  }))
}
