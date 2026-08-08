import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ShoppingSuggestionGroup from '../ShoppingSuggestionGroup'

describe('ShoppingSuggestionGroup', () => {
  it('renders each item with its reason, priority badge, and purchase window', () => {
    render(
      <ShoppingSuggestionGroup
        group={{
          category: 'Fresh & Vegetables',
          items: [
            {
              canonicalName: 'Onion',
              preferredBrand: null,
              suggestedGrams: 1000,
              priority: 'HIGH',
              reason: 'Onion stock will run out in 1 day',
              purchaseWindow: { label: 'Buy now', urgent: true },
            },
          ],
        }}
      />
    )
    expect(screen.getByText('Fresh & Vegetables')).toBeInTheDocument()
    expect(screen.getByText('Onion')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('Onion stock will run out in 1 day')).toBeInTheDocument()
    expect(screen.getByText('Buy now')).toBeInTheDocument()
  })

  it('shows the preferred brand inline when known', () => {
    render(
      <ShoppingSuggestionGroup
        group={{
          category: 'Staples',
          items: [
            {
              canonicalName: 'Rice',
              preferredBrand: 'India Gate',
              suggestedGrams: 1000,
              priority: 'LOW',
              reason: 'Rice stock is sufficient for 10 more days',
              purchaseWindow: { label: 'Can wait until your next regular shop', urgent: false },
            },
          ],
        }}
      />
    )
    expect(screen.getByText(/India Gate/)).toBeInTheDocument()
  })
})
