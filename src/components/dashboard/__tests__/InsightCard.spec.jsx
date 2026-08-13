import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import InsightCard from '../InsightCard.jsx'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('InsightCard component', () => {
  const mockInsight = {
    insight_id: 'ins-123',
    insight_type: 'LIKELY_DEPLETION',
    household_id: 'hh-1',
    title: 'Basmati Rice is likely to run out in 2 days',
    summary: 'Based on consumption velocity, Basmati Rice is predicted to run low.',
    severity: 'critical',
    confidence: { score: 0.85, level: 'HIGH' },
    evidence: [
      { type: 'PREDICTED_DEPLETION_DAYS', source: 'prediction_cache', value: 2, details: 'Days until depletion' },
    ],
    deduplication_key: 'LIKELY_DEPLETION:basmati rice',
    suggested_next_step: {
      text: 'Ask Copilot for re-stock advice',
      askCopilotPrompt: 'We are running low on Basmati Rice. Re-stock advice?',
    },
  }

  const mockDismiss = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title, summary, severity badge, and confidence badge', () => {
    render(
      <BrowserRouter>
        <InsightCard insight={mockInsight} onDismiss={mockDismiss} householdId="hh-1" />
      </BrowserRouter>
    )

    expect(screen.getByText('Basmati Rice is likely to run out in 2 days')).toBeInTheDocument()
    expect(screen.getByText(/Based on consumption velocity/)).toBeInTheDocument()
    expect(screen.getByText('critical')).toBeInTheDocument()
    expect(screen.getByText(/HIGH Confidence \(85%\)/)).toBeInTheDocument()
  })

  it('toggles evidence panel when Inspect Evidence is clicked', () => {
    render(
      <BrowserRouter>
        <InsightCard insight={mockInsight} onDismiss={mockDismiss} householdId="hh-1" />
      </BrowserRouter>
    )

    const toggleBtn = screen.getByRole('button', { name: /Inspect Evidence/ })
    expect(screen.queryByText('PREDICTED_DEPLETION_DAYS')).not.toBeInTheDocument()

    fireEvent.click(toggleBtn)
    expect(screen.getByText('PREDICTED_DEPLETION_DAYS')).toBeInTheDocument()
    expect(screen.getByText('prediction_cache')).toBeInTheDocument()
  })

  it('navigates to /copilot with prompt when Ask Copilot is clicked', () => {
    render(
      <BrowserRouter>
        <InsightCard insight={mockInsight} onDismiss={mockDismiss} householdId="hh-1" />
      </BrowserRouter>
    )

    const copilotBtn = screen.getByRole('button', { name: /Ask Copilot/ })
    fireEvent.click(copilotBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/copilot', {
      state: {
        initialPrompt: 'We are running low on Basmati Rice. Re-stock advice?',
        insightContext: {
          title: mockInsight.title,
          summary: mockInsight.summary,
          evidence: mockInsight.evidence,
        },
      },
    })
  })

  it('triggers onDismiss when dismiss button is clicked', () => {
    render(
      <BrowserRouter>
        <InsightCard insight={mockInsight} onDismiss={mockDismiss} householdId="hh-1" />
      </BrowserRouter>
    )

    const dismissBtn = screen.getByTitle('Dismiss insight')
    fireEvent.click(dismissBtn)

    expect(mockDismiss).toHaveBeenCalledWith('LIKELY_DEPLETION:basmati rice')
  })
})
