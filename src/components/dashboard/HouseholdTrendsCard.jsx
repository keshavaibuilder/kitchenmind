function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function HouseholdTrendsCard({ trends }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Household Trends</p>
      <div className="space-y-2 text-sm">
        <Row label="Typical shopping cadence" value={trends.shoppingFrequencyDays ? `every ${trends.shoppingFrequencyDays}d` : '—'} />
        <Row label="Bills analyzed" value={trends.totalBillsAnalyzed} />
        <Row label="Stable ingredient profiles" value={`${trends.ingredientsWithStableProfile} / ${trends.totalTrackedIngredients}`} />
        <Row label="Last cooked" value={formatDate(trends.lastCookedAt)} />
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-[#1E3A5F]">{value}</span>
    </div>
  )
}
