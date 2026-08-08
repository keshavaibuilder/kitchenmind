import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExpiryRiskList from '../ExpiryRiskList'

describe('ExpiryRiskList', () => {
  it('shows the honest "no expiry data yet" state rather than a fake empty list', () => {
    render(<ExpiryRiskList items={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Expiry Risk/ }))
    expect(screen.getByText(/No batches have an expiry date recorded yet/)).toBeInTheDocument()
  })

  it('flags already-expired items distinctly from upcoming ones', () => {
    render(
      <ExpiryRiskList
        items={[
          { batchId: 'b1', canonicalName: 'Curd', daysUntilExpiry: -1, isExpired: true },
          { batchId: 'b2', canonicalName: 'Milk', daysUntilExpiry: 3, isExpired: false },
        ]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Expiry Risk/ }))
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.getByText('3d left')).toBeInTheDocument()
  })
})
