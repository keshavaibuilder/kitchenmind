import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MessageItem from '../MessageItem.jsx'

describe('MessageItem component', () => {
  it('renders user message correctly', () => {
    const msg = { role: 'user', content: 'What should I cook tonight?' }
    render(<MessageItem message={msg} />)
    expect(screen.getByText('What should I cook tonight?')).toBeInTheDocument()
  })

  it('renders assistant message with grounding badge', () => {
    const msg = {
      role: 'assistant',
      content: 'You can cook Dal Tadka using your lentils.',
      trust_verdict: 'pass',
      citations: [
        { tool: 'InventoryTool', source: 'inventory', data: { items: [{ canonical_name: 'Lentils', quantity_grams: 500 }] } },
      ],
    }
    render(<MessageItem message={msg} />)

    expect(screen.getByText('KitchenMind Copilot')).toBeInTheDocument()
    expect(screen.getByText('You can cook Dal Tadka using your lentils.')).toBeInTheDocument()
    expect(screen.getByText('Grounded in Kitchen Data')).toBeInTheDocument()
    expect(screen.getByText('Inventory Status')).toBeInTheDocument()
    expect(screen.getByText('Lentils')).toBeInTheDocument()
  })

  it('handles copy button click', async () => {
    const msg = { role: 'assistant', content: 'Test response text' }
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(window.navigator, { clipboard: { writeText: writeTextMock } })

    render(<MessageItem message={msg} />)
    const copyBtn = screen.getByLabelText('Copy message')
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('Test response text')
  })
})
