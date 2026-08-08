import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PantryHealthCard from '../PantryHealthCard'

describe('PantryHealthCard', () => {
  it('renders the score, label, and at-risk breakdown', () => {
    render(<PantryHealthCard pantryHealth={{ score: 75, label: 'OK', trackedIngredients: 4, atRiskCount: 1 }} />)
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('OK')).toBeInTheDocument()
    expect(screen.getByText(/1 of 4 tracked ingredients/)).toBeInTheDocument()
  })

  it('shows a cold-start message when nothing has been tracked yet', () => {
    render(<PantryHealthCard pantryHealth={{ score: 100, label: 'Great', trackedIngredients: 0, atRiskCount: 0 }} />)
    expect(screen.getByText(/Not enough purchase history yet/)).toBeInTheDocument()
  })
})
