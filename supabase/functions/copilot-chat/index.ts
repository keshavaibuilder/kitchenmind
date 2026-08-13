// AI Copilot Edge Function entry point (§1.2 ADR-6A-1, §8 API Design).
//
// Per-request Supabase client pattern: a NEW client is created for every request, with the
// caller's own Authorization header forwarded — never a shared singleton. This is the standard
// Supabase Edge Function pattern and is required here specifically because a shared,
// session-mutating client (the browser app's pattern, src/services/supabaseClient.js) would leak
// state across concurrent requests from different households in this multi-tenant server
// process. RLS then does the actual household-scoping (§6.1) automatically on every query issued
// through that client — no household_id filtering is ever done in application code.
import { createClient } from '@supabase/supabase-js'
import { config } from './config.ts'
import { HouseholdService } from '@/services/HouseholdService.js'
import { createProvider } from './providers/providerFactory.ts'
import { runTurn } from './runtime/orchestrator.ts'
import { emitErrorTelemetry } from './runtime/telemetry.ts'
import { rateLimiter } from './runtime/rateLimiter.ts'
import type { ToolContext } from './types.ts'

interface CopilotRequestBody {
  conversation_id?: string | null
  message?: string
  client_context?: { current_page?: string }
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID()

  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Only POST is supported')
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonError(401, 'unauthenticated', 'Missing Authorization header')
  }

  let body: CopilotRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonError(422, 'invalid_request', 'Request body must be valid JSON')
  }

  if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
    return jsonError(422, 'invalid_request', '"message" is required')
  }

  // Per-request client, JWT forwarded — see module header. Uses the anon key (never the service
  // role key, §6.1/§0.2) so RLS is the real enforcement boundary, exactly like the browser app.
  const client = createClient(config.supabase.url(), config.supabase.anonKey(), {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: authError } = await client.auth.getUser()
  if (authError || !userData?.user) {
    return jsonError(401, 'unauthenticated', 'Invalid or expired session')
  }

  let householdId: string | null = null
  try {
    householdId = await HouseholdService.getHouseholdIdByUserId(userData.user.id, client)
  } catch (err) {
    emitErrorTelemetry({ requestId, code: 'HOUSEHOLD_LOOKUP_FAILED', message: err instanceof Error ? err.message : String(err) })
    return jsonError(401, 'unauthenticated', 'Could not resolve household for this session')
  }
  if (!householdId) {
    return jsonError(401, 'unauthenticated', 'No household associated with this session')
  }

  if (rateLimiter.isRateLimited(householdId)) {
    emitErrorTelemetry({ requestId, householdId, code: 'RATE_LIMITED', message: 'Household turn rate limit exceeded' })
    return jsonError(429, 'rate_limited', 'Turn rate limit exceeded for this household. Please wait before sending another message.')
  }

  const ctx: ToolContext = { householdId, client }

  let provider
  try {
    provider = createProvider()
  } catch (err) {
    emitErrorTelemetry({ requestId, householdId, code: 'PROVIDER_UNAVAILABLE', message: err instanceof Error ? err.message : String(err) })
    return jsonError(503, 'copilot_unavailable', 'LLM provider is not configured')
  }

  const streamRequested = new URL(req.url).searchParams.get('stream') !== 'false'

  if (!streamRequested) {
    // Non-streaming variant (§8.3) — drains the same async generator, returns one JSON body.
    // Used by clients/evaluation harnesses that don't need incremental rendering.
    try {
      let citations: unknown[] = []
      let messageId = ''
      let conversationId = body.conversation_id ?? null
      for await (const ev of runTurn({ requestId, ctx, provider, conversationId: body.conversation_id ?? null, userTurn: body.message })) {
        if (ev.type === 'done') {
          citations = ev.citations
          messageId = ev.messageId
          conversationId = ev.conversationId
        }
      }
      return new Response(JSON.stringify({ message_id: messageId, conversation_id: conversationId, citations, suggested_actions: [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      emitErrorTelemetry({ requestId, householdId, code: 'TURN_FAILED', message: err instanceof Error ? err.message : String(err) })
      return jsonError(503, 'copilot_unavailable', 'The copilot could not complete this turn')
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const ev of runTurn({ requestId, ctx, provider, conversationId: body.conversation_id ?? null, userTurn: body.message! })) {
          switch (ev.type) {
            case 'token':
              controller.enqueue(encoder.encode(sseEvent('token', { delta: ev.delta })))
              break
            case 'tool_call':
              controller.enqueue(encoder.encode(sseEvent('tool_call', { tool: ev.tool, status: ev.status, asOf: ev.asOf })))
              break
            case 'done':
              controller.enqueue(encoder.encode(sseEvent('done', {
                message_id: ev.messageId,
                conversation_id: ev.conversationId,
                citations: ev.citations,
                action_proposal: ev.actionProposal,
              })))
              break
            case 'error':
              controller.enqueue(encoder.encode(sseEvent('error', { code: ev.code, message: ev.message })))
              break
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        emitErrorTelemetry({ requestId, householdId, code: 'TURN_FAILED', message })
        controller.enqueue(encoder.encode(sseEvent('error', { code: 'copilot_unavailable', message: 'The copilot could not complete this turn' })))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Request-Id': requestId,
    },
  })
})
