import { formatGrams } from '../../utils/formatters.js'

/**
 * Before -> after preview of exactly what inventory will be consumed. No inventory changes
 * until the user confirms — this is a pure read-only projection from already-fetched data.
 * @param {Array<{canonical_name, requiredGrams, remainingAfterCookGrams, status}>} availability
 */
export default function InventoryImpactPreview({ availability }) {
  if (!availability || availability.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3">
      {availability.map((row) => (
        <div key={row.canonical_name} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-xs font-semibold text-[#1E3A5F] truncate mb-1">{row.canonical_name}</p>
          <p className="text-sm font-bold text-gray-700">{formatGrams(row.requiredGrams)}</p>
          <p className="text-gray-300 text-xs my-0.5" aria-hidden="true">
            ↓
          </p>
          <p className={`text-xs font-semibold ${row.status === 'missing' ? 'text-[#C0392B]' : 'text-gray-500'}`}>
            {formatGrams(row.remainingAfterCookGrams)} remaining
          </p>
        </div>
      ))}
    </div>
  )
}
