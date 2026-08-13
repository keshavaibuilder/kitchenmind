import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionPreviewCard from '../copilot/ActionPreviewCard.jsx'
import ConfirmationDialog from '../copilot/ConfirmationDialog.jsx'

export default function InsightCard({ insight, onDismiss, householdId }) {
  const [showEvidence, setShowEvidence] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const navigate = useNavigate()

  if (!insight) return null

  const {
    title,
    summary,
    severity = 'info',
    evidence = [],
    confidence = { score: 0.8, level: 'HIGH' },
    suggested_next_step,
    deduplication_key,
  } = insight

  const severityBadgeStyles = {
    critical: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  }

  const confidenceBadgeStyles = {
    HIGH: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    LOW: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  }

  const handleAskCopilot = () => {
    if (suggested_next_step?.askCopilotPrompt) {
      navigate('/copilot', {
        state: {
          initialPrompt: suggested_next_step.askCopilotPrompt,
          insightContext: {
            title,
            summary,
            evidence,
          },
        },
      })
    } else {
      navigate('/copilot')
    }
  }

  const actionProposal = suggested_next_step?.actionProposal

  return (
    <div className="p-4 rounded-xl border transition-all duration-200 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs relative">
      {/* Header Badges & Dismiss Button */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border capitalize ${severityBadgeStyles[severity] || severityBadgeStyles.info}`}>
            {severity}
          </span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-md border ${confidenceBadgeStyles[confidence.level] || confidenceBadgeStyles.HIGH}`}>
            {confidence.level} Confidence ({Math.round(confidence.score * 100)}%)
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(deduplication_key)}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg"
          title="Dismiss insight"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">{title}</h4>
      <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">{summary}</p>

      {/* Expandable Evidence Panel */}
      {evidence.length > 0 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>{showEvidence ? '▲ Hide Evidence' : '▼ Inspect Evidence'}</span>
            <span className="text-slate-400">({evidence.length} {evidence.length === 1 ? 'item' : 'items'})</span>
          </button>

          {showEvidence && (
            <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5">
              {evidence.map((ev, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>{ev.type}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {ev.source}
                    </span>
                  </div>
                  <div className="text-slate-700 dark:text-slate-200 font-medium">
                    {ev.details} <span className="font-semibold text-emerald-600 dark:text-emerald-400">({ev.value})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Proposal Card if Confirmation Required */}
      {actionProposal && (
        <div className="mb-3">
          <ActionPreviewCard
            actionProposal={actionProposal}
            onConfirm={() => setShowConfirmationModal(true)}
            onCancel={() => {}}
          />
        </div>
      )}

      {/* Footer Controls */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
        <button
          type="button"
          onClick={handleAskCopilot}
          className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1"
        >
          <span>💬 Ask Copilot</span>
        </button>

        {suggested_next_step?.text && !actionProposal && (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Next: {suggested_next_step.text}
          </span>
        )}
      </div>

      {/* Confirmation Dialog for Action Proposal */}
      {showConfirmationModal && actionProposal && (
        <ConfirmationDialog
          actionProposal={actionProposal}
          householdId={householdId}
          onClose={() => setShowConfirmationModal(false)}
          onSuccess={() => {
            setShowConfirmationModal(false)
            onDismiss(deduplication_key)
          }}
        />
      )}
    </div>
  )
}
