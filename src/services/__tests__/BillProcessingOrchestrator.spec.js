import { describe, it, expect, vi } from 'vitest'

vi.mock('../OCRService.js', () => ({
  OCRService: {
    scanBill: vi.fn(),
  },
}))

vi.mock('../IngredientMatchingService.js', () => ({
  IngredientMatchingService: {
    matchItem: vi.fn(),
  },
}))

import { BillProcessingOrchestrator } from '../BillProcessingOrchestrator.js'
import { OCRService } from '../OCRService.js'
import { IngredientMatchingService } from '../IngredientMatchingService.js'

describe('BillProcessingOrchestrator.processBillImage', () => {
  it('carries purchaseQuantity and packSize through into item.ocr, not just quantity/unit/price', async () => {
    OCRService.scanBill.mockResolvedValue({
      merchant: 'Reliance Fresh',
      billDate: '2026-01-01',
      totalAmount: 999,
      items: [
        {
          itemName: 'TATA MUSTARD OI-5lt',
          canonicalName: 'Mustard Oil',
          purchaseQuantity: 1,
          packSize: 5,
          quantity: 5,
          unit: 'l',
          price: 999,
          category: 'Staples',
          confidence: 'high',
        },
        {
          itemName: 'L SM KURNOOL RICE',
          canonicalName: 'Rice',
          purchaseQuantity: 5.036,
          packSize: null,
          quantity: 5.036,
          unit: 'kg',
          price: 327.34,
          category: 'Staples',
          confidence: 'high',
        },
      ],
    })
    IngredientMatchingService.matchItem.mockResolvedValue({
      ingredientId: null,
      canonicalName: 'Mustard Oil',
      matchedAlias: null,
      confidence: 'MEDIUM',
      confidenceScore: 0.7,
      requiresManualReview: false,
    })

    const result = await BillProcessingOrchestrator.processBillImage('base64data', 'image/jpeg')

    expect(result.items[0].ocr).toMatchObject({
      itemName: 'TATA MUSTARD OI-5lt',
      purchaseQuantity: 1,
      packSize: 5,
      quantity: 5,
      unit: 'l',
      price: 999,
    })
    expect(result.items[1].ocr).toMatchObject({
      itemName: 'L SM KURNOOL RICE',
      purchaseQuantity: 5.036,
      packSize: null,
      quantity: 5.036,
      unit: 'kg',
    })
  })
})
