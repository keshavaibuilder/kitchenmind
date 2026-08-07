import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ServingScaleSelector from '../ServingScaleSelector'

describe('ServingScaleSelector', () => {
  it('marks the active preset and calls onChange when a different preset is clicked', () => {
    const onChange = vi.fn()
    render(<ServingScaleSelector servings={4} onChange={onChange} presets={[1, 2, 4, 6, 8]} />)

    expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '6' }))
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('opens a custom input and reports the typed value', () => {
    const onChange = vi.fn()
    render(<ServingScaleSelector servings={4} onChange={onChange} presets={[1, 2, 4, 6, 8]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    fireEvent.change(screen.getByLabelText('Custom serving count'), { target: { value: '15' } })
    expect(onChange).toHaveBeenCalledWith(15)
  })

  it('clamps custom input to the 1-50 range', () => {
    const onChange = vi.fn()
    render(<ServingScaleSelector servings={4} onChange={onChange} presets={[1, 2, 4, 6, 8]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    fireEvent.change(screen.getByLabelText('Custom serving count'), { target: { value: '999' } })
    expect(onChange).toHaveBeenCalledWith(50)

    fireEvent.change(screen.getByLabelText('Custom serving count'), { target: { value: '0' } })
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('opens the custom input automatically when the current value is not a preset', () => {
    render(<ServingScaleSelector servings={11} onChange={vi.fn()} presets={[1, 2, 4, 6, 8]} />)
    expect(screen.getByLabelText('Custom serving count')).toBeInTheDocument()
  })
})
