import ExpandablePanel from './ExpandablePanel'

export default function ExpiryRiskList({ items }) {
  return (
    <ExpandablePanel
      title="Expiry Risk"
      summary={items.length > 0 ? `${items.length} item${items.length === 1 ? '' : 's'} expiring within a week` : 'No expiry data tracked yet'}
      badge={
        items.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-[#B7950B]">{items.length}</span>
        )
      }
      isEmpty={items.length === 0}
      emptyMessage="No batches have an expiry date recorded yet — this fills in automatically once bills include expiry dates or one is set manually."
    >
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.batchId} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">{item.canonicalName}</span>
            <span className={`font-semibold ${item.isExpired ? 'text-[#C0392B]' : 'text-[#B7950B]'}`}>
              {item.isExpired ? 'Expired' : `${item.daysUntilExpiry}d left`}
            </span>
          </div>
        ))}
      </div>
    </ExpandablePanel>
  )
}
