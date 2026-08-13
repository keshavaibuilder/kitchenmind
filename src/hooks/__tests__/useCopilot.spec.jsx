import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useCopilot from '../useCopilot.js'
import { CopilotService } from '../../services/CopilotService.js'

vi.mock('../useHousehold.js', () => ({
  useHousehold: () => ({
    household: { id: 'hh-1', name: 'Test Family' },
  }),
}))

vi.mock('../../services/CopilotService.js', () => ({
  CopilotService: {
    generateAutoTitle: vi.fn((text) => text.substring(0, 20)),
    loadConversations: vi.fn().mockResolvedValue([
      { id: 'c1', title: 'Conversation 1', updated_at: '2026-08-10T00:00:00Z' },
    ]),
    loadMessages: vi.fn().mockResolvedValue([
      { id: 'm1', role: 'user', content: 'What should I cook?' },
      { id: 'm2', role: 'assistant', content: 'You can cook Dal Tadka.' },
    ]),
    createConversation: vi.fn().mockResolvedValue({ id: 'c2', title: 'New Chat' }),
    renameConversation: vi.fn().mockResolvedValue(true),
    deleteConversation: vi.fn().mockResolvedValue(true),
    clearMessages: vi.fn().mockResolvedValue(true),
    streamChatTurn: vi.fn().mockImplementation(({ onDone }) => {
      onDone({ messageId: 'm3', conversationId: 'c1', citations: [] })
      return Promise.resolve()
    }),
  },
}))

describe('useCopilot hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads conversation list on mount', async () => {
    const { result } = renderHook(() => useCopilot())

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(CopilotService.loadConversations).toHaveBeenCalledWith('hh-1')
    expect(result.current.rawConversations.length).toBe(1)
    expect(result.current.rawConversations[0].title).toBe('Conversation 1')
  })

  it('selects conversation and loads messages', async () => {
    const { result } = renderHook(() => useCopilot())

    await act(async () => {
      result.current.selectConversation('c1')
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.activeConversationId).toBe('c1')
    expect(CopilotService.loadMessages).toHaveBeenCalledWith('c1')
    expect(result.current.messages.length).toBe(2)
  })

  it('creates new conversation', async () => {
    const { result } = renderHook(() => useCopilot())

    await act(async () => {
      await result.current.createNewConversation('Custom Title')
    })

    expect(CopilotService.createConversation).toHaveBeenCalledWith('hh-1', 'Custom Title')
    expect(result.current.activeConversationId).toBe('c2')
  })

  it('sends turn and handles streaming done', async () => {
    const { result } = renderHook(() => useCopilot())

    await act(async () => {
      result.current.selectConversation('c1')
    })

    await act(async () => {
      await result.current.sendTurn('Check my inventory')
    })

    expect(CopilotService.streamChatTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Check my inventory',
        conversationId: 'c1',
      })
    )
  })
})
