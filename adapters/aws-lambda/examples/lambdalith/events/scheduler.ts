// EventBridge Scheduler passes the schedule's `Input` to Lambda as-is, so these are exactly
// the JSON strings configured in `Target.Input` of template.yaml (no EventBridge envelope).

/** Every day: aggregate the daily report. */
export const dailyReportScheduleEvent = {
  source: 'myapp.scheduler',
  'detail-type': 'daily-report',
  detail: { target: 'sales' },
}

/** Every hour: delete stale sessions. */
export const sessionCleanupScheduleEvent = {
  source: 'myapp.scheduler',
  'detail-type': 'session-cleanup',
  detail: { maxAgeHours: 24 },
}

/** Every week: send billing reminders. */
export const billingReminderScheduleEvent = {
  source: 'myapp.scheduler',
  'detail-type': 'billing-reminder',
  detail: { daysBeforeDue: 3 },
}
