export default function HouseholdSnapshotHeader({ snapshot, onRefresh }) {
  return (
    <div className="bg-[#1E3A5F] rounded-2xl p-5 text-white">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-blue-200 font-semibold mb-1">Kitchen Snapshot</p>
          <h1 className="text-xl font-bold">{snapshot.householdName}</h1>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label="Refresh dashboard"
            title="Refresh"
          >
            ↻
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SnapshotStat value={snapshot.pantryHealthScore ?? '—'} label="Health" />
        <SnapshotStat value={snapshot.lowStockCount} label="Low stock" />
        <SnapshotStat value={snapshot.expiryRiskCount} label="Expiring" />
      </div>
    </div>
  )
}

function SnapshotStat({ value, label }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] text-blue-200 uppercase tracking-wide">{label}</p>
    </div>
  )
}
