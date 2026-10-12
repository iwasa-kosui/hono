# Lambdalith example

One Lambda function that receives events from nine different sources, dispatched by `LambdaRouter`.

```
 S3 uploads-bucket ──┐
 S3 reports-bucket ──┤
 Scheduler (daily)   ┤                  ┌─ s3          (branch on bucket name)
 Scheduler (hourly)  ┼──▶ Lambda ──▶ LambdaRouter ─┼─ eventBridge (branch on detail-type)
 Scheduler (weekly)  ┤                  ├─ http        (Hono app)
 REST API  (v1) x2   ┤                  └─ fallback    (log unknown events)
 HTTP API  (v2) x2 ──┘
```

## Event sources and handlers

| #   | Source                    | Trigger                                  | Handler       | Job                      |
| --- | ------------------------- | ---------------------------------------- | ------------- | ------------------------ |
| 1   | S3 `uploads-bucket`       | `s3:ObjectCreated:*`                     | `s3`          | generate a thumbnail     |
| 2   | S3 `reports-bucket`       | `s3:ObjectCreated:*`                     | `s3`          | notify the report is out |
| 3   | Scheduler `daily-report`  | `cron(0 1 * * ? *)`                      | `eventBridge` | aggregate daily report   |
| 4   | Scheduler `session-cleanup` | `rate(1 hour)`                         | `eventBridge` | delete stale sessions    |
| 5   | Scheduler `billing-reminder` | `cron(0 9 ? * MON *)`                 | `eventBridge` | send billing reminders   |
| 6   | HTTP API (v2)             | `GET /health`                            | `http`        | health check             |
| 7   | REST API (v1)             | `GET /users/{id}`                        | `http`        | fetch a user             |
| 8   | HTTP API (v2)             | `POST /uploads`                          | `http`        | issue an upload URL      |
| 9   | REST API (v1)             | `POST /webhooks/stripe`                  | `http`        | receive a Stripe webhook |

Anything else is passed to `fallback`, which logs it.

## EventBridge Scheduler: the shape of `Input`

A Lambda target of EventBridge Scheduler receives the schedule's `Input` **as-is**. Unlike an
EventBridge rule, no event envelope (`id`, `time`, `resources`, ...) is added.

`LambdaRouter` recognizes an EventBridge event by the presence of the three keys `detail-type`,
`source` and `detail`. So each schedule's `Input` is written in that shape:

```json
{ "source": "myapp.scheduler", "detail-type": "daily-report", "detail": { "target": "sales" } }
```

If `Input` lacks any of the three keys, the event is not routed to `eventBridge`.
The `eventBridge` handler then branches on `detail-type`.

## Files

- `index.ts`: the Hono app, the handlers, and the `LambdaRouter` (`export const handler`)
- `jobs.ts`: dummy business logic (only logs)
- `events/`: sample events for every source, in the real AWS shapes
- `lambdalith.test.ts`: sends every sample event to `handler` and checks where it was routed
- `template.yaml`: an AWS SAM template wiring all nine sources to one function (not deployed or validated; adjust before use)

## Running the tests

From the repository root:

```sh
pnpm install
pnpm run build # `hono` must be built once
cd adapters/aws-lambda
pnpm test # type-checks `src`, `test` and `examples`, then runs vitest
```

This directory is not part of the published package (`files` only contains `dist`, and the build entry is `src/**`).
