import React from 'react'

export default function PredictionVisualizer({ predictions = [] }) {
  if (!predictions || predictions.length === 0) return null

  return (
    <div className="my-3 p-3.5 bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-xl shadow-inner text-slate-100">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-700/50">
        <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
          <span>🔮</span> Expiry & Depletion Forecast
        </span>
        <span className="text-[11px] text-slate-400 font-medium">
          {predictions.length} predictions
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {predictions.slice(0, 4).map((pred, idx) => {
          const name = pred.canonical_name || pred.name || 'Ingredient'
          const days = pred.days_until_depletion ?? pred.days_remaining ?? 3
          const isUrgent = days <= 3

          return (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                isUrgent ? 'bg-rose-950/40 border-rose-500/40 text-rose-200' : 'bg-slate-900/60 border-slate-700/60 text-slate-200'
              }`}
            >
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-[10px] text-slate-400">Pantry depletion</p>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-xs">
                  {days === 0 ? 'Today' : `~${days} d`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
