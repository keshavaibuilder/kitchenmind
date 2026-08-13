import React, { useState } from 'react'
import ConfirmationDialog from './ConfirmationDialog.jsx'

export default function ActionPreviewCard({ messageId, proposal, actionState, onConfirm, onCancel }) {
  const [showModal, setShowModal] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)

  if (!proposal || !proposal.preview) return null

  const { preview, actionName } = proposal
  const currentStatus = actionState?.status || 'pending'

  if (currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'cancelled') {
    return null // ActionStatusCard renders completion state
  }

  const handleConfirmClick = async () => {
    if (preview.irreversible) {
      setShowModal(true)
    } else {
      executeConfirm()
    }
  }

  const executeConfirm = async () => {
    setShowModal(false)
    setIsExecuting(true)
    try {
      await onConfirm(messageId, proposal)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <>
      <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-amber-400 text-lg">⚡</span>
            <span className="font-semibold text-amber-200 text-sm">{actionName || 'Proposed Action'}</span>
          </div>
          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-medium text-amber-300">
            Confirmation Required
          </span>
        </div>

        <p className="text-xs text-slate-300 mb-3">{preview.action}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] mb-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
          <div>
            <span className="text-slate-400 font-medium">Affected Items:</span>
            <div className="text-slate-200 mt-0.5">
              {(preview.affectedItems || []).join(', ') || 'N/A'}
            </div>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Quantities:</span>
            <div className="text-slate-200 mt-0.5">
              {(preview.quantities || []).join(', ') || 'N/A'}
            </div>
          </div>
          <div className="col-span-1 md:col-span-2">
            <span className="text-slate-400 font-medium">Household Impact:</span>
            <div className="text-slate-300 mt-0.5 font-sans leading-relaxed">
              {preview.householdImpact}
            </div>
          </div>
          <div className="col-span-1 md:col-span-2">
            <span className="text-slate-400 font-medium">Expected Result:</span>
            <div className="text-emerald-300/90 mt-0.5 font-sans leading-relaxed">
              {preview.expectedResult}
            </div>
          </div>
        </div>

        {preview.irreversible && (
          <div className="mb-3 flex items-center space-x-1.5 text-[10px] text-rose-300 bg-rose-950/30 px-2.5 py-1 rounded border border-rose-800/40">
            <span>⚠️</span>
            <span>Warning: This action will deduct physical inventory stock.</span>
          </div>
        )}

        <div className="flex items-center space-x-2 pt-1">
          <button
            onClick={handleConfirmClick}
            disabled={isExecuting || currentStatus === 'executing'}
            className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-3 py-1.5 text-xs font-semibold shadow transition-colors flex items-center justify-center space-x-1"
          >
            {isExecuting || currentStatus === 'executing' ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-950 mr-1" />
                <span>Executing...</span>
              </>
            ) : (
              <span>✓ Confirm Action</span>
            )}
          </button>
          <button
            onClick={() => onCancel(messageId)}
            disabled={isExecuting || currentStatus === 'executing'}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-3 py-1.5 text-xs font-medium border border-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {showModal && (
        <ConfirmationDialog
          proposal={proposal}
          onConfirm={executeConfirm}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
