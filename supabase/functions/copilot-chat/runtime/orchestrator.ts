// LLM Orchestration Loop — the request lifecycle from §1.4's sequence diagram, implemented as an
// async generator so index.ts can forward each event straight onto the SSE response as it
// happens, rather than buffering the whole turn in memory.
//
// Streaming design note: raw LLM tokens are NOT forwarded to the client as they're generated.
// §1.9 frames the AI Trust Model as a gate that "mechanically blocks any response from shipping
// until it passes" — shipping means the client never sees a draft that hasn't been validated,
// not even transiently. So this orchestrator buffers each round's text internally, runs the full
// Trust Model pipeline, and only then emits `token` events for the validated (or BLOCK-fallback)
// text — chunked for a smooth client-side reveal, not because the provider streamed it that way.
// This trades a slightly later first-token time for the correctness guarantee the design doc
// actually asks for; §7.1's latency budget should be read as "first token of the validated
// answer," not the underlying provider's raw first-token time.
import type {
  Citation,
  EvidenceLedgerEntry,
  LLMProvider,
  ProviderMessage,
  ProviderStreamEvent,
  ToolCallRecord,
  ToolContext,
  ToolResult,
  TrustVerdict,
} from '../types.ts'
import { config } from '../config.ts'
import { capabilityRegistry } from '../registry/capabilityRegistry.ts'
import { TOOL_IMPLEMENTATIONS } from '../tools/index.ts'
import { assembleBaseContext } from './contextAssembler.ts'
import { buildForcedSynthesisInstruction, buildPrompt } from './promptBuilder.ts'
import { buildBlockFallback, buildEvidenceLedger, evaluateTrust } from './trustModel.ts'
import * as conversationStore from './conversationStore.ts'
import { emitToolTelemetry, emitTurnTelemetry } from './telemetry.ts'

export type OrchestratorEvent =
  | { type: 'token'; delta: string }
  | { type: 'tool_call'; tool: string; status: 'started' | 'completed'; asOf?: string }
  | { type: 'done'; messageId: string; conversationId: string; citations: Citation[]; actionProposal?: unknown }
  | { type: 'error'; code: string; message: string }

const MAX_TOOL_ROUNDS = 6 // safety bound independent of the token budget (§4.3), guards against a pathological tool-call loop
const CHUNK_SIZE = 48 // presentation-only reveal granularity for the post-validation flush, see module header

function errResult(code: string, message: string, source: string): ToolResult<unknown> {
  return { ok: false, error: { code, message }, asOf: new Date().toISOString(), source }
}

/** §3.2/§1.8: timeout + one retry for idempotent reads, then degrade — never throw out of the
 * turn, since a single failed tool must not fail the whole answer (§1.8 "partial multi-tool
 * failures degrade gracefully"). */
export async function invokeToolWithBudget(
  capabilityId: string,
  input: unknown,
  ctx: ToolContext
): Promise<{ result: ToolResult<unknown>; durationMs: number }> {
  const entry = capabilityRegistry.resolve(capabilityId)
  const start = performance.now()

  if (!entry || !capabilityRegistry.isInvocable(capabilityId)) {
    return { result: errResult('CAPABILITY_NOT_INVOCABLE', `"${capabilityId}" is not available`, capabilityId), durationMs: performance.now() - start }
  }

  // Sprint 6D: Write capabilities run their thin adapter to prepare a structured ActionProposal.
  // The adapter validates inputs and returns a proposal without mutating database state.

  const impl = TOOL_IMPLEMENTATIONS[entry.bound_tool]
  if (!impl) {
    return { result: errResult('TOOL_NOT_IMPLEMENTED', `No implementation bound to "${entry.bound_tool}"`, capabilityId), durationMs: performance.now() - start }
  }

  const budgetMs = entry.timeout_ms || entry.perf_budget_ms || config.defaultToolTimeoutMs
  const attempt = () =>
    Promise.race([
      impl(input, ctx),
      new Promise<ToolResult<unknown>>((_, reject) => setTimeout(() => reject(new Error('timeout')), budgetMs)),
    ])

  try {
    const result = await attempt()
    return { result, durationMs: performance.now() - start }
  } catch (firstErr) {
    for (let i = 0; i < config.toolRetryCount; i++) {
      try {
        const result = await attempt()
        return { result, durationMs: performance.now() - start }
      } catch {
        // retry exhausted below
      }
    }
    const message = firstErr instanceof Error ? firstErr.message : String(firstErr)
    const timedOut = message === 'timeout'
    return {
      result: errResult(timedOut ? 'TOOL_TIMEOUT' : 'TOOL_ERROR', message, capabilityId),
      durationMs: performance.now() - start,
    }
  }
}

interface RoundResult {
  text: string
  toolCalls: Extract<ProviderStreamEvent, { type: 'tool_call' }>[]
  usage?: { inputTokens: number; outputTokens: number }
}

/** Objective 2: Runs provider round with configurable timeout wrapper. */
async function runProviderRound(
  provider: LLMProvider,
  system: string,
  messages: ProviderMessage[],
  tools: ReturnType<typeof capabilityRegistry.toProviderToolSpecs>,
  timeoutMs: number = config.llmTimeoutMs
): Promise<RoundResult> {
  let text = ''
  const toolCalls: Extract<ProviderStreamEvent, { type: 'tool_call' }>[] = []
  let usage: { inputTokens: number; outputTokens: number } | undefined

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    for await (const ev of provider.streamChat({ system, messages, tools, signal: controller.signal })) {
      if (ev.type === 'text_delta') text += ev.delta
      else if (ev.type === 'tool_call') toolCalls.push(ev)
      else if (ev.type === 'usage') usage = { inputTokens: ev.inputTokens, outputTokens: ev.outputTokens }
    }
    return { text, toolCalls, usage }
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('PROVIDER_TIMEOUT'))) {
      throw new Error(`LLM provider round timed out after ${timeoutMs}ms (PROVIDER_TIMEOUT)`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function estimateRunningTokens(messages: ProviderMessage[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil((m.content?.length ?? 0) / 4), 0)
}

function* chunk(text: string, size: number): Generator<string> {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size)
}

export async function* runTurn(args: {
  requestId: string
  ctx: ToolContext
  provider: LLMProvider
  conversationId: string | null
  userTurn: string
}): AsyncGenerator<OrchestratorEvent> {
  const turnStart = performance.now()
  const toolTimingsMs: number[] = []
  let toolCallCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  const conversationId = await conversationStore.getOrCreateConversation(args.ctx, args.conversationId)

  const [baseContext, historyRows] = await Promise.all([
    assembleBaseContext(args.ctx),
    conversationStore.loadRecentMessages(args.ctx, conversationId, config.sessionMemoryTurns),
    conversationStore.saveMessage(args.ctx, { conversationId, role: 'user', content: args.userTurn }),
  ])

  const history: ProviderMessage[] = historyRows.map((m) => ({ role: m.role, content: m.content }))
  const toolSpecs = capabilityRegistry.toProviderToolSpecs()

  const built = buildPrompt({
    capabilities: capabilityRegistry.listEnabled(),
    toolSpecs,
    baseContext,
    history,
    userTurn: args.userTurn,
    maxContextTokens: config.maxContextTokens,
  })

  let workingMessages = built.messages
  const evidenceSources: Array<{ tool: string; capabilityId: string; result: ToolResult<unknown> }> = []
  const toolCallRecords: ToolCallRecord[] = []
  const failedTools: string[] = []
  let draftText = ''
  let round = 0
  let budgetExceeded = false

  while (round < MAX_TOOL_ROUNDS) {
    round++
    if (built.exceedsBudget || estimateRunningTokens(workingMessages) > config.maxContextTokens) {
      budgetExceeded = true
      workingMessages = [...workingMessages, buildForcedSynthesisInstruction()]
    }

    const { text, toolCalls, usage } = await runProviderRound(
      args.provider,
      built.system,
      workingMessages,
      budgetExceeded ? [] : toolSpecs
    )
    if (usage) { totalInputTokens += usage.inputTokens; totalOutputTokens += usage.outputTokens }

    if (toolCalls.length === 0 || budgetExceeded) {
      draftText = text
      break
    }

    // Objective 6: Execute independent tool calls concurrently while preserving deterministic ordering
    for (const call of toolCalls) {
      toolCallCount++
      yield { type: 'tool_call', tool: call.toolName, status: 'started' }
    }

    const executedTools = await Promise.all(
      toolCalls.map(async (call) => {
        const { result, durationMs } = await invokeToolWithBudget(call.toolName, call.input, args.ctx)
        return { call, result, durationMs }
      })
    )

    // Process executed tool calls in original deterministic order
    for (const { call, result, durationMs } of executedTools) {
      toolTimingsMs.push(durationMs)
      const status = result.ok ? 'success' : (result.error?.code === 'TOOL_TIMEOUT' ? 'timeout' : 'error')
      if (!result.ok) {
        failedTools.push(call.toolName)
      }
      emitToolTelemetry({ requestId: args.requestId, householdId: args.ctx.householdId, capabilityId: call.toolName, durationMs, status })
      yield { type: 'tool_call', tool: call.toolName, status: 'completed', asOf: result.asOf }

      evidenceSources.push({ tool: call.toolName, capabilityId: call.toolName, result })
      const entry = capabilityRegistry.resolve(call.toolName)
      toolCallRecords.push({
        messageId: '', // filled in once assistant message row exists
        capabilityId: call.toolName,
        toolName: entry?.bound_tool ?? call.toolName,
        capabilityVersion: entry?.version ?? '1.0.0',
        input: call.input,
        output: result,
        asOf: result.asOf ?? null,
        durationMs,
        status,
      })

      workingMessages = [
        ...workingMessages,
        { role: 'assistant', content: '', toolName: call.toolName, toolCallId: call.toolCallId, toolInput: call.input, providerMeta: call.providerMeta },
        { role: 'tool', content: JSON.stringify(result), toolName: call.toolName, toolCallId: call.toolCallId },
      ]
    }
  }

  // ── AI Trust Model (§1.9) — runs on the fully-buffered draft before anything is shipped ──
  const ledger: EvidenceLedgerEntry[] = buildEvidenceLedger(evidenceSources)
  let trust = evaluateTrust(draftText, ledger, failedTools)
  let repairCount = 0

  while (trust.verdict === 'REPAIR' && repairCount < config.trustModelMaxRepairAttempts) {
    repairCount++
    workingMessages = [
      ...workingMessages,
      { role: 'assistant', content: draftText },
      { role: 'user', content: trust.repairInstruction ?? 'Please revise your answer to cite only tool-returned data.' },
    ]
    const repaired = await runProviderRound(args.provider, built.system, workingMessages, [])
    if (repaired.usage) { totalInputTokens += repaired.usage.inputTokens; totalOutputTokens += repaired.usage.outputTokens }
    draftText = repaired.text
    trust = evaluateTrust(draftText, ledger, failedTools)
  }

  let finalVerdict: TrustVerdict = trust.verdict
  let finalText = draftText
  let citations: Citation[] = []

  if (trust.verdict === 'REPAIR') {
    // Repair budget exhausted and still failing -> BLOCK (§1.9): never ship the ungrounded draft.
    const blocked = buildBlockFallback()
    finalVerdict = 'BLOCK'
    finalText = blocked.fallbackText ?? finalText
  } else if (trust.verdict === 'PASS') {
    citations = trust.citations
  }

  let actionProposal: unknown = undefined
  for (const source of evidenceSources) {
    if (source.result.ok && source.result.data && (source.result.data as { capabilityId?: string }).capabilityId) {
      actionProposal = source.result.data
      break
    }
  }

  // Only now does anything reach the client — see module header.
  for (const piece of chunk(finalText, CHUNK_SIZE)) yield { type: 'token', delta: piece }

  const messageId = await conversationStore.saveMessage(args.ctx, {
    conversationId,
    role: 'assistant',
    content: finalText,
    trustVerdict: finalVerdict.toLowerCase() as Lowercase<TrustVerdict>,
    citations,
    actionProposal,
  })
  await conversationStore.saveToolCalls(
    args.ctx,
    messageId,
    toolCallRecords.map((r) => ({ ...r, messageId }))
  )

  emitTurnTelemetry({
    requestId: args.requestId,
    householdId: args.ctx.householdId,
    provider: args.provider.name,
    toolCallCount,
    toolTimingsMs,
    latencyMs: performance.now() - turnStart,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    trustVerdict: finalVerdict,
    repairCount,
    blocked: finalVerdict === 'BLOCK',
  })

  yield { type: 'done', messageId, conversationId, citations, actionProposal }
}
