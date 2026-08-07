import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import IngredientAvailabilityList from '../IngredientAvailabilityList'

describe('IngredientAvailabilityList', () => {
  it('renders each ingredient with its required/available/shortfall figures', () => {
    render(
      <IngredientAvailabilityList
        availability={[
          { canonical_name: 'Rice', requiredGrams: 300, availableGrams: 1000, shortfallGrams: 0, status: 'available', isOptional: false },
          { canonical_name: 'Salt', requiredGrams: 50, availableGrams: 30, shortfallGrams: 20, status: 'low', isOptional: false },
          { canonical_name: 'Ghee', requiredGrams: 20, availableGrams: 0, shortfallGrams: 20, status: 'missing', isOptional: true },
        ]}
      />
    )
    expect(screen.getByText('Rice')).toBeInTheDocument()
    // Both Salt (low) and Ghee (missing) legitimately show a 20g shortfall.
    expect(screen.getAllByText(/Short 20g/)).toHaveLength(2)
    expect(screen.getByText(/\(optional\)/)).toBeInTheDocument()
  })

  it('shows an empty message when there are no ingredients', () => {
    render(<IngredientAvailabilityList availability={[]} />)
    expect(screen.getByText(/No ingredients listed/)).toBeInTheDocument()
  })
})
