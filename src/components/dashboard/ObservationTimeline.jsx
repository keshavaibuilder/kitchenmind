import ExpandablePanel from './ExpandablePanel'

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function ObservationTimeline({ observations }) {
  return (
    <ExpandablePanel
      title="AI Observation Timeline"
      summary={observations.length > 0 ? `${observations.length} recent observation${observations.length === 1 ? '' : 's'}` : 'No observations yet'}
      isEmpty={observations.length === 0}
      emptyMessage="Observations appear here as bills are scanned — new ingredients, unusual quantities, and pantry milestones."
    >
      <ol className="space-y-3">
        {observations.map((obs) => (
          <li key={obs.id} className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2E86AB] mt-1.5 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm text-gray-700">{obs.message || obs.label}</p>
              <p className="text-[11px] text-gray-400">
                {obs.label} · {timeAgo(obs.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </ExpandablePanel>
  )
}
