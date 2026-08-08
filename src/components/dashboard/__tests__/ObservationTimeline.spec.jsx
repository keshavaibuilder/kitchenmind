import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ObservationTimeline from '../ObservationTimeline'

describe('ObservationTimeline', () => {
  it('shows an empty state before any bills have been scanned', () => {
    render(<ObservationTimeline observations={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /AI Observation Timeline/ }))
    expect(screen.getByText(/Observations appear here as bills are scanned/)).toBeInTheDocument()
  })

  it('renders each observation with its label and message', () => {
    render(
      <ObservationTimeline
        observations={[
          { id: 'o1', label: 'New ingredient', message: 'New ingredient "Paneer" added to household kitchen', createdAt: new Date().toISOString() },
        ]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /AI Observation Timeline/ }))
    expect(screen.getByText(/New ingredient "Paneer"/)).toBeInTheDocument()
  })
})
