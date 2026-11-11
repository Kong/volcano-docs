---
title: 'Report problems from Slack'
description: 'Mention Volcano in Slack to have LavaFlow diagnose a reported problem and open a fix.'
---

Mention `@Volcano` in a Slack thread that describes a problem, and
[LavaFlow](lavaflow.md) reads the report, picks the project, and runs its
usual diagnosis, fix, review and pull request. It answers in the thread and
updates that answer with the outcome.

Slack reports need the project's `lavaflow.slack` capability. Reporting from
Slack is rolling out environment by environment, so check it first. It is
available where the project's `lavaflow` capability is and Slack reports have
launched in the environment:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/capabilities" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

## Set up

Set up Slack in the dashboard; the CLI does not manage it yet.

1. **Install.** As the project's owner, open LavaFlow settings and choose
   **Add to Slack**. Slack asks you to install the Volcano app in your
   workspace. The installation becomes a Slack connector, which everyone
   connected to that workspace can bind channels with. Only you, as the one
   who installed it, can remove it from Volcano.
2. **Connect.** Everyone who will report problems opens account settings and
   chooses **Connect Slack**, while signed in to the Volcano account that owns
   the projects. Slack confirms who they are with Sign in with Slack, and the
   connection is tied to the Volcano session they connected in. Several people
   can connect to one account, and one Slack account can connect to several
   Volcano accounts.
3. **Add Volcano to a channel.** In Slack, invite the app to each channel that
   will report problems, for example with `/invite @Volcano`.
4. **Bind.** In LavaFlow settings, the owner picks which channels report
   problems for which projects. The picker lists only channels the app and
   the Slack account you connected in this Volcano session are both in, and
   you can bind only such a channel, so on an account several people share,
   each picks from their own channels. After signing in to Volcano again,
   connect Slack again to pick channels. Archived, Slack Connect and shared
   channels can't report. Binding a channel the app isn't in answers `400`:
   invite the app, then bind again. A channel reports for nothing until it is
   bound.

## Report a problem

In a bound channel, reply to the message that describes the problem with
`@Volcano`, or mention `@Volcano` in that message itself. LavaFlow picks the
project:

- **One bound project:** it uses that project.
- **Several, and your reply names one:** the reply after the mention must be
  exactly one project's Volcano name, such as `@Volcano checkout-api`. Quotes,
  backticks and trailing punctuation are ignored. Anything else gets a question
  listing the channel's projects.
- **Several, and you only mention `@Volcano`:** it uses the project whose name
  the original message contains. Otherwise LavaFlow's AI picks one of the
  channel's projects, or asks.

Only Volcano project names select a project, not repository names. When the
original message names a bound project LavaFlow can't work on now, it asks
instead of picking another. To answer a question, mention `@Volcano` again in
the same thread with only the project's name. If you described the problem
in replies rather than in the original message, the answer keeps them, up to
your ten newest in the thread. If they don't all fit a report's limit of 8,200
characters, it keeps the newest that fit, and the report LavaFlow works from
notes how many it left out.

LavaFlow then answers in the thread with the project it picked, and updates
that answer with the outcome. A run from Slack goes as far as opening a fix
pull request, even where the project lets LavaFlow merge, and so does a run
someone starts again on the report's issue: merging a fix someone reported in
Slack stays a person's step. The outcome is the fix pull request's link, or why it stopped,
and the run's ID. Follow the run in Volcano like any other; see
[Follow runs](lavaflow.md#follow-runs). Each report becomes an issue on the
project, titled `Problem reported in Slack`, and counts toward the project's
open issues until its fix pull request merges, which resolves it. A project at
its limit of open issues is refused in the thread, and so is one that has used
its LavaFlow runs for the day; that reply says when to mention Volcano again.

While LavaFlow is paused, it keeps a report for up to 10 days after it arrives,
and picks it up if LavaFlow resumes in that time. A reporter who may report for
no project is refused even while LavaFlow is paused.

Answers and fix pull request links are posted in the channel, where everyone
in it can see them.

## Who can report

A mention starts work only when all of these hold:

- Volcano's app is installed in the workspace.
- The channel is a regular channel in that workspace. Slack Connect channels
  and direct messages can't report problems; Volcano ignores mentions there.
- The person mentioning `@Volcano` has connected their Slack account to the
  Volcano account that owns the project.
- The project's owner bound the channel to the project.
- LavaFlow can work on the project: it is turned on, offered, and included in
  the owner's plan.

A person who hasn't connected gets a reply with a link to connect. A connected
person in a channel bound to none of their projects gets a reply with a link
to LavaFlow settings, where the owner binds it. Each person hears each
refusal once a day in a thread, and a report limit's refusal once an hour:
mentioning `@Volcano` again in the same thread for the same reason posts
nothing new, while someone else, or a new reason, gets an answer.

## Report limits

| Limit                          | Value                | Over it                                                         |
| ------------------------------ | -------------------- | --------------------------------------------------------------- |
| Mentions from one person       | 10 in any hour       | The next one is refused once that hour; later ones get no reply |
| Reports waiting in a workspace | 25 not yet picked up | Each person is refused once an hour until LavaFlow catches up   |

A report over a limit starts no work and reads nothing from Slack. The runs
reports start count toward the project's LavaFlow run limits like any other.

Each run checks these again as it goes. Disconnecting a Slack account,
unbinding a channel, or removing the connector (uninstalling the app) takes
effect at the next check, and cancels the report's queued work.

Enterprise Grid org-wide installs are not supported.

## What LavaFlow reads

| What                       | Limit                                                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The original message       | 4,000 characters. A reply mentioning `@Volcano` under a longer one is refused in the thread; a longer original message that mentions `@Volcano` itself gets no reply |
| The reply that mentions it | 4,000 characters. It doesn't read the rest of the thread, except your replies LavaFlow asked about                                                                   |
| Screenshots                | Up to 5 PNG, JPEG or GIF images on the original message. A GIF is read as its first frame                                                                            |
| Text files                 | Up to 5 files, such as logs, JSON, CSV or YAML, 100 KB in total and 50 KB each. A longer file keeps its start and end                                                |

Text files reach LavaFlow's AI along with the message. Logs often hold
credentials, tokens or personal data; remove them before you report, or leave
the file out.

Other attachments, such as PDFs, videos, WebP images and binary files, are left
out, and so is anything past these limits. The report still goes ahead, and the
answer in the thread says how many attachments were left out.

## Data and retention

Ten days after a report's run finishes, after LavaFlow answers without
starting one, or 10 days after it arrived if it is still open, as when LavaFlow
is paused, whichever comes first, Volcano deletes the report's text, its
screenshots and files, and who reported it. A run still waiting for a deleted
report stops. An issue still open then becomes `ignored`, so it stops
counting toward the project's open issues without being counted as fixed. If
its fix pull request merges later, the issue resolves. Deleting a message in Slack does not delete
the report sooner. Deleting the project deletes its reports at once.

The run itself is kept like any other LavaFlow run, and its diagnosis may quote
the report.

## API

The dashboard uses these routes. Where Slack reports are not available in the
environment, installing, connecting, the channel picker and binding a channel
answer `404` with code `feature_unavailable`. Listing and removing connections,
connectors and bindings work either way, so nothing you set up is stranded.

| Route                                      | Purpose                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `POST /user/slack/installations`           | Starts installing Volcano's Slack app and returns the URL to send the browser to                |
| `GET /connectors`                          | The Slack workspaces you installed the app in or connected to, as connectors                    |
| `GET /connectors/{id}`                     | One connector                                                                                   |
| `DELETE /connectors/{id}`                  | Uninstalls the app from the workspace; only whoever installed it can                            |
| `POST /user/slack/connections`             | Starts connecting your Slack account and returns the Sign in with Slack URL                     |
| `GET /user/slack/connections`              | Your connected Slack accounts, and whether the app is installed in each workspace               |
| `DELETE /user/slack/connections/{id}`      | Disconnects one                                                                                 |
| `GET /user/slack/channels?team_id=`        | The channels you, as connected in this session, and the app are both in; Slack Connect left out |
| `GET /lavaflow/connector-bindings`         | A project's bound channels                                                                      |
| `POST /lavaflow/connector-bindings`        | Binds a channel to a project                                                                    |
| `DELETE /lavaflow/connector-bindings/{id}` | Unbinds a channel                                                                               |

Find the workspace's connector:

```bash
curl "https://api.volcano.dev/connectors" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "connectors": [
    {
      "id": "3e7a9c51-2b84-4f0d-9c6e-8d1f2a7b5e40",
      "type": "slack",
      "name": "Acme",
      "slack": { "team_id": "T0123ABCD" },
      "removable": true,
      "created_at": "2026-11-04T18:02:11Z"
    }
  ]
}
```

Bind a channel with it, as the project's owner:

```bash
curl -X POST "https://api.volcano.dev/lavaflow/connector-bindings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "connector_id": "'"$CONNECTOR_ID"'", "slack": {"channel_id": "C0456EFGH"}}'
```

```json
{
  "id": "9b0d4e2a-3f1c-4b7e-8a6d-2c5f7e9a1b34",
  "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
  "connector_type": "slack",
  "connector_id": "3e7a9c51-2b84-4f0d-9c6e-8d1f2a7b5e40",
  "slack": { "team_id": "T0123ABCD", "team_name": "Acme", "channel_id": "C0456EFGH" },
  "created_at": "2026-11-04T18:20:31Z"
}
```

A new binding answers `201`. Binding again answers `200` with the same
binding, so a retry is safe. A binding whose workspace no longer has the app
installed has no `connector_id`, and reports again once the app is installed
there again. Unbind with the binding's `id`:

```bash
curl -X DELETE "https://api.volcano.dev/lavaflow/connector-bindings/$BINDING_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

| Status | Code                  | Why                                                                                                                                                                                                 |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                       | A field is missing or malformed, the connector's workspace is not one you connected to in this session, the channel is archived, a Slack Connect channel or shared, or the app isn't in the channel |
| `403`  | `person_required`     | A project access token or MCP tried to change the bindings                                                                                                                                          |
| `403`  | `plan_required`       | Binding: the owner's plan does not include LavaFlow                                                                                                                                                 |
| `404`  |                       | The project doesn't exist or you can't read it; binding, you're not in the channel, or it's a private channel the app isn't in; unbinding, there's no such binding                                  |
| `404`  | `feature_unavailable` | Binding: the project's `lavaflow.slack` capability is unavailable                                                                                                                                   |
| `502`  |                       | Binding: Slack did not answer whether you're in the channel; try again                                                                                                                              |

Unbinding and reading the bindings work even while `lavaflow.slack` is
unavailable. Any credential that can read the project reads its bindings.

Removing a connector uninstalls the app from the workspace for everyone who
uses it. Only the person who installed it can; anyone else gets `403` and can
uninstall the app in Slack instead. If Slack does not answer, the connector
stays and the request answers `502`, so try again. The workspace's bindings
stay, and report again if the app is installed there again.

## Agents

The [MCP endpoint](../interfaces/mcp.md) reads a project's bound channels with
the `get_lavaflow_connector_bindings` tool. Binding a channel is the owner's
decision, so no tool changes the bindings.
