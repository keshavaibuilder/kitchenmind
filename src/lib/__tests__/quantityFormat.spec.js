import { describe, it, expect } from 'vitest'
import { formatInventoryQuantity } from '../quantityFormat.js'

describe('formatInventoryQuantity', () => {
  it('formats mustard oil (5000 ml base) as 5 L', () => {
    const item = { base_unit: 'ml', quantity_grams: 5000, pack_size: null, pack_unit: null }
    expect(formatInventoryQuantity(item)).toEqual({ primary: '5 L', secondary: null })
  })

  it('formats rice (5036 g base) as 5.036 kg', () => {
    const item = { base_unit: 'g', quantity_grams: 5036, pack_size: null, pack_unit: null }
    expect(formatInventoryQuantity(item)).toEqual({ primary: '5.036 kg', secondary: null })
  })

  it('formats Tata Tea (250 g base, no upconversion under 1000) as 250 g', () => {
    const item = { base_unit: 'g', quantity_grams: 250, pack_size: null, pack_unit: null }
    expect(formatInventoryQuantity(item)).toEqual({ primary: '250 g', secondary: null })
  })

  it('formats a packaged item (9 pcs x 110 g) with a Total line, no auto-upconversion of the total', () => {
    const item = {
      base_unit: 'g', quantity_grams: 990,
      purchase_quantity: 9, remaining_quantity: 9, pack_size: 110, pack_unit: 'g',
    }
    expect(formatInventoryQuantity(item)).toEqual({
      primary: '9 pcs × 110 g',
      secondary: 'Total: 990 g',
    })
  })

  it('formats Maaza (1 pc x 1200 ml) with total staying in ml, not auto-converted to L', () => {
    const item = {
      base_unit: 'ml', quantity_grams: 1200,
      purchase_quantity: 1, remaining_quantity: 1, pack_size: 1200, pack_unit: 'ml',
    }
    expect(formatInventoryQuantity(item)).toEqual({
      primary: '1 pcs × 1200 ml',
      secondary: 'Total: 1200 ml',
    })
  })

  it('derives packaged count from remaining base quantity after partial consumption', () => {
    const item = {
      base_unit: 'g', quantity_grams: 880,
      purchase_quantity: 9, remaining_quantity: 8, pack_size: 110, pack_unit: 'g',
    }
    expect(formatInventoryQuantity(item).primary).toBe('8 pcs × 110 g')
  })

  it('formats a pure count item (no pack, no weight) as a bare pcs count', () => {
    const item = { base_unit: 'pcs', quantity_grams: 6, pack_size: null, pack_unit: null }
    expect(formatInventoryQuantity(item)).toEqual({ primary: '6 pcs', secondary: null })
  })

  it('returns null (signalling legacy fallback) when base_unit is absent', () => {
    expect(formatInventoryQuantity({ quantity_grams: 500, base_unit: null })).toBeNull()
    expect(formatInventoryQuantity({ quantity_grams: 500 })).toBeNull()
  })

  it('returns null for a missing/undefined item', () => {
    expect(formatInventoryQuantity(null)).toBeNull()
    expect(formatInventoryQuantity(undefined)).toBeNull()
  })
})
