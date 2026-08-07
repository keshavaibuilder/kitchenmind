import { describe, it, expect } from 'vitest'
import { computeIngredientAvailability, summarizeAvailability, AVAILABILITY_STATUS } from '../ingredientAvailability.js'

describe('computeIngredientAvailability', () => {
  it('marks an ingredient missing when there is no inventory row', () => {
    const result = computeIngredientAvailability([{ canonical_name: 'Rice', quantity_grams: 300 }], [])
    expect(result[0].status).toBe(AVAILABILITY_STATUS.MISSING)
    expect(result[0].shortfallGrams).toBe(300)
  })

  it('marks low when available is less than required', () => {
    const result = computeIngredientAvailability(
      [{ canonical_name: 'Rice', quantity_grams: 500 }],
      [{ canonical_name: 'Rice', quantity_grams: 300 }]
    )
    expect(result[0].status).toBe(AVAILABILITY_STATUS.LOW)
    expect(result[0].shortfallGrams).toBe(200)
  })

  it('marks low when sufficient for the recipe but cooking would leave stock at/under its own threshold', () => {
    const result = computeIngredientAvailability(
      [{ canonical_name: 'Salt', quantity_grams: 100 }],
      [{ canonical_name: 'Salt', quantity_grams: 150, low_stock_threshold: 100 }]
    )
    expect(result[0].status).toBe(AVAILABILITY_STATUS.LOW)
    expect(result[0].remainingAfterCookGrams).toBe(50)
  })

  it('marks available when comfortably enough remains after cooking', () => {
    const result = computeIngredientAvailability(
      [{ canonical_name: 'Onion', quantity_grams: 100 }],
      [{ canonical_name: 'Onion', quantity_grams: 1000, low_stock_threshold: 100 }]
    )
    expect(result[0].status).toBe(AVAILABILITY_STATUS.AVAILABLE)
  })

  it('matches canonical names case-insensitively', () => {
    const result = computeIngredientAvailability([{ canonical_name: 'rice', quantity_grams: 100 }], [{ canonical_name: 'RICE', quantity_grams: 500 }])
    expect(result[0].availableGrams).toBe(500)
  })

  it('passes through the isOptional flag', () => {
    const result = computeIngredientAvailability([{ canonical_name: 'Cardamom', quantity_grams: 5, is_optional: true }], [])
    expect(result[0].isOptional).toBe(true)
  })
})

describe('summarizeAvailability', () => {
  it('counts each status', () => {
    const rows = [
      { status: 'available', isOptional: false },
      { status: 'low', isOptional: false },
      { status: 'missing', isOptional: true },
    ]
    const summary = summarizeAvailability(rows)
    expect(summary).toMatchObject({ available: 1, low: 1, missing: 1, total: 3 })
  })

  it('canCookFully is true when a missing ingredient is optional', () => {
    expect(summarizeAvailability([{ status: 'missing', isOptional: true }]).canCookFully).toBe(true)
  })

  it('canCookFully is false when a required (non-optional) ingredient is missing', () => {
    expect(summarizeAvailability([{ status: 'missing', isOptional: false }]).canCookFully).toBe(false)
  })

  it('canCookFully is true when everything is available or merely low', () => {
    expect(summarizeAvailability([{ status: 'available', isOptional: false }, { status: 'low', isOptional: false }]).canCookFully).toBe(true)
  })
})
