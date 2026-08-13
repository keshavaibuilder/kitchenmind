import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Copilot from '../Copilot.jsx'

vi.mock('../../hooks/useHousehold.js', () => ({
  useHousehold: () => ({
    household: { id: 'hh-1', name: 'Test Household' },
  }),
}))

vi.mock('../../services/CopilotService.js', () => ({
  CopilotService: {
    generateAutoTitle: vi.fn((text) => text.substring(0, 20)),
    loadConversations: vi.fn().mockResolvedValue([
      { id: 'c1', title: 'Pantry Question', updated_at: '2026-08-10T00:00:00Z' },
    ]),
    loadMessages: vi.fn().mockResolvedValue([
      { id: 'm1', role: 'user', content: 'What ingredients are running low?' },
      { id: 'm2', role: 'assistant', content: 'Your Rice (500g) is below the 1000g threshold.', trust_verdict: 'pass', citations: [] },
    ]),
    createConversation: vi.fn().mockResolvedValue({ id: 'c2', title: 'New Conversation' }),
    renameConversation: vi.fn().mockResolvedValue(true),
    deleteConversation: vi.fn().mockResolvedValue(true),
    clearMessages: vi.fn().mockResolvedValue(true),
    streamChatTurn: vi.fn().mockImplementation(({ onDone }) => {
      onDone({ messageId: 'm3', conversationId: 'c1', citations: [] })
      return Promise.resolve()
    }),
  },
}))

describe('Copilot page component', () => {
  let queryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
  })

  it('renders Copilot interface with conversation list and example prompt chips', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Copilot />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Pantry Question')).toBeInTheDocument()
    })

    expect(screen.getByText('What should I cook tonight?')).toBeInTheDocument()
    expect(screen.getByText('Which vegetables will expire first?')).toBeInTheDocument()
  })

  it('allows clicking an example prompt chip to send turn', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Copilot />
        </MemoryRouter>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('What should I cook tonight?')).toBeInTheDocument()
    })

    const promptChip = screen.getByText('What should I cook tonight?')
    fireEvent.click(promptChip)

    await waitFor(() => {
      expect(screen.getByText('What should I cook tonight?')).toBeInTheDocument()
    })
  })
})
