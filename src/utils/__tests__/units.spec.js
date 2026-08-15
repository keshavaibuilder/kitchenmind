import { describe, it, expect } from 'vitest'
import {
  convertToUnitGrams,
  deriveBaseUnit,
  getCompatibleConsumptionUnits,
  convertConsumptionToBaseUnits,
} from '../units.js'

describe('convertToUnitGrams', () => {
  it('5 L -> 5000 ml', () => {
    expect(convertToUnitGrams(5, 'l')).toBe(5000)
  })

  it('5.036 kg -> 5036 g', () => {
    expect(convertToUnitGrams(5.036, 'kg')).toBe(5036)
  })

  it('does not fabricate a weight for a bare pcs count (1 pc stays 1 pc)', () => {
    expect(convertToUnitGrams(1, 'pcs')).toBe(1)
    expect(convertToUnitGrams(9, 'pcs')).toBe(9)
  })
})

describe('deriveBaseUnit', () => {
  it('maps weight units to g', () => {
    expect(deriveBaseUnit('kg')).toBe('g')
    expect(deriveBaseUnit('g')).toBe('g')
  })
  it('maps volume units to ml', () => {
    expect(deriveBaseUnit('l')).toBe('ml')
    expect(deriveBaseUnit('ml')).toBe('ml')
  })
  it('maps count to pcs', () => {
    expect(deriveBaseUnit('pcs')).toBe('pcs')
  })
})

describe('getCompatibleConsumptionUnits', () => {
  it('offers pcs alongside weight units only when a real pack size is known', () => {
    const vim = { base_unit: 'g', pack_size: 110, pack_unit: 'g' }
    expect(getCompatibleConsumptionUnits(vim)).toEqual(['g', 'kg', 'pcs'])
  })

  it('does not offer pcs when no pack size is known', () => {
    const tea = { base_unit: 'g', pack_size: null, pack_unit: null }
    expect(getCompatibleConsumptionUnits(tea)).toEqual(['g', 'kg'])
  })

  it('offers only pcs for a pure count item with no base weight/volume', () => {
    const eggs = { base_unit: 'pcs', pack_size: null, pack_unit: null }
    expect(getCompatibleConsumptionUnits(eggs)).toEqual(['pcs'])
  })

  it('offers volume units for a liquid item', () => {
    const oil = { base_unit: 'ml', pack_size: null, pack_unit: null }
    expect(getCompatibleConsumptionUnits(oil)).toEqual(['ml', 'l'])
  })
})

describe('convertConsumptionToBaseUnits', () => {
  const mustardOil = { base_unit: 'ml', pack_size: null, pack_unit: null }
  const rice = { base_unit: 'g', pack_size: null, pack_unit: null }
  const tataTea = { base_unit: 'g', pack_size: 250, pack_unit: 'g' }
  const vim = { base_unit: 'g', pack_size: 110, pack_unit: 'g' }
  const eggs = { base_unit: 'pcs', pack_size: null, pack_unit: null }

  it('500 ml deduction from mustard oil converts to 500 base units', () => {
    expect(convertConsumptionToBaseUnits(500, 'ml', mustardOil)).toBe(500)
  })

  it('2 kg deduction from rice converts to 2000 base units', () => {
    expect(convertConsumptionToBaseUnits(2, 'kg', rice)).toBe(2000)
  })

  it('1 pc deduction from Vim (110g pack) converts to 110 base units', () => {
    expect(convertConsumptionToBaseUnits(1, 'pcs', vim)).toBe(110)
  })

  it('2 pcs deduction from Vim (110g pack) converts to 220 base units', () => {
    expect(convertConsumptionToBaseUnits(2, 'pcs', vim)).toBe(220)
  })

  it('110 g deduction from Vim is allowed directly (matches pack_size, no fabrication needed)', () => {
    expect(convertConsumptionToBaseUnits(110, 'g', vim)).toBe(110)
  })

  it('50 g deduction from Tata Tea (250g pack) converts to 50 base units', () => {
    expect(convertConsumptionToBaseUnits(50, 'g', tataTea)).toBe(50)
  })

  it('1 pc with NO pack size must NOT become 50 g — it stays a bare count', () => {
    expect(convertConsumptionToBaseUnits(1, 'pcs', eggs)).toBe(1)
  })

  it('rejects "pcs" for an item with no known pack size (cannot fabricate a conversion)', () => {
    expect(() => convertConsumptionToBaseUnits(1, 'pcs', tataTea === tataTea
      ? { base_unit: 'g', pack_size: null, pack_unit: null }
      : tataTea)).toThrow(/pack size/i)
  })

  it('rejects an incompatible unit (g against a pcs-only base item)', () => {
    expect(() => convertConsumptionToBaseUnits(50, 'g', eggs)).toThrow(/not compatible/i)
  })

  it('rejects a volume unit against a weight-based item', () => {
    expect(() => convertConsumptionToBaseUnits(1, 'l', rice)).toThrow(/not compatible/i)
  })

  it('rejects a zero or negative quantity', () => {
    expect(() => convertConsumptionToBaseUnits(0, 'g', rice)).toThrow(/greater than 0/i)
    expect(() => convertConsumptionToBaseUnits(-5, 'g', rice)).toThrow(/greater than 0/i)
  })

  it('rejects consumption against an item with no semantic base_unit at all', () => {
    expect(() => convertConsumptionToBaseUnits(1, 'g', { base_unit: null })).toThrow(/no semantic unit data/i)
  })
})
