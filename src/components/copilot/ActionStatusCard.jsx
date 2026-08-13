import React from 'react'

export default function ActionStatusCard({ actionState, proposal }) {
  if (!actionState) return null

  const { status, error, alreadyExecuted } = actionState
  const actionName = proposal?.actionName || proposal?.preview?.action || 'AI Action'

  if (status === 'completed') {
    return (
      <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3.5 shadow-md">
        <div className="flex items-center space-x-2">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-xs font-semibold text-emerald-200">
            {alreadyExecuted ? 'Action Already Completed' : `${actionName} Executed Successfully`}
          </span>
        </div>
        <p className="text-[11px] text-emerald-300/90 mt-1 pl-5">
          {proposal?.preview?.expectedResult || 'Database state updated.'}
        </p>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/20 p-3.5 shadow-md">
        <div className="flex items-center space-x-2">
          <span className="text-rose-400 font-bold">❌</span>
          <span className="text-xs font-semibold text-rose-200">Action Execution Failed</span>
        </div>
        <p className="text-[11px] text-rose-300 mt-1 pl-5 font-mono">{error || 'Unknown execution error'}</p>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-400">
          <span>🚫</span>
          <span className="text-xs font-medium">Action Cancelled by User</span>
        </div>
      </div>
    )
  }

  return null
}
