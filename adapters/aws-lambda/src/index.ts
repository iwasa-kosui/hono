/**
 * @module
 * AWS Lambda Adapter for Hono.
 */

export { handle, streamHandle, defaultIsContentTypeBinary } from './handler'
export { getConnInfo } from './conninfo'
export { LambdaRouter } from './router'
export {
  isSQSEvent,
  isSNSEvent,
  isS3Event,
  isDynamoDBStreamEvent,
  isEventBridgeEvent,
  isHttpEvent,
} from './events'
export type { APIGatewayProxyResult, LambdaEvent } from './handler'
export type { LambdaRouterOptions, LambdaEventHandler, LambdaEventSource } from './router'
export type {
  SQSRecord,
  SQSEvent,
  SQSBatchResponse,
  SNSMessage,
  SNSEventRecord,
  SNSEvent,
  S3EventRecord,
  S3Event,
  DynamoDBRecord,
  DynamoDBStreamEvent,
  DynamoDBBatchResponse,
  EventBridgeEvent,
} from './events'
export type {
  ApiGatewayRequestContext,
  ApiGatewayRequestContextV2,
  ALBRequestContext,
  LambdaContext,
} from './types'
