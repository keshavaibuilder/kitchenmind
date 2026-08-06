import { useState, useMemo } from 'react'

// Rice-free, sambhar-paired tiffin items
const BOX_OPTIONS = [
  'Paratha with Pickle',
  'Thepla',
  'Roti Sabzi',
  'Sandwich',
  'Veg Noodles',
  'Poha',
  'Idli with Sambhar',   // always paired
  'Dosa with Sambhar',   // always paired
  'Dhokla',
  'Pasta',
  'Upma',
  'Besan Chilla',
  'Fruit Box',
]

// Items that require sambhar in inventory
const REQUIRES_SAMBHAR = new Set(['Idli with Sambhar', 'Dosa with Sambhar'])

const DEFAULT_OPTIONS = [
  { id: 'none',   label: 'No tiffin needed' },
  { id: '1box',   label: 'Usually 1 box'    },
  { id: '2boxes', label: 'Always 2 boxes'   },
  { id: 'varies', label: 'Varies day to day' },
]

function AddCustomModal({ onAdd, onClose }) {
  const [text, setText] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 px-4 pb-8">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-base font-bold text-[#1E3A5F] mb-1">Add your own</h3>
        <p className="text-xs text-gray-400 mb-4">What do you call it?</p>
        <input
          autoFocus
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && text.trim() && onAdd(text.trim())}
          placeholder="e.g. Mushroom Roll"
          className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E86AB] mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-500 font-semibold text-sm">
            Cancel
          </button>
          <button
            onClick={() => text.trim() && onAdd(text.trim())}
            disabled={!text.trim()}
            className="flex-1 h-12 rounded-xl bg-[#1E3A5F] text-white font-semibold text-sm disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemChip({ name, selected, custom, onToggle }) {
  const needsSambhar = REQUIRES_SAMBHAR.has(name)
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 h-12 px-4 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 whitespace-nowrap
        ${selected
          ? 'bg-[#2E86AB] border-[#2E86AB] text-white'
          : 'bg-white border-gray-200 text-gray-700'
        }`}
    >
      {custom && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selected ? 'bg-white/30 text-white' : 'bg-[#2E86AB]/10 text-[#2E86AB]'}`}>
          Your recipe
        </span>
      )}
      {needsSambhar && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selected ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'}`}>
          +sambhar
        </span>
      )}
      {name}
    </button>
  )
}

function BoxPreferences({ label, selected, customItems, onChange, onAddCustom, search }) {
  const [showModal, setShowModal] = useState(false)

  function toggle(name) {
    if (selected.includes(name)) onChange(selected.filter((i) => i !== name))
    else onChange([...selected, name])
  }

  function handleAdd(name) {
    onAddCustom(name)
    onChange([...selected, name])
    setShowModal(false)
  }

  const q = search.toLowerCase().trim()
  const filteredOptions = useMemo(
    () => BOX_OPTIONS.filter((o) => !q || o.toLowerCase().includes(q)),
    [q]
  )
  const filteredCustom = useMemo(
    () => customItems.filter((c) => !q || c.toLowerCase().includes(q)),
    [customItems, q]
  )

  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {filteredCustom.map((name) => (
          <ItemChip key={name} name={name} selected={selected.includes(name)} custom onToggle={() => toggle(name)} />
        ))}
        {filteredOptions.map((name) => (
          <ItemChip key={name} name={name} selected={selected.includes(name)} onToggle={() => toggle(name)} />
        ))}
      </div>
      <button
        onClick={() => setShowModal(true)}
        className="w-full h-10 rounded-xl border-2 border-dashed border-[#2E86AB]/40 text-[#2E86AB] text-xs font-semibold active:scale-95 transition-transform"
      >
        + Add your own
      </button>
      {showModal && <AddCustomModal onAdd={handleAdd} onClose={() => setShowModal(false)} />}
    </div>
  )
}

export default function StepTiffin({ value, onChange, customItems, onAddCustom, onNext }) {
  const { tiffinDefault, box1, box2 } = value
  const [search, setSearch] = useState('')

  const needsTiffin = tiffinDefault && tiffinDefault !== 'none'
  const showBox2    = tiffinDefault === '2boxes' || tiffinDefault === 'varies'

  function setDefault(d) {
    if (d === 'none') {
      onChange({ tiffinDefault: 'none', box1: [], box2: [], requiresSambhar: false })
    } else {
      onChange({ ...value, tiffinDefault: d })
    }
  }

  function setBox1(items) {
    const sambhar = items.some((i) => REQUIRES_SAMBHAR.has(i)) ||
                    (value.box2 ?? []).some((i) => REQUIRES_SAMBHAR.has(i))
    onChange({ ...value, box1: items, requiresSambhar: sambhar })
  }

  function setBox2(items) {
    const sambhar = (value.box1 ?? []).some((i) => REQUIRES_SAMBHAR.has(i)) ||
                    items.some((i) => REQUIRES_SAMBHAR.has(i))
    onChange({ ...value, box2: items, requiresSambhar: sambhar })
  }

  const canProceed = tiffinDefault === 'none' ||
    (needsTiffin && box1.length > 0)

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
        Does anyone carry a tiffin to school or office?
      </h2>
      <p className="text-gray-500 text-sm mt-2 mb-6">
        We'll plan a fresh box for them every day
      </p>

      {/* Tiffin default selector */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {DEFAULT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setDefault(opt.id)}
            className={`h-14 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95
              ${tiffinDefault === opt.id
                ? 'bg-[#2E86AB] border-[#2E86AB] text-white'
                : 'bg-white border-gray-200 text-gray-700'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {needsTiffin && (
        <>
          {/* Search across both boxes */}
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tiffin items…"
              className="w-full h-11 pl-9 pr-8 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✕</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto -mx-4 px-4 pb-2">
            <BoxPreferences
              label={showBox2 ? 'Box 1 — what goes in first box?' : 'What do you usually pack?'}
              selected={box1}
              customItems={customItems}
              onChange={setBox1}
              onAddCustom={onAddCustom}
              search={search}
            />

            {showBox2 && (
              <BoxPreferences
                label="Box 2 — what goes in second box?"
                selected={box2}
                customItems={customItems}
                onChange={setBox2}
                onAddCustom={onAddCustom}
                search={search}
              />
            )}
          </div>

          <p className="text-xs text-gray-400 text-center mt-2 mb-1">
            You can change this every morning — we'll ask you each day.
          </p>
        </>
      )}

      {!needsTiffin && tiffinDefault !== 'none' && <div className="flex-1" />}

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="mt-3 w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-40 active:scale-95 transition-transform"
      >
        {tiffinDefault === 'none' ? "All set! Let's see your kitchen →" : "Perfect →"}
      </button>
    </div>
  )
}
