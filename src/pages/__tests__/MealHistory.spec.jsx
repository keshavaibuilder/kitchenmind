import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MealHistory from '../MealHistory'

let historyState
let deductionsState

vi.mock('../../hooks/useMealHistory', () => ({
  useMealHistory: () => historyState,
  useMealDeductions: () => deductionsState,
}))

beforeEach(() => {
  historyState = {
    mealLogs: [
      { id: 'm1', meal_type: 'lunch', cooked_at: '2026-08-10T12:00:00Z', headcount: 4, recipes: { name: 'Dal Tadka' } },
    ],
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }
  deductionsState = { deductions: [], isLoading: false }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <MealHistory />
    </MemoryRouter>
  )
}

describe('MealHistory', () => {
  it('renders cooked meals with the recipe name, servings, and date', () => {
    renderPage()
    expect(screen.getByText('Dal Tadka')).toBeInTheDocument()
    expect(screen.getByText(/4 servings/)).toBeInTheDocument()
  })

  it('shows an empty state when nothing has been cooked yet', () => {
    historyState = { ...historyState, mealLogs: [] }
    renderPage()
    expect(screen.getByText(/No meals cooked yet/)).toBeInTheDocument()
  })

  it('shows an error state when meal history fails to load', () => {
    historyState = { ...historyState, isError: true, mealLogs: [] }
    renderPage()
    expect(screen.getByText(/Couldn't load meal history/)).toBeInTheDocument()
  })

  it('expands a row to show its ingredient deductions', async () => {
    deductionsState = { deductions: [{ id: 'd1', grams_deducted: 300, inventory: { canonical_name: 'Rice' } }], isLoading: false }
    renderPage()

    fireEvent.click(screen.getByText('Dal Tadka'))
    await waitFor(() => expect(screen.getByText('Rice')).toBeInTheDocument())
    expect(screen.getByText('300g')).toBeInTheDocument()
  })

  it('collapses an expanded row on a second click', async () => {
    deductionsState = { deductions: [{ id: 'd1', grams_deducted: 300, inventory: { canonical_name: 'Rice' } }], isLoading: false }
    renderPage()

    const row = screen.getByText('Dal Tadka')
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByText('Rice')).toBeInTheDocument())

    fireEvent.click(row)
    expect(screen.queryByText('Rice')).not.toBeInTheDocument()
  })
})
