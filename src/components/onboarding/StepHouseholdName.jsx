export default function StepHouseholdName({ value, onChange, onNext }) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
        First, what should we call your kitchen?
      </h2>
      <p className="text-gray-500 text-sm mt-2 mb-8">
        This is just a friendly name — like "The Sharma Kitchen"
      </p>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. The Sharma Kitchen"
        className="w-full h-12 px-4 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E86AB] text-sm mb-auto"
        autoFocus
      />

      <button
        onClick={onNext}
        disabled={!value.trim()}
        className="mt-8 w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-40 active:scale-95 transition-transform"
      >
        That's us →
      </button>
    </div>
  )
}
