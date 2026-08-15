import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../hooks/useInventory'
import { InventoryConsumptionService } from '../services/InventoryConsumptionService'
import ConsumeItemModal from '../components/inventory/ConsumeItemModal'

const TABS = [
  { label: 'All',         value: 'All'               },
  { label: 'Staples',     value: 'Staples'            },
  { label: 'Fresh & Veg', value: 'Fresh & Vegetables' },
  { label: 'Non-Veg',     value: 'Non-Veg'            },
  { label: 'Dairy',       value: 'Dairy'              },
  { label: 'Spices',      value: 'Spices'             },
  { label: 'Misc',        value: 'Miscellaneous'      },
]

const CAT_STYLE = {
  'Staples':            { chip: 'bg-blue-100 text-[#2E86AB]',   border: 'border-l-[#2E86AB]'  },
  'Fresh & Vegetables': { chip: 'bg-green-100 text-[#1A7A4A]',  border: 'border-l-[#1A7A4A]'  },
  'Non-Veg':            { chip: 'bg-red-100 text-[#C0392B]',    border: 'border-l-[#C0392B]'  },
  'Dairy':              { chip: 'bg-yellow-100 text-[#D4AC0D]', border: 'border-l-[#D4AC0D]'  },
  'Spices':             { chip: 'bg-orange-100 text-[#E67E22]', border: 'border-l-[#E67E22]'  },
  'Miscellaneous':      { chip: 'bg-purple-100 text-[#8E44AD]', border: 'border-l-[#8E44AD]'  },
}

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  return `Updated ${days} days ago`
}

function ItemCard({ item, onConsume }) {
  const isLow = item.low_stock_threshold > 0 && item.quantity_grams <= item.low_stock_threshold
  const style = CAT_STYLE[item.category] ?? CAT_STYLE['Miscellaneous']
  const compatibleUnits = InventoryConsumptionService.getCompatibleUnits(item)

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${isLow ? 'border-l-red-400' : style.border} shadow-sm px-4 py-3 flex items-center gap-3`}>
      {/* Low stock dot */}
      {isLow && <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-[#1E3A5F] truncate capitalize">
            {item.canonical_name}
          </p>
          {isLow && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-500 flex-shrink-0">
              Running low
            </span>
          )}
        </div>
        <p className="text-base font-bold text-[#2E86AB]">{item.display_quantity}</p>
        {item.display_quantity_detail && (
          <p className="text-[11px] text-gray-500">{item.display_quantity_detail}</p>
        )}
        <p className="text-[11px] text-gray-400 mt-0.5">{relativeTime(item.last_updated)}</p>
      </div>

      {/* Category chip */}
      <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${style.chip}`}>
        {item.category === 'Fresh & Vegetables' ? 'Fresh' :
         item.category === 'Miscellaneous' ? 'Misc' : item.category}
      </span>

      {/* Manual consumption entry point — only offered when at least one unit is safe to
          convert (getCompatibleUnits never returns a fabricated conversion). */}
      {compatibleUnits.length > 0 && (
        <button
          onClick={() => onConsume({ ...item, compatibleUnits })}
          className="text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 border border-gray-200 text-gray-500 active:scale-95 transition-transform"
        >
          Use
        </button>
      )}
    </div>
  )
}

export default function Inventory() {
  const navigate = useNavigate()
  const { items, isLoading, refetch } = useInventory()
  const [activeTab, setActiveTab] = useState('All')
  const [consumeTarget, setConsumeTarget] = useState(null)

  const displayed = activeTab === 'All'
    ? items
    : items.filter((i) => i.category === activeTab)

  // ── Loading ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#2E86AB] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#1E3A5F] font-medium text-sm">Checking your kitchen…</p>
        </div>
      </div>
    )
  }

  // ── Empty kitchen ────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">🧺</div>
          <h2 className="text-lg font-bold text-[#1E3A5F] mb-2">
            Your kitchen looks a bit empty
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            Scan a grocery bill to get started — or add items one by one.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/scan')}
              className="w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
            >
              📷 Scan a bill
            </button>
            <button
              onClick={() => navigate('/add-item')}
              className="w-full h-14 rounded-xl border-2 border-[#2E86AB] text-[#2E86AB] font-semibold active:scale-95 transition-transform"
            >
              + Add an item
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-8 pb-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Your Kitchen</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/add-item')}
            className="h-9 px-3 rounded-xl bg-[#2E86AB] text-white text-sm font-semibold active:scale-95 transition-transform"
          >
            + Add
          </button>
          <button
            onClick={() => refetch()}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Category tabs — horizontal scroll */}
      <div className="flex-shrink-0 overflow-x-auto px-4 pb-3">
        <div className="flex gap-2 w-max">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-all active:scale-95
                ${activeTab === tab.value
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-white border border-gray-200 text-gray-600'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {displayed.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">
              Nothing in {activeTab === 'All' ? 'your kitchen' : activeTab} yet
            </p>
            <button
              onClick={() => navigate('/scan')}
              className="mt-4 text-[#2E86AB] text-sm font-semibold underline"
            >
              Scan a bill to add items
            </button>
          </div>
        ) : (
          displayed.map((item) => <ItemCard key={item.id} item={item} onConsume={setConsumeTarget} />)
        )}
      </div>

      {consumeTarget && (
        <ConsumeItemModal item={consumeTarget} onClose={() => setConsumeTarget(null)} />
      )}
    </div>
  )
}
