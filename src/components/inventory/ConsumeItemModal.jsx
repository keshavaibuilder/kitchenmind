import { useState } from 'react'
import { useInventory } from '../../hooks/useInventory'
import { useToast } from '../../hooks/useToast'
import { formatInventoryQuantity } from '../../lib/quantityFormat'

/**
 * Simple "I used X" consumption entry point for a single inventory item. Only offers units
 * compatible with the item's semantic data (InventoryConsumptionService.getCompatibleUnits) —
 * never a unit that would need a fabricated conversion. Deterministic conversion/validation
 * happens in InventoryConsumptionService / units.js, not here and not via an LLM.
 */
export default function ConsumeItemModal({ item, onClose }) {
  const { consumeItem, isConsuming } = useInventory()
  const { showToast } = useToast()
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState(item.compatibleUnits[0] || '')
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState(null)

  async function handleConfirm() {
    setErrorMsg('')
    const qty = Number(quantity)
    if (!quantity || isNaN(qty) || qty <= 0) {
      setErrorMsg('Enter a quantity greater than 0')
      return
    }
    try {
      const outcome = await consumeItem({ itemId: item.id, item, quantity: qty, unit })
      setResult({ quantity: qty, unit, baseQuantityDeducted: outcome.baseQuantityDeducted })
      showToast(`Used ${qty} ${unit} of ${item.canonical_name}`, { type: 'success' })
    } catch (err) {
      setErrorMsg(err.message || 'Could not record consumption')
    }
  }

  // Computed from the RPC's own reported deduction (never re-derived/guessed) — the item
  // prop itself stays stale until the invalidated query refetches behind this modal.
  const newBalance = result
    ? formatInventoryQuantity({ ...item, quantity_grams: Math.max(0, item.quantity_grams - result.baseQuantityDeducted) })
    : null

  if (item.compatibleUnits.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-t-3xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-gray-500 mb-4">
            This item doesn't have semantic quantity data yet, so a safe unit can't be offered.
            Re-scan a bill for it to enable consumption tracking.
          </p>
          <button onClick={onClose} className="w-full h-12 rounded-xl border border-gray-200 text-gray-600 font-medium">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-3xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#1E3A5F] mb-1">Use {item.canonical_name}</h2>
        <p className="text-xs text-gray-400 mb-4">Currently: {formatInventoryQuantity(item)?.primary || item.display_quantity}</p>

        {result ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-1">Recorded {result.quantity} {result.unit} used.</p>
            <p className="text-base font-bold text-[#2E86AB] mb-4">
              New balance: {newBalance?.primary}
            </p>
            <button onClick={onClose} className="w-full h-12 rounded-xl bg-[#1E3A5F] text-white font-semibold">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              <input
                autoFocus
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantity"
                className="flex-1 h-12 px-3 rounded-xl border border-gray-200 text-sm"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-12 px-3 rounded-xl border border-gray-200 text-sm"
              >
                {item.compatibleUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {errorMsg && <p className="text-xs text-red-500 mb-3">{errorMsg}</p>}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConsuming}
                className="flex-1 h-12 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-50"
              >
                {isConsuming ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
