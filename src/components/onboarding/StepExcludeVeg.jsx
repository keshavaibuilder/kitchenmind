const VEGETABLES = [
  'Karela', 'Lauki', 'Tori', 'Parwal', 'Arbi', 'Kathal',
  'Baingan', 'Bhindi', 'Methi', 'Sarson', 'Kaddu',
  'Raw Banana', 'Jackfruit',
]

export default function StepExcludeVeg({ value, onChange, onNext }) {
  function toggle(veg) {
    if (value.includes(veg)) {
      onChange(value.filter((v) => v !== veg))
    } else {
      onChange([...value, veg])
    }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
        Any vegetables the family doesn't enjoy?
      </h2>
      <p className="text-gray-500 text-sm mt-2 mb-6">
        We'll make sure these never show up in suggestions
      </p>

      <div className="flex flex-wrap gap-2 mb-auto">
        {VEGETABLES.map((veg) => {
          const excluded = value.includes(veg)
          return (
            <button
              key={veg}
              onClick={() => toggle(veg)}
              className={`h-12 px-4 rounded-full border-2 text-sm font-medium transition-all active:scale-95
                ${excluded
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'bg-white border-gray-200 text-gray-700'
                }`}
            >
              {excluded ? '✕ ' : ''}{veg}
            </button>
          )
        })}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {value.length === 0 && (
          <button
            onClick={onNext}
            className="w-full h-14 rounded-xl border-2 border-[#2E86AB] text-[#2E86AB] font-semibold active:scale-95 transition-transform"
          >
            We eat everything!
          </button>
        )}
        <button
          onClick={onNext}
          className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
        >
          {value.length > 0
            ? `Got it, skip these ${value.length} →`
            : "Continue →"}
        </button>
      </div>
    </div>
  )
}
