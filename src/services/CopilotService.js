import { supabaseClient } from './supabaseClient.js'
import { env } from '../config/env.config.js'
import { normalizeError } from '../utils/errors.js'

/**
 * Service for interacting with the AI Copilot Edge Function and conversation history store.
 */
export const CopilotService = {
  /**
   * Helper to derive a concise title from the user's initial message.
   * @param {string} promptText
   * @returns {string}
   */
  generateAutoTitle(promptText) {
    if (!promptText || typeof promptText !== 'string') return 'New Conversation'
    const trimmed = promptText.trim()
    if (trimmed.length <= 35) return trimmed
    return trimmed.substring(0, 32).trim() + '...'
  },

  /**
   * Stream a chat turn to the copilot-chat Edge Function via Server-Sent Events.
   * @param {Object} params
   * @param {string} params.message - User prompt
   * @param {string|null} [params.conversationId] - Active conversation ID (if any)
   * @param {function(string): void} [params.onToken] - Callback for incoming streaming token text
   * @param {function(Object): void} [params.onToolCall] - Callback for tool execution status events
   * @param {function(Object): void} [params.onDone] - Callback when turn completes with final metadata & citations
   * @param {function(Object): void} [params.onError] - Callback for structured errors
   * @param {AbortSignal} [params.signal] - Signal for stopping generation
   * @param {Object} [params.client] - Optional Supabase client instance
   */
  async streamChatTurn({
    message,
    conversationId = null,
    onToken = () => {},
    onToolCall = () => {},
    onDone = () => {},
    onError = () => {},
    signal = null,
    client = supabaseClient,
  }) {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      onError({ code: 'invalid_request', message: 'Message is required' })
      return
    }

    try {
      const { data: sessionData, error: sessionErr } = await client.auth.getSession()
      if (sessionErr || !sessionData?.session?.access_token) {
        onError({ code: 'unauthenticated', message: 'Invalid or expired auth session' })
        return
      }

      const baseUrl = env.SUPABASE_URL || 'https://placeholder.supabase.co'
      const functionUrl = `${baseUrl.replace(/\/$/, '')}/functions/v1/copilot-chat`

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId || undefined,
          message: message.trim(),
        }),
        signal,
      })

      if (!response.ok) {
        let errCode = 'copilot_unavailable'
        let errMessage = 'The copilot is temporarily unavailable. Try the Dashboard or Planner directly.'

        if (response.status === 401) {
          errCode = 'unauthenticated'
          errMessage = 'Your session has expired. Please log in again.'
        } else if (response.status === 429) {
          errCode = 'rate_limited'
          errMessage = 'Turn rate limit exceeded for this household. Please wait before sending another message.'
        } else {
          try {
            const errJson = await response.json()
            if (errJson?.error?.code) errCode = errJson.error.code
            if (errJson?.error?.message) errMessage = errJson.error.message
          } catch {
            // fallback to default text
          }
        }

        onError({ code: errCode, message: errMessage })
        return
      }

      if (!response.body) {
        onError({ code: 'copilot_unavailable', message: 'Empty stream response received from copilot' })
        return
      }

      const reader = response.body.getReader()
      const DecoderClass = typeof window !== 'undefined' ? window.TextDecoder : globalThis.TextDecoder
      const decoder = new DecoderClass('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // Keep partial event chunk in buffer

        for (const evtBlock of events) {
          if (!evtBlock.trim()) continue
          const lines = evtBlock.split('\n')
          let eventType = 'message'
          let eventData = null

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7).trim()
            } else if (line.startsWith('data: ')) {
              try {
                eventData = JSON.parse(line.substring(6).trim())
              } catch {
                eventData = line.substring(6).trim()
              }
            }
          }

          if (eventType === 'token' && eventData?.delta) {
            onToken(eventData.delta)
          } else if (eventType === 'tool_call' && eventData) {
            onToolCall(eventData)
          } else if (eventType === 'done' && eventData) {
            onDone({
              messageId: eventData.message_id || eventData.messageId,
              conversationId: eventData.conversation_id || eventData.conversationId,
              citations: eventData.citations || [],
              actionProposal: eventData.action_proposal || eventData.actionProposal || null,
            })
          } else if (eventType === 'error' && eventData) {
            onError({
              code: eventData.code || 'copilot_unavailable',
              message: eventData.message || 'An error occurred during turn generation',
            })
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        onError({ code: 'cancelled', message: 'Generation was stopped by user.' })
      } else {
        const norm = normalizeError(err)
        onError({ code: 'copilot_unavailable', message: norm.message || 'Network error while connecting to Copilot.' })
      }
    }
  },

  /**
   * Load active and past conversations for a household.
   * @param {string} householdId
   * @param {Object} [client]
   * @returns {Promise<Array<Object>>}
   */
  async loadConversations(householdId, client = supabaseClient) {
    if (!householdId) return []
    try {
      const { data, error } = await client
        .from('copilot_conversations')
        .select('*')
        .eq('household_id', householdId)
        .order('updated_at', { ascending: false })

      if (error) {
        console.warn('Failed to load copilot_conversations:', error.message)
        return []
      }
      return data || []
    } catch (err) {
      console.warn('Error loading conversations:', err)
      return []
    }
  },

  /**
   * Load message history for a specific conversation.
   * @param {string} conversationId
   * @param {Object} [client]
   * @returns {Promise<Array<Object>>}
   */
  async loadMessages(conversationId, client = supabaseClient) {
    if (!conversationId) return []
    try {
      const { data, error } = await client
        .from('copilot_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) {
        console.warn('Failed to load copilot_messages:', error.message)
        return []
      }
      return data || []
    } catch (err) {
      console.warn('Error loading conversation messages:', err)
      return []
    }
  },

  /**
   * Create a new conversation record.
   * @param {string} householdId
   * @param {string} [title]
   * @param {Object} [client]
   * @returns {Promise<Object|null>}
   */
  async createConversation(householdId, title = 'New Conversation', client = supabaseClient) {
    if (!householdId) return null
    try {
      const { data, error } = await client
        .from('copilot_conversations')
        .insert({
          household_id: householdId,
          title: title.trim(),
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.warn('Failed to create copilot conversation:', err)
      return null
    }
  },

  /**
   * Rename an existing conversation.
   * @param {string} conversationId
   * @param {string} newTitle
   * @param {Object} [client]
   * @returns {Promise<boolean>}
   */
  async renameConversation(conversationId, newTitle, client = supabaseClient) {
    if (!conversationId || !newTitle) return false
    try {
      const { error } = await client
        .from('copilot_conversations')
        .update({
          title: newTitle.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)

      return !error
    } catch (err) {
      console.warn('Failed to rename copilot conversation:', err)
      return false
    }
  },

  /**
   * Delete a conversation and all associated messages.
   * @param {string} conversationId
   * @param {Object} [client]
   * @returns {Promise<boolean>}
   */
  async deleteConversation(conversationId, client = supabaseClient) {
    if (!conversationId) return false
    try {
      // First delete messages for cleanliness (or cascade RLS)
      await client.from('copilot_messages').delete().eq('conversation_id', conversationId)
      const { error } = await client.from('copilot_conversations').delete().eq('id', conversationId)
      return !error
    } catch (err) {
      console.warn('Failed to delete copilot conversation:', err)
      return false
    }
  },

  /**
   * Clear all messages in a conversation without deleting the conversation container.
   * @param {string} conversationId
   * @param {Object} [client]
   * @returns {Promise<boolean>}
   */
  async clearMessages(conversationId, client = supabaseClient) {
    if (!conversationId) return false
    try {
      const { error } = await client.from('copilot_messages').delete().eq('conversation_id', conversationId)
      return !error
    } catch (err) {
      console.warn('Failed to clear conversation messages:', err)
      return false
    }
  },
}
