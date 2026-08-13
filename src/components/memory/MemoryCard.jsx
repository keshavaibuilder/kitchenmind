import React from 'react'

export default function MemoryCard({ memory, onToggleStatus, onEdit, onDelete }) {
  const { id, memory_type, memory_key, memory_value, source, status, created_at } = memory
  const isActive = status === 'active'

  const typeColors = {
    preference: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    restriction: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    habit: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    instruction: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    context: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  }

  const createdDate = new Date(created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-200 ${
        isActive
          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded-md border capitalize ${
                typeColors[memory_type] || typeColors.preference
              }`}
            >
              {memory_type}
            </span>

            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              {memory_key}
            </span>

            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {source === 'user_explicit' ? 'Explicit Instruction' : 'UI Setting'}
            </span>
          </div>

          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 break-words">
            "{memory_value}"
          </p>

          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Remembered on {createdDate}
          </div>
        </div>

        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => onToggleStatus(id, isActive ? 'disabled' : 'active')}
            className={`px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
            title={isActive ? 'Disable memory' : 'Enable memory'}
          >
            {isActive ? 'Active' : 'Disabled'}
          </button>

          <button
            type="button"
            onClick={() => onEdit(memory)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Edit memory"
          >
            ✏️
          </button>

          <button
            type="button"
            onClick={() => onDelete(id)}
            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            title="Delete memory"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}
