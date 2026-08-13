// Shared types for the AI Copilot runtime. Mirrors the contracts frozen in
// docs/21_AI_COPILOT_ARCHITECTURE_AND_DESIGN.md v1.1.0 — section references throughout point back
// to that document rather than re-deriving the reasoning here.

// ── Tool envelope (§3.2) ──────────────────────────────────────────────────
export interface ToolError {
  code: string
  message: string
}

/** Every tool returns exactly this shape — see §3.2 "Design Rules for All Tools". */
export interface ToolResult<T> {
  ok: boolean
  data?: T
  error?: ToolError
  asOf: string // ISO timestamp
  source: string // e.g. 'inventory', 'prediction_cache', 'planning_engine'
  stale?: boolean // §2 prediction_cache.ttl_expires_at staleness flag
}

export function okResult<T>(data: T, source: string, extra: Partial<ToolResult<T>> = {}): ToolResult<T> {
  return { ok: true, data, asOf: new Date().toISOString(), source, ...extra }
}

export function errResult<T>(code: string, message: string, source: string): ToolResult<T> {
  return { ok: false, error: { code, message }, asOf: new Date().toISOString(), source }
}

// ── Capability Registry (§3.1) ────────────────────────────────────────────
export type AccessClass = 'read' | 'write'

export interface CapabilityEntry {
  capability_id: string
  description: string
  bound_tool: string // key into the tool implementation map
  access_class: AccessClass
  household_scope: 'injected' // invariant — see §3.1; no other value is ever valid
  data_sources: string[]
  version: string
  deprecated_at: string | null
  perf_budget_ms: number
  /** Sprint 6B ships read-only; write capabilities are registered but never enabled for
   * invocation until Sprint 6D implements the confirmation flow (§6.3/§6.4). */
  enabled: boolean
  token_budget: number
  max_rows: number
  timeout_ms: number
  parallel_safe: boolean
  priority: number
}

/** Minimal request context every tool executes under — household_id is always injected here,
 * never accepted as an LLM-supplied argument (§3.2, §6.1). */
export interface ToolContext {
  householdId: string
  // deno-lint-ignore no-explicit-any
  client: any // SupabaseClient, typed loosely here to avoid a hard npm: type dependency in this file
}

// deno-lint-ignore no-explicit-any
export type ToolFn = (input: any, ctx: ToolContext) => Promise<ToolResult<unknown>>

// ── AI Trust Model (§1.9) ─────────────────────────────────────────────────
export interface EvidenceLedgerEntry {
  tool: string
  capabilityId: string
  data: unknown
  asOf: string
  source: string
  stale?: boolean
  version?: string
}

export type TrustVerdict = 'PASS' | 'REPAIR' | 'BLOCK'

export interface Citation {
  tool: string
  source: string
  asOf: string
  summary: string
}

export interface ActionProposalPreview {
  action: string
  affectedItems: string[]
  quantities: string[]
  householdImpact: string
  expectedResult: string
  irreversible: boolean
}

export interface MemoryItem {
  id: string
  household_id: string
  memory_type: 'preference' | 'restriction' | 'habit' | 'instruction' | 'context'
  memory_key: string
  memory_value: string
  source: 'user_explicit' | 'ui_setting'
  confidence: number
  status: 'active' | 'disabled' | 'expired' | 'deleted'
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export interface ActionProposal {
  capabilityId: string
  actionName: string
  payload: Record<string, unknown>
  preview: ActionProposalPreview
}

export interface TrustModelResult {
  verdict: TrustVerdict
  citations: Citation[]
  /** Present only when verdict is REPAIR or BLOCK — fed back to the LLM or substituted directly. */
  repairInstruction?: string
  fallbackText?: string
}

// ── Conversation (§5.1) ───────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant'

export interface ConversationMessage {
  id?: string
  conversationId: string
  householdId: string
  role: MessageRole
  content: string
  trustVerdict?: Lowercase<TrustVerdict>
  citations?: Citation[]
  createdAt?: string
}

export interface ToolCallRecord {
  messageId: string
  capabilityId: string
  toolName: string
  capabilityVersion?: string
  input: unknown
  output: unknown
  asOf: string | null
  durationMs: number
  status: 'success' | 'error' | 'timeout'
}

// ── LLM Provider abstraction ──────────────────────────────────────────────
export interface ProviderToolSpec {
  name: string
  description: string
  // JSON Schema for the tool's input
  // deno-lint-ignore no-explicit-any
  inputSchema: Record<string, any>
}

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  // Present on assistant messages that requested a tool call, and on the following tool message.
  toolName?: string
  toolCallId?: string
  toolInput?: unknown
  /** Opaque, provider-specific continuation data the orchestrator must thread back verbatim on
   * the matching assistant tool-call message but never itself interpret (keeps provider quirks —
   * e.g. Gemini's mandatory functionCall `thoughtSignature`, discovered via live testing against
   * the real API rather than assumed — contained to that provider's own module, satisfying "no
   * provider-specific code outside this layer"). Providers that don't need it simply ignore it. */
  providerMeta?: unknown
}

export type ProviderStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; toolCallId: string; toolName: string; input: unknown; providerMeta?: unknown }
  | { type: 'done'; stopReason: 'end_turn' | 'tool_use' | 'max_tokens' }
  | { type: 'usage'; inputTokens: number; outputTokens: number }

export interface LLMProvider {
  name: string
  streamChat(args: {
    system: string
    messages: ProviderMessage[]
    tools: ProviderToolSpec[]
    signal?: AbortSignal
  }): AsyncGenerator<ProviderStreamEvent>
}

// ── Telemetry (§7, Sprint 6B "Telemetry" section) ─────────────────────────
export interface TelemetryEvent {
  event: string
  requestId: string
  householdId: string // internal correlation only — never sent to the LLM provider or client as PII
  timestamp: string
  [key: string]: unknown
}
