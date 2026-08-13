import React from 'react'
import { WorkflowCard } from './WorkflowCard.jsx'

export function WorkflowSection({ workflows = [], onDismiss, onComplete, householdId }) {
  if (!workflows || workflows.length === 0) return null

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚡</span>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Proactive Household Workflows
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Guided assistance and confirmation-gated next steps for your kitchen
          </p>
        </div>
      </div>

      <div className="space-y-3.5">
        {workflows.map((wf) => (
          <WorkflowCard
            key={wf.workflow_instance_id}
            workflow={wf}
            onDismiss={onDismiss}
            onComplete={onComplete}
            householdId={householdId}
          />
        ))}
      </div>
    </div>
  )
}
