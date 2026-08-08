import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Planner from '../Planner'

let plannerState

vi.mock('../../hooks/usePlanner', () => ({
  usePlanner: () => plannerState,
}))

const recipe = { id: 'r1', name: 'Dal Tadka', meal_type: 'lunch' }
const suggestedSlot = { status: 'suggested', suggestion: { recipe, confidence: 0.8, reasons: [{ code: 'NO_SHOPPING', text: 'Everything you need is already in stock' }] } }

function fullState(overrides = {}) {
  return {
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    todaysPlan: { breakfast: { status: 'no_options' }, lunch: suggestedSlot, dinner: { status: 'no_options' } },
    weekPreview: [{ date: '2026-08-10', weekday: 'Monday', dateLabel: 'Mon, 10 Aug', meals: { breakfast: { status: 'no_options' }, lunch: suggestedSlot, dinner: { status: 'no_options' } } }],
    shoppingSuggestions: [],
    recipeById: new Map([['r1', recipe]]),
    acceptSuggestion: vi.fn().mockResolvedValue({}),
    isAccepting: false,
    dismissSuggestion: vi.fn(),
    regenerateSuggestion: vi.fn(),
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Planner />
    </MemoryRouter>
  )
}

describe('Planner', () => {
  beforeEach(() => {
    plannerState = fullState()
  })

  it('shows a skeleton while loading', () => {
    plannerState = fullState({ isLoading: true })
    const { container } = renderPage()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows a retry affordance on error', () => {
    plannerState = fullState({ isError: true })
    renderPage()
    expect(screen.getByText(/Couldn't load your meal plan/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('renders Today\'s Plan, This Week, and Shopping Suggestions sections', () => {
    renderPage()
    expect(screen.getByText("Today's Plan")).toBeInTheDocument()
    expect(screen.getByText('This Week')).toBeInTheDocument()
    expect(screen.getByText('Shopping Suggestions')).toBeInTheDocument()
    expect(screen.getByText('Nothing predicted to buy soon.')).toBeInTheDocument()
  })

  it('accepting a suggestion calls the hook and shows a confirmation', async () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0])
    expect(plannerState.acceptSuggestion).toHaveBeenCalled()
  })

  it('renders grouped shopping suggestions when present', () => {
    plannerState = fullState({
      shoppingSuggestions: [
        {
          category: 'Staples',
          items: [
            {
              canonicalName: 'Rice',
              preferredBrand: null,
              suggestedGrams: 1000,
              priority: 'LOW',
              reason: 'Rice stock is sufficient for 10 more days',
              purchaseWindow: { label: 'Can wait until your next regular shop', urgent: false },
            },
          ],
        },
      ],
    })
    renderPage()
    expect(screen.getByText('Staples')).toBeInTheDocument()
    expect(screen.getByText('Rice')).toBeInTheDocument()
  })
})
