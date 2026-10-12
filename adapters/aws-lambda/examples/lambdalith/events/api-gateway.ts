// Sample API Gateway events. REST API (payload v1) and HTTP API (payload v2) are mixed on purpose:
// the same Hono app serves both.

const restEvent = (init: {
  method: string
  path: string
  resource: string
  pathParameters?: Record<string, string>
  headers?: Record<string, string>
  body?: string
}) => {
  const headers = {
    Host: 'abcdef1234.execute-api.ap-northeast-1.amazonaws.com',
    'User-Agent': 'example-client/1.0',
    ...init.headers,
  }
  return {
    resource: init.resource,
    path: init.path,
    httpMethod: init.method,
    headers,
    multiValueHeaders: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, [v]])),
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: init.pathParameters ?? null,
    stageVariables: null,
    requestContext: {
      resourceId: 'abc123',
      resourcePath: init.resource,
      httpMethod: init.method,
      extendedRequestId: 'XyZ=',
      requestTime: '01/May/2024:09:00:00 +0000',
      path: `/Prod${init.path}`,
      accountId: '123456789012',
      protocol: 'HTTP/1.1',
      stage: 'Prod',
      domainPrefix: 'abcdef1234',
      requestTimeEpoch: 1714554000000,
      requestId: 'c6af9ac6-7b61-11e6-9a41-93e8deadbeef',
      identity: {
        sourceIp: '192.0.2.1',
        userAgent: 'example-client/1.0',
      },
      domainName: 'abcdef1234.execute-api.ap-northeast-1.amazonaws.com',
      apiId: 'abcdef1234',
    },
    body: init.body ?? null,
    isBase64Encoded: false,
  }
}

const httpApiEvent = (init: {
  method: string
  path: string
  headers?: Record<string, string>
  body?: string
}) => ({
  version: '2.0',
  routeKey: `${init.method} ${init.path}`,
  rawPath: init.path,
  rawQueryString: '',
  headers: {
    host: 'zyxwvu9876.execute-api.ap-northeast-1.amazonaws.com',
    'user-agent': 'example-client/1.0',
    ...init.headers,
  },
  requestContext: {
    accountId: '123456789012',
    apiId: 'zyxwvu9876',
    domainName: 'zyxwvu9876.execute-api.ap-northeast-1.amazonaws.com',
    domainPrefix: 'zyxwvu9876',
    http: {
      method: init.method,
      path: init.path,
      protocol: 'HTTP/1.1',
      sourceIp: '192.0.2.1',
      userAgent: 'example-client/1.0',
    },
    requestId: 'JKJaXmPLvHcESHA=',
    routeKey: `${init.method} ${init.path}`,
    stage: '$default',
    time: '01/May/2024:09:00:00 +0000',
    timeEpoch: 1714554000000,
  },
  body: init.body,
  isBase64Encoded: false,
})

/** HTTP API (v2): GET /health */
export const healthEvent = httpApiEvent({ method: 'GET', path: '/health' })

/** REST API (v1): GET /users/{id} */
export const getUserEvent = restEvent({
  method: 'GET',
  path: '/users/42',
  resource: '/users/{id}',
  pathParameters: { id: '42' },
})

/** HTTP API (v2): POST /uploads (issue a pre-signed URL) */
export const createUploadEvent = httpApiEvent({
  method: 'POST',
  path: '/uploads',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ filename: 'my photo.png' }),
})

/** REST API (v1): POST /webhooks/stripe */
export const stripeWebhookEvent = restEvent({
  method: 'POST',
  path: '/webhooks/stripe',
  resource: '/webhooks/stripe',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': 't=1714554000,v1=dummy',
  },
  body: JSON.stringify({ type: 'invoice.paid' }),
})
