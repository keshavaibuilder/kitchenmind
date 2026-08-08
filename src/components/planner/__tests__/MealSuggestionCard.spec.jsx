import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MealSuggestionCard from '../MealSuggestionCard'

const recipe = { id: 'r1', name: 'Dal Tadka', meal_type: 'lunch' }

function renderCard(slot, overrides = {}) {
  return render(
    <MemoryRouter>
      <MealSuggestionCard
        mealType="lunch"
        slot={slot}
        recipeById={new Map([['r1', recipe]])}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onRegenerate={vi.fn()}
        isAccepting={false}
        {...overrides}
      />
    </MemoryRouter>
  )
}

describe('MealSuggestionCard', () => {
  it('shows an explained suggestion with Accept/Regenerate/Dismiss actions', () => {
    renderCard({
      status: 'suggested',
      suggestion: {
        recipe,
        confidence: 0.85,
        reasons: [{ code: 'NO_SHOPPING', text: 'Everything you need is already in stock' }],
      },
    })
    expect(screen.getByText('Dal Tadka')).toBeInTheDocument()
    expect(screen.getByText('Everything you need is already in stock')).toBeInTheDocument()
    expect(screen.getByText('Confidence: 85%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  it('calls onAccept when Accept is tapped', () => {
    const onAccept = vi.fn()
    renderCard(
      { status: 'suggested', suggestion: { recipe, confidence: 0.7, reasons: [{ code: 'X', text: 'reason' }] } },
      { onAccept }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onAccept).toHaveBeenCalledWith('lunch', expect.objectContaining({ recipe }))
  })

  it('calls onDismiss and onRegenerate with the meal type and recipe id', () => {
    const onDismiss = vi.fn()
    const onRegenerate = vi.fn()
    renderCard(
      { status: 'suggested', suggestion: { recipe, confidence: 0.7, reasons: [{ code: 'X', text: 'reason' }] } },
      { onDismiss, onRegenerate }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this suggestion' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show a different suggestion' }))
    expect(onDismiss).toHaveBeenCalledWith('lunch', 'r1')
    expect(onRegenerate).toHaveBeenCalledWith('lunch', 'r1')
  })

  it('shows a planned meal without action buttons', () => {
    renderCard({ status: 'planned', mealLog: { recipe_id: 'r1' } })
    expect(screen.getByText('Dal Tadka')).toBeInTheDocument()
    expect(screen.getByText('✓ Planned')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
  })

  it('shows a cooked meal distinctly from a planned one', () => {
    renderCard({ status: 'cooked', mealLog: { recipe_id: 'r1' } })
    expect(screen.getByText('✓ Cooked today')).toBeInTheDocument()
  })

  it('shows a no_options state instead of a blank card', () => {
    renderCard({ status: 'no_options' })
    expect(screen.getByText(/No recipe matches right now/)).toBeInTheDocument()
  })
})
