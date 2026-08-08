import { formatGrams } from '../../utils/formatters.js'

const PRIORITY_STYLE = {
  HIGH: 'bg-red-100 text-[#C0392B]',
  MEDIUM: 'bg-yellow-100 text-[#B7950B]',
  LOW: 'bg-gray-100 text-gray-500',
}

export default function ShoppingSuggestionGroup({ group }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{group.category}</p>
      <div className="space-y-3">
        {group.items.map((item) => (
          <div key={item.canonicalName} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-sm font-semibold text-gray-700 min-w-0 truncate">
                {item.canonicalName}
                {item.preferredBrand && <span className="text-gray-400 font-normal"> · {item.preferredBrand}</span>}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_STYLE[item.priority]}`}>
                {item.priority}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">{item.reason}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-gray-400">{item.suggestedGrams ? formatGrams(item.suggestedGrams) : ''}</span>
              <span className={`text-[11px] font-semibold ${item.purchaseWindow.urgent ? 'text-[#C0392B]' : 'text-[#2E86AB]'}`}>
                {item.purchaseWindow.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
