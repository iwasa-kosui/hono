/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Hono } from 'hono'
import type {
  DynamoDBBatchResponse,
  DynamoDBStreamEvent,
  EventBridgeEvent,
  S3Event,
  SNSEvent,
  SQSBatchResponse,
  SQSEvent,
} from './events'
import {
  isDynamoDBStreamEvent,
  isEventBridgeEvent,
  isHttpEvent,
  isS3Event,
  isSNSEvent,
  isSQSEvent,
} from './events'
import type { APIGatewayProxyResult, HandleOptions, LambdaEvent } from './handler'
import { handle } from './handler'
import type { LambdaContext } from './types'

export type LambdaEventHandler<TEvent, TResult = unknown> = (
  event: TEvent,
  context: LambdaContext
) => TResult | Promise<TResult>

export type LambdaEventSource = 'http' | 'sqs' | 'sns' | 's3' | 'dynamodb' | 'eventBridge'

export interface LambdaRouterOptions {
  /**
   * Handler for HTTP events (API Gateway v1/v2, Function URL, ALB, VPC Lattice).
   * When a Hono app is passed, it is wrapped with `handle(app, httpOptions)`.
   */
  http?: Hono<any, any, any> | LambdaEventHandler<LambdaEvent, APIGatewayProxyResult>
  /**
   * Options passed to `handle()` as the second argument when `http` is a Hono app.
   */
  httpOptions?: HandleOptions
  sqs?: LambdaEventHandler<SQSEvent, SQSBatchResponse | void>
  sns?: LambdaEventHandler<SNSEvent, void>
  s3?: LambdaEventHandler<S3Event, void>
  dynamodb?: LambdaEventHandler<DynamoDBStreamEvent, DynamoDBBatchResponse | void>
  /**
   * Handler for EventBridge events, including EventBridge Scheduler and CloudWatch scheduled events.
   */
  eventBridge?: LambdaEventHandler<EventBridgeEvent, unknown>
  /**
   * Called when the event does not match any known source,
   * or when no handler is registered for the detected source.
   */
  fallback?: LambdaEventHandler<unknown, unknown>
}

const SOURCES: LambdaEventSource[] = ['http', 'sqs', 'sns', 's3', 'dynamodb', 'eventBridge']

type Route = [LambdaEventSource, (event: unknown) => boolean, LambdaEventHandler<any, unknown>]

// Checked in this order. HTTP is last because it is the most generic check.
const DETECTORS: [LambdaEventSource, (event: unknown) => boolean][] = [
  ['sqs', isSQSEvent],
  ['sns', isSNSEvent],
  ['s3', isS3Event],
  ['dynamodb', isDynamoDBStreamEvent],
  ['eventBridge', isEventBridgeEvent],
  ['http', isHttpEvent],
]

// Duck-typed instead of `instanceof Hono` so that duplicated hono instances still work.
const isHonoApp = (value: unknown): value is Hono<any, any, any> =>
  typeof (value as { fetch?: unknown }).fetch === 'function'

/**
 * A Lambda entry point that dispatches each event source to its own handler.
 *
 * If the event is unsupported, or no handler (and no `fallback`) is registered for the detected
 * source, `handle` rejects. In Lambda a thrown error marks the invocation as failed,
 * so asynchronous sources such as SQS or SNS are retried.
 *
 * Sources are checked in the order sqs, sns, s3, dynamodb, eventBridge, http,
 * and the first matching handler is called. HTTP is evaluated last because its check is the most generic.
 * Only the registered sources are checked.
 *
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { LambdaRouter } from '@hono/aws-lambda'
 *
 * const app = new Hono()
 * app.get('/', (c) => c.text('Hello from Lambda'))
 *
 * export const handler = new LambdaRouter({
 *   http: app,
 *   sqs: async (event) => {
 *     for (const record of event.Records) {
 *       console.log(record.body)
 *     }
 *   },
 * }).handle
 * ```
 */
export class LambdaRouter {
  #handlers: Partial<Record<LambdaEventSource, LambdaEventHandler<any, unknown>>>
  #routes: Route[]
  #fallback: LambdaEventHandler<unknown, unknown> | undefined

  constructor(init: LambdaRouterOptions) {
    const { http } = init
    this.#handlers = {
      http: http ? (isHonoApp(http) ? handle(http, init.httpOptions) : http) : undefined,
      sqs: init.sqs,
      sns: init.sns,
      s3: init.s3,
      dynamodb: init.dynamodb,
      eventBridge: init.eventBridge,
    }
    this.#routes = DETECTORS.flatMap(([source, is]): Route[] => {
      const handler = this.#handlers[source]
      return handler ? [[source, is, handler]] : []
    })
    this.#fallback = init.fallback
  }

  get name(): string {
    const registered = SOURCES.filter((source) => this.#handlers[source])
    return registered.length ? `LambdaRouter(${registered.join(', ')})` : 'LambdaRouter'
  }

  /**
   * Detects the event source of a Lambda event.
   * Returns `undefined` when the event is not a supported source.
   */
  static detect(event: unknown): LambdaEventSource | undefined {
    return DETECTORS.find(([, is]) => is(event))?.[0]
  }

  handle = async (event: unknown, context: LambdaContext): Promise<unknown> => {
    for (const [, is, handler] of this.#routes) {
      if (is(event)) {
        return handler(event, context)
      }
    }
    if (this.#fallback) {
      return this.#fallback(event, context)
    }

    // Detect all sources only on the error path to report a precise message.
    const source = LambdaRouter.detect(event)
    if (!source) {
      throw new Error('LambdaRouter: unsupported event')
    }
    throw new Error(`LambdaRouter: no handler registered for "${source}" event`)
  }
}
