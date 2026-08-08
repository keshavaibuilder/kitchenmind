/**
 * Renders a suggestion's explanation. Every suggestion this app generates carries at least one
 * reason (see PlanningEngine.scoreMealCandidate's fallback) — this component has no "no reason
 * given" branch on purpose, so a future caller can't accidentally render an unexplained pick.
 */
export default function ReasonChips({ reasons, confidence }) {
  return (
    <div className="space-y-1">
      {reasons.map((r) => (
        <p key={r.code} className="text-[11px] text-gray-500 flex items-start gap-1">
          <span className="text-[#2E86AB]" aria-hidden="true">
            •
          </span>
          <span>{r.text}</span>
        </p>
      ))}
      {typeof confidence === 'number' && <p className="text-[10px] text-gray-300 mt-1">Confidence: {Math.round(confidence * 100)}%</p>}
    </div>
  )
}
