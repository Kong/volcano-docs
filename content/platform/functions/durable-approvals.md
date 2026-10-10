---
title: "Durable approvals"
description: "Pause a durable function until a person approves or denies it, then resume with their decision. Decide in the dashboard, the CLI, the API, or an SDK."
---

A durable function can stop and wait for a person to sign off. `ctx.waitForApproval` records an approval request, suspends the execution, and resumes it with the decision once someone approves or denies it. The execution runs no code and costs no compute while it waits, whether that takes a minute or a month.

```javascript
const { durable } = require('@volcano.dev/sdk/durable');

exports.handler = durable(async (input, ctx) => {
  const order = await ctx.step('load-order', () => loadOrder(input.order_id));

  const decision = await ctx.waitForApproval('ship-order', {
    title: `Ship order ${order.id}?`,
    description: 'The total is over the auto-ship limit.',
    details: { order_id: order.id, total: order.total },
    timeout: '3d',
  });

  if (!decision.approved) {
    // 'denied' or 'expired'
    await ctx.step('release-stock', () => releaseStock(order.id));
    return { shipped: false, status: decision.status, comment: decision.comment };
  }

  await ctx.step('ship', () => ship(order.id));
  return { shipped: true, approved_by: decision.decidedBy?.email };
});
```

The request appears under **Approvals** in the dashboard, naming the function and execution that asked. Approve it there, from the [CLI](#decide-from-the-cli), or through the [API](#decide-through-the-api), and the execution carries on from the line after `waitForApproval`.

The same handler in Python:

```python
from volcano_sdk.durable_authoring import durable


@durable
def handler(event, ctx):
    order = ctx.step("load-order", lambda scope: load_order(event["order_id"]))

    decision = ctx.wait_for_approval(
        "ship-order",
        title=f"Ship order {order['id']}?",
        description="The total is over the auto-ship limit.",
        details={"order_id": order["id"], "total": order["total"]},
        timeout="3d",
    )

    if not decision.approved:
        ctx.step("release-stock", lambda scope: release_stock(order["id"]))
        return {"shipped": False, "status": decision.status, "comment": decision.comment}

    ctx.step("ship", lambda scope: ship(order["id"]))
    return {"shipped": True, "approved_by": decision.decided_by.email if decision.decided_by else None}
```

`waitForApproval` needs `@volcano.dev/sdk` 2.0 or later in JavaScript, or `volcano-sdk-python` 0.14 or later in Python. A durable function deployed before approvals were available has to be redeployed once to get the `VOLCANO_PLATFORM_API_URL` variable they use; see [Errors](#errors). Ruby has no durable authoring API, so a Ruby application can [decide approvals](#decide-from-an-sdk) but not request them.

## Request an approval

| Argument | Description |
|---|---|
| `name` | Required. Names the operation in the execution's history, like a step's name. Up to 237 printable ASCII characters; the SDKs refuse anything else before recording the request. |
| `title` | Required. What the person deciding sees first. Up to 200 characters. |
| `description` | Longer context. Up to 4,000 characters. |
| `details` | Any JSON value shown with the request, such as the record under review. |
| `timeout` | How long people have to decide, in the format `ctx.wait` takes (`'30m'`, `'3d'`, a number of seconds), from 1 second to 366 days. Without it, the approval stays open as long as the execution runs. |

The request, with its details, is limited to 64 KiB.

The approval is checkpointed like any other operation. A resumed execution replays the recorded decision instead of asking again, and the request is registered once however many times the handler replays. Approvals inside `ctx.parallel`, `ctx.map`, or `ctx.child` work the same way, so one execution can wait on several at once.

`waitForApproval` throws, failing the execution unless you catch it, when its arguments are invalid or Volcano refuses the request — for example when the execution already has 100 approvals pending. Brief refusals, such as a busy moment, a rate limit, or a request that arrives before Volcano can see the execution waiting, are retried for about 30 seconds before they surface.

## Read the decision

A denial and an expiry are outcomes to branch on, not errors, so `waitForApproval` resolves with a decision in every case:

| JavaScript | Python | Approved | Denied | Expired |
|---|---|---|---|---|
| `approved` | `approved` | `true` | `false` | `false` |
| `status` | `status` | `'approved'` | `'denied'` | `'expired'` |
| `comment` | `comment` | The comment, or `''` | The comment, or `''` | `''` |
| `decidedBy` | `decided_by` | `{ id, email }` | `{ id, email }` | `null` / `None` |
| `decidedAt` | `decided_at` | ISO 8601 timestamp | ISO 8601 timestamp | `null` / `None` |

`decidedBy` is also `null` when the account that decided was deleted before the decision reached the workflow.

An approval can end a fourth way, as `cancelled`, when its execution ends before anyone decides — it was stopped, timed out, failed, or its function was deleted. The workflow never sees that status, because it is no longer running. It shows in the approval list and the statistics.

| Status | What happened | What the workflow gets |
|---|---|---|
| `pending` | Waiting for a decision | Nothing yet; it is suspended |
| `approved` | A person approved it | `approved: true` and the comment |
| `denied` | A person denied it | `approved: false` and the comment |
| `expired` | The timeout passed with nobody deciding | `status: 'expired'` |
| `cancelled` | The execution ended first | Nothing; the execution is over |

## Timeouts

The `timeout` you pass is the approval's deadline, and the approval's `expires_at` is set from it. When it passes, the execution resumes with an `expired` decision, and a decision that arrives afterwards is refused with `409` and `approval_expired`.

Without a timeout, the approval lasts as long as the execution, and `expires_at` is `null`. The execution timeout still applies, and an approval left open when it is reached ends as `cancelled`.

A decision Volcano has accepted stands even if the execution cannot be reached at that moment. Volcano keeps retrying the delivery for as long as the execution waits, and the execution resumes once it lands, so a `200` from approve or deny means the decision is recorded, not necessarily that the workflow has resumed yet. If the execution stops waiting before the decision reaches it, the approval ends the way the workflow saw it: `expired` when its timeout passed, or `cancelled` when the execution ended, with the decision removed. A decision that may have reached the execution is kept.

## Decide in the dashboard

Open **Approvals** in the project's dashboard. It lists approvals newest first, opens on the **Pending** tab, and can be narrowed to one workflow, a time range, or another status. Open one to read its description and details, then approve or deny it with an optional comment. The same page shows how many approvals were approved, denied, or expired, which workflows ask most, and how requests trend over time. See [Dashboard](../interfaces/dashboard.md).

## Decide from the CLI

The [Volcano CLI](/cli/durable-functions) decides approvals as the person signed in with `volcano login`:

```bash
volcano cloud durable approvals list
volcano cloud durable approvals get 0b6f3c1e-8a4d-4f7e-9c2b-5d1a7e3f9b20
volcano cloud durable approvals approve 0b6f3c1e-8a4d-4f7e-9c2b-5d1a7e3f9b20 --comment "Checked stock"
volcano cloud durable approvals deny 0b6f3c1e-8a4d-4f7e-9c2b-5d1a7e3f9b20 --comment "Customer cancelled"
volcano cloud durable approvals stats --since 7d
```

| Command | Flags |
|---|---|
| `list` | `--function` (name or id), `--status` (`pending` by default, any status, or `all`), `--execution`, `--since` (such as `7d` or `24h`), `--page`, `--limit` |
| `get <approval-id>` | |
| `approve <approval-id>`, `deny <approval-id>` | `--comment`, `--yes` to skip the confirmation prompt |
| `stats` | `--function`, `--since` (`30d` by default) |

Every command takes `--json`. Repeating the decision an approval already has succeeds without changing anything, so a retried command is safe. A different decision, or any decision on an expired or cancelled approval, exits non-zero and says what happened.

Against `volcano start`, drop `cloud`: `volcano durable approvals approve <approval-id>`. See [Developing durable functions locally](../guides/durable-functions-locally.md#approve-locally).

## Decide through the API

Listing and statistics take any project credential, including a `read_only` [project access token](../authentication/security/project-access-tokens.md). Approving and denying take a person's credential — see [Who can decide](#who-can-decide).

### List approvals

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/durable-approvals?status=pending&function=order-pipeline" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```json
{
  "data": [
    {
      "id": "0b6f3c1e-8a4d-4f7e-9c2b-5d1a7e3f9b20",
      "status": "pending",
      "name": "ship-order",
      "title": "Ship order 4417?",
      "description": "The total is over the auto-ship limit.",
      "details": { "order_id": 4417, "total": 1280 },
      "function": { "id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b", "name": "order-pipeline" },
      "execution": { "id": "9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d", "name": "order-4417", "status": "running" },
      "requested_at": "2026-10-06T11:00:00Z",
      "expires_at": "2026-10-09T11:00:00Z",
      "decision": null
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 1,
  "has_more": false
}
```

Approvals are listed newest first. Filter with `status`, `function` (a durable function's name or id), `execution_id`, and `from` and `to` (RFC 3339, by request time), and page with `page` and `limit`. Read one with `GET /projects/{id}/durable-approvals/{approvalId}`.

### Approve or deny

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/durable-approvals/$APPROVAL_ID/approve" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Checked stock"}'
```

```json
{
  "id": "0b6f3c1e-8a4d-4f7e-9c2b-5d1a7e3f9b20",
  "status": "approved",
  "name": "ship-order",
  "title": "Ship order 4417?",
  "description": "The total is over the auto-ship limit.",
  "details": { "order_id": 4417, "total": 1280 },
  "function": { "id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b", "name": "order-pipeline" },
  "execution": { "id": "9a8b7c6d-5e4f-4a3b-8c1d-2e3f4a5b6c7d", "name": "order-4417", "status": "running" },
  "requested_at": "2026-10-06T11:00:00Z",
  "expires_at": "2026-10-09T11:00:00Z",
  "decision": {
    "comment": "Checked stock",
    "decided_by": { "id": "3f2b8c1d-7e4a-4b9c-9d1e-5a6b7c8d9e0f", "email": "owner@example.com" },
    "decided_at": "2026-10-06T11:04:12Z"
  }
}
```

Deny is the same request to `/deny`:

```bash
curl -X POST "https://api.volcano.dev/projects/$PROJECT_ID/durable-approvals/$APPROVAL_ID/deny" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Customer cancelled"}'
```

The response is the approval with `"status": "denied"` and its `decision`. The body is optional on both; `comment` is up to 2,000 characters and reaches the workflow as the decision's comment.

Repeating the decision an approval already has returns it unchanged with `200`. Deciding the other way, or deciding an approval that expired or was cancelled, returns `409`:

```json
{ "error": "approval already decided", "code": "approval_decided" }
```

### Read statistics

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/durable-approvals/stats?from=2026-09-06T00:00:00Z" \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

```json
{
  "from": "2026-09-06T00:00:00Z",
  "to": "2026-10-06T12:00:00Z",
  "counts": { "requested": 42, "pending": 3, "approved": 30, "denied": 6, "expired": 2, "cancelled": 1 },
  "approval_rate": 0.8333333333333334,
  "median_seconds_to_decision": 1840,
  "p90_seconds_to_decision": 21600,
  "functions": [
    {
      "function": { "id": "6f1c0f6e-6b0e-4a1d-9f8a-2c3d4e5f6a7b", "name": "order-pipeline" },
      "counts": { "requested": 35, "pending": 2, "approved": 26, "denied": 5, "expired": 1, "cancelled": 1 }
    },
    {
      "function": { "id": null, "name": "refund-review" },
      "counts": { "requested": 7, "pending": 1, "approved": 4, "denied": 1, "expired": 1, "cancelled": 0 }
    }
  ],
  "other_functions": { "requested": 0, "pending": 0, "approved": 0, "denied": 0, "expired": 0, "cancelled": 0 },
  "daily": [
    { "date": "2026-10-05", "counts": { "requested": 4, "pending": 0, "approved": 3, "denied": 1, "expired": 0, "cancelled": 0 } },
    { "date": "2026-10-06", "counts": { "requested": 2, "pending": 2, "approved": 0, "denied": 0, "expired": 0, "cancelled": 0 } }
  ]
}
```

The window defaults to the last 30 days and covers at most 366. Pass `function` to count one workflow. Each approval is counted on the day it was requested, in UTC, under its current status.

- `approval_rate` is approved out of approved and denied. It and both decision times are `null` when nothing in the window was decided.
- `functions` lists the ten workflows that asked most; the rest are summed in `other_functions`. A deleted workflow keeps its name with a `null` id.
- `daily` lists only days that have approvals.

## Decide from an SDK

Each SDK has an owner client for approvals. Reading takes the owner's platform token or a project access token; approving and denying take the platform token.

```javascript
const { data } = await ownerClient.durable.approvals.list(projectId, { status: 'pending' });

const { error } = await ownerClient.durable.approvals.approve(projectId, data.data[0].id, {
  comment: 'Checked stock',
});
```

```python
page = owner_client.durable.approvals.list(project_id, status="pending")

owner_client.durable.approvals.approve(project_id, page.approvals[0].id, comment="Checked stock")
```

```ruby
page = owner_client.durable.approvals.list(project_id, status: "pending")

owner_client.durable.approvals.approve(project_id, page.approvals.first.id, comment: "Checked stock")
```

All three have `list`, `get`, `stats`, `approve`, and `deny`. JavaScript returns its usual `{ data, status, error }` envelope; Python and Ruby raise a permission error for `403`, a conflict error for `409`, and a not-found error for `404`. See the [JavaScript](/sdk/js/durable-functions#deciding-approvals), [Python](/sdk/python/functions#decide-approvals-from-a-backend), and [Ruby](/sdk/ruby/functions#decide-durable-approvals) guides.

## Who can decide

Only a person decides an approval: someone signed in to the dashboard, or a platform token (`pk-`) from `volcano login`. A workflow can hold a project access token, and an approval it could answer itself would approve nothing.

| Credential | List, get, stats | Approve, deny |
|---|---|---|
| Dashboard session | Yes | Yes |
| Platform token (`pk-`) | Yes | Yes |
| Project access token (`pt-`), `full` | Yes | No, `403` |
| Project access token (`pt-`), `read_only` | Yes | No, `403` |
| [MCP server](../interfaces/mcp.md) | List and stats | No tool to decide |

A `full` project access token is refused with:

```json
{ "error": "project access tokens cannot decide durable approvals; a person decides in the dashboard or with a platform token" }
```

A `read_only` token is refused one step earlier with `project access token is read-only`.

An approval belongs to the project whose execution requested it. Another project's approval id answers `404`, the same as one that does not exist.

## History

Approvals and their decisions are kept for one year from the request, independently of the execution's own [retention](durable-functions.md#wait-for-the-result). They outlive the records they point at:

- After the execution is no longer retained, `execution.id` and `execution.status` are `null`; `execution.name` stays.
- After the durable function is deleted, `function.id` is `null`; `function.name` stays, and `function` filters still match it by name.
- After the deciding account is deleted, `decision.decided_by` is `null`.

Deleting the project deletes its approvals.

## Limits and billing

| Limit | Value |
|---|---|
| Pending approvals per execution | 100 |
| Approval requests | 600 per hour per execution, and 6,000 refused requests per hour per sending address |
| `title` / `description` / `name` | 200 / 4,000 / 237 characters, `name` in printable ASCII |
| Request size, details included | 64 KiB |
| Comment | 2,000 characters |
| Timeout | 1 second to 366 days |
| History | 1 year |
| Statistics window | 366 days |

These are the same on both plans. Approvals are not a separate allowance: each one is three durable operations — the approval itself, the wait for the decision, and the step that registers the request — counted against your [operation allowance](durable-functions.md#limits-and-billing). Waiting costs no compute.

In an execution's [operations trace](durable-functions.md#inspect-an-executions-operations), an approval appears as a `child` context named after it, holding a `callback` operation that is `waiting` until the decision arrives and the `step` that registered the request.

## Errors

Errors on the approval endpoints:

| Status | `code` | When |
|---|---|---|
| `400` | | A filter or the request body is invalid, the comment contains a NUL character, `from` is after `to`, or a statistics window is empty or longer than 366 days |
| `403` | | A project access token tried to approve or deny |
| `404` | | No approval with that id in this project |
| `413` | | A decision body larger than 16 KiB |
| `409` | `approval_decided` | The approval was already decided the other way |
| `409` | `approval_expired` | Its timeout passed before the decision |
| `409` | `approval_cancelled` | Its execution ended before the decision |

Errors `waitForApproval` can raise inside the workflow, when Volcano refuses the request. Those marked retried are retried for about 30 seconds and raised only if they persist:

| Status | `code` | When |
|---|---|---|
| `400` | | The request is invalid, such as text containing a NUL character |
| `404` | | No running durable execution Volcano started matches the request. Retried, because a new execution can take a moment to appear |
| `409` | `approval_not_ready` | Volcano cannot see the execution waiting yet. Retried |
| `409` | `execution_ended` | The execution has finished |
| `409` | `too_many_pending_approvals` | The execution already has 100 approvals pending |
| `429` | | Too many approval requests from this execution or its address. Retried |
| `5xx` | | The request could not be confirmed right now. Retried |

The SDK checks the request's size and that `details` is JSON before sending it, so an oversized or unserializable request throws without a round trip. A `409` with `approval_closed` is not raised: the approval's deadline already passed, so `waitForApproval` resolves with an `expired` decision.

`waitForApproval` also throws when `VOLCANO_PLATFORM_API_URL` is missing. Volcano sets that variable when it deploys a durable function or syncs its variables, so a missing one means the handler is not deployed as a durable function, or was last deployed before approvals were available; redeploy it. The variable is [reserved](environment-variables.md#variable-name-rules) and counts toward the environment size limit.

## What's next

| Guide | Description |
|-------|-------------|
| [Durable functions](durable-functions.md) | Operations, executions, and billing |
| [Developing durable functions locally](../guides/durable-functions-locally.md) | Run and approve on your machine |
| [Errors](../api-reference/errors.md) | Every API error body |
