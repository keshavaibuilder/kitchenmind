import React from 'react'

export default function ShoppingVisualizer({ suggestions = [] }) {
  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="my-3 p-3.5 bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-xl shadow-inner text-slate-100">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-700/50">
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <span>🛒</span> Shopping Suggestions
        </span>
        <span className="text-[11px] text-slate-400 font-medium">
          {suggestions.length} items
        </span>
      </div>

      <div className="space-y-2">
        {suggestions.slice(0, 5).map((item, idx) => {
          const name = item.canonicalName || item.canonical_name || item.name || 'Item'
          const qty = item.suggestedGrams || item.quantity_grams || 500
          const reason = item.reason || 'Replenish stock'

          return (
            <div key={idx} className="p-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg text-xs flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-200">{name}</p>
                <p className="text-[10px] text-slate-400 italic">{reason}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono text-amber-300 font-semibold text-xs">{qty}g</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
