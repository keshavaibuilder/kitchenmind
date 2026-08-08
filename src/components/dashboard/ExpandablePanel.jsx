import { useState } from 'react'

/**
 * Shared expandable insight panel used across the Kitchen Intelligence Dashboard's list-shaped
 * modules (Low Stock, Expiry Risk, Shopping Intelligence, Observation Timeline).
 */
export default function ExpandablePanel({ title, summary, badge, defaultOpen = false, isEmpty = false, emptyMessage, children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full p-4 flex items-center justify-between gap-3 text-left active:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1E3A5F]">{title}</p>
          {summary && <p className="text-xs text-gray-400 mt-0.5 truncate">{summary}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge}
          <span className="text-gray-300">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          {isEmpty ? <p className="text-sm text-gray-400">{emptyMessage}</p> : children}
        </div>
      )}
    </div>
  )
}
