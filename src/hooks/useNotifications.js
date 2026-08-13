import { useState, useEffect, useCallback } from 'react'
import { NotificationService } from '../services/notification/NotificationService.js'
import { NotificationPreferencesService } from '../services/notification/NotificationPreferencesService.js'
import { NotificationScheduler } from '../services/notification/NotificationScheduler.js'

/**
 * React Hook for Notification Management (Sprint 7C)
 * Wraps notification querying, preference management, and scheduler triggers.
 */
export function useNotifications({ householdId, activeInsights = [] } = {}) {
  const [notifications, setNotifications] = useState([])
  const [preferences, setPreferences] = useState(() => NotificationPreferencesService.getPreferences(householdId))

  // Sync notifications from storage
  const refreshNotifications = useCallback(() => {
    if (!householdId) return
    const list = NotificationService.getNotifications(householdId)
    setNotifications(list)
  }, [householdId])

  // Run scheduler whenever active insights change
  useEffect(() => {
    if (!householdId) return
    NotificationScheduler.processInsights(householdId, activeInsights)
    refreshNotifications()
  }, [householdId, activeInsights, refreshNotifications])

  // Preferences updates
  const updatePreferences = useCallback(
    (updates) => {
      const updated = NotificationPreferencesService.updatePreferences(householdId, updates)
      setPreferences(updated)
    },
    [householdId]
  )

  // Notification actions
  const markAsRead = useCallback(
    (notificationId) => {
      NotificationService.markAsRead(householdId, notificationId)
      refreshNotifications()
    },
    [householdId, refreshNotifications]
  )

  const markAllAsRead = useCallback(() => {
    NotificationService.markAllAsRead(householdId)
    refreshNotifications()
  }, [householdId, refreshNotifications])

  const dismissNotification = useCallback(
    (notificationId) => {
      NotificationService.dismissNotification(householdId, notificationId)
      refreshNotifications()
    },
    [householdId, refreshNotifications]
  )

  const clearAll = useCallback(() => {
    NotificationService.clearAllNotifications(householdId)
    refreshNotifications()
  }, [householdId, refreshNotifications])

  const unreadCount = notifications.filter((n) => n.status === 'SENT' || n.status === 'DELIVERED').length

  return {
    notifications,
    unreadCount,
    preferences,
    updatePreferences,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    refreshNotifications,
  }
}
