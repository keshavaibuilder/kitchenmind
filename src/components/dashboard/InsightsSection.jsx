import React, { useState } from 'react'
import InsightCard from './InsightCard.jsx'
import { NotificationCenterButton } from '../notification/NotificationCenterButton.jsx'
import { NotificationCenterModal } from '../notification/NotificationCenterModal.jsx'
import { useNotifications } from '../../hooks/useNotifications.js'

export default function InsightsSection({
  insights = [],
  criticalCount = 0,
  warningCount = 0,
  infoCount = 0,
  onDismiss,
  householdId,
}) {
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    preferences,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
  } = useNotifications({ householdId, activeInsights: insights })

  if (!insights || insights.length === 0) {
    return (
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">💡</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Proactive Kitchen Insights
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenterButton
              unreadCount={unreadCount}
              onClick={() => setIsNotifModalOpen(true)}
            />
            <span className="text-xs text-slate-400 font-medium">All Clear</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No critical alerts or depleting stocks detected. Your kitchen inventory and meal plan are running smoothly!
        </p>

        <NotificationCenterModal
          isOpen={isNotifModalOpen}
          onClose={() => setIsNotifModalOpen(false)}
          notifications={notifications}
          unreadCount={unreadCount}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDismiss={dismissNotification}
          onClearAll={clearAll}
        />
      </div>
    )
  }

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs mb-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">💡</span>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Proactive Kitchen Insights
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deterministic evidence-backed recommendations for your household
            </p>
          </div>
        </div>

        {/* Severity Badges & Notification Trigger */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {criticalCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {warningCount} Warning
              </span>
            )}
            {infoCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {infoCount} Info
              </span>
            )}
          </div>

          <NotificationCenterButton
            unreadCount={unreadCount}
            onClick={() => setIsNotifModalOpen(true)}
          />
        </div>
      </div>

      {/* Insights Grid */}
      <div className="space-y-3.5">
        {insights.map((insight) => (
          <InsightCard
            key={insight.insight_id}
            insight={insight}
            onDismiss={onDismiss}
            householdId={householdId}
          />
        ))}
      </div>

      <NotificationCenterModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDismiss={dismissNotification}
        onClearAll={clearAll}
      />
    </div>
  )
}
