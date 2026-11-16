---
title: 'Notifications'
description: 'Get an email or a signed webhook when a scheduled function keeps failing, and again when it recovers.'
---

A scheduler that keeps firing a broken function fails quietly until someone
looks. Notifications tell you instead. By default, every project emails its
owner once a scheduler's runs have failed 3 times in a row, and again when a
run succeeds. Add a webhook to route the same alerts into your own tooling.

## Check the current settings

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/notifications" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

A project that never saved settings returns the defaults:

```json
{
  "project_id": "7f2b3c1e-0d4a-4c8e-9a51-2f6d8b0e1c34",
  "email": { "enabled": true, "recipients": [], "status": "delivering" },
  "webhook": { "secret_configured": false },
  "scheduler_failures": {
    "notify_on": "consecutive_failures",
    "threshold": 3,
    "notify_on_recovery": true
  }
}
```

Alerts are emailed only to the project owner's verified account email address,
so `recipients` stays empty. `email.status` says whether email is delivering:

| `email.status`           | Meaning                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `delivering`             | Email is on and the owner's address is verified.                                                         |
| `disabled`               | Email is off.                                                                                            |
| `owner_email_unverified` | Email is on, but the owner has not verified their account address. Alerts are not emailed until they do. |

While the owner's address is unverified, email does not count as a channel: a
project with no webhook sends no alerts, and a failing streak is announced on
the first failure after the owner verifies. Changing the account email address
needs a new verification, and alerts are not emailed in between.

## Add a webhook

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/notifications" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "webhook": { "url": "https://ops.example.com/hooks/volcano" } }'
```

Adding the first webhook generates its signing secret. The response is the only
place it appears:

```json
{
  "project_id": "7f2b3c1e-0d4a-4c8e-9a51-2f6d8b0e1c34",
  "email": { "enabled": true, "recipients": [], "status": "delivering" },
  "webhook": {
    "url": "https://ops.example.com/hooks/volcano",
    "secret_configured": true,
    "secret": "whsec_0000000000000000000000000000000000000000000"
  },
  "scheduler_failures": {
    "notify_on": "consecutive_failures",
    "threshold": 3,
    "notify_on_recovery": true
  },
  "updated_at": "2026-10-19T15:04:05Z"
}
```

Store the secret where your receiver can read it. Every later response reports
only `secret_configured`. If you lose it, [rotate it](#rotate-the-signing-secret).

Omitted fields keep their values, so a `PUT` changes only what it names.
Changing the URL keeps the secret, and `"url": ""` removes the webhook and its
secret. The URL must be `http` or `https` and reachable on the public internet:
a URL that names a private or loopback address is refused when it is saved,
and a delivery to a host name that resolves to one fails. Put a routing token in
the path or query string if your receiver needs one. Credentials in the URL are
refused.

## Choose when to alert

```bash
curl -X PUT "https://api.volcano.dev/projects/$PROJECT_ID/notifications" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "scheduler_failures": { "notify_on": "first_failure" } }'
```

| Field                                   | Default                | Description                                                                                                               |
| --------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `email.enabled`                         | `true`                 | Whether alerts are emailed.                                                                                               |
| `email.recipients`                      | `[]`                   | Empty, or the project owner's verified account address. Either way alerts go to the owner, and the list is saved empty.   |
| `webhook.url`                           | none                   | Where alerts are posted. `""` removes the webhook.                                                                        |
| `scheduler_failures.notify_on`          | `consecutive_failures` | `first_failure` alerts on a scheduler's first failed run. `consecutive_failures` waits for `threshold` failures in a row. |
| `scheduler_failures.threshold`          | `3`                    | 1 to 100. Ignored for `first_failure`.                                                                                    |
| `scheduler_failures.notify_on_recovery` | `true`                 | Send `scheduler.recovered` when a run succeeds after an alert.                                                            |

Any other address is refused, as is any address while the owner's is
unverified:

```json
{
  "error": "email.recipients: only the project owner's verified account email address is supported; leave recipients empty to email the owner"
}
```

To send alerts somewhere else, such as a team channel or an on-call tool, add a
[webhook](#add-a-webhook).

Either way, a failing streak is announced once. Further failures in the same
streak send nothing more, and the streak ends at the next successful run. A
scheduler is announced failing at most once an hour: a streak that meets the
policy sooner after the last alert is announced by its first failure once the
hour is up, so a scheduler that alternates between failing and succeeding
does not flood you. Recoveries are never held back. The settings apply to
every scheduler in the project.

A full-scope [project access token](../authentication/security/project-access-tokens.md)
can read and change the settings. A read-only token is refused both with `403`,
because the webhook URL can carry your receiver's token. For the same reason,
[config export](configuration.md) leaves the webhook out.

## What counts as a failed run

- **Durable functions.** A run fails when the execution it started fails, times
  out, or is stopped. The run finishes when its execution does, so an alert can
  arrive some time after the tick that started it.
- **Standard functions.** A run fails when Volcano cannot invoke the function,
  for example because it is not deployed in the scheduler's region. An error
  the function returns or throws from its handler does not count. Volcano
  retries the tick every minute and each attempt is a failed run, so a
  function missing from its region meets the default threshold within about
  three minutes.
- **Both.** A tick that Volcano cannot deliver, such as during an outage, is
  retried every minute. Its attempts count as failed runs once 15 minutes have
  passed since its first attempt. A durable function that is being redeployed,
  a rate limit or a spent plan allowance, a function whose deployment leaves it
  unable to start, and a standard function that runs past the invoke timeout
  reach the same point. A tick Volcano refuses for a reason of its own never counts,
  however long it lasts.

A scheduler runs in one region at a time. Moving it to another region starts a
new count of failed runs, but an announced streak stays open: the first
successful run in the new region sends the recovery. Runs still finishing in
the region it left are recorded there and send nothing. See
[Scheduler health](../functions/scheduled-invocations.md#scheduler-health) for
how the same state shows in the schedulers API.

A disabled scheduler keeps the health it had when it stopped, apart from durable
runs already started then: they still count when their executions finish, and
can still send an alert. A scheduler that does not fire, such as one on a HOBBY
project, records no runs and sends no alerts.

## Send a test

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/notifications/test" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

The test goes out on every channel that delivers right away, signed like an
alert, and the response reports each delivery:

```json
{
  "deliveries": [
    { "channel": "email", "delivered": true },
    { "channel": "webhook", "delivered": false, "status_code": 500, "error": "webhook responded 500" }
  ]
}
```

A failed test delivery is not retried. One test per project per minute: another
within the minute answers `429`. With email on but the owner's address
unverified, the email entry reports `delivered: false` and nothing is emailed.
With no webhook and email off or unverified there is nowhere to send, and the
request answers `409`.

## Webhook requests

Each alert is a `POST` with a JSON body and these headers:

| Header                      | Value                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `Volcano-Webhook-Id`        | The event id, as in the body's `id`. The same on every attempt to deliver one event. |
| `Volcano-Webhook-Timestamp` | Unix seconds when this attempt was signed.                                           |
| `Volcano-Webhook-Signature` | `v1=` followed by the hex HMAC-SHA256 of `<timestamp>.<body>`.                       |
| `User-Agent`                | `Volcano-Webhooks/1`                                                                 |

A `scheduler.failing` event:

```json
{
  "id": "1c0f8a4e-7f61-5b8d-9a3e-2f4b6d8c0e1a",
  "type": "scheduler.failing",
  "created_at": "2026-10-19T15:00:04Z",
  "project": { "id": "7f2b3c1e-0d4a-4c8e-9a51-2f6d8b0e1c34", "name": "my-app" },
  "function": { "id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b", "name": "hourly-sync", "kind": "durable" },
  "scheduler": {
    "id": "2c9d1e0f-3a4b-4c5d-8e9f-0a1b2c3d4e5f",
    "name": "hourly-sync",
    "health": "failing",
    "consecutive_failures": 3,
    "last_success_at": "2026-10-19T11:00:05Z",
    "last_failure_at": "2026-10-19T15:00:04Z"
  },
  "run": {
    "id": "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    "region": "us-east-1",
    "status": "failed",
    "started_at": "2026-10-19T15:00:00Z",
    "finished_at": "2026-10-19T15:00:04Z",
    "error": { "type": "TypeError", "message": "Cannot read properties of undefined (reading 'rows')" }
  }
}
```

A `scheduler.recovered` event has the same shape, with `scheduler.health` set
to `healthy`, `consecutive_failures` set to `0`, and the successful run, which
has no `error`. A `notification.test` event carries only `id`, `type`,
`created_at`, and `project`.

`last_success_at` is absent until Volcano records a successful run, including
for a scheduler whose last success came before scheduler health was tracked.
`error.type` is absent when the failure has no type.

## Verify the signature

Compute the HMAC over the raw request body, before parsing it. The key is the
whole secret, including its `whsec_` prefix. Reject a request whose timestamp
is too old so that a captured request cannot be replayed.

```javascript
import crypto from 'node:crypto';
import http from 'node:http';

const SECRET = process.env.VOLCANO_WEBHOOK_SECRET;
const TOLERANCE_SECONDS = 5 * 60;

function verify(body, headers) {
  const timestamp = headers['volcano-webhook-timestamp'];
  const signature = headers['volcano-webhook-signature'];
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const expected = 'v1=' + crypto.createHmac('sha256', SECRET).update(`${timestamp}.`).update(body).digest('hex');
  const received = Buffer.from(signature);
  return received.length === expected.length && crypto.timingSafeEqual(received, Buffer.from(expected));
}

http
  .createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (!verify(body, req.headers)) {
        res.writeHead(401).end();
        return;
      }
      const event = JSON.parse(body);
      console.log(event.type, event.scheduler?.name, event.run?.error?.message);
      res.writeHead(204).end();
    });
  })
  .listen(3000);
```

## Delivery and retries

Answer with any `2xx` status within 10 seconds. Any other status, a timeout, or
a connection error is retried with a backoff that starts at 30 seconds and
doubles up to 15 minutes, for 8 attempts over about 45 minutes. Redirects are not
followed, and a redirect fails the delivery without a retry.

Deliveries are at least once, so a receiver can see one event more than once.
Deduplicate on the body's `id`, after verifying the signature.
`Volcano-Webhook-Id` carries the same value, but the signature does not cover
headers, so a replayed request could change it. A retried alert can arrive after a later
one for the same scheduler, such as `scheduler.failing` after
`scheduler.recovered`; order a scheduler's events by `created_at`.

Email retries the same way, and each attempt goes to the owner's current
account address. An email fails without a retry when the owner has not
verified that address, or when the mail server refuses it for good, such as an
unknown mailbox. In rare cases, such as a restart in the
middle of an attempt, the same email can arrive twice.

Each attempt reads the current settings. Removing the webhook drops alerts still
waiting to be delivered to it, turning email off drops queued emails, and after
a rotation, retries of earlier alerts are signed with the new secret.

## Rotate the signing secret

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/notifications/webhook-secret" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

The response carries the new secret in `webhook.secret`, this once. The old
secret stops working immediately, so update your receiver right after
rotating. Without a webhook the request answers `409`.

## Manage notifications from the CLI and the manifest

The CLI wraps these endpoints in `volcano cloud notifications get`, `set`,
`rotate-webhook-secret`, and `test`. See [Notifications in the CLI](/cli/notifications).

The [configuration manifest](configuration.md#notification-settings) takes a
`notifications` section with the same fields. The signing secret is never part
of it.

## Local development

In local development, the same settings and endpoints work. Email goes to the
local inbox at `http://localhost:8025`, and the webhook URL may name a private
address. The local server runs in a Docker container, where `localhost` is the
server itself, so point the webhook at a receiver on your machine through
`host.docker.internal` (Docker Desktop) or your machine's network address.

## Related

- [Scheduled invocations](../functions/scheduled-invocations.md)
- [Durable functions](../functions/durable-functions.md)
- [Function Schedulers API](../api-reference/function-schedulers.md)
- [Notifications API](../api-reference/notifications.md)
