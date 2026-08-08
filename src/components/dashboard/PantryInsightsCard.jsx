export default function PantryInsightsCard({ insights }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Pantry Insights</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-lg font-bold text-[#1E3A5F]">{insights.pantryDiversityScore}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Unique ingredients</p>
        </div>
        <div>
          <p className="text-lg font-bold text-[#1E3A5F]">{insights.preferredShoppingDay || '—'}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Usual shopping day</p>
        </div>
      </div>
      {insights.topCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insights.topCategories.map((c) => (
            <span key={c.category} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
              {c.category} ({c.count})
            </span>
          ))}
        </div>
      )}
      {insights.mostConsumedIngredients.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Fastest-moving ingredients</p>
          <div className="flex flex-wrap gap-1.5">
            {insights.mostConsumedIngredients.map((i) => (
              <span key={i.canonicalName} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-[#2E86AB]">
                {i.canonicalName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
