import { Hono } from 'hono'
import type { SQSBatchResponse, SQSEvent } from './events'
import { isHttpEvent } from './events'
import { LambdaRouter } from './router'
import type { LambdaContext } from './types'

const context: LambdaContext = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'fn',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:fn',
  memoryLimitInMB: '128',
  awsRequestId: 'request-id',
  logGroupName: '/aws/lambda/fn',
  logStreamName: 'stream',
  getRemainingTimeInMillis: () => 1000,
}

const v1Event = {
  version: '1.0',
  resource: '/hello',
  path: '/hello',
  httpMethod: 'GET',
  headers: {},
  multiValueHeaders: {},
  queryStringParameters: {},
  requestContext: {
    accountId: '123456789012',
    apiId: 'id',
    httpMethod: 'GET',
    identity: { sourceIp: '192.0.2.1', userAgent: 'user-agent' },
    path: '/hello',
    protocol: 'HTTP/1.1',
    requestId: 'id=',
    stage: 'prod',
  },
  body: null,
  isBase64Encoded: false,
}

const v2Event = {
  version: '2.0',
  routeKey: '$default',
  rawPath: '/hello',
  rawQueryString: '',
  cookies: [],
  headers: {},
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    authentication: null,
    authorizer: {},
    domainName: 'id.execute-api.us-east-1.amazonaws.com',
    domainPrefix: 'id',
    http: {
      method: 'GET',
      path: '/hello',
      protocol: 'HTTP/1.1',
      sourceIp: '192.0.2.1',
      userAgent: 'agent',
    },
    requestId: 'id',
    routeKey: '$default',
    stage: '$default',
    time: '12/Mar/2020:19:03:58 +0000',
    timeEpoch: 1583348638390,
  },
  body: null,
  isBase64Encoded: false,
}

const albEvent = {
  httpMethod: 'GET',
  path: '/hello',
  headers: {},
  body: null,
  isBase64Encoded: false,
  requestContext: {
    elb: { targetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/tg/1' },
  },
}

const latticeEvent = {
  version: '2.0',
  path: '/hello',
  method: 'GET',
  headers: {},
  queryStringParameters: {},
  body: null,
  isBase64Encoded: false,
  requestContext: {
    serviceNetworkArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:servicenetwork/sn-1',
    serviceArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:service/svc-1',
    targetGroupArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:targetgroup/tg-1',
    region: 'us-east-1',
    timeEpoch: '1583348638390',
    identity: {},
  },
}

const sqsEvent: SQSEvent = {
  Records: [
    {
      messageId: 'm-1',
      receiptHandle: 'handle',
      body: 'hello',
      attributes: {},
      messageAttributes: {},
      md5OfBody: 'md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:queue',
      awsRegion: 'us-east-1',
    },
  ],
}

const snsEvent = {
  Records: [
    {
      EventVersion: '1.0',
      EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:topic:sub',
      EventSource: 'aws:sns',
      Sns: { MessageId: 'm-1', Message: 'hello', TopicArn: 'arn:aws:sns:us-east-1:1:topic' },
    },
  ],
}

const s3Event = {
  Records: [
    {
      eventVersion: '2.1',
      eventSource: 'aws:s3',
      awsRegion: 'us-east-1',
      eventTime: '2024-01-01T00:00:00.000Z',
      eventName: 'ObjectCreated:Put',
      s3: {
        bucket: { name: 'bucket', arn: 'arn:aws:s3:::bucket' },
        object: { key: 'file.txt', size: 1, sequencer: '0A' },
      },
    },
  ],
}

const dynamoDBEvent = {
  Records: [
    {
      eventID: 'e-1',
      eventName: 'INSERT',
      eventSource: 'aws:dynamodb',
      eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789012:table/t/stream/1',
      dynamodb: { Keys: { id: { S: '1' } }, NewImage: { id: { S: '1' } } },
    },
  ],
}

const eventBridgeEvent = {
  id: 'id',
  version: '0',
  account: '123456789012',
  time: '2024-01-01T00:00:00Z',
  region: 'us-east-1',
  resources: [],
  source: 'aws.events',
  'detail-type': 'Scheduled Event',
  detail: {},
}

describe('LambdaRouter.detect', () => {
  it.each([
    ['API Gateway v1', v1Event, 'http'],
    ['API Gateway v2', v2Event, 'http'],
    ['ALB', albEvent, 'http'],
    ['VPC Lattice', latticeEvent, 'http'],
    ['SQS', sqsEvent, 'sqs'],
    ['SNS', snsEvent, 'sns'],
    ['S3', s3Event, 's3'],
    ['DynamoDB Streams', dynamoDBEvent, 'dynamodb'],
    ['EventBridge', eventBridgeEvent, 'eventBridge'],
    ['unknown object', {}, undefined],
    ['empty Records', { Records: [] }, undefined],
    ['null', null, undefined],
    ['string', 'foo', undefined],
  ])('Should detect %s', (_name, event, expected) => {
    expect(LambdaRouter.detect(event)).toBe(expected)
  })

  it('Should not treat an event without requestContext as HTTP', () => {
    expect(isHttpEvent({ httpMethod: 'GET' })).toBe(false)
    expect(isHttpEvent(undefined)).toBe(false)
  })
})

describe('LambdaRouter', () => {
  it('Should route an HTTP event to a Hono app', async () => {
    const app = new Hono()
    app.get('/hello', (c) => c.text('hi'))
    const router = new LambdaRouter({ http: app })

    const result = (await router.handle(v2Event, context)) as { statusCode: number; body: string }

    expect(result.statusCode).toBe(200)
    expect(result.body).toBe('hi')
  })

  it('Should route an HTTP event to a plain function', async () => {
    const http = vi.fn(async () => ({
      statusCode: 204,
      body: '',
      headers: {},
      isBase64Encoded: false,
    }))
    const router = new LambdaRouter({ http })

    const result = await router.handle(albEvent, context)

    expect(http).toHaveBeenCalledWith(albEvent, context)
    expect(result).toMatchObject({ statusCode: 204 })
  })

  it('Should pass httpOptions to handle()', async () => {
    const app = new Hono()
    app.get('/hello', (c) => c.body('hi', 200, { 'content-type': 'text/plain' }))
    const router = new LambdaRouter({
      http: app,
      httpOptions: { isContentTypeBinary: () => true },
    })

    const result = (await router.handle(v2Event, context)) as {
      body: string
      isBase64Encoded: boolean
    }

    expect(result.isBase64Encoded).toBe(true)
    expect(result.body).toBe(btoa('hi'))
  })

  it('Should pass the event and context to the SQS handler and return its result', async () => {
    const response: SQSBatchResponse = { batchItemFailures: [{ itemIdentifier: 'm-1' }] }
    const sqs = vi.fn(async () => response)
    const router = new LambdaRouter({ sqs })

    const result = await router.handle(sqsEvent, context)

    expect(sqs).toHaveBeenCalledTimes(1)
    expect(sqs).toHaveBeenCalledWith(sqsEvent, context)
    expect(result).toBe(response)
  })

  it('Should route each source to its own handler', async () => {
    const handlers = {
      sns: vi.fn(),
      s3: vi.fn(),
      dynamodb: vi.fn(),
      eventBridge: vi.fn(() => 'scheduled'),
    }
    const router = new LambdaRouter(handlers)

    await router.handle(snsEvent, context)
    await router.handle(s3Event, context)
    await router.handle(dynamoDBEvent, context)
    const result = await router.handle(eventBridgeEvent, context)

    expect(handlers.sns).toHaveBeenCalledWith(snsEvent, context)
    expect(handlers.s3).toHaveBeenCalledWith(s3Event, context)
    expect(handlers.dynamodb).toHaveBeenCalledWith(dynamoDBEvent, context)
    expect(handlers.eventBridge).toHaveBeenCalledWith(eventBridgeEvent, context)
    expect(result).toBe('scheduled')
  })

  it('Should call fallback when no handler is registered for the source', async () => {
    const fallback = vi.fn(() => 'fallback')
    const router = new LambdaRouter({ http: new Hono(), fallback })

    const result = await router.handle(sqsEvent, context)

    expect(fallback).toHaveBeenCalledWith(sqsEvent, context)
    expect(result).toBe('fallback')
  })

  it('Should call fallback for an unknown event', async () => {
    const fallback = vi.fn(() => 'fallback')
    const router = new LambdaRouter({ fallback })

    const result = await router.handle({}, context)

    expect(fallback).toHaveBeenCalledWith({}, context)
    expect(result).toBe('fallback')
  })

  it('Should reject when no handler or fallback is registered for the source', async () => {
    const router = new LambdaRouter({ http: new Hono() })

    await expect(router.handle(sqsEvent, context)).rejects.toThrow(
      'LambdaRouter: no handler registered for "sqs" event'
    )
  })

  it('Should reject with the detected source when only a different handler is registered', async () => {
    const router = new LambdaRouter({ sqs: vi.fn() })

    await expect(router.handle(v2Event, context)).rejects.toThrow(
      'LambdaRouter: no handler registered for "http" event'
    )
  })

  it('Should reject for an unknown event without fallback', async () => {
    const router = new LambdaRouter({ http: new Hono() })

    await expect(router.handle({}, context)).rejects.toThrow('LambdaRouter: unsupported event')
    await expect(router.handle(null, context)).rejects.toThrow('LambdaRouter: unsupported event')
  })

  it('Should work when `handle` is detached from the instance', async () => {
    const sqs = vi.fn()
    const { handle } = new LambdaRouter({ sqs })

    await handle(sqsEvent, context)

    expect(sqs).toHaveBeenCalledTimes(1)
  })

  it('Should expose the registered sources as its name', () => {
    expect(new LambdaRouter({}).name).toBe('LambdaRouter')
    expect(new LambdaRouter({ http: new Hono(), sqs: vi.fn() }).name).toBe(
      'LambdaRouter(http, sqs)'
    )
    expect(new LambdaRouter({ eventBridge: vi.fn(), s3: vi.fn(), fallback: vi.fn() }).name).toBe(
      'LambdaRouter(s3, eventBridge)'
    )
  })
})
