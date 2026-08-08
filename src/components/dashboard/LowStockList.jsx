import ExpandablePanel from './ExpandablePanel'

export default function LowStockList({ items }) {
  return (
    <ExpandablePanel
      title="Low Stock Predictions"
      summary={items.length > 0 ? `${items.length} item${items.length === 1 ? '' : 's'} running low` : 'Everything looks stocked'}
      badge={
        items.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-[#C0392B]">{items.length}</span>
        )
      }
      isEmpty={items.length === 0}
      emptyMessage="No ingredients are predicted to run low right now."
    >
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.canonicalName} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">{item.canonicalName}</span>
            <span className="text-[#C0392B] font-semibold">
              {item.daysUntilDepletion <= 0 ? 'Out now' : `${item.daysUntilDepletion}d left`}
            </span>
          </div>
        ))}
      </div>
    </ExpandablePanel>
  )
}
