---
title: 'Notifications API'
description: "Read and change where a project's alerts go, rotate the webhook signing secret, and send a test."
---

Notification settings belong to a project:

- `GET /projects/:id/notifications`
- `PUT /projects/:id/notifications`
- `POST /projects/:id/notifications/webhook-secret`
- `POST /projects/:id/notifications/test`

All four accept a user token or a full-scope project access token. A read-only
project access token is refused all four with `403`: the settings carry the
webhook URL, which can hold the receiver's token. See [Notifications](../projects/notifications.md)
for when alerts are sent, the webhook payload, and signature verification.

## Get settings

```bash
curl "$VOLCANO_API_URL/projects/$PROJECT_ID/notifications" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "project_id": "7f2b3c1e-0d4a-4c8e-9a51-2f6d8b0e1c34",
  "email": { "enabled": true, "recipients": [], "status": "delivering" },
  "webhook": { "url": "https://ops.example.com/hooks/volcano", "secret_configured": true },
  "scheduler_failures": {
    "notify_on": "consecutive_failures",
    "threshold": 3,
    "notify_on_recovery": true
  },
  "updated_at": "2026-10-19T15:04:05Z"
}
```

`webhook.url` is absent when no webhook is configured, and `updated_at` until
the settings are first saved. The signing secret is never returned here.

`email.status` is `delivering` when email is on and the owner's account email
address is verified, `disabled` when email is off, and `owner_email_unverified`
when email is on but the owner has not verified their address. In the last
case alerts are not emailed, and email does not count as a channel.

## Update settings

Every field is optional, and an omitted one keeps its value:

```json
{
  "email": { "enabled": true, "recipients": [] },
  "webhook": { "url": "https://ops.example.com/hooks/volcano" },
  "scheduler_failures": {
    "notify_on": "first_failure",
    "threshold": 3,
    "notify_on_recovery": true
  }
}
```

| Field                          | Rules                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email.recipients`             | Empty, or the project owner's verified account email address. Either way alerts go to the owner and the list is saved empty. Any other address, or any address while the owner's is unverified, answers `400`.                                    |
| `webhook.url`                  | An absolute `http` or `https` URL up to 2048 characters, without credentials or a fragment. A port, if given, must be 1–65535. `""` removes the webhook and its secret. Outside local development it must not name a private or loopback address. |
| `scheduler_failures.notify_on` | `first_failure` or `consecutive_failures`.                                                                                                                                                                                                        |
| `scheduler_failures.threshold` | 1 to 100.                                                                                                                                                                                                                                         |

The response is the saved settings. When the update adds a webhook to a project
without one, it also carries the generated signing secret in `webhook.secret`.
That is the only time it is returned. Changing an existing URL keeps the
secret. An invalid field answers `400` with a message naming it.

## Rotate the webhook signing secret

```bash
curl -X POST "$VOLCANO_API_URL/projects/$PROJECT_ID/notifications/webhook-secret" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

Answers the settings with the new secret in `webhook.secret`. Deliveries from
then on, including retries of earlier alerts, are signed with it. Answers `409`
when no webhook is configured.

## Send a test

```bash
curl -X POST "$VOLCANO_API_URL/projects/$PROJECT_ID/notifications/test" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "deliveries": [
    { "channel": "email", "delivered": true },
    { "channel": "webhook", "delivered": true, "status_code": 204 }
  ]
}
```

Sends a `notification.test` event on every channel that delivers and reports
each delivery. Email to an unverified owner is reported with `delivered: false`
and is not sent. `status_code` is the webhook's response status, absent for email and
when no response arrived. `error` explains a failed delivery. A failed test is
not retried.

| Status | Meaning                                                                          |
| ------ | -------------------------------------------------------------------------------- |
| `200`  | The test was attempted. Check `delivered` on each entry.                         |
| `409`  | No webhook is configured, and email is off or the owner's address is unverified. |
| `429`  | A test was sent less than a minute ago.                                          |

## Scheduler health

Scheduler responses carry the health these alerts are based on. See
[Function Schedulers API](function-schedulers.md#health).
