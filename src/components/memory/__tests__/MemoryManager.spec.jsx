import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MemoryManager from '../MemoryManager.jsx'

const mockMemories = [
  {
    id: 'mem-1',
    memory_type: 'preference',
    memory_key: 'weekday_breakfast',
    memory_value: 'Prefers quick 15-minute breakfasts on weekdays.',
    source: 'user_explicit',
    status: 'active',
    created_at: '2026-08-10T10:00:00Z',
  },
  {
    id: 'mem-2',
    memory_type: 'restriction',
    memory_key: 'spiciness',
    memory_value: 'Children do not like very spicy food.',
    source: 'user_explicit',
    status: 'disabled',
    created_at: '2026-08-09T10:00:00Z',
  },
]

const mockSaveMemory = vi.fn().mockResolvedValue({})
const mockUpdateMemory = vi.fn().mockResolvedValue({})
const mockToggleMemoryStatus = vi.fn().mockResolvedValue({})
const mockDeleteMemory = vi.fn().mockResolvedValue({})
const mockClearAllMemories = vi.fn().mockResolvedValue({})

vi.mock('../../../hooks/useMemory.js', () => ({
  useMemory: () => ({
    memories: mockMemories,
    isLoading: false,
    saveMemory: mockSaveMemory,
    updateMemory: mockUpdateMemory,
    toggleMemoryStatus: mockToggleMemoryStatus,
    deleteMemory: mockDeleteMemory,
    clearAllMemories: mockClearAllMemories,
  }),
}))

describe('MemoryManager component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders memory list and counts correctly', () => {
    render(<MemoryManager />)

    expect(screen.getByText('What KitchenMind Remembers')).toBeInTheDocument()
    expect(screen.getByText(/Prefers quick 15-minute breakfasts/)).toBeInTheDocument()
    expect(screen.getByText(/Children do not like very spicy food/)).toBeInTheDocument()
  })

  it('filters memories by status tab click', () => {
    render(<MemoryManager />)

    const activeTab = screen.getAllByRole('button', { name: 'Active' })[0]
    fireEvent.click(activeTab)

    expect(screen.getByText(/Prefers quick 15-minute breakfasts/)).toBeInTheDocument()
    expect(screen.queryByText(/Children do not like very spicy food/)).not.toBeInTheDocument()
  })

  it('opens add memory modal and triggers saveMemory', async () => {
    render(<MemoryManager />)

    const addBtn = screen.getByRole('button', { name: '+ Add Memory' })
    fireEvent.click(addBtn)

    expect(screen.getByText('Add Explicit Memory')).toBeInTheDocument()

    const keyInput = screen.getByPlaceholderText('weekday_breakfast')
    const valueInput = screen.getByPlaceholderText('Prefers quick 15-minute breakfasts on weekdays.')

    fireEvent.change(keyInput, { target: { value: 'tea_time' } })
    fireEvent.change(valueInput, { target: { value: 'Prefers Masala Chai at 5pm' } })

    const submitBtn = screen.getByRole('button', { name: 'Save Memory' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockSaveMemory).toHaveBeenCalledWith({
        memoryKey: 'tea_time',
        memoryValue: 'Prefers Masala Chai at 5pm',
        memoryType: 'preference',
        source: 'ui_setting',
      })
    })
  })

  it('triggers deleteMemory when delete icon is clicked', () => {
    render(<MemoryManager />)

    const deleteBtns = screen.getAllByTitle('Delete memory')
    fireEvent.click(deleteBtns[0])

    expect(mockDeleteMemory).toHaveBeenCalledWith('mem-1')
  })
})
