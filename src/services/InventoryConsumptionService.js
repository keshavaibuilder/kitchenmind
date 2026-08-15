import { supabaseClient } from './supabaseClient.js'
import { normalizeError } from '../utils/errors.js'
import { convertConsumptionToBaseUnits, getCompatibleConsumptionUnits } from '../utils/units.js'

/**
 * InventoryConsumptionService
 * Manual semantic consumption ("I used 500ml mustard oil", "I used 1 Vim") — separate from
 * and does not replace recipe-cooking deduction (MealLogService / mark_meal_cooked()).
 *
 * Unit validation and conversion happen here, deterministically, in application code — never
 * in the RPC and never via an LLM. The RPC (consume_inventory_item, 0017) receives the
 * already-converted base_quantity and performs FIFO batch deduction + transaction recording.
 */
export const InventoryConsumptionService = {
  /**
   * @param {string} householdId
   * @param {{ itemId: string, item: Object, quantity: number, unit: string }} params
   *   `item` must carry base_unit/pack_size/pack_unit as returned by InventoryService.getInventory.
   * @returns {Promise<{ success: boolean, itemId: string, baseQuantityDeducted: number, purchaseQuantityDeducted: number|null, committedAt: string }>}
   */
  async consumeItem(householdId, { itemId, item, quantity, unit }) {
    if (!householdId) {
      throw normalizeError('Missing household_id for inventory consumption', 'CONSUMPTION_VALIDATION_ERROR')
    }
    if (!itemId || !item) {
      throw normalizeError('Missing inventory item for consumption', 'CONSUMPTION_VALIDATION_ERROR')
    }

    let baseQuantity
    try {
      baseQuantity = convertConsumptionToBaseUnits(quantity, unit, item)
    } catch (err) {
      throw normalizeError(err, err.code || 'CONSUMPTION_VALIDATION_ERROR')
    }

    const { data, error } = await supabaseClient.rpc('consume_inventory_item', {
      p_payload: {
        household_id: householdId,
        item_id: itemId,
        base_quantity: baseQuantity,
        transaction_type: 'manual_adjustment',
      },
    })

    if (error) {
      throw normalizeError(error, 'CONSUMPTION_FAILED')
    }

    return {
      success: true,
      itemId: data.item_id,
      baseQuantityDeducted: data.base_quantity_deducted,
      purchaseQuantityDeducted: data.purchase_quantity_deducted,
      committedAt: data.committed_at,
    }
  },

  /**
   * Units the UI should offer for a given inventory item — never a unit that would require
   * fabricating an unknown conversion.
   * @param {Object} item
   * @returns {string[]}
   */
  getCompatibleUnits(item) {
    return getCompatibleConsumptionUnits(item)
  },
}
