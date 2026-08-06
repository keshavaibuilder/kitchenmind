const OPTIONS = [
  { id: 'ekadashi',  label: 'Ekadashi',     sub: 'Twice a month' },
  { id: 'monday',    label: 'Monday fast',   sub: 'Every Monday' },
  { id: 'saturday',  label: 'Saturday fast', sub: 'Every Saturday' },
  { id: 'navratri',  label: 'Navratri',      sub: 'Seasonal' },
  { id: 'none',      label: 'No fasting days', sub: 'We eat normally all week' },
]

export default function StepFasting({ value, onChange, onNext }) {
  function toggle(id) {
    if (id === 'none') {
      onChange(['none'])
      return
    }
    const without = value.filter((v) => v !== 'none')
    if (without.includes(id)) {
      onChange(without.filter((v) => v !== id))
    } else {
      onChange([...without, id])
    }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
        Any regular fasting days?
      </h2>
      <p className="text-gray-500 text-sm mt-2 mb-6">
        We'll suggest the right food on these days
      </p>

      <div className="flex flex-col gap-3 mb-auto">
        {OPTIONS.map((opt) => {
          const selected = value.includes(opt.id)
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={`flex items-center gap-4 h-16 px-4 rounded-xl border-2 text-left transition-all active:scale-95
                ${selected
                  ? 'bg-[#2E86AB] border-[#2E86AB] text-white'
                  : 'bg-white border-gray-200 text-gray-800'
                }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-white bg-white' : 'border-gray-300'}`}>
                {selected && <div className="w-2.5 h-2.5 rounded-full bg-[#2E86AB]" />}
              </div>
              <div>
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className={`text-xs ${selected ? 'text-blue-100' : 'text-gray-400'}`}>{opt.sub}</p>
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={onNext}
        disabled={value.length === 0}
        className="mt-8 w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-40 active:scale-95 transition-transform"
      >
        All set! Let's see your kitchen →
      </button>
    </div>
  )
}
