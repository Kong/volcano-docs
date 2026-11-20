---
title: 'Fix Aikido issues with LavaFlow'
description: 'Connect an Aikido workspace so LavaFlow opens fix pull requests for the code issues Aikido finds.'
---

Connect your [Aikido](https://www.aikido.dev) workspace, bind a project, and
each new code (SAST) issue Aikido finds on the project's GitHub repository
starts a [LavaFlow](lavaflow.md) run. LavaFlow
reads the issue, diagnoses it, and opens a pull request with the fix for you
to review. It never merges an Aikido fix, and it writes nothing back to
Aikido: follow the run in Volcano.

Aikido reports need the project's `lavaflow.aikido` capability. They are
rolling out environment by environment, so check it first. It is available
where the project's `lavaflow` capability is and Aikido reports have launched
in the environment:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/capabilities" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

## Set up

Set up Aikido in the dashboard or with the API; the CLI does not manage it
yet. In the dashboard, the project's owner sets it up in the **Aikido** card
of the project's LavaFlow settings. The card shows while the project's
`lavaflow.aikido` capability is available; everyone else who can read the
project sees which workspaces report for it.

### 1. Create credentials in Aikido

As an Aikido workspace admin:

1. In **Settings → Integrations → REST API**, create an API client. Volcano
   reads issues, code repositories and the workspace, so read access is
   enough. Copy its client ID and secret.
2. In **Settings → Integrations → Webhooks**, choose **Add secret** and copy
   the signing secret. Aikido shows it once.

### 2. Connect the workspace

In the **Aikido** card, choose your workspace's region, enter the client ID,
client secret and signing secret, and choose **Connect Aikido**. Once a
workspace is connected, choose **Connect another Aikido workspace** to add
more.

With the API, send the three values and your workspace's region: `eu` for
app.aikido.dev, `us` for app.us.aikido.dev, `au` for app.au.aikido.dev, or
`me` for app.me.aikido.dev.

```bash
curl -X POST "https://api.volcano.dev/connectors" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "aikido",
    "aikido": {
      "region": "eu",
      "client_id": "'"$AIKIDO_CLIENT_ID"'",
      "client_secret": "'"$AIKIDO_CLIENT_SECRET"'",
      "webhook_secret": "'"$AIKIDO_WEBHOOK_SECRET"'"
    }
  }'
```

Either way, Volcano checks the client with Aikido, reads which workspace it
belongs to, and stores the three values encrypted. It never returns them:

```json
{
  "id": "2d7c0f4e-8a51-4d0b-9a3e-1f6c2b9d4e70",
  "type": "aikido",
  "name": "Acme",
  "aikido": { "region": "eu", "workspace_id": 123 },
  "removable": true,
  "created_at": "2026-11-10T12:00:00Z"
}
```

| Status | Meaning                                                                                 |
| ------ | --------------------------------------------------------------------------------------- |
| `409`  | The workspace is already connected to Volcano. Remove that connector first.             |
| `422`  | Aikido refused the client, or it can't read the workspace. Check the region and scopes. |
| `502`  | Aikido didn't answer. Nothing was saved; try again.                                     |

The card explains the same refusals in its own words.

A workspace connects to one Volcano account, and only that account sees its
connector.

### 3. Point Aikido's webhook at Volcano

In Aikido's webhooks settings, add a webhook for new issues
(`issue.open.created`) with the URL `https://api.volcano.dev/webhooks/aikido`.
The **Aikido** card shows this address once a workspace is connected.

### 4. Bind a project

As the project's owner, bind the workspace to the project with the lowest
severity that starts a run. It defaults to high, since each run counts against
the project's LavaFlow runs.

In the **Aikido** card, pick the workspace if you connected several, pick the
lowest severity (**High and above** by default), and choose **Add workspace**.
The card lists the project's workspaces with their severity. To change a
workspace's severity there, remove it and add it again.

With the API, bind the connector with `min_severity`:

```bash
curl -X POST "https://api.volcano.dev/lavaflow/connector-bindings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "'"$PROJECT_ID"'",
    "connector_id": "2d7c0f4e-8a51-4d0b-9a3e-1f6c2b9d4e70",
    "aikido": { "min_severity": "high" }
  }'
```

Binding again changes the minimum. The project must be connected to the GitHub
repository Aikido scans.

## What reaches LavaFlow

A new issue starts a run when all of these hold:

- It is a code finding (`sast`). Vulnerable dependencies (`open_source`)
  are ignored for now: their fixes usually need a lockfile change, which
  LavaFlow doesn't make. Secrets, cloud, IaC and other issues need more than
  a code change, so they are ignored too.
- Its severity is at or above a bound project's `min_severity`.
- It is still open when LavaFlow picks it up.
- Its code repository is on GitHub, and is the bound project's repository.

LavaFlow reads the issue's title, rule, file and lines, and Aikido's advice
for fixing it, then runs its usual diagnosis, fix and review. The run stops at
a pull request, whatever the project's own autonomy.
If several bound projects share the repository, the first one bound that
LavaFlow can run on gets the issue.

Each run counts against the project's LavaFlow run limits, which bound how
many Aikido issues start runs in a day. A workspace holds at most 25 issues
waiting to be picked up, including issues on repositories no project binds,
and LavaFlow reads Aikido at its limit of 20 calls a minute. While 25 are
waiting, Volcano answers a new issue with `503` and `Retry-After`, and Aikido
sends it again; it retries a delivery five times.

## Remove Aikido

To stop a workspace reporting for one project, the project's owner chooses
**Remove** next to it in the **Aikido** card. With the API, remove the
binding with `DELETE /lavaflow/connector-bindings/{binding_id}`.

To remove a workspace from Volcano, open account settings: the **Aikido**
section of **Your account** lists the workspaces you connected, each with
**Remove**. With the API, remove the connector with
`DELETE /connectors/{connector_id}`. Its credentials and every project's
binding to it are deleted, and issues still waiting are canceled. Then delete
the webhook in Aikido, since Volcano refuses its deliveries from then on.
