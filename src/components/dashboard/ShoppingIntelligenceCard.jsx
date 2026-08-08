import ExpandablePanel from './ExpandablePanel'
import { formatGrams } from '../../utils/formatters.js'

export default function ShoppingIntelligenceCard({ items }) {
  return (
    <ExpandablePanel
      title="Shopping Intelligence"
      summary={items.length > 0 ? `${items.length} item${items.length === 1 ? '' : 's'} likely needed soon` : 'Nothing predicted to buy soon'}
      isEmpty={items.length === 0}
      emptyMessage="Nothing is predicted to run out soon."
    >
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.canonicalName} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">
              {item.canonicalName}
              {item.preferredBrand && <span className="text-gray-400"> · {item.preferredBrand}</span>}
            </span>
            <span className="text-[#2E86AB] font-semibold">
              {item.suggestedPurchaseGrams ? formatGrams(item.suggestedPurchaseGrams) : `${item.daysUntilDepletion}d`}
            </span>
          </div>
        ))}
      </div>
    </ExpandablePanel>
  )
}
