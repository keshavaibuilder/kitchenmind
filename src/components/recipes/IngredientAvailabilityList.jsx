import { AVAILABILITY_STATUS } from '../../utils/ingredientAvailability.js'
import { formatGrams } from '../../utils/formatters.js'

const STATUS_META = {
  [AVAILABILITY_STATUS.AVAILABLE]: { icon: '✓', label: 'Available', color: 'text-[#1A7A4A]', bg: 'bg-green-50' },
  [AVAILABILITY_STATUS.LOW]: { icon: '⚠', label: 'Low stock', color: 'text-[#B7950B]', bg: 'bg-yellow-50' },
  [AVAILABILITY_STATUS.MISSING]: { icon: '✕', label: 'Missing', color: 'text-[#C0392B]', bg: 'bg-red-50' },
}

/**
 * @param {Array<{canonical_name, requiredGrams, availableGrams, shortfallGrams, status, isOptional}>} availability
 */
export default function IngredientAvailabilityList({ availability }) {
  if (!availability || availability.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No ingredients listed for this recipe.</p>
  }

  return (
    <div className="space-y-2">
      {availability.map((row) => {
        const meta = STATUS_META[row.status]
        return (
          <div key={row.canonical_name} className={`rounded-xl p-3 flex items-center justify-between gap-3 ${meta.bg}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`text-base font-bold flex-shrink-0 ${meta.color}`} aria-label={meta.label} title={meta.label}>
                {meta.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1E3A5F] truncate">
                  {row.canonical_name}
                  {row.isOptional && <span className="text-gray-400 font-normal"> (optional)</span>}
                </p>
                <p className="text-[11px] text-gray-500">
                  Need {formatGrams(row.requiredGrams)} · Have {formatGrams(row.availableGrams)}
                  {row.shortfallGrams > 0 && ` · Short ${formatGrams(row.shortfallGrams)}`}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
