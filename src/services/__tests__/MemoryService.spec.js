import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryService } from '../MemoryService.js'
import { supabaseClient } from '../supabaseClient.js'

vi.mock('../supabaseClient.js', () => ({
  supabaseClient: {
    from: vi.fn(),
  },
}))

describe('MemoryService', () => {
  const householdId = 'hh-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadMemories fetches all non-deleted memories for household', async () => {
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockNeq = vi.fn().mockReturnThis()
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'm1', memory_key: 'spiciness', memory_value: 'No spicy food', status: 'active' }],
      error: null,
    })

    supabaseClient.from.mockReturnValue({
      select: mockSelect,
    })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ neq: mockNeq })
    mockNeq.mockReturnValue({ order: mockOrder })

    const res = await MemoryService.loadMemories(householdId)

    expect(supabaseClient.from).toHaveBeenCalledWith('copilot_memory')
    expect(mockEq).toHaveBeenCalledWith('household_id', householdId)
    expect(mockNeq).toHaveBeenCalledWith('status', 'deleted')
    expect(res).toHaveLength(1)
    expect(res[0].memory_key).toBe('spiciness')
  })

  it('getActiveMemories filters for active and non-expired entries', async () => {
    const mockSelect = vi.fn().mockReturnThis()
    const mockEqHousehold = vi.fn().mockReturnThis()
    const mockEqStatus = vi.fn().mockReturnThis()
    const mockOr = vi.fn().mockReturnThis()
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'm2', memory_key: 'quick_breakfast', memory_value: 'Prefers quick breakfasts', status: 'active' }],
      error: null,
    })

    supabaseClient.from.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEqHousehold })
    mockEqHousehold.mockReturnValue({ eq: mockEqStatus })
    mockEqStatus.mockReturnValue({ or: mockOr })
    mockOr.mockReturnValue({ order: mockOrder })

    const res = await MemoryService.getActiveMemories(householdId)

    expect(mockEqStatus).toHaveBeenCalledWith('status', 'active')
    expect(res).toHaveLength(1)
    expect(res[0].memory_key).toBe('quick_breakfast')
  })

  it('saveMemory inserts a new memory entry if key does not exist', async () => {
    const mockSelectExisting = vi.fn().mockReturnThis()
    const mockEq1 = vi.fn().mockReturnThis()
    const mockEq2 = vi.fn().mockReturnThis()
    const mockNeq = vi.fn().mockReturnThis()
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

    const mockInsert = vi.fn().mockReturnThis()
    const mockSelectInsert = vi.fn().mockReturnThis()
    const mockSingleInsert = vi.fn().mockResolvedValue({
      data: { id: 'm3', memory_key: 'weekday_dinners', memory_value: 'Vegetarian on Fridays' },
      error: null,
    })

    supabaseClient.from.mockImplementation((table) => {
      if (table === 'copilot_memory') {
        return {
          select: (cols) => {
            if (cols === '*') return { insert: mockInsert }
            return { eq: mockEq1 }
          },
          insert: mockInsert,
        }
      }
      return {}
    })

    mockEq1.mockReturnValue({ eq: mockEq2 })
    mockEq2.mockReturnValue({ neq: mockNeq })
    mockNeq.mockReturnValue({ maybeSingle: mockMaybeSingle })

    mockInsert.mockReturnValue({ select: mockSelectInsert })
    mockSelectInsert.mockReturnValue({ single: mockSingleInsert })

    const result = await MemoryService.saveMemory(householdId, {
      memoryKey: 'weekday_dinners',
      memoryValue: 'Vegetarian on Fridays',
      memoryType: 'restriction',
    })

    expect(result.memory_key).toBe('weekday_dinners')
  })

  it('setMemoryStatus updates status to disabled or deleted', async () => {
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq1 = vi.fn().mockReturnThis()
    const mockEq2 = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'm1', status: 'disabled' },
      error: null,
    })

    supabaseClient.from.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq1 })
    mockEq1.mockReturnValue({ eq: mockEq2 })
    mockEq2.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })

    const res = await MemoryService.setMemoryStatus(householdId, 'm1', 'disabled')

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'disabled' }))
    expect(res.status).toBe('disabled')
  })

  it('rejects saveMemory if householdId is missing', async () => {
    await expect(
      MemoryService.saveMemory(null, { memoryKey: 'k', memoryValue: 'v' })
    ).rejects.toThrow(/Missing household_id/)
  })
})
