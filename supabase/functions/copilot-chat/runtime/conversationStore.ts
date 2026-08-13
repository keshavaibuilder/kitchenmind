// Conversation Store (§5.1) — persistence for copilot_conversations/copilot_messages/
// copilot_tool_calls (migration 0010). Household isolation comes entirely from RLS on the
// per-request-scoped client (§6.1) — this module never filters by household_id itself beyond
// what it's told to write, matching the "RLS is the authorization boundary" principle (§1.1 #3).
import type { Citation, ToolCallRecord, ToolContext, TrustVerdict } from '../types.ts'

export async function getOrCreateConversation(ctx: ToolContext, conversationId?: string | null): Promise<string> {
  if (conversationId) {
    const { data } = await ctx.client
      .from('copilot_conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle()

    if (data?.id) return data.id as string
    return conversationId
  }

  const { data, error } = await ctx.client
    .from('copilot_conversations')
    .insert({ household_id: ctx.householdId })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create conversation: ${error.message}`)
  return data.id as string
}

export interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Session memory (§5.1): last N turns loaded verbatim. Summarization of older turns is a
 * Sprint 6E deliverable (design doc §10 roadmap row) — this sprint caps at N and stops there,
 * which is the documented, safe default rather than silently dropping context. */
export async function loadRecentMessages(
  ctx: ToolContext,
  conversationId: string,
  limit: number
): Promise<StoredMessage[]> {
  const { data, error } = await ctx.client
    .from('copilot_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to load conversation history: ${error.message}`)
  return ((data ?? []) as StoredMessage[]).reverse()
}

export async function saveMessage(
  ctx: ToolContext,
  args: {
    conversationId: string
    role: 'user' | 'assistant'
    content: string
    trustVerdict?: Lowercase<TrustVerdict>
    citations?: Citation[]
    actionProposal?: unknown
  }
): Promise<string> {
  const citationsToSave = [...(args.citations ?? [])]
  if (args.actionProposal) {
    citationsToSave.push({
      tool: 'ActionProposal',
      source: 'action_proposal',
      asOf: new Date().toISOString(),
      summary: 'Action Proposal',
      // @ts-ignore attach raw proposal payload to jsonb citations
      proposal: args.actionProposal,
    })
  }

  const { data, error } = await ctx.client
    .from('copilot_messages')
    .insert({
      conversation_id: args.conversationId,
      household_id: ctx.householdId,
      role: args.role,
      content: args.content,
      trust_verdict: args.trustVerdict ?? null,
      citations: citationsToSave,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save message: ${error.message}`)

  await ctx.client
    .from('copilot_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', args.conversationId)

  return data.id as string
}

export async function saveToolCalls(ctx: ToolContext, messageId: string, records: ToolCallRecord[]): Promise<void> {
  if (records.length === 0) return
  const rows = records.map((r) => ({
    message_id: messageId,
    capability_id: r.capabilityId,
    tool_name: r.toolName,
    capability_version: r.capabilityVersion ?? '1.0.0',
    input: r.input,
    output: r.output,
    as_of: r.asOf,
    duration_ms: Math.round(r.durationMs),
    status: r.status,
  }))
  const { error } = await ctx.client.from('copilot_tool_calls').insert(rows)
  if (error) {
    // Non-fatal: the conversation transcript itself already succeeded. Losing the tool trace
    // degrades the citation/evaluation detail for this turn but must never fail the user-visible
    // response, mirroring the fire-and-forget discipline already established for Andaaza/AI
    // Observation post-commit hooks elsewhere in this codebase.
    console.warn('[COPILOT] Failed to persist tool call trace:', error.message)
  }
}
