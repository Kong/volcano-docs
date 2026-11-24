---
title: 'Report problems from Slack'
description: 'Mention Volcano in Slack to have LavaFlow diagnose a reported problem, or propose a change you ask for, in a pull request.'
---

Mention `@Volcano` in a Slack thread that describes a problem, and
[LavaFlow](lavaflow.md) reads the report, picks the project, and runs its
usual diagnosis, fix, review and pull request. It answers in the thread, and
answers again with the outcome. You can also ask it for a change, such
as new content or functionality; see [Request a change](#request-a-change).

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
   who installed it, can remove it from Volcano. If your workspace's admins
   approve apps, Slack sends them a request instead, and again whenever
   Volcano asks for a permission they haven't approved. Choose
   **Add to Slack** again once they approve it.
2. **Connect.** Everyone who will report problems opens account settings and
   chooses **Connect Slack**, while signed in to the Volcano account that owns
   the projects. Slack confirms who they are with Sign in with Slack, and the
   connection is tied to the Volcano session they connected in. Several people
   can connect to one account, and one Slack account can connect to several
   Volcano accounts.
3. **Invite Volcano to private channels.** Binding a public channel adds the
   app to it, so public channels need nothing here. In Slack, invite the app to
   each private channel that will report problems, for example with
   `/invite @Volcano`, so the picker lists it.
4. **Bind.** In LavaFlow settings, the owner picks which channels report
   problems for which projects. The picker lists the public channels the Slack
   account you connected in this Volcano session is in, and the private
   channels it and the app are both in. You can bind only such a channel, so on
   an account several people share, each picks from their own channels. After
   signing in to Volcano again, connect Slack again to pick channels. Archived,
   Slack Connect and shared channels can't report. A channel reports for
   nothing until it is bound.

   If binding a public channel answers `400` because the app can't join it on
   its own, invite the app the same way, or choose **Add to Slack** again: an
   installation from before the app could join channels gets that permission
   when it is added again.

## Report a problem

In a bound channel, reply to the message that describes the problem with
`@Volcano`, or mention `@Volcano` in that message itself. LavaFlow picks the
project:

- **One bound project:** it uses that project.
- **Several, and your reply names one:** Reply with the project name, full repository name, or a unique repository shorthand.
  For the repository `Kong/volcano-docs`, you can reply with `@Volcano volcano-docs` or `@Volcano docs`.
  Quotes, backticks, and trailing punctuation are ignored.
- **Several, and you only mention `@Volcano`:** LavaFlow uses the project named in the original message, tries to identify it from the report, or asks you to choose.

An exact project name takes priority.
If your selection matches several projects or names a project LavaFlow can't work on, it asks you to choose again.
Reply in the same thread with only the project or repository name.
If you described the problem
in replies rather than in the original message, the answer keeps them, up to
your ten newest in the thread. If they don't all fit a report's limit of 8,200
characters, it keeps the newest that fit, and the report LavaFlow works from
notes how many it left out.

Where problem clarification has launched, LavaFlow checks whether it has enough
detail to investigate before starting diagnosis. If something essential is
missing, it asks about it in the same thread with one of a fixed set of
questions: what happened, where it happened, what you expected instead, how to
reproduce it, or which of two conflicting replies is right. The question never
quotes the thread or anything LavaFlow's AI wrote. Anyone in that thread
can answer by mentioning `@Volcano` with the missing details, even if they have
not connected their own Slack account to Volcano. The question says that a
reply reaches LavaFlow's AI and how long Volcano keeps it, and links to
[Data and retention](#data-and-retention). LavaFlow assesses the replies for
relevant evidence, asks again if needed, and continues the original report
once it has enough information. Ordinary replies without a mention are not read.

Contributors do not choose another project or grant new permissions, and
their replies don't change what the original reporter reported. LavaFlow lists
the reporter's own replies apart from everyone else's, and reads the others as
context: they can clarify facts, but they can't add to, narrow, or replace the
reporter's report. The original reporter must remain connected and authorized,
and the original channel binding must remain valid. The report keeps up to the ten newest
clarification replies within its 8,200-character limit. Other people's replies
are left out first; the original description is shortened only to make room
for the reporter's own replies. Waiting for an answer does not
start a run. If LavaFlow refused the report before starting, you can try again in the same thread.

## Follow up in the same thread

Once LavaFlow starts working, mention `@Volcano` again to add a detail, ask about the run, or request an edit.
Anyone whose connected Slack account is authorized for the selected project can follow up.

- **While work is in progress**, give LavaFlow a clue such as `@Volcano check content/platform/authentication/anonymous-users.md`.
  LavaFlow uses it when it continues the run.
- **With an open pull request**, ask for a specific edit and LavaFlow reviews it before updating the same pull request.
  LavaFlow pauses automatic merge while an accepted edit is pending.
- **After the pull request closes or the run ends without one**, ask about the outcome in the same thread.
  To continue the same work, explicitly ask for a follow-up PR and describe the change you want.

Start a new Slack thread and mention `@Volcano` there for a separate change.

LavaFlow then answers in the thread with the project it picked and a link to
its repository, and posts the outcome as a new reply. It never edits an
earlier reply, so the thread keeps each step of the report. A reported fix can merge when the project allows it and the fix passes LavaFlow's merge checks.
A pull request for a requested change waits for a person to merge it.
The outcome includes the pull request's link, or a
fixed reason it opened none, and a link to the run in Volcano. The run link
opens the report's project in the same environment as the Slack app and still
requires access to that project. It never holds the diagnosis:
everyone in the channel reads the answer, including people who can't see the
project's runs. Read the diagnosis in Volcano, and follow the run like any
other; see
[Follow runs](lavaflow.md#follow-runs). Each report becomes an issue on the
project, titled `Problem reported in Slack`, and counts toward the project's
open issues until its fix pull request merges, which resolves it. A project at
its limit of open issues is refused in the thread, and so is one that has used
its LavaFlow runs for the day; that reply says when to mention Volcano again.

While LavaFlow is paused, it keeps a report for up to 10 days after it arrives,
and picks it up if LavaFlow resumes in that time. A reporter without an
authorized project can still be refused during a run-execution pause. During a
publication maintenance pause, outgoing notices also wait, including pause and
refusal notices; the pause does not use the report's retry allowance.
Authorization and retention still apply. A reply to a question LavaFlow is
waiting on still joins that report during a pause. A capped or unauthorized
report ends without a channel notice. Its text is cleared unless it was
already kept as a clarification; previously clarified text keeps its existing
retention period.

Answers and fix pull request links are posted in the channel, where everyone
in it can see them.

## Request a change

The person who mentions `@Volcano` can ask for a change rather than report a
defect, such as `@Volcano add hello.md containing "hello world"`. Only what
that person wrote can ask for one: the original message when they wrote it,
the reply that mentions `@Volcano`, and their replies LavaFlow asked about. An
original message someone else wrote is read only as a description of the
problem, so mentioning `@Volcano` under another person's feature request
doesn't ask for it. Write the request in your own reply. Replies to a
clarification question, including the reporter's, describe the problem. For
a separate change after the run starts, mention `@Volcano` in a new thread.

Before any run starts, LavaFlow reads what you wrote, and only that, to tell
what you're asking for:

- When your words name the change, such as a file or feature to add, the run
  builds it.
- When they describe a problem, ask LavaFlow to look at or fix one, or only
  point at the thread, such as a bare `@Volcano` or a project's name, the run
  diagnoses the thread like any report. If it finds nothing to fix, the reply
  tells you to describe the change you want in your own message.
- When they ask for new content or functionality without naming it, such as
  `@Volcano do this` under someone else's feature request, LavaFlow starts no
  run and asks you to say what to change in your own message.

LavaFlow builds what the request asks for and nothing beyond it, and its
reviewers hold anything else the change adds. The request can't change what
LavaFlow may do: its permissions, the files it may not change, its review, and
when it opens a pull request stay the same, and the run stops at a pull
request for a person to review and merge. The pull request says it proposes a
requested change, not a fix, and the run's `diagnosis.requested` is `true`.
When the request is unclear, the result already exists, or the change lies
outside the repository, LavaFlow opens nothing and says so in the thread.

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

A person who hasn't connected gets a reply with a link to connect, except in a
thread where a report is waiting for an answer to LavaFlow's clarification
question: there their mention is read as an answer to it instead. A connected
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

A clarification answer still counts against its contributor's hourly mention
limit. It can join an existing report even when the workspace's waiting queue
is full, because it does not create another waiting report. A report waiting
for an answer doesn't count toward the workspace's waiting reports either.

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
| The reply that mentions it | 4,000 characters. It doesn't read the rest of the thread, except replies mentioning it to answer a clarification question                                            |
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

Replies that answer a clarification question are part of the report: they
reach LavaFlow's AI with it, from whoever wrote them, and Volcano deletes them
with it. Follow-up messages are subject to the same retention window.

The run itself is kept like any other LavaFlow run, and its diagnosis may quote
the report. Volcano keeps a hash of the thread's identifiers with the run so
another mention in that thread can't start a duplicate.

## API

The dashboard uses these routes. Where Slack reports are not available in the
environment, installing, connecting, the channel picker and binding a channel
answer `404` with code `feature_unavailable`. Listing and removing connections,
connectors and bindings work either way, so nothing you set up is stranded.

Starting an installation or connection, listing channels, and binding a
channel accept the dashboard's current sign-in session. Browser requests
include credentials so the callback can verify its cookie. Only the configured
dashboard origin receives credentialed cross-origin access. A session from
another Volcano project cannot authorize these operations.

Bound Slack channels keep a project's LavaFlow settings readable while
LavaFlow is unavailable, even if the project has no saved settings or runs.
The owner can still remove those bindings; this does not enable new reports.

| Route                                      | Purpose                                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /user/slack/installations`           | Starts installing Volcano's Slack app and returns the URL to send the browser to                                                        |
| `GET /connectors`                          | The Slack workspaces you installed the app in or connected to, as connectors                                                            |
| `GET /connectors/{id}`                     | One connector                                                                                                                           |
| `DELETE /connectors/{id}`                  | Uninstalls the app from the workspace; only whoever installed it can                                                                    |
| `POST /user/slack/connections`             | Starts connecting your Slack account and returns the Sign in with Slack URL                                                             |
| `GET /user/slack/connections`              | Your connected Slack accounts, and whether the app is installed in each workspace                                                       |
| `DELETE /user/slack/connections/{id}`      | Disconnects one                                                                                                                         |
| `GET /user/slack/channels?team_id=`        | The public channels you, as connected in this session, are in, and the private ones you and the app are both in; Slack Connect left out |
| `GET /lavaflow/connector-bindings`         | A project's bound channels                                                                                                              |
| `POST /lavaflow/connector-bindings`        | Binds a channel to a project                                                                                                            |
| `DELETE /lavaflow/connector-bindings/{id}` | Unbinds a channel                                                                                                                       |

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

A new binding answers `201`, and adds the app to a public channel it isn't in
yet. Binding again answers `200` with the same binding, so a retry is safe. A
binding whose workspace no longer has the app installed has no
`connector_id`, and reports again once the app is installed there again.
Unbind with the binding's `id`:

```bash
curl -X DELETE "https://api.volcano.dev/lavaflow/connector-bindings/$BINDING_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

| Status | Code                       | Why                                                                                                                                                                                                                              |
| ------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                            | A field is missing or malformed, the connector's workspace is not one you connected to in this session, the channel is archived, a Slack Connect channel or shared, or the app isn't in the channel and can't join it on its own |
| `403`  | `person_required`          | A project access token or MCP tried to change the bindings                                                                                                                                                                       |
| `403`  | `plan_required`            | Binding: the owner's plan does not include LavaFlow                                                                                                                                                                              |
| `404`  |                            | The project doesn't exist or you can't read it; binding, you're not in the channel, or it's a private channel the app isn't in; unbinding, there's no such binding                                                               |
| `404`  | `feature_unavailable`      | Binding: the project's `lavaflow.slack` capability is unavailable                                                                                                                                                                |
| `502`  |                            | Binding: Slack did not answer while checking or joining the channel; try again                                                                                                                                                   |
| `502`  | `slack_reinstall_required` | Binding: Slack refused the app's token, or a permission other than joining channels that its installation lacks; add the app to the workspace again, once a workspace admin approves it if needed                                |

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
