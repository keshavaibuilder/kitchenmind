import { useState } from 'react'

/**
 * @param {number} servings
 * @param {(servings: number) => void} onChange
 * @param {Array<number>} [presets]
 */
export default function ServingScaleSelector({ servings, onChange, presets = [1, 2, 4, 6, 8] }) {
  const isPreset = presets.includes(servings)
  const [customOpen, setCustomOpen] = useState(!isPreset)

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Servings</p>
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Select number of servings">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => {
              onChange(p)
              setCustomOpen(false)
            }}
            aria-pressed={servings === p && !customOpen}
            className={`w-11 h-11 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${
              servings === p && !customOpen
                ? 'bg-[#2E86AB] border-[#2E86AB] text-white'
                : 'bg-white border-gray-200 text-gray-700'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen(true)}
          aria-pressed={customOpen}
          className={`h-11 px-3 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${
            customOpen ? 'bg-[#2E86AB] border-[#2E86AB] text-white' : 'bg-white border-gray-200 text-gray-700'
          }`}
        >
          {!isPreset ? servings : 'Custom'}
        </button>
      </div>
      {customOpen && (
        <input
          type="number"
          min={1}
          max={50}
          value={servings}
          onChange={(e) => onChange(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          aria-label="Custom serving count"
          className="mt-3 w-24 h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
          autoFocus
        />
      )}
    </div>
  )
}
