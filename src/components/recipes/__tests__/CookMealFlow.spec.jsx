import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CookMealFlow from '../CookMealFlow'

const mockCookNow = vi.fn()
let mockCookState

vi.mock('../../../hooks/useCookMeal', () => ({
  useCookMeal: () => mockCookState,
}))

const recipe = { id: 'r1', name: 'Dal Tadka', meal_type: 'lunch' }

beforeEach(() => {
  mockCookNow.mockReset()
  mockCookState = {
    servings: 4,
    setServings: vi.fn(),
    servingPresets: [1, 2, 4, 6, 8],
    includeRoti: false,
    setIncludeRoti: vi.fn(),
    rotiRequirement: null,
    availability: [
      {
        canonical_name: 'Toor Dal',
        requiredGrams: 200,
        availableGrams: 500,
        remainingAfterCookGrams: 300,
        shortfallGrams: 0,
        status: 'available',
        isOptional: false,
      },
    ],
    availabilitySummary: { available: 1, low: 0, missing: 0, total: 1, canCookFully: true },
    cookNow: mockCookNow,
    isCooking: false,
    cookError: null,
    cookResult: null,
    resetCookResult: vi.fn(),
  }
})

describe('CookMealFlow', () => {
  it('shows the review step with ingredient availability and inventory impact', () => {
    render(<CookMealFlow recipe={recipe} onClose={vi.fn()} />)
    expect(screen.getByText('Cook Dal Tadka')).toBeInTheDocument()
    // "Toor Dal" legitimately appears twice — once in the availability list, once in the
    // impact preview — both sections are visible on the review step at the same time.
    expect(screen.getAllByText('Toor Dal')).toHaveLength(2)
    expect(screen.getByText('300g remaining')).toBeInTheDocument()
  })

  it('warns but still allows cooking when availability cannot fully cover the recipe', () => {
    mockCookState.availabilitySummary = { available: 0, low: 0, missing: 1, total: 1, canCookFully: false }
    render(<CookMealFlow recipe={recipe} onClose={vi.fn()} />)
    expect(screen.getByText(/Some required ingredients are missing/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirm & Cook/ })).not.toBeDisabled()
  })

  it('confirms cooking and transitions to the success step', async () => {
    mockCookState.cookResult = { success: true, hasShortfall: false, deductions: [] }
    mockCookNow.mockResolvedValue(mockCookState.cookResult)

    render(<CookMealFlow recipe={recipe} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Cook/ }))

    expect(mockCookNow).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('Meal Cooked!')).toBeInTheDocument())
    expect(screen.getByText('Inventory has been updated.')).toBeInTheDocument()
  })

  it('surfaces a shortfall warning in the success step without failing the cook', async () => {
    mockCookState.cookResult = { success: true, hasShortfall: true, deductions: [] }
    mockCookNow.mockResolvedValue(mockCookState.cookResult)

    render(<CookMealFlow recipe={recipe} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Cook/ }))

    await waitFor(() => expect(screen.getByText(/ran short/)).toBeInTheDocument())
  })

  it('shows an error and a retry affordance when cooking fails', () => {
    mockCookState.cookError = { message: 'Network error' }
    render(<CookMealFlow recipe={recipe} onClose={vi.fn()} />)
    expect(screen.getByText('Network error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('calls onClose when the sheet is dismissed', () => {
    const onClose = vi.fn()
    render(<CookMealFlow recipe={recipe} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})
