const LABEL_COLOR = {
  Great: 'text-[#1A7A4A]',
  OK: 'text-[#D4AC0D]',
  'Needs attention': 'text-[#C0392B]',
}

/**
 * Deliberately a number + qualitative label, not a gauge/progress-ring chart — per the brief,
 * this dashboard avoids generic BI widgets in favor of directly actionable read-outs.
 */
export default function PantryHealthCard({ pantryHealth }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Pantry Health</p>
      <div className="flex items-end gap-2 mb-1">
        <span className="text-3xl font-bold text-[#1E3A5F]">{pantryHealth.score}</span>
        <span className="text-sm text-gray-400 mb-1">/ 100</span>
      </div>
      <p className={`text-sm font-semibold ${LABEL_COLOR[pantryHealth.label] || 'text-gray-500'}`}>{pantryHealth.label}</p>
      <p className="text-xs text-gray-400 mt-1">
        {pantryHealth.trackedIngredients === 0
          ? 'Not enough purchase history yet to score your pantry.'
          : `${pantryHealth.atRiskCount} of ${pantryHealth.trackedIngredients} tracked ingredients need attention`}
      </p>
    </div>
  )
}
