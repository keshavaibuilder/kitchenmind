import { useState, useMemo } from 'react'

const GROUPS = [
  {
    label: 'Grain Based',
    items: ['Poha', 'Upma', 'Sheera', 'Sabudana Khichdi', 'Daliya', 'Pongal'],
  },
  {
    label: 'Paratha Family',
    items: [
      'Aloo Paratha', 'Gobhi Paratha', 'Mooli Paratha',
      'Methi Paratha', 'Paneer Paratha', 'Plain Paratha',
    ],
  },
  {
    label: 'South Indian',
    items: ['Idli', 'Dosa', 'Masala Dosa', 'Rava Dosa', 'Uttapam', 'Medu Vada', 'Appam'],
  },
  {
    label: 'Bread Based',
    items: ['Bread Butter', 'Bread Omelette', 'Bread Upma', 'Sandwich'],
  },
  {
    label: 'Quick & Light',
    items: ['Boiled Eggs', 'Oats Porridge', 'Cornflakes', 'Fruit & Curd', 'Makhana'],
  },
  {
    label: 'Weekend Special',
    items: ['Chole Bhature', 'Puri Sabzi', 'Besan Chilla', 'Moong Dal Chilla'],
  },
]

function ItemChip({ name, selected, custom, onToggle }) {
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
      {name}
    </button>
  )
}

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
          placeholder="e.g. Paneer Roll"
          className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E86AB] mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-500 font-semibold text-sm"
          >
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

export default function StepBreakfast({ value, onChange, customItems, onAddCustom, onNext }) {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  function toggle(name) {
    if (value.includes(name)) {
      onChange(value.filter((v) => v !== name))
    } else {
      onChange([...value, name])
    }
  }

  function handleAddCustom(name) {
    onAddCustom(name)
    onChange([...value, name])
    setShowModal(false)
  }

  const q = search.toLowerCase().trim()

  const filteredGroups = useMemo(() => {
    if (!q) return GROUPS
    return GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => i.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0)
  }, [q])

  const filteredCustom = useMemo(
    () => customItems.filter((c) => !q || c.toLowerCase().includes(q)),
    [customItems, q]
  )

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
        What does breakfast usually look like?
      </h2>
      <p className="text-gray-500 text-sm mt-2 mb-4">
        Pick everything you make — we'll rotate through them
      </p>

      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search breakfast items…"
          className="w-full h-11 pl-9 pr-4 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✕</button>
        )}
      </div>

      {/* Scrollable item list */}
      <div className="flex-1 overflow-y-auto -mx-4 px-4 space-y-5 pb-2">
        {/* Custom items first */}
        {filteredCustom.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[#2E86AB] uppercase tracking-wide mb-2">Your Recipes</p>
            <div className="flex flex-wrap gap-2">
              {filteredCustom.map((name) => (
                <ItemChip key={name} name={name} selected={value.includes(name)} custom onToggle={() => toggle(name)} />
              ))}
            </div>
          </div>
        )}

        {/* Grouped items */}
        {filteredGroups.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <ItemChip key={item} name={item} selected={value.includes(item)} onToggle={() => toggle(item)} />
              ))}
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && filteredCustom.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No results for "{search}"</p>
        )}
      </div>

      {/* Add your own */}
      <button
        onClick={() => setShowModal(true)}
        className="mt-3 w-full h-12 rounded-xl border-2 border-dashed border-[#2E86AB] text-[#2E86AB] text-sm font-semibold active:scale-95 transition-transform"
      >
        + Add your own
      </button>

      <button
        onClick={onNext}
        disabled={value.length === 0}
        className="mt-3 w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-40 active:scale-95 transition-transform"
      >
        These are our favourites →
      </button>

      {showModal && <AddCustomModal onAdd={handleAddCustom} onClose={() => setShowModal(false)} />}
    </div>
  )
}
