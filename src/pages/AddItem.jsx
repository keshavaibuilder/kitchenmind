import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../hooks/useInventory'
import { CURATED_INGREDIENTS as ITEMS, INGREDIENT_GROUP_ORDER as GROUP_ORDER } from '../config/ingredients.js'

// ── Quantity options per type ─────────────────────────────────
const QTY = {
  Staples: [
    { label: 'Ek mutthi',  hint: '~60g',   grams: 60   },
    { label: 'Do mutthi',  hint: '~120g',  grams: 120  },
    { label: 'Teen mutthi',hint: '~180g',  grams: 180  },
    { label: 'Ek katori',  hint: '~150g',  grams: 150  },
    { label: 'Ek gilas',   hint: '~250g',  grams: 250  },
    { label: 'Adha kilo',  hint: '~500g',  grams: 500  },
    { label: 'Ek kilo',    hint: '~1kg',   grams: 1000 },
    { label: 'Do kilo',    hint: '~2kg',   grams: 2000 },
  ],
  FreshVeg: [
    { label: 'Thoda sa',   hint: '~100g',  grams: 100  },
    { label: 'Ek mutthi',  hint: '~150g',  grams: 150  },
    { label: 'Do mutthi',  hint: '~300g',  grams: 300  },
    { label: 'Adha kilo',  hint: '~500g',  grams: 500  },
    { label: 'Ek kilo',    hint: '~1kg',   grams: 1000 },
    { label: 'Dedh kilo',  hint: '~1.5kg', grams: 1500 },
    { label: 'Do kilo',    hint: '~2kg',   grams: 2000 },
  ],
  DairyMilk: [
    { label: 'Adha litre', hint: '~500ml', grams: 500  },
    { label: 'Ek litre',   hint: '~1L',    grams: 1000 },
    { label: 'Do litre',   hint: '~2L',    grams: 2000 },
  ],
  DairySolid: [
    { label: 'Thoda sa',   hint: '~100g',  grams: 100  },
    { label: 'Adha packet',hint: '~200g',  grams: 200  },
    { label: 'Ek packet',  hint: '~500g',  grams: 500  },
  ],
  Spices: [
    { label: 'Thodi si',   hint: '~50g',   grams: 50   },
    { label: 'Ek dibba',   hint: '~100g',  grams: 100  },
    { label: 'Bada pack',  hint: '~200g',  grams: 200  },
    { label: 'Adha kilo',  hint: '~500g',  grams: 500  },
  ],
  NonVeg: [
    { label: 'Adha kilo',  hint: '~500g',  grams: 500  },
    { label: 'Pauna kilo', hint: '~750g',  grams: 750  },
    { label: 'Ek kilo',    hint: '~1kg',   grams: 1000 },
    { label: 'Dedh kilo',  hint: '~1.5kg', grams: 1500 },
    { label: 'Do kilo',    hint: '~2kg',   grams: 2000 },
  ],
  Eggs: [
    { label: '6 ande',     hint: '6 eggs', grams: 6,   isPcs: true },
    { label: '12 ande',    hint: '12 eggs',grams: 12,  isPcs: true },
    { label: '18 ande',    hint: '18 eggs',grams: 18,  isPcs: true },
    { label: '30 ande',    hint: '30 eggs',grams: 30,  isPcs: true },
  ],
}

function getQtyOptions(item) {
  if (item.isEggs)                             return QTY.Eggs
  if (item.category === 'Non-Veg')             return QTY.NonVeg
  if (item.category === 'Spices')              return QTY.Spices
  if (item.category === 'Fresh & Vegetables')  return QTY.FreshVeg
  if (item.category === 'Dairy') {
    const isMilk = item.canonical.toLowerCase().includes('milk') ||
                   item.canonical.toLowerCase().includes('cream') ||
                   item.canonical.toLowerCase().includes('curd')
    return isMilk ? QTY.DairyMilk : QTY.DairySolid
  }
  return QTY.Staples
}

// Default low-stock thresholds
function defaultThreshold(canonical, category) {
  const n = canonical.toLowerCase()
  if (n.includes('rice'))                                         return 500
  if (n.includes('flour') || n.includes('atta'))                  return 500
  if (n.includes('dal') || n.includes('bean') || n.includes('chickpea')) return 300
  if (n.includes('oil'))                                          return 300
  if (n.includes('ghee'))                                         return 100
  if (n.includes('milk'))                                         return 500
  if (category === 'Spices')                                      return 50
  if (category === 'Fresh & Vegetables')                          return 200
  return 0
}

const CATEGORY_COLOURS = {
  'Staples':           'bg-blue-100 text-[#2E86AB]',
  'Fresh & Vegetables':'bg-green-100 text-[#1A7A4A]',
  'Non-Veg':           'bg-red-100 text-[#C0392B]',
  'Dairy':             'bg-yellow-100 text-[#D4AC0D]',
  'Spices':            'bg-orange-100 text-[#E67E22]',
  'Miscellaneous':     'bg-purple-100 text-[#8E44AD]',
}

// ── Main component ────────────────────────────────────────────
export default function AddItem() {
  const navigate = useNavigate()
  const { addItem } = useInventory()

  const [step,     setStep]     = useState(1)
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)   // { label, canonical, category, isEggs? }
  const [qtyOpt,   setQtyOpt]   = useState(null)   // { label, hint, grams, isPcs? }
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const searchRef = useRef()

  // ── Step 1: filtered items ─────────────────────────────────
  const q = search.toLowerCase().trim()
  const filtered = useMemo(() => {
    if (!q) return ITEMS
    return ITEMS.filter(
      (i) => i.label.toLowerCase().includes(q) || i.canonical.toLowerCase().includes(q)
    )
  }, [q])

  const groups = useMemo(() => {
    const map = {}
    filtered.forEach((item) => {
      if (!map[item.category]) map[item.category] = []
      map[item.category].push(item)
    })
    return GROUP_ORDER.filter((g) => map[g]).map((g) => ({ group: g, items: map[g] }))
  }, [filtered])

  function selectItem(item) {
    setSelected(item)
    setQtyOpt(null)
    setStep(2)
  }

  function selectCustom() {
    if (!customName.trim()) return
    selectItem({ label: customName.trim(), canonical: customName.trim(), category: 'Miscellaneous' })
    setCustomName('')
    setShowCustom(false)
  }

  // ── Step 3: save ───────────────────────────────────────────
  async function handleSave() {
    if (!qtyOpt || !selected) return
    setSaving(true)

    const gramsToStore = qtyOpt.isPcs ? qtyOpt.grams : qtyOpt.grams
    const displayUnit  = qtyOpt.isPcs ? 'pcs' : 'g'
    const threshold    = defaultThreshold(selected.canonical, selected.category)

    try {
      await addItem({
        label: selected.label,
        canonical: selected.canonical,
        category: selected.category,
        gramsToStore,
        displayUnit,
        threshold,
      })
      setDone(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  if (done) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-[#1E3A5F] mb-2">
            Done! {selected.label} is now in your kitchen.
          </h2>
          <p className="text-gray-500 text-sm mb-8">{qtyOpt.label} added successfully.</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setStep(1); setSearch(''); setSelected(null); setQtyOpt(null); setDone(false) }}
              className="w-full h-14 rounded-xl border-2 border-[#2E86AB] text-[#2E86AB] font-semibold active:scale-95 transition-transform"
            >
              Add another item
            </button>
            <button
              onClick={() => navigate('/inventory')}
              className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
            >
              View kitchen →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: quantity ──────────────────────────────────────
  if (step === 2 && selected) {
    const options = getQtyOptions(selected)
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col max-w-md mx-auto">
        {/* Header */}
        <div className="px-4 pt-8 pb-4 flex-shrink-0">
          <button onClick={() => setStep(1)} className="text-[#2E86AB] text-sm font-semibold mb-4 flex items-center gap-1">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
            How much {selected.label} did you buy?
          </h1>
        </div>

        {/* Quantity grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-32">
          <div className="grid grid-cols-2 gap-3">
            {options.map((opt) => {
              const sel = qtyOpt?.label === opt.label
              return (
                <button
                  key={opt.label}
                  onClick={() => { setQtyOpt(opt); setStep(3) }}
                  className={`h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95
                    ${sel
                      ? 'bg-[#2E86AB] border-[#2E86AB] text-white'
                      : 'bg-white border-gray-200 text-gray-800'
                    }`}
                >
                  <span className="text-base font-bold">{opt.label}</span>
                  <span className={`text-xs ${sel ? 'text-blue-100' : 'text-gray-400'}`}>{opt.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: confirm ───────────────────────────────────────
  if (step === 3 && selected && qtyOpt) {
    const catColour = CATEGORY_COLOURS[selected.category] || 'bg-gray-100 text-gray-600'
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col max-w-md mx-auto px-4 pt-8">
        <button onClick={() => setStep(2)} className="text-[#2E86AB] text-sm font-semibold mb-6 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-6">Looks right?</h1>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Adding to kitchen</p>
          <p className="text-xl font-bold text-[#1E3A5F] mb-1">{selected.label}</p>
          <p className="text-lg text-[#2E86AB] font-semibold mb-3">{qtyOpt.label}</p>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${catColour}`}>
            {selected.category}
          </span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold disabled:opacity-50 active:scale-95 transition-transform"
        >
          {saving ? 'Adding…' : 'Add to kitchen'}
        </button>
      </div>
    )
  }

  // ── Step 1: search & select ───────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col max-w-md mx-auto">
      {/* Sticky search header */}
      <div className="sticky top-0 bg-[#F5F7FA] px-4 pt-8 pb-3 z-10">
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-4">What did you buy?</h1>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            ref={searchRef}
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredients…"
            className="w-full h-12 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✕</button>
          )}
        </div>
      </div>

      {/* Grouped list */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-5">
        {groups.map(({ group, items }) => (
          <div key={group}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{group}</p>
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {items.map((item) => (
                <button
                  key={item.canonical}
                  onClick={() => selectItem(item)}
                  className="w-full flex items-center justify-between px-4 h-14 text-left active:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  <span className="text-gray-300 text-lg">›</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No results for "{search}"</p>
        )}

        {/* Add manually */}
        <div>
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className="w-full h-12 rounded-xl border-2 border-dashed border-[#2E86AB] text-[#2E86AB] text-sm font-semibold active:scale-95 transition-transform"
            >
              + Can't find it? Add manually
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-2">What do you call it?</p>
              <input
                autoFocus
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && selectCustom()}
                placeholder="e.g. Tinda, Suran…"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2E86AB] mb-3"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowCustom(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-gray-500 text-sm">Cancel</button>
                <button onClick={selectCustom} disabled={!customName.trim()} className="flex-1 h-10 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
