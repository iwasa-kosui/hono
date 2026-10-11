import type { LambdaEvent } from './handler'

export interface SQSRecord {
  messageId: string
  receiptHandle: string
  body: string
  attributes: Record<string, string | undefined>
  messageAttributes: Record<string, unknown>
  md5OfBody: string
  eventSource: 'aws:sqs'
  eventSourceARN: string
  awsRegion: string
}

export interface SQSEvent {
  Records: SQSRecord[]
}

export interface SQSBatchResponse {
  batchItemFailures: { itemIdentifier: string }[]
}

export interface SNSMessage {
  SignatureVersion: string
  Timestamp: string
  Signature: string
  SigningCertUrl: string
  MessageId: string
  Message: string
  MessageAttributes: Record<string, { Type: string; Value: string }>
  Type: string
  UnsubscribeUrl: string
  TopicArn: string
  Subject: string | null
}

export interface SNSEventRecord {
  EventVersion: string
  EventSubscriptionArn: string
  EventSource: 'aws:sns'
  Sns: SNSMessage
}

export interface SNSEvent {
  Records: SNSEventRecord[]
}

export interface S3EventRecord {
  eventVersion: string
  eventSource: 'aws:s3'
  awsRegion: string
  eventTime: string
  eventName: string
  userIdentity: { principalId: string }
  requestParameters: { sourceIPAddress: string }
  responseElements: Record<string, string>
  s3: {
    s3SchemaVersion: string
    configurationId: string
    bucket: {
      name: string
      ownerIdentity: { principalId: string }
      arn: string
    }
    object: {
      key: string
      size?: number
      eTag?: string
      versionId?: string
      sequencer: string
    }
  }
}

export interface S3Event {
  Records: S3EventRecord[]
}

export interface DynamoDBRecord {
  eventID: string
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE'
  eventVersion?: string
  eventSource: 'aws:dynamodb'
  eventSourceARN: string
  awsRegion?: string
  dynamodb: {
    ApproximateCreationDateTime?: number
    Keys?: Record<string, unknown>
    NewImage?: Record<string, unknown>
    OldImage?: Record<string, unknown>
    SequenceNumber?: string
    SizeBytes?: number
    StreamViewType?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'
  }
}

export interface DynamoDBStreamEvent {
  Records: DynamoDBRecord[]
}

export interface DynamoDBBatchResponse {
  batchItemFailures: { itemIdentifier: string }[]
}

/**
 * Event delivered by Amazon EventBridge.
 * EventBridge Scheduler and CloudWatch scheduled events share this shape,
 * so they are represented by this type as well.
 */
export interface EventBridgeEvent<TDetailType extends string = string, TDetail = unknown> {
  id: string
  version: string
  account: string
  time: string
  region: string
  resources: string[]
  source: string
  'detail-type': TDetailType
  detail: TDetail
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const hasRecordsOf = (event: unknown, key: 'eventSource' | 'EventSource', source: string) => {
  if (!isObject(event) || !Array.isArray(event.Records) || event.Records.length === 0) {
    return false
  }
  const first: unknown = event.Records[0]
  return isObject(first) && first[key] === source
}

export const isSQSEvent = (event: unknown): event is SQSEvent =>
  hasRecordsOf(event, 'eventSource', 'aws:sqs')

export const isSNSEvent = (event: unknown): event is SNSEvent =>
  hasRecordsOf(event, 'EventSource', 'aws:sns')

export const isS3Event = (event: unknown): event is S3Event =>
  hasRecordsOf(event, 'eventSource', 'aws:s3')

export const isDynamoDBStreamEvent = (event: unknown): event is DynamoDBStreamEvent =>
  hasRecordsOf(event, 'eventSource', 'aws:dynamodb')

export const isEventBridgeEvent = (event: unknown): event is EventBridgeEvent =>
  isObject(event) && 'detail-type' in event && 'source' in event && 'detail' in event

/**
 * Checks whether the event is an HTTP-style event:
 * API Gateway (v1 / v2), Function URL, ALB, or VPC Lattice.
 */
export const isHttpEvent = (event: unknown): event is LambdaEvent => {
  if (!isObject(event) || !isObject(event.requestContext)) {
    return false
  }
  return (
    'httpMethod' in event ||
    'rawPath' in event ||
    'elb' in event.requestContext ||
    'serviceArn' in event.requestContext
  )
}
