import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabaseClient.js', () => ({
  supabaseClient: { rpc: vi.fn() },
}))

import { BillPersistenceService } from '../BillPersistenceService.js'
import { supabaseClient } from '../supabaseClient.js'

function itemFixture(userEdits) {
  return {
    status: 'confirmed',
    ocr: { itemName: userEdits.itemName, purchaseQuantity: userEdits.purchaseQuantity, packSize: userEdits.packSize, quantity: userEdits.quantity, unit: userEdits.unit, price: userEdits.price },
    match: { canonicalName: userEdits.canonicalName, category: userEdits.category },
    userEdits,
  }
}

describe('BillPersistenceService.commitBill — semantic quantity payload', () => {
  let capturedPayload

  beforeEach(() => {
    capturedPayload = null
    supabaseClient.rpc.mockReset()
    supabaseClient.rpc.mockImplementation((_fn, args) => {
      capturedPayload = args.p_payload
      return Promise.resolve({
        data: {
          commit_id: 'c1', bill_id: 'b1', household_id: 'hh1', idempotency_key: 'k1',
          is_duplicate: false, metrics: {}, committed_at: '2026-08-14T00:00:00Z',
        },
        error: null,
      })
    })
  })

  it('carries Mustard Oil (loose, 5 L) as purchase_unit=l, base_unit=ml, no pack', async () => {
    await BillPersistenceService.commitBill('hh1', {
      items: [itemFixture({
        itemName: 'Mustard Oil', canonicalName: 'Mustard Oil', category: 'Staples',
        purchaseQuantity: 5, packSize: null, quantity: 5, unit: 'l', price: 999,
      })],
    })
    expect(capturedPayload.items[0]).toMatchObject({
      purchase_quantity: 5, purchase_unit: 'l', pack_size: null, pack_unit: null, base_unit: 'ml', unit_grams: 5000,
    })
  })

  it('carries Kurnool Rice (loose, 5.036 kg) as purchase_unit=kg, base_unit=g, no pack', async () => {
    await BillPersistenceService.commitBill('hh1', {
      items: [itemFixture({
        itemName: 'Kurnool Rice', canonicalName: 'Rice', category: 'Staples',
        purchaseQuantity: 5.036, packSize: null, quantity: 5.036, unit: 'kg', price: 327.34,
      })],
    })
    expect(capturedPayload.items[0]).toMatchObject({
      purchase_quantity: 5.036, purchase_unit: 'kg', pack_size: null, pack_unit: null, base_unit: 'g', unit_grams: 5036,
    })
  })

  it('carries Vim (9 pcs x 110 g) as purchase_unit=pcs, pack_size=110, pack_unit=g, unit_grams=990', async () => {
    await BillPersistenceService.commitBill('hh1', {
      items: [itemFixture({
        itemName: 'Vim Dishwash', canonicalName: 'Vim Dishwash', category: 'Miscellaneous',
        purchaseQuantity: 9, packSize: 110, quantity: 990, unit: 'g', price: 180,
      })],
    })
    expect(capturedPayload.items[0]).toMatchObject({
      purchase_quantity: 9, purchase_unit: 'pcs', pack_size: 110, pack_unit: 'g', base_unit: 'g', unit_grams: 990,
    })
  })

  it('carries Maaza (1 pc x 1200 ml) as purchase_unit=pcs, pack_size=1200, pack_unit=ml, unit_grams=1200', async () => {
    await BillPersistenceService.commitBill('hh1', {
      items: [itemFixture({
        itemName: 'Maaza', canonicalName: 'Maaza', category: 'Miscellaneous',
        purchaseQuantity: 1, packSize: 1200, quantity: 1200, unit: 'ml', price: 120,
      })],
    })
    expect(capturedPayload.items[0]).toMatchObject({
      purchase_quantity: 1, purchase_unit: 'pcs', pack_size: 1200, pack_unit: 'ml', base_unit: 'ml', unit_grams: 1200,
    })
  })

  it('still sends the pre-existing quantity_value/unit/unit_grams/cost contract unchanged', async () => {
    await BillPersistenceService.commitBill('hh1', {
      items: [itemFixture({
        itemName: 'Tata Tea', canonicalName: 'Tata Tea', category: 'Staples',
        purchaseQuantity: 1, packSize: 250, quantity: 250, unit: 'g', price: 140,
      })],
    })
    expect(capturedPayload.items[0]).toMatchObject({
      item_name: 'Tata Tea', canonical_name: 'Tata Tea', category: 'Staples',
      quantity_value: 250, unit: 'g', unit_grams: 250, cost: 140,
    })
  })
})
