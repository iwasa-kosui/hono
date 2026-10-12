// Dummy business logic. A real application would call S3, a database, Stripe, and so on.
// Every job only logs, so the tests can verify which job a given event was routed to.

export const generateThumbnail = (bucket: string, key: string) =>
  console.log(`[thumbnail] ${bucket}/${key}`)

export const notifyReportReady = (bucket: string, key: string) =>
  console.log(`[report-ready] ${bucket}/${key}`)

export const aggregateDailyReport = (target: string) => console.log(`[daily-report] ${target}`)

export const cleanupStaleSessions = (maxAgeHours: number) =>
  console.log(`[session-cleanup] older than ${maxAgeHours}h`)

export const sendBillingReminders = (daysBeforeDue: number) =>
  console.log(`[billing-reminder] ${daysBeforeDue} days before due`)

export const handleStripeEvent = (type: string) => console.log(`[stripe] ${type}`)
