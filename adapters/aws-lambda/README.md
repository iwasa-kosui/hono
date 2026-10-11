# @hono/aws-lambda

AWS Lambda adapter for [Hono](https://hono.dev).

```sh
npm i @hono/aws-lambda
```

## Migrating from `hono/aws-lambda`

The exports are the same. Change the import path:

```diff
- import { handle } from 'hono/aws-lambda'
+ import { handle } from '@hono/aws-lambda'
```

`hono/aws-lambda` is deprecated and will be removed in Hono v5.

## LambdaRouter

`LambdaRouter` dispatches each Lambda event source to its own handler, so a single function can serve HTTP requests, queue messages, and scheduled events.

```ts
import { Hono } from 'hono'
import { LambdaRouter } from '@hono/aws-lambda'

const app = new Hono()
app.get('/', (c) => c.text('Hello from Lambda'))

export const handler = new LambdaRouter({
  // Pass a Hono app (wrapped with `handle(app, httpOptions)`) or a plain function
  http: app,
  sqs: async (event) => {
    const batchItemFailures: { itemIdentifier: string }[] = []
    for (const record of event.Records) {
      try {
        console.log(record.body)
      } catch {
        batchItemFailures.push({ itemIdentifier: record.messageId })
      }
    }
    return { batchItemFailures }
  },
  eventBridge: async (event) => {
    console.log(event['detail-type'], event.detail)
  },
  // Called for unknown events, or sources without a registered handler
  fallback: async (event) => {
    console.warn('Unhandled event', event)
  },
}).handle
```

Handlers are available for `http`, `sqs`, `sns`, `s3`, `dynamodb`, and `eventBridge`. If the event is unsupported, or no handler is registered for its source and no `fallback` is given, `handle` throws. In Lambda this marks the invocation as failed, so the event may be retried.

### How events are detected

Checked in this order; the first match wins.

| Source        | Rule                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sqs`         | `Records[0].eventSource === 'aws:sqs'`                                                                                                            |
| `sns`         | `Records[0].EventSource === 'aws:sns'`                                                                                                            |
| `s3`          | `Records[0].eventSource === 'aws:s3'`                                                                                                             |
| `dynamodb`    | `Records[0].eventSource === 'aws:dynamodb'`                                                                                                       |
| `eventBridge` | Has `detail-type`, `source`, and `detail` (also matches EventBridge Scheduler and CloudWatch scheduled events)                                    |
| `http`        | Has an object `requestContext` and one of: `httpMethod` (API Gateway v1 / ALB), `rawPath` (API Gateway v2 / Function URL), `requestContext.elb` (ALB), `requestContext.serviceArn` (VPC Lattice) |

`LambdaRouter.detect(event)` returns the detected source, or `undefined`. The `isSQSEvent`, `isSNSEvent`, `isS3Event`, `isDynamoDBStreamEvent`, `isEventBridgeEvent`, and `isHttpEvent` type guards are exported as well.

## License

MIT
