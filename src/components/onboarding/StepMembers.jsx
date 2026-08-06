function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="flex-1 bg-gray-50 rounded-2xl p-4 text-center">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-10 h-10 rounded-full border-2 border-[#2E86AB] text-[#2E86AB] text-xl font-bold flex items-center justify-center active:scale-90 transition-transform"
        >
          −
        </button>
        <span className="text-3xl font-bold text-[#1E3A5F] w-8">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-10 h-10 rounded-full bg-[#2E86AB] text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-transform"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function StepMembers({ value, onChange, onNext }) {
  const { adults, children, rotiPerAdult } = value

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
        Who's eating with you?
      </h2>
      <p className="text-gray-500 text-sm mt-2 mb-8">
        We'll use this to plan the right portions
      </p>

      <div className="flex gap-3 mb-6">
        <Stepper
          label="Adults"
          value={adults}
          min={1}
          max={10}
          onChange={(v) => onChange({ ...value, adults: v })}
        />
        <Stepper
          label="Children"
          value={children}
          min={0}
          max={8}
          onChange={(v) => onChange({ ...value, children: v })}
        />
      </div>

      <div className="bg-gray-50 rounded-2xl p-4 mb-auto">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Roti per adult
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onChange({ ...value, rotiPerAdult: Math.max(1, rotiPerAdult - 1) })}
            className="w-10 h-10 rounded-full border-2 border-[#2E86AB] text-[#2E86AB] text-xl font-bold flex items-center justify-center active:scale-90 transition-transform"
          >
            −
          </button>
          <span className="text-3xl font-bold text-[#1E3A5F] w-8">{rotiPerAdult}</span>
          <button
            onClick={() => onChange({ ...value, rotiPerAdult: Math.min(10, rotiPerAdult + 1) })}
            className="w-10 h-10 rounded-full bg-[#2E86AB] text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-transform"
          >
            +
          </button>
          <span className="text-sm text-gray-500 ml-2">per meal</span>
        </div>
      </div>

      <button
        onClick={onNext}
        className="mt-8 w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
      >
        That's our family →
      </button>
    </div>
  )
}
