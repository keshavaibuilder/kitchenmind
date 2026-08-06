const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function StepNonVeg({ value, onChange, onNext }) {
  const { eatsNonVeg, days } = value

  function toggleDay(day) {
    if (days.includes(day)) {
      onChange({ ...value, days: days.filter((d) => d !== day) })
    } else {
      onChange({ ...value, days: [...days, day] })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
        Does the family eat non-veg?
      </h2>
      <p className="text-gray-500 text-sm mt-2 mb-8">
        We'll only suggest chicken, mutton or fish on these days
      </p>

      {/* Yes / No toggle */}
      <div className="flex gap-3 mb-8">
        {[true, false].map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange({ eatsNonVeg: opt, days: opt ? days : [] })}
            className={`flex-1 h-14 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95
              ${eatsNonVeg === opt
                ? 'bg-[#2E86AB] border-[#2E86AB] text-white'
                : 'bg-white border-gray-200 text-gray-700'
              }`}
          >
            {opt ? 'Yes' : 'No, we\'re vegetarian'}
          </button>
        ))}
      </div>

      {eatsNonVeg && (
        <div className="mb-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Which days?
          </p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const selected = days.includes(day)
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`w-14 h-14 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95
                    ${selected
                      ? 'bg-[#2E86AB] border-[#2E86AB] text-white'
                      : 'bg-white border-gray-200 text-gray-700'
                    }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {eatsNonVeg === null && <div className="mb-auto" />}

      <button
        onClick={onNext}
        disabled={eatsNonVeg === null || (eatsNonVeg && days.length === 0)}
        className="mt-8 w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-40 active:scale-95 transition-transform"
      >
        Perfect →
      </button>
    </div>
  )
}
