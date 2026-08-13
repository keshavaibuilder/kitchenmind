# KitchenMind: Notification & Intelligent Scheduling Architecture Specification

**Document Version:** 1.0.0  
**Domain:** Notification Layer, Intelligent Scheduling, Preference Filtering, Idempotency  
**Sprint:** Sprint 7C — Notifications & Intelligent Scheduling  
**Status:** **PRODUCTION READY**  

---

## 1. Architectural Overview & Core Invariants

The KitchenMind Notification Layer delivers validated proactive insights to users via controlled in-app notifications and scheduled digests without creating a second intelligence engine.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION ARCHITECTURE PIPELINE                       │
├─────────────────┬──────────────────┬─────────────────┬──────────────────────┤
│ 1. Household    │ 2. Deterministic │ 3. Policy &     │ 4. Scheduler &       │
│    Data State   │    Insight Engine│    Preference   │    In-App Center     │
│    (Read-only)  │    (Authoritative)│   Evaluation   │    (Confirmation)    │
└─────────────────┴──────────────────┴─────────────────┴──────────────────────┘
```

### Core Invariants
1. **Single Source of Intelligence:** Notifications **NEVER** independently compute predictions, recommendations, or household facts. They consume existing, validated `InsightEngine` output exclusively.
2. **100% Confirmation Gating:** Notification action proposals require explicit out-of-band user confirmation via `ActionExecutionService.js`. Zero autonomous mutations.
3. **Conservative Preference Defaults:** Quiet hours (10:00 PM – 07:00 AM) and daily maximum limits (3 notifications/day) are enabled by default.
4. **Strict Idempotency:** Notifications use deterministic idempotency keys (`NOTIF:[deduplication_key]:[date]`) to eliminate duplicate deliveries.

---

## 2. Notification Policy & Priority Matrix

`NotificationPolicyService.js` evaluates every validated insight object against household preferences before delivery:

| Insight Severity | Confidence Level | Quiet Hours Active? | Daily Limit Reached? | Resulting Delivery Mode |
| :--- | :--- | :--- | :--- | :--- |
| **Critical** | High (>= 0.80) | No | No | `IMMEDIATE` |
| **Critical** | High (>= 0.80) | Yes (Bypass off) | No | `SCHEDULED` (Deferred) |
| **Warning** | High/Med (>= 0.65) | No | No | `SCHEDULED` |
| **Any** | Any | Any | Yes | `DIGEST` or `SUPPRESSED` |
| **Info** | Low/Med (< 0.65) | Any | Any | `SUPPRESSED` (Dashboard only) |

---

## 3. Component Architecture

- **`NotificationPreferencesService.js`**: Household notification settings (`notificationsEnabled`, `quietHours`, `maxNotificationsPerDay`, `minSeverity`, `categoriesEnabled`).
- **`NotificationPolicyService.js`**: Policy evaluation matrix enforcing quiet hours, daily volume limits, and freshness checks.
- **`NotificationService.js`**: Notification object creation, idempotency key verification, unread counts, and localStorage state persistence.
- **`NotificationScheduler.js`**: Intelligent batch processor executing pre-delivery re-validation (checks expiration and resolution status before delivery).
- **`useNotifications.js`**: React hook providing reactive notification state and preference management.
- **`NotificationCenterModal.jsx` & `NotificationCenterButton.jsx`**: Responsive in-app notification center UI with evidence inspection, Copilot handoff, and action confirmation.
