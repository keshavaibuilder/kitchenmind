import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InventoryImpactPreview from '../InventoryImpactPreview'

describe('InventoryImpactPreview', () => {
  it('shows the required amount and remaining stock after cooking, in grams and kg', () => {
    render(
      <InventoryImpactPreview
        availability={[
          { canonical_name: 'Rice', requiredGrams: 300, remainingAfterCookGrams: 2100, status: 'available' },
          { canonical_name: 'Oil', requiredGrams: 20, remainingAfterCookGrams: 780, status: 'available' },
        ]}
      />
    )
    expect(screen.getByText('300g')).toBeInTheDocument()
    expect(screen.getByText('2.1kg remaining')).toBeInTheDocument()
    expect(screen.getByText('20g')).toBeInTheDocument()
    expect(screen.getByText('780g remaining')).toBeInTheDocument()
  })

  it('renders nothing for an empty availability list', () => {
    const { container } = render(<InventoryImpactPreview availability={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
