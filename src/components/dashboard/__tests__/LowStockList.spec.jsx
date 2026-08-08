import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LowStockList from '../LowStockList'

describe('LowStockList', () => {
  it('shows the honest empty state when nothing is at risk', () => {
    render(<LowStockList items={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Low Stock Predictions/ }))
    expect(screen.getByText(/No ingredients are predicted to run low/)).toBeInTheDocument()
  })

  it('expands to show at-risk items with days remaining', () => {
    render(
      <LowStockList
        items={[{ canonicalName: 'Salt', daysUntilDepletion: 2, predictedDepletionDate: '2026-08-09', confidence: 0.8 }]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Low Stock Predictions/ }))
    expect(screen.getByText('Salt')).toBeInTheDocument()
    expect(screen.getByText('2d left')).toBeInTheDocument()
  })

  it('shows "Out now" for items already at zero days', () => {
    render(<LowStockList items={[{ canonicalName: 'Oil', daysUntilDepletion: 0 }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Low Stock Predictions/ }))
    expect(screen.getByText('Out now')).toBeInTheDocument()
  })
})
