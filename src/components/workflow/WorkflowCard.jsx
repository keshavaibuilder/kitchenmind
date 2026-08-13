import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionPreviewCard from '../copilot/ActionPreviewCard.jsx'
import ConfirmationDialog from '../copilot/ConfirmationDialog.jsx'
import { ActionExecutionService } from '../../services/ActionExecutionService.js'

export function WorkflowCard({ workflow, onDismiss, onComplete, householdId }) {
  const navigate = useNavigate()
  const [showEvidence, setShowEvidence] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [actionStatus, setActionStatus] = useState(null)

  if (!workflow) return null

  const handleAskCopilot = () => {
    const prompt =
      workflow.suggested_next_step?.askCopilotPrompt || `Help me execute workflow: ${workflow.title}`
    navigate('/copilot', {
      state: {
        initialPrompt: prompt,
        insightContext: workflow.originating_insight,
      },
    })
  }

  const handleActionClick = () => {
    if (workflow.suggested_next_step?.actionProposal) {
      setPendingAction(workflow.suggested_next_step.actionProposal)
    }
  }

  const handleConfirmAction = async () => {
    if (!pendingAction) return
    setIsConfirmOpen(false)
    setActionStatus({ loading: true, message: 'Executing confirmed action...' })
    try {
      const result = await ActionExecutionService.executeAction(
        pendingAction.capabilityId,
        pendingAction.payload
      )
      setActionStatus({ success: true, message: result.message || 'Action completed successfully!' })
      if (onComplete) onComplete(workflow.workflow_instance_id)
      setPendingAction(null)
    } catch (err) {
      setActionStatus({ error: true, message: err.message || 'Action execution failed.' })
    }
  }

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 shadow-md transition-all hover:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
            Workflow • {workflow.name}
          </span>
        </div>
        <button
          onClick={() => onDismiss && onDismiss(workflow.workflow_instance_id)}
          className="text-slate-500 hover:text-slate-300 text-xs"
          title="Dismiss Workflow"
        >
          ✕
        </button>
      </div>

      <h4 className="font-semibold text-sm text-slate-100 mt-2">{workflow.title}</h4>
      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{workflow.summary}</p>

      {/* Action Status Toast */}
      {actionStatus && (
        <div
          className={`mt-2 p-2.5 rounded-lg text-xs border ${
            actionStatus.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : actionStatus.error
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          }`}
        >
          {actionStatus.message}
        </div>
      )}

      {/* Evidence Inspection */}
      {workflow.originating_insight?.evidence?.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline"
          >
            {showEvidence ? 'Hide Evidence' : 'Inspect Evidence'}
          </button>
          {showEvidence && (
            <div className="mt-2 p-2 bg-slate-950/80 rounded-lg text-[11px] space-y-1 border border-slate-800">
              {workflow.originating_insight.evidence.map((ev, idx) => (
                <div key={idx} className="text-slate-300">
                  <span className="font-mono text-emerald-400">[{ev.type}]</span> {ev.details}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Next Step Controls */}
      <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800">
        <button
          onClick={handleAskCopilot}
          className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg border border-slate-700 transition-colors"
        >
          💬 Ask Copilot
        </button>

        {workflow.suggested_next_step?.actionProposal && (
          <button
            onClick={handleActionClick}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
          >
            Take Action
          </button>
        )}
      </div>

      {/* Action Preview Card & Confirmation Modal */}
      {pendingAction && (
        <div className="mt-3">
          <ActionPreviewCard
            preview={pendingAction.preview}
            onConfirm={() => setIsConfirmOpen(true)}
            onCancel={() => setPendingAction(null)}
          />
        </div>
      )}

      <ConfirmationDialog
        isOpen={isConfirmOpen}
        preview={pendingAction?.preview}
        onConfirm={handleConfirmAction}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  )
}
