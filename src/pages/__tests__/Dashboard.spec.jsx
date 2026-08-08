import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../Dashboard'

let dashboardState

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: () => dashboardState,
}))

const FULL_STATE = {
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  snapshot: { householdName: 'The Sharmas', pantryHealthScore: 82, lowStockCount: 1, expiryRiskCount: 0 },
  pantryHealth: { score: 82, label: 'Great', trackedIngredients: 5, atRiskCount: 1 },
  lowStock: [{ canonicalName: 'Salt', daysUntilDepletion: 2 }],
  expiryRisk: [],
  shoppingIntelligence: [],
  cookingSuggestions: { readyToCook: [], useItUp: [] },
  pantryInsights: { pantryDiversityScore: 5, topCategories: [], preferredShoppingDay: 'Sunday', mostConsumedIngredients: [] },
  householdTrends: { shoppingFrequencyDays: 7, totalBillsAnalyzed: 3, ingredientsWithStableProfile: 2, totalTrackedIngredients: 5, lastCookedAt: null },
  observationTimeline: [],
  quickActions: [{ id: 'browse', label: 'Browse recipes', path: '/recipes', emoji: '📖' }],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    dashboardState = FULL_STATE
  })

  it('shows a skeleton while the dashboard is loading', () => {
    dashboardState = { ...FULL_STATE, isLoading: true }
    const { container } = renderPage()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows a retry affordance on error', () => {
    dashboardState = { ...FULL_STATE, isError: true }
    renderPage()
    expect(screen.getByText(/Couldn't load your kitchen intelligence/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('renders every module once data is loaded', () => {
    renderPage()
    expect(screen.getByText('The Sharmas')).toBeInTheDocument()
    expect(screen.getByText('Pantry Health')).toBeInTheDocument()
    expect(screen.getByText('Low Stock Predictions')).toBeInTheDocument()
    expect(screen.getByText('Expiry Risk')).toBeInTheDocument()
    expect(screen.getByText('Shopping Intelligence')).toBeInTheDocument()
    expect(screen.getByText('Cooking Suggestions')).toBeInTheDocument()
    expect(screen.getByText('Pantry Insights')).toBeInTheDocument()
    expect(screen.getByText('Household Trends')).toBeInTheDocument()
    expect(screen.getByText('AI Observation Timeline')).toBeInTheDocument()
    expect(screen.getByText('Browse recipes')).toBeInTheDocument()
  })
})
