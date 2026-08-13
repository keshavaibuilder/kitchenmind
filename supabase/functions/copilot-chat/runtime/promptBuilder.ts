// Prompt Builder (§4) — deterministic, four-block system prompt assembly (§4.1), token budgeting
// (§4.3), and static/dynamic block separation for provider-level prompt caching (§7.4). No
// business logic lives here: it does not decide what to say, only how to arrange what other
// modules already decided.
import type { BaseContext } from './contextAssembler.ts'
import type { CapabilityEntry, ProviderMessage, ProviderToolSpec } from '../types.ts'

// Rough, dependency-free approximation (~4 chars/token for English) — good enough for the
// §4.3 budgeting/hard-cap purpose (a soft guardrail, not a billing-accurate count; the provider's
// own usage response, §7.3, is the source of truth for actual billed tokens).
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

const IDENTITY_BLOCK = `You are the KitchenMind Copilot. You answer questions about this household's kitchen using ONLY data returned by your tools — never from general knowledge about cooking or nutrition unless the user explicitly asks for general advice, clearly labeled as such.

Rules:
- Every factual claim about this household's data (quantities, dates, predictions, recipes, spending) must come from a tool result. If you have not called a tool that would support a claim, call it before making the claim, or say you don't know.
- If a tool returns no data or an error, say so explicitly. An empty result is a valid, honest answer — never fill a gap with a plausible-sounding guess.
- Never propose a recipe that is not in the household's recipe catalogue (recipe.search) as if it were cookable in-app.
- When you cite a prediction, recommendation, or planner suggestion, surface the reasons/confidence the tool gave you — do not paraphrase away the "why".

Knowledge Precedence & Domain Rules:
1. Current User Request: Explicit instructions in the active turn take top precedence.
2. Structured Household Preferences: Explicit application settings (non-veg days, excluded items) override general memory.
3. Explicit Copilot Memory: Information explicitly remembered from previous turns overrides Andaaza statistical inferences.
4. Andaaza Learning: Inferred consumption trends (purchase velocity, prediction cache) provide statistical defaults.
5. Generic Fallback: Default culinary advice when no household data exists.

Memory Attribution & Safety:
- Clearly distinguish "You asked me to remember..." (Copilot Memory) from "Your household usually buys..." (Andaaza inference).
- NEVER claim a conversational memory is an Andaaza learning statistic or application setting.
- NEVER autonomously save or delete permanent memories without proposing a confirmation-gated action (memory.save or memory.delete).

Known current limitations — disclose these when relevant, do not silently work around them:
- Expiry-date tracking is not populated yet for most items; you usually cannot answer "what expires this week" with real dates.
- Portion/volumetric calibration (e.g. "1 katori of rice" -> grams) is not active; fall back to recipe base quantities.
- Spend-trend answers are limited to raw monthly bill totals — no category-level budget breakdown yet.
- Ingredient "days remaining" predictions are derived from purchase cadence, not actual cooking/eating rate.`

function toolCatalogueBlock(tools: ProviderToolSpec[]): string {
  const lines = tools.map((t) => `- ${t.name}: ${t.description}`)
  return `Available tools (call by name; household scoping is automatic, never ask the user for it):\n${lines.join('\n')}`
}

function baseContextBlock(ctx: BaseContext): string {
  const meals = ctx.todaysMeals.length > 0
    ? ctx.todaysMeals.map((m) => `${m.meal_type}: ${m.status}`).join(', ')
    : 'none planned yet'

  const memoryLines = ctx.activeMemories && ctx.activeMemories.length > 0
    ? ctx.activeMemories.map((m) => `- [${m.memory_type.toUpperCase()}] ${m.memory_key}: "${m.memory_value}"`).join('\n')
    : '- None recorded'

  return [
    `Household snapshot (as of ${ctx.asOf}):`,
    `- Household: ${ctx.householdName}, ${ctx.memberCount} member(s)`,
    `- Pantry health: ${ctx.pantryHealthScore ?? 'unknown'} (${ctx.pantryHealthLabel ?? 'n/a'})`,
    `- Items at low-stock risk: ${ctx.lowStockCount}`,
    `- Today's meals: ${meals}`,
    ``,
    `Explicit Household Copilot Memories:`,
    memoryLines,
  ].join('\n')
}

export interface BuiltPrompt {
  system: string
  messages: ProviderMessage[]
  /** §7.4: segments that are byte-identical across requests and safe to prompt-cache. */
  cacheableSystemPrefix: string
  estimatedTokens: { system: number; history: number; total: number }
  /** §4.3 hard cap check result. */
  exceedsBudget: boolean
}

export function buildPrompt(args: {
  capabilities: CapabilityEntry[]
  toolSpecs: ProviderToolSpec[]
  baseContext: BaseContext
  history: ProviderMessage[] // already capped/summarized by the caller per §5.1
  userTurn: string
  maxContextTokens: number
}): BuiltPrompt {
  // §4.1: four fixed blocks, deterministic order, blocks 1-2 static (cacheable), 3-4 dynamic.
  const block1 = IDENTITY_BLOCK
  const block2 = toolCatalogueBlock(args.toolSpecs)
  const block3 = baseContextBlock(args.baseContext)

  const cacheableSystemPrefix = `${block1}\n\n${block2}`
  const system = `${cacheableSystemPrefix}\n\n${block3}`

  const messages: ProviderMessage[] = [...args.history, { role: 'user', content: args.userTurn }]

  const systemTokens = estimateTokens(system)
  const historyTokens = args.history.reduce((sum, m) => sum + estimateTokens(m.content), 0) + estimateTokens(args.userTurn)
  const total = systemTokens + historyTokens

  return {
    system,
    messages,
    cacheableSystemPrefix,
    estimatedTokens: { system: systemTokens, history: historyTokens, total },
    exceedsBudget: total > args.maxContextTokens,
  }
}

/** §4.3 hard cap: once mid-loop context estimate crosses the budget, force a synthesis turn
 * instead of allowing further tool-call chaining. */
export function buildForcedSynthesisInstruction(): ProviderMessage {
  return {
    role: 'user',
    content: 'Context budget reached. Answer now with the information already gathered — do not call any more tools this turn.',
  }
}
