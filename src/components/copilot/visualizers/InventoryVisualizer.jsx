import React from 'react'

export default function InventoryVisualizer({ items = [] }) {
  if (!items || items.length === 0) return null

  return (
    <div className="my-3 p-3.5 bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-xl shadow-inner text-slate-100">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-700/50">
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <span>📦</span> Inventory Status
        </span>
        <span className="text-[11px] text-slate-400 font-medium">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.slice(0, 6).map((item, idx) => {
          const name = item.canonical_name || item.name || 'Ingredient'
          const qty = item.quantity_grams ?? item.quantity ?? 0
          const unit = item.display_unit || 'g'
          const isLow = item.is_low_stock || item.isLowStock

          return (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                isLow
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-slate-900/60 border-slate-700/60 text-slate-200'
              }`}
            >
              <div className="min-w-0 pr-2">
                <p className="font-semibold truncate">{name}</p>
                <p className="text-[10px] text-slate-400">{item.category || 'Pantry'}</p>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-xs">
                  {qty} {unit}
                </span>
                {isLow && (
                  <span className="block text-[9px] font-semibold text-amber-400 uppercase tracking-tight">
                    Low Stock
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
