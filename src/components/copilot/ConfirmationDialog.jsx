import React from 'react'

export default function ConfirmationDialog({ proposal, onConfirm, onClose }) {
  if (!proposal || !proposal.preview) return null
  const { preview, actionName } = proposal

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center space-x-3 text-amber-400 mb-3">
          <span className="text-2xl">🛡️</span>
          <h3 className="text-lg font-bold text-slate-100">{actionName || 'Confirm AI Action'}</h3>
        </div>

        <p className="text-xs text-slate-300 mb-4">{preview.action}</p>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-2 mb-4">
          <div>
            <span className="text-slate-400">Impact:</span>
            <p className="text-slate-200 font-medium">{preview.householdImpact}</p>
          </div>
          <div>
            <span className="text-slate-400">Expected Result:</span>
            <p className="text-emerald-300 font-medium">{preview.expectedResult}</p>
          </div>
        </div>

        <p className="text-[11px] text-rose-300 mb-6 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
          ⚠️ This action will modify your household database (inventory stock or meal records).
        </p>

        <div className="flex items-center space-x-3 justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-lg transition-colors"
          >
            Confirm & Execute
          </button>
        </div>
      </div>
    </div>
  )
}
