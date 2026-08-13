import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationPreferencesService, DEFAULT_NOTIFICATION_PREFERENCES } from '../NotificationPreferencesService.js'

describe('NotificationPreferencesService', () => {
  const householdId = 'hh-pref-test'

  beforeEach(() => {
    localStorage.clear()
  })

  it('returns default preferences when none stored', () => {
    const prefs = NotificationPreferencesService.getPreferences(householdId)
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES)
  })

  it('updates and persists preferences', () => {
    const updated = NotificationPreferencesService.updatePreferences(householdId, {
      maxNotificationsPerDay: 5,
      minSeverity: 'critical',
      quietHours: { enabled: true, startHour: 23, endHour: 6 },
    })

    expect(updated.maxNotificationsPerDay).toBe(5)
    expect(updated.minSeverity).toBe('critical')
    expect(updated.quietHours.startHour).toBe(23)

    const reloaded = NotificationPreferencesService.getPreferences(householdId)
    expect(reloaded.maxNotificationsPerDay).toBe(5)
    expect(reloaded.minSeverity).toBe('critical')
  })

  it('resets preferences to defaults', () => {
    NotificationPreferencesService.updatePreferences(householdId, { maxNotificationsPerDay: 10 })
    NotificationPreferencesService.resetPreferences(householdId)
    const reset = NotificationPreferencesService.getPreferences(householdId)
    expect(reset.maxNotificationsPerDay).toBe(DEFAULT_NOTIFICATION_PREFERENCES.maxNotificationsPerDay)
  })
})
