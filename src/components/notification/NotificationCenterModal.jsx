import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionPreviewCard from '../copilot/ActionPreviewCard.jsx'
import ConfirmationDialog from '../copilot/ConfirmationDialog.jsx'
import { ActionExecutionService } from '../../services/ActionExecutionService.js'

export function NotificationCenterModal({
  isOpen,
  onClose,
  notifications = [],
  unreadCount = 0,
  preferences = {},
  onUpdatePreferences,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClearAll,
}) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('notifications') // 'notifications' | 'settings'
  const [expandedEvidenceId, setExpandedEvidenceId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null) // Action proposal for confirmation
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [actionStatus, setActionStatus] = useState(null)

  if (!isOpen) return null

  const handleAskCopilot = (notif) => {
    const prompt = notif.suggested_next_step?.askCopilotPrompt || `Tell me more about: ${notif.title}`
    onClose()
    navigate('/copilot', {
      state: {
        initialPrompt: prompt,
        insightContext: {
          insight_type: notif.insight_type,
          title: notif.title,
          evidence: notif.evidence,
        },
      },
    })
  }

  const handleActionClick = (notif) => {
    if (notif.suggested_next_step?.actionProposal) {
      setPendingAction(notif.suggested_next_step.actionProposal)
    }
  }

  const handleConfirmAction = async () => {
    if (!pendingAction) return
    setIsConfirmOpen(false)
    setActionStatus({ loading: true, message: 'Executing confirmed action...' })
    try {
      const result = await ActionExecutionService.executeAction(pendingAction.capabilityId, pendingAction.payload)
      setActionStatus({ success: true, message: result.message || 'Action executed successfully!' })
      setPendingAction(null)
    } catch (err) {
      setActionStatus({ error: true, message: err.message || 'Action execution failed.' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-900 text-slate-100 w-full max-w-md h-[85vh] rounded-2xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100">Notification Center</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl font-bold p-1"
            aria-label="Close Notification Center"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Notifications ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙ Preferences
          </button>
        </div>

        {/* Action Result Toast */}
        {actionStatus && (
          <div
            className={`p-3 text-xs border-b ${
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

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'notifications' ? (
            <>
              {notifications.length > 0 && (
                <div className="flex items-center justify-between pb-2">
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    ✓ Mark all as read
                  </button>
                  <button onClick={onClearAll} className="text-xs text-slate-400 hover:text-rose-400">
                    Clear all
                  </button>
                </div>
              )}

              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="text-3xl mb-2">🔔</div>
                  <p className="text-sm font-medium">No new notifications</p>
                  <p className="text-xs text-slate-500 mt-1">
                    KitchenMind will notify you when useful household insights arise.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border transition-all ${
                      notif.status === 'READ'
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-80'
                        : 'bg-slate-800/60 border-slate-700 shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full border ${
                            notif.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : notif.severity === 'warning'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          }`}
                        >
                          {notif.severity}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <button
                        onClick={() => onDismiss(notif.id)}
                        className="text-slate-500 hover:text-slate-300 text-xs"
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>

                    <h4 className="font-semibold text-sm text-slate-100 mt-2">{notif.title}</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{notif.summary}</p>

                    {/* Evidence Toggle */}
                    {notif.evidence && notif.evidence.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() =>
                            setExpandedEvidenceId(expandedEvidenceId === notif.id ? null : notif.id)
                          }
                          className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                        >
                          {expandedEvidenceId === notif.id ? 'Hide Evidence' : 'Inspect Evidence'}
                        </button>
                        {expandedEvidenceId === notif.id && (
                          <div className="mt-2 p-2 bg-slate-950/80 rounded-lg text-[11px] space-y-1 border border-slate-800">
                            {notif.evidence.map((ev, idx) => (
                              <div key={idx} className="text-slate-300">
                                <span className="font-mono text-emerald-400">[{ev.type}]</span> {ev.details}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => handleAskCopilot(notif)}
                        className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg border border-slate-700 transition-colors"
                      >
                        💬 Ask Copilot
                      </button>

                      {notif.suggested_next_step?.actionProposal && (
                        <button
                          onClick={() => handleActionClick(notif)}
                          className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium"
                        >
                          Take Action
                        </button>
                      )}

                      {notif.status !== 'READ' && (
                        <button
                          onClick={() => onMarkAsRead(notif.id)}
                          className="ml-auto text-xs text-slate-400 hover:text-slate-200"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            /* Settings Tab */
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200">Notifications Enabled</div>
                  <div className="text-slate-400 text-[11px]">Receive proactive alerts and digests</div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notificationsEnabled}
                  onChange={(e) => onUpdatePreferences({ notificationsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200">Quiet Hours</div>
                  <input
                    type="checkbox"
                    checked={preferences.quietHours?.enabled}
                    onChange={(e) =>
                      onUpdatePreferences({
                        quietHours: { ...preferences.quietHours, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-emerald-500"
                  />
                </div>
                <p className="text-slate-400 text-[11px]">
                  Defer non-critical notifications between 10:00 PM and 07:00 AM
                </p>
              </div>

              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
                <div className="font-semibold text-slate-200">Daily Maximum Limit</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={preferences.maxNotificationsPerDay || 3}
                    onChange={(e) =>
                      onUpdatePreferences({ maxNotificationsPerDay: parseInt(e.target.value, 10) || 3 })
                    }
                    className="w-16 p-1.5 bg-slate-900 border border-slate-700 rounded text-center font-bold text-slate-100"
                  />
                  <span className="text-slate-400">notifications per day</span>
                </div>
              </div>

              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
                <div className="font-semibold text-slate-200">Minimum Severity Filter</div>
                <select
                  value={preferences.minSeverity || 'warning'}
                  onChange={(e) => onUpdatePreferences({ minSeverity: e.target.value })}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-200"
                >
                  <option value="critical">Critical Only</option>
                  <option value="warning">Warning & Critical</option>
                  <option value="info">All (Info, Warning, Critical)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Action Preview Modal Overlay if pending */}
        {pendingAction && (
          <div className="p-4 bg-slate-950 border-t border-slate-800">
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
    </div>
  )
}
