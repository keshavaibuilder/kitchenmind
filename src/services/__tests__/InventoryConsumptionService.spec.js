import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabaseClient.js', () => ({
  supabaseClient: { rpc: vi.fn() },
}))

import { InventoryConsumptionService } from '../InventoryConsumptionService.js'
import { supabaseClient } from '../supabaseClient.js'

describe('InventoryConsumptionService.consumeItem', () => {
  const vim = { id: 'item-vim', base_unit: 'g', pack_size: 110, pack_unit: 'g' }

  beforeEach(() => {
    supabaseClient.rpc.mockReset()
  })

  it('converts deterministically and calls consume_inventory_item with the base-unit quantity', async () => {
    supabaseClient.rpc.mockResolvedValue({
      data: { item_id: 'item-vim', base_quantity_deducted: 110, purchase_quantity_deducted: 1, committed_at: '2026-08-14T00:00:00Z' },
      error: null,
    })

    const result = await InventoryConsumptionService.consumeItem('hh1', { itemId: 'item-vim', item: vim, quantity: 1, unit: 'pcs' })

    expect(supabaseClient.rpc).toHaveBeenCalledWith('consume_inventory_item', {
      p_payload: { household_id: 'hh1', item_id: 'item-vim', base_quantity: 110, transaction_type: 'manual_adjustment' },
    })
    expect(result).toMatchObject({ success: true, baseQuantityDeducted: 110, purchaseQuantityDeducted: 1 })
  })

  it('never calls the RPC when the unit is incompatible — rejected client-side, deterministically', async () => {
    await expect(
      InventoryConsumptionService.consumeItem('hh1', { itemId: 'item-vim', item: vim, quantity: 50, unit: 'ml' })
    ).rejects.toMatchObject({ code: 'CONSUMPTION_INCOMPATIBLE_UNIT' })

    expect(supabaseClient.rpc).not.toHaveBeenCalled()
  })

  it('propagates an RPC-side insufficient-stock rejection without swallowing it', async () => {
    supabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC_INSUFFICIENT_STOCK: requested 500 exceeds available 200 for this item', code: 'P0001' },
    })

    await expect(
      InventoryConsumptionService.consumeItem('hh1', { itemId: 'item-vim', item: { ...vim, base_unit: 'g' }, quantity: 500, unit: 'g' })
    ).rejects.toThrow(/RPC_INSUFFICIENT_STOCK/)
  })
})
