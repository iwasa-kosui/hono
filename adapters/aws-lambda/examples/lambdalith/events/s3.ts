import type { S3Event } from '../../../src'

const s3Record = (bucket: string, key: string, size: number): S3Event['Records'][number] => ({
  eventVersion: '2.1',
  eventSource: 'aws:s3',
  awsRegion: 'ap-northeast-1',
  eventTime: '2024-05-01T09:00:00.000Z',
  eventName: 'ObjectCreated:Put',
  userIdentity: { principalId: 'AWS:AIDAEXAMPLE' },
  requestParameters: { sourceIPAddress: '192.0.2.10' },
  responseElements: {
    'x-amz-request-id': 'EXAMPLE123456789',
    'x-amz-id-2': 'EXAMPLE123/abcdefghijklmno/ABCDEFGHIJK',
  },
  s3: {
    s3SchemaVersion: '1.0',
    configurationId: 'lambdalith-notification',
    bucket: {
      name: bucket,
      ownerIdentity: { principalId: 'A3EXAMPLE' },
      arn: `arn:aws:s3:::${bucket}`,
    },
    object: {
      key,
      size,
      eTag: '0123456789abcdef0123456789abcdef',
      sequencer: '0055AED6DCD90281E5',
    },
  },
})

/** A user uploaded an image to `uploads-bucket`. The key contains a URL-encoded space. */
export const uploadsS3Event: S3Event = {
  Records: [s3Record('uploads-bucket', 'users/42/my+photo.png', 204800)],
}

/** The daily report was written to `reports-bucket`. */
export const reportsS3Event: S3Event = {
  Records: [s3Record('reports-bucket', 'daily/2024-05-01.csv', 1024)],
}
