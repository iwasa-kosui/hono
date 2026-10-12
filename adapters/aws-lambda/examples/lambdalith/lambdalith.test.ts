import type { LambdaContext } from '../../src'
import {
  createUploadEvent,
  getUserEvent,
  healthEvent,
  stripeWebhookEvent,
} from './events/api-gateway'
import { reportsS3Event, uploadsS3Event } from './events/s3'
import {
  billingReminderScheduleEvent,
  dailyReportScheduleEvent,
  sessionCleanupScheduleEvent,
} from './events/scheduler'
import { unknownEvent } from './events/unknown'
import { handler } from './index'

const context: LambdaContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'lambdalith',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:lambdalith',
  memoryLimitInMB: '128',
  awsRequestId: 'request-id',
  logGroupName: '/aws/lambda/lambdalith',
  logStreamName: 'stream',
  getRemainingTimeInMillis: () => 1000,
}

describe('Lambdalith example', () => {
  let log: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    log = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    log.mockRestore()
  })

  const logged = () => log.mock.calls.map((args: unknown[]) => args.join(' '))

  describe('S3', () => {
    it('uploads-bucket -> thumbnail (the key is URL-decoded)', async () => {
      await handler(uploadsS3Event, context)
      expect(logged()).toEqual(['[thumbnail] uploads-bucket/users/42/my photo.png'])
    })

    it('reports-bucket -> report notification', async () => {
      await handler(reportsS3Event, context)
      expect(logged()).toEqual(['[report-ready] reports-bucket/daily/2024-05-01.csv'])
    })

    it('rejects an unexpected bucket', async () => {
      const event = structuredClone(uploadsS3Event)
      event.Records[0].s3.bucket.name = 'other-bucket'
      await expect(handler(event, context)).rejects.toThrow('unexpected bucket: other-bucket')
    })
  })

  describe('EventBridge Scheduler', () => {
    it('daily-report', async () => {
      await handler(dailyReportScheduleEvent, context)
      expect(logged()).toEqual(['[daily-report] sales'])
    })

    it('session-cleanup', async () => {
      await handler(sessionCleanupScheduleEvent, context)
      expect(logged()).toEqual(['[session-cleanup] older than 24h'])
    })

    it('billing-reminder', async () => {
      await handler(billingReminderScheduleEvent, context)
      expect(logged()).toEqual(['[billing-reminder] 3 days before due'])
    })

    it('rejects an unknown detail-type', async () => {
      const event = { ...dailyReportScheduleEvent, 'detail-type': 'nope' }
      await expect(handler(event, context)).rejects.toThrow('unexpected detail-type: nope')
    })

    it('rejects an unknown source', async () => {
      const event = { ...dailyReportScheduleEvent, source: 'other.app' }
      await expect(handler(event, context)).rejects.toThrow('unexpected source: other.app')
    })
  })

  describe('API Gateway', () => {
    it('HTTP API (v2): GET /health', async () => {
      const res = (await handler(healthEvent, context)) as { statusCode: number; body: string }
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ ok: true })
    })

    it('REST API (v1): GET /users/:id', async () => {
      const res = (await handler(getUserEvent, context)) as { statusCode: number; body: string }
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ id: '42', name: 'Alice' })
    })

    it('HTTP API (v2): POST /uploads', async () => {
      const res = (await handler(createUploadEvent, context)) as {
        statusCode: number
        body: string
      }
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.key).toBe('users/42/my photo.png')
      expect(body.uploadUrl).toContain('https://uploads-bucket.s3.amazonaws.com/')
    })

    it('REST API (v1): POST /webhooks/stripe', async () => {
      const res = (await handler(stripeWebhookEvent, context)) as {
        statusCode: number
        body: string
      }
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ received: true })
      expect(logged()).toEqual(['[stripe] invoice.paid'])
    })

    it('REST API (v1): POST /webhooks/stripe without a signature is rejected', async () => {
      const event = structuredClone(stripeWebhookEvent)
      delete (event.headers as Record<string, string>)['Stripe-Signature']
      delete (event.multiValueHeaders as Record<string, string[]>)['Stripe-Signature']
      const res = (await handler(event, context)) as { statusCode: number; body: string }
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body)).toEqual({ error: 'missing signature' })
    })
  })

  describe('fallback', () => {
    it('logs an unknown event', async () => {
      await handler(unknownEvent, context)
      expect(logged()).toEqual(['[unknown event] {"hello":"world"}'])
    })
  })
})
