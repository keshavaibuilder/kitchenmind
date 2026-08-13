import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import InsightsSection from '../InsightsSection.jsx'

describe('InsightsSection component', () => {
  it('renders All Clear empty state when no insights exist', () => {
    render(
      <BrowserRouter>
        <InsightsSection insights={[]} />
      </BrowserRouter>
    )

    expect(screen.getByText('Proactive Kitchen Insights')).toBeInTheDocument()
    expect(screen.getByText('All Clear')).toBeInTheDocument()
    expect(screen.getByText(/No critical alerts or depleting stocks detected/)).toBeInTheDocument()
  })

  it('renders insights list and severity summary badges when insights are present', () => {
    const mockInsights = [
      {
        insight_id: 'i-1',
        insight_type: 'LIKELY_DEPLETION',
        household_id: 'hh-1',
        title: 'Rice low',
        summary: 'Rice running low',
        severity: 'critical',
        confidence: { score: 0.9, level: 'HIGH' },
        evidence: [],
        deduplication_key: 'K-1',
      },
    ]

    render(
      <BrowserRouter>
        <InsightsSection
          insights={mockInsights}
          criticalCount={1}
          warningCount={0}
          infoCount={0}
          onDismiss={vi.fn()}
          householdId="hh-1"
        />
      </BrowserRouter>
    )

    expect(screen.getByText('Proactive Kitchen Insights')).toBeInTheDocument()
    expect(screen.getByText('1 Critical')).toBeInTheDocument()
    expect(screen.getByText('Rice low')).toBeInTheDocument()
  })
})
