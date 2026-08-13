// Central runtime configuration for the AI Copilot Edge Function.
//
// Per docs/21_AI_COPILOT_ARCHITECTURE_AND_DESIGN.md §1.2 (ADR-6A-1), this function is the sole
// backend compute layer for the copilot — it owns every LLM provider credential; none are ever
// exposed to the browser bundle. All values are read from Deno.env at cold start, never hardcoded.
//
// Every field below is a getter (or explicit function, for the API keys), not a plain value
// captured once at module import — deliberately, so Deno.env changes are always reflected on
// next access rather than frozen at first import. In production this makes no observable
// difference (Supabase Edge Function env vars are static for an isolate's lifetime), but it's
// what makes config testable via Deno.env.set/delete across test cases in the same process.

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function optionalEnv(name: string, fallback: string): string {
  return Deno.env.get(name) || fallback
}

export const config = {
  supabase: {
    // Standard Supabase Edge Function env vars, auto-injected by the platform — not the VITE_
    // prefixed browser vars, since this runtime never runs in Vite.
    url: () => requireEnv('SUPABASE_URL'),
    anonKey: () => requireEnv('SUPABASE_ANON_KEY'),
  },
  llm: {
    // §7.6: default to a single capable provider rather than a router/classifier architecture.
    // Configurable per §"LLM Provider Layer" requirement (Gemini / Groq / SambaNova / future).
    get provider(): string {
      return optionalEnv('COPILOT_LLM_PROVIDER', 'gemini')
    },
    geminiApiKey: () => Deno.env.get('GEMINI_API_KEY') || Deno.env.get('VITE_GEMINI_API_KEY') || '',
    groqApiKey: () => Deno.env.get('GROQ_API_KEY') || '',
    sambanovaApiKey: () => Deno.env.get('SAMBANOVA_API_KEY') || '',
    get model(): string {
      return optionalEnv('COPILOT_LLM_MODEL', '') // '' = provider's own default, see each provider module
    },
  },
  // Objective 2: LLM runtime timeouts
  get llmTimeoutMs(): number {
    return Number(optionalEnv('COPILOT_LLM_TIMEOUT_MS', '15000'))
  },
  get overallDeadlineMs(): number {
    return Number(optionalEnv('COPILOT_OVERALL_DEADLINE_MS', '30000'))
  },
  // Objective 7: Rate limiting cap per household
  get rateLimitMaxTurnsPerMin(): number {
    return Number(optionalEnv('COPILOT_RATE_LIMIT_TURNS_PER_MIN', '10'))
  },
  // §3.2 default tool timeout; per-capability perf_budget_ms in the registry can override this.
  get defaultToolTimeoutMs(): number {
    return Number(optionalEnv('COPILOT_TOOL_TIMEOUT_MS', '2000'))
  },
  toolRetryCount: 1,
  // §4.3 hard cap: force synthesis once the running context estimate crosses this.
  get maxContextTokens(): number {
    return Number(optionalEnv('COPILOT_MAX_CONTEXT_TOKENS', '6000'))
  },
  // §5.1: last N turns included verbatim before older turns are summarized.
  get sessionMemoryTurns(): number {
    return Number(optionalEnv('COPILOT_SESSION_MEMORY_TURNS', '10'))
  },
  // §1.9: one forced repair turn before BLOCK.
  trustModelMaxRepairAttempts: 1,
}
