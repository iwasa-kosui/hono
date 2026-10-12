import { Hono } from 'hono'
import { LambdaRouter } from '../../src'
import type { EventBridgeEvent, S3Event } from '../../src'
import {
  aggregateDailyReport,
  cleanupStaleSessions,
  generateThumbnail,
  handleStripeEvent,
  notifyReportReady,
  sendBillingReminders,
} from './jobs'

// In a real deployment these come from the environment (see template.yaml).
export const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET ?? 'uploads-bucket'
export const REPORTS_BUCKET = process.env.REPORTS_BUCKET ?? 'reports-bucket'

// ---------------------------------------------------------------------------
// API Gateway (REST API v1 / HTTP API v2): a plain Hono app.
// The same app serves both payload formats; `handle()` detects the format.
// ---------------------------------------------------------------------------
export const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

app.get('/users/:id', (c) => c.json({ id: c.req.param('id'), name: 'Alice' }))

app.post('/uploads', async (c) => {
  const { filename } = await c.req.json<{ filename: string }>()
  const key = `users/42/${filename}`
  // A real implementation would issue a pre-signed PUT URL with the AWS SDK.
  const uploadUrl = `https://${UPLOADS_BUCKET}.s3.amazonaws.com/${key}?X-Amz-Signature=dummy`
  return c.json({ key, uploadUrl }, 201)
})

app.post('/webhooks/stripe', async (c) => {
  if (!c.req.header('stripe-signature')) {
    return c.json({ error: 'missing signature' }, 400)
  }
  const { type } = await c.req.json<{ type: string }>()
  handleStripeEvent(type)
  return c.json({ received: true })
})

// ---------------------------------------------------------------------------
// S3: two buckets, one handler. Branch on the bucket name.
// ---------------------------------------------------------------------------
const handleS3 = (event: S3Event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name
    // Object keys in S3 events are URL-encoded (spaces become "+").
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))
    switch (bucket) {
      case UPLOADS_BUCKET:
        generateThumbnail(bucket, key)
        break
      case REPORTS_BUCKET:
        notifyReportReady(bucket, key)
        break
      default:
        // Throw so that the invocation fails and S3 retries, instead of silently dropping.
        throw new Error(`unexpected bucket: ${bucket}`)
    }
  }
}

// ---------------------------------------------------------------------------
// EventBridge Scheduler: three schedules, one handler.
//
// A Lambda target of EventBridge Scheduler receives the schedule's `Input` as-is.
// Unlike an EventBridge rule, there is no event envelope (no `id`, `time`, ...).
// LambdaRouter treats an object having `source`, `detail-type` and `detail` as an EventBridge
// event, so every schedule's Input is written in exactly that shape (see template.yaml):
//
//   {"source": "myapp.scheduler", "detail-type": "daily-report", "detail": {...}}
//
// and the handler branches on `detail-type`.
// ---------------------------------------------------------------------------
type SchedulerEvent<TDetailType extends string, TDetail> = Pick<
  EventBridgeEvent<TDetailType, TDetail>,
  'source' | 'detail-type' | 'detail'
>

type ScheduledEvent =
  | SchedulerEvent<'daily-report', { target: string }>
  | SchedulerEvent<'session-cleanup', { maxAgeHours: number }>
  | SchedulerEvent<'billing-reminder', { daysBeforeDue: number }>

const SCHEDULER_SOURCE = 'myapp.scheduler'

const handleScheduled = (input: EventBridgeEvent) => {
  // The router only guarantees the three keys, so narrow to the shapes this app schedules.
  const event = input as ScheduledEvent
  if (event.source !== SCHEDULER_SOURCE) {
    throw new Error(`unexpected source: ${event.source}`)
  }
  switch (event['detail-type']) {
    case 'daily-report':
      return aggregateDailyReport(event.detail.target)
    case 'session-cleanup':
      return cleanupStaleSessions(event.detail.maxAgeHours)
    case 'billing-reminder':
      return sendBillingReminders(event.detail.daysBeforeDue)
    default:
      throw new Error(`unexpected detail-type: ${input['detail-type']}`)
  }
}

// ---------------------------------------------------------------------------
// The router: the Lambda entry point.
// ---------------------------------------------------------------------------
export const router = new LambdaRouter({
  http: app,
  s3: handleS3,
  eventBridge: handleScheduled,
  fallback: (event) => {
    console.log('[unknown event]', JSON.stringify(event))
  },
})

export const handler = router.handle
