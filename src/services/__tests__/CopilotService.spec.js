import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CopilotService } from '../CopilotService.js'

describe('CopilotService', () => {
  let mockSupabase

  beforeEach(() => {
    vi.restoreAllMocks()
    mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'mock-jwt-token' } },
          error: null,
        }),
      },
      from: vi.fn(),
    }
  })

  describe('generateAutoTitle', () => {
    it('returns New Conversation for empty or non-string input', () => {
      expect(CopilotService.generateAutoTitle(null)).toBe('New Conversation')
      expect(CopilotService.generateAutoTitle('')).toBe('New Conversation')
    })

    it('returns exact prompt if <= 35 characters', () => {
      expect(CopilotService.generateAutoTitle('What should I cook tonight?')).toBe('What should I cook tonight?')
    })

    it('truncates long prompt with ellipsis if > 35 characters', () => {
      const longPrompt = 'Which ingredients in my inventory are running low and need restocking this weekend?'
      const title = CopilotService.generateAutoTitle(longPrompt)
      expect(title.length).toBeLessThanOrEqual(35)
      expect(title.endsWith('...')).toBe(true)
    })
  })

  describe('loadConversations', () => {
    it('returns empty array if no householdId is provided', async () => {
      const res = await CopilotService.loadConversations(null, mockSupabase)
      expect(res).toEqual([])
    })

    it('fetches conversations ordered by updated_at descending', async () => {
      const mockList = [{ id: 'c1', title: 'Session 1' }]
      const selectChain = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockList, error: null }),
      }
      mockSupabase.from.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) })

      const res = await CopilotService.loadConversations('hh-1', mockSupabase)
      expect(mockSupabase.from).toHaveBeenCalledWith('copilot_conversations')
      expect(selectChain.eq).toHaveBeenCalledWith('household_id', 'hh-1')
      expect(res).toEqual(mockList)
    })
  })

  describe('loadMessages', () => {
    it('fetches messages for a conversation ordered by created_at ascending', async () => {
      const mockMsgs = [{ id: 'm1', role: 'user', content: 'Hi' }]
      const selectChain = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockMsgs, error: null }),
      }
      mockSupabase.from.mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) })

      const res = await CopilotService.loadMessages('c1', mockSupabase)
      expect(mockSupabase.from).toHaveBeenCalledWith('copilot_messages')
      expect(selectChain.eq).toHaveBeenCalledWith('conversation_id', 'c1')
      expect(res).toEqual(mockMsgs)
    })
  })

  describe('createConversation', () => {
    it('inserts a new conversation row and returns the created record', async () => {
      const createdRow = { id: 'c2', household_id: 'hh-1', title: 'New Conversation' }
      const insertChain = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: createdRow, error: null }),
      }
      mockSupabase.from.mockReturnValue({ insert: vi.fn().mockReturnValue(insertChain) })

      const res = await CopilotService.createConversation('hh-1', 'New Conversation', mockSupabase)
      expect(mockSupabase.from).toHaveBeenCalledWith('copilot_conversations')
      expect(insertChain.select).toHaveBeenCalled()
      expect(res).toEqual(createdRow)
    })
  })

  describe('renameConversation', () => {
    it('updates title and updated_at timestamp', async () => {
      const updateChain = {
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
      mockSupabase.from.mockReturnValue({ update: vi.fn().mockReturnValue(updateChain) })

      const ok = await CopilotService.renameConversation('c1', 'Renamed Title', mockSupabase)
      expect(ok).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('copilot_conversations')
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'c1')
    })
  })

  describe('deleteConversation', () => {
    it('deletes messages and conversation row', async () => {
      const deleteChainMsgs = { eq: vi.fn().mockResolvedValue({ error: null }) }
      const deleteChainConvo = { eq: vi.fn().mockResolvedValue({ error: null }) }

      mockSupabase.from
        .mockReturnValueOnce({ delete: vi.fn().mockReturnValue(deleteChainMsgs) })
        .mockReturnValueOnce({ delete: vi.fn().mockReturnValue(deleteChainConvo) })

      const ok = await CopilotService.deleteConversation('c1', mockSupabase)
      expect(ok).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('copilot_messages')
      expect(mockSupabase.from).toHaveBeenCalledWith('copilot_conversations')
    })
  })

  describe('streamChatTurn', () => {
    it('invokes onError if prompt message is empty', async () => {
      const onError = vi.fn()
      await CopilotService.streamChatTurn({ message: '', onError })
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_request' }))
    })

    it('handles HTTP 429 rate_limited response correctly', async () => {
      const onError = vi.fn()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({ error: { code: 'rate_limited', message: 'Rate limit exceeded' } }),
      })

      await CopilotService.streamChatTurn({
        message: 'Hello',
        onError,
        client: mockSupabase,
      })

      expect(onError).toHaveBeenCalledWith({
        code: 'rate_limited',
        message: 'Turn rate limit exceeded for this household. Please wait before sending another message.',
      })
    })

    it('parses SSE stream events (token, tool_call, done)', async () => {
      const onToken = vi.fn()
      const onToolCall = vi.fn()
      const onDone = vi.fn()

      const streamContent =
        'event: tool_call\ndata: {"tool":"InventoryTool","status":"success"}\n\n' +
        'event: token\ndata: {"delta":"You have "}\n\n' +
        'event: token\ndata: {"delta":"500g Rice."}\n\n' +
        'event: done\ndata: {"message_id":"m1","conversation_id":"c1","citations":[]}\n\n'

      const EncoderClass = typeof window !== 'undefined' ? window.TextEncoder : globalThis.TextEncoder
      const StreamClass = typeof window !== 'undefined' ? window.ReadableStream : globalThis.ReadableStream
      const encoder = new EncoderClass()
      const readableStream = new StreamClass({
        start(controller) {
          controller.enqueue(encoder.encode(streamContent))
          controller.close()
        },
      })

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: readableStream,
      })

      await CopilotService.streamChatTurn({
        message: 'Check rice',
        onToken,
        onToolCall,
        onDone,
        client: mockSupabase,
      })

      expect(onToolCall).toHaveBeenCalledWith({ tool: 'InventoryTool', status: 'success' })
      expect(onToken).toHaveBeenCalledWith('You have ')
      expect(onToken).toHaveBeenCalledWith('500g Rice.')
      expect(onDone).toHaveBeenCalledWith({
        messageId: 'm1',
        conversationId: 'c1',
        citations: [],
        actionProposal: null,
      })
    })
  })
})
