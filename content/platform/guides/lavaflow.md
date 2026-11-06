---
title: 'LavaFlow'
description: 'Turn production errors into reviewed fixes: LavaFlow diagnoses your issues, opens pull requests that fix them, and, when you allow it, merges them.'
---

LavaFlow turns production errors into reviewed fixes.

1. **Error**: a function or frontend fails in production.
2. **Issue**: Volcano groups the error into an [issue](issues.md).
3. **Diagnosis**: LavaFlow reads the project's logs and source code and finds the root cause.
4. **Fix**: LavaFlow writes a fix and [reviews it](#follow-runs).
5. **Pull request**: LavaFlow opens a pull request with the fix in the project's [linked repository](#link-a-repository).
6. **Review**: you review the pull request like any other, unless you let LavaFlow merge.
7. **Merge**: you merge it, or [let LavaFlow merge it](#merge-fixes) once LavaFlow's reviewers and the required checks pass.
8. **Deployed**: when a deployment Volcano confirmed has the fix goes live, LavaFlow [resolves the issue](#after-a-fix-merges).

Volcano picks and runs the models, so there is no model or API key to set up.

LavaFlow sends this project's logs and source code to an AI service that Volcano operates.

LavaFlow's commit on a fix branch can carry a CI-skip directive, so your CI
doesn't run code a model wrote before a person looks at it. To keep the
directive out of your base branch, squash the fix with a message of your own.
Rebased, the commit becomes the head of the push to the base branch; squashed
with its commit messages, as GitHub does by default, the directive is copied
into the squash commit. Most CI services, GitHub Actions included, then skip
that push. Merged with a merge commit, or rebased with a commit on top, the
commit still lands in the base branch's history, where a CI service that skips
a push when any of its commits carries the directive, such as Azure Pipelines,
won't run.

Turn it on as the project's owner. The [CLI](/cli/lavaflow) says what LavaFlow
does and where it sends data, then asks first:

```bash
volcano cloud lavaflow enable
```

Or with the API:

```bash
curl -X PATCH "https://api.volcano.dev/lavaflow/settings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "enabled": true}'
```

```json
{
  "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
  "enabled": true,
  "autonomy": "open_pr",
  "merge_policy": {
    "human_review_paths": []
  },
  "custom_context": "",
  "system_prompt": "",
  "allow_ungated_workflows": false,
  "updated_at": "2026-11-02T14:05:11Z",
  "updated_by": "6b1f0c52-3e4d-4a8b-9f2c-7d5e1a0b3c4d",
  "can_update": true,
  "repository": {
    "repo_installation_id": 52001234,
    "repo_id": 812345678,
    "repo_full_name": "acme/storefront",
    "root_directory": "",
    "production_branch": "main",
    "updated_at": "2026-11-02T13:58:40Z"
  },
  "fix_blocker": null
}
```

This project links `acme/storefront`. A project with no linked repository
reports `repository_required` in `fix_blocker`; see
[Link a repository](#link-a-repository).

At the default autonomy, `open_pr`, LavaFlow opens a draft pull request with
each fix. Send `"autonomy": "diagnose_only"` to stop at the diagnosis.

LavaFlow works on the repository the project points at when you turn it on.
When the project points at another repository, or at none, `enabled` stays
`true`, but LavaFlow starts no new run until you turn it on again as above, or
point the project back at that repository.

## When runs start

LavaFlow starts a run on its own when an open [issue](issues.md) with
`exception: true` happens a second time. An error seen once waits for another
occurrence. A resolved issue that reopens starts a new run too; see
[After a fix merges](#after-a-fix-merges). An issue you ignore or resolve
starts none, and neither does an issue with `exception: false`.

An open issue with `exception: true` that has no run, such as one seen twice
while LavaFlow was off, gets a run when it's seen again once LavaFlow has been
on for a few minutes. An issue that already has a run, yours included, gets
none this way.

Not every recurring error needs a code change. When the diagnosis finds no
change that fixes it, for example because the cause is outside your code, the
run opens no pull request and reports `not_fixable` with its diagnosis; see
[Runs that open no pull request](#runs-that-open-no-pull-request).

## Match your commit conventions

LavaFlow writes a fix's pull request title and commit subject in the form your
repository asks for, so your title and commit checks pass:

```text
fix(web): guard against an empty cart
```

It reads these files, as text, in the commit the fix was made against:

- A commitlint configuration at the root, including a `commitlint` key in
  `package.json`
- A workflow in `.github/workflows` that checks titles or commit messages, such
  as `amannn/action-semantic-pull-request` or a job that runs commitlint
- `.github/semantic.yml`, for the Semantic Pull Requests app
- `AGENTS.md` and `CLAUDE.md` at the root and in each directory holding a file
  the fix changes, when they ask for Conventional Commits

When any of them asks for Conventional Commits, the header's type is `fix`, or
your repository's own type for one, such as `bugfix`. A title check that lists
no types allows the types it allows by default. The subject starts in
lowercase, has no trailing full stop, and fits your header length limit with
room for the pull request number GitHub adds when you squash.
LavaFlow adds a scope only when your repository requires one: the first allowed
scope a changed path names, such as `web` for `apps/web/src/cart.ts`, else the
first scope your repository lists. Scopes in
`amannn/action-semantic-pull-request` are patterns, matched as that action
matches them. It skips a scope that holds a number, a
link, or something shaped like a credential, and one too long to leave room
under your header length limit for a short subject and the pull request
number. When your repository's types include no type for a fix, no allowed
scope is left, or the limit leaves no such room at all, the title is the
closest one that fits your limit, for you to edit before you merge.

When nothing asks for Conventional Commits, the title is the fix's summary,
with numbers and quoted values replaced by `‹n›` and `‹str›`.

On a repository that isn't private, the title and commit subject name only the
issue, never the fix's summary:
`LavaFlow: handle TypeError in function checkout`, or
`fix: handle TypeError in function checkout` when your repository asks for
Conventional Commits.

Your repository chooses only the type and scope. Nothing in it changes what
LavaFlow redacts or whether its commit skips CI.

## Name the project

Every LavaFlow endpoint names one project with `project_id`: a query parameter
on reads, a body field on `PATCH`. Write it as a hyphenated UUID, in either case.
Reading one run is the exception: the run's own project authorizes it, so
`project_id` is optional there. Every item in a response carries the
`project_id` it belongs to.

A project you can't read answers `404` without a code, exactly like a project
that doesn't exist, and so does one being deleted. A run in such a project
answers like a run that doesn't exist. A project access token reads only its
own project.

## Check availability

LavaFlow is in preview and needs the SUPERAGENT plan. LavaFlow fixes never
count toward the project's Sandbox usage. Check the project's
capabilities before you offer it; `lavaflow` accounts for the owner's plan:

```bash
curl "https://api.volcano.dev/projects/$PROJECT_ID/capabilities" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

While `lavaflow` is `available`, every LavaFlow route answers. Where it is not:

- A project that never used LavaFlow lists it `unavailable` and is refused by
  every route: `404` with code `feature_unavailable` while LavaFlow is not
  offered to the project, and `403` with code `plan_required` when it is but
  the owner's plan does not include it. The list then gives `lavaflow` the
  `code` `plan_required`.
- A project with saved settings or runs lists it `read_only`. It keeps its
  reads, and its owner can still turn LavaFlow off with `{"enabled": false}`,
  and `allow_ungated_workflows` off with it. Every other change is refused the
  same way.

While the owner's account is read-only or inactive, LavaFlow starts no runs and
cancels queued and running runs with failure code `account_held`. Nothing needs
turning off.

LavaFlow is not available in local mode.

## Settings

| Field                     | Values                                                                                                                                                                          | Default   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `enabled`                 | Whether LavaFlow diagnoses the project's issues                                                                                                                                 | `false`   |
| `autonomy`                | `diagnose_only` stops at a diagnosis. `open_pr` may also open a pull request with a fix, and never merges it. `merge` may also merge the fix; see [Merge fixes](#merge-fixes)   | `open_pr` |
| `merge_policy`            | Fixes LavaFlow never merges with `autonomy: merge`; see [Merge fixes](#merge-fixes)                                                                                             |           |
| `custom_context`          | What LavaFlow should know about the project, such as its architecture. Up to 4000 characters                                                                                    | `""`      |
| `system_prompt`           | Instructions for LavaFlow's runs. Up to 4000 characters                                                                                                                         | `""`      |
| `allow_ungated_workflows` | Open a fix's pull request even where a workflow could run it with the repository's secrets before a person approves it. See [Allow ungated workflows](#allow-ungated-workflows) | `false`   |

LavaFlow saves `custom_context` and `system_prompt`, but runs do not use them
yet.

`PATCH` changes only the settings you send; send `project_id` and at least one
setting. A setting you omit
keeps its saved value, or its default when the project never saved settings.
`PUT /lavaflow/settings` is deprecated and does the same; use `PATCH`.
`updated_at` and `updated_by` are `null` until the first save.

Only the project's owner changes the settings, signed in with a platform token,
while their account is active. `can_update` says whether your credential can.

| Status | Code                  | Why                                                                                                                                                                                                                                                                                                         |
| ------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                       | `project_id` is missing or not a UUID, a field is unknown, `autonomy` is not one of its values, a `merge_policy` field is invalid, or a text field is over 4000 characters                                                                                                                                  |
| `400`  | `feature_unavailable` | The save sets `autonomy: merge` or changes `merge_policy` while the project's `lavaflow.merge` capability is unavailable                                                                                                                                                                                    |
| `401`  |                       | The request has no valid credential                                                                                                                                                                                                                                                                         |
| `403`  | `person_required`     | A full-scope project access token or MCP tried to change the settings                                                                                                                                                                                                                                       |
| `403`  | `person_required`     | The save turns on `allow_ungated_workflows` or changes a setting [Turn merging on](#turn-merging-on) lists, and the owner didn't make it with a sign-in session, `volcano login`, or a platform token that expires, or their GitHub account can't push to the project's repository, or the project has none |
| `403`  | `plan_required`       | The owner's plan does not include LavaFlow                                                                                                                                                                                                                                                                  |
| `403`  |                       | A read-only project access token tried to change the settings, or the owner's account is read-only                                                                                                                                                                                                          |
| `403`  |                       | The owner's plan could not be read. Nothing was saved; retry                                                                                                                                                                                                                                                |
| `404`  |                       | The project doesn't exist, you can't read it, or it is being deleted                                                                                                                                                                                                                                        |
| `404`  | `feature_unavailable` | LavaFlow is not available to the project; see [Check availability](#check-availability)                                                                                                                                                                                                                     |
| `409`  |                       | The settings, or the project's repository, kept changing while the save checked them. Nothing was saved; send it again                                                                                                                                                                                      |
| `413`  |                       | The body is over 128 KiB                                                                                                                                                                                                                                                                                    |
| `429`  |                       | The owner's GitHub push access was checked too often this hour. Nothing was saved; retry after `Retry-After`                                                                                                                                                                                                |
| `503`  |                       | The owner's GitHub push access couldn't be checked now. Nothing was saved; retry after `Retry-After`                                                                                                                                                                                                        |

`volcano-config.yaml` does not configure LavaFlow; see
[Leave out `lavaflow`](../projects/configuration.md#leave-out-lavaflow).

## Link a repository

LavaFlow opens fix pull requests in the GitHub repository the project is
linked to, against its production branch. The settings name it in
`repository`, in the shape the project's git connection uses, or `null` when
the project has none. `fix_blocker` says what in the project's repository setup
stops LavaFlow from fixing issues while it is on, and is `null` when the
repository setup doesn't:

```json
{
  "enabled": true,
  "autonomy": "open_pr",
  "repository": null,
  "fix_blocker": {
    "code": "repository_required",
    "message": "Link your project to GitHub, then turn LavaFlow on again to start fixing your issues."
  }
}
```

| Code                  | Why                                                                                                                                                                                                             | What to do                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `repository_required` | The project has no linked repository. With `autonomy` `open_pr` or `merge`, LavaFlow diagnoses issues but fixes none. If LavaFlow was turned on for a repository the project no longer links, it starts no runs | Link a repository, then turn LavaFlow on again. Linking the one LavaFlow was turned on for resumes it |
| `repository_changed`  | The project is linked to another repository than LavaFlow was turned on for, or to one linked after LavaFlow was turned on with none. LavaFlow starts no runs                                                   | Turn LavaFlow on again. The repository linked then is the one it fixes                                |

Link a repository with `volcano git connect <git-url>`, or through the API with
`PUT /projects/{id}/git-connection`; see
[Bind the repository to a project](../projects/git-deploy.md#3-bind-the-repository-to-a-project).
LavaFlow works only in a repository the owner turned it on for, so a project
that links one after LavaFlow is on, or links another, then reports
`repository_changed`. Turn LavaFlow on again as the owner:

```bash
volcano cloud lavaflow enable
```

Or send `{"project_id": "…", "enabled": true}` to `PATCH /lavaflow/settings`.

`fix_blocker` covers only the repository setup, so `null` doesn't mean nothing
else stops LavaFlow. It's also `null` while the project's `lavaflow` capability
isn't available; see [Check availability](#check-availability). Show the
`message` of a code you don't know.

### Code LavaFlow reads

LavaFlow reads the linked repository at the commit of the deployment that was
live when the issue was last seen. It never reads the uploaded files. The
commit comes from one of these:

- a push to the repository that built the deployment;
- a frontend upload whose [reported commit](deployment-source.md#commit) has
  `verification: files`;
- a function or durable function upload whose reported commit has
  `verification: repository`. LavaFlow reads it only for that deployment, and
  only while the project's repository link is unchanged since Volcano checked
  the commit. Any change to the link ends it, for a retry of the run too:
  relinking, even to the same repository, reinstalling the GitHub App,
  renaming the repository, or changing the production branch or root
  directory. A pull request an earlier attempt of the run already opened stays
  on the run. A redeploy of the same upload, such as one a variable change
  starts, carries no commit LavaFlow reads.

For any other deployment, LavaFlow diagnoses from the logs alone. A fix on a
reported commit is held for a person under `client_reported_commit`. A fix on a
`verification: repository` commit opens only while the production branch still
holds that commit.

## Find LavaFlow's pull requests

Every pull request LavaFlow opens carries the `Volcano LavaFlow` label. Search
your repository's pull requests for it:

```text
is:pr label:"Volcano LavaFlow"
```

LavaFlow creates the label in a repository that lacks it, with the description
"Opened by Volcano LavaFlow". A label of that name you already have keeps its
color and description. LavaFlow adds the label once, when it opens the pull
request, and never changes or removes labels afterwards, including yours. If
GitHub refuses the label, the pull request stays open without it. A run that
only diagnoses opens no pull request. Creating and adding the label fire
workflows like any other label; see
[Gate workflows that run a fix](#gate-workflows-that-run-a-fix).

## Merge fixes

With `autonomy: merge`, LavaFlow merges a fix's pull request once its
reviewers pass it, its required checks pass, and nothing holds it. With
`open_pr`, LavaFlow opens each fix as a draft pull request, where the
repository's GitHub plan offers drafts, and never merges it: mark it ready for
review, then review and merge it like any other. Merging needs the project's `lavaflow.merge` capability. While it
is unavailable, a new fix opens its pull request as under `open_pr`, and
LavaFlow never merges it. A merge that was already waiting gets `reason`
`paused`. LavaFlow takes a queued fix out of the merge queue, so it shows
`waiting_for_checks`, and queues it again when the capability is back.

Turning on merge lets LavaFlow's fixes, including those from runs it starts on
its own, run your CI with the secrets your pull request workflows get. Under
`open_pr`, a fix's commits skip CI.

```bash
curl -X PATCH "https://api.volcano.dev/lavaflow/settings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "autonomy": "merge", "merge_policy": {"human_review_paths": ["db/migrations/**"]}}'
```

| Field                             | Values                                                                                                                                          | Default |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `merge_policy.human_review_paths` | Up to 50 globs, relative to the repository root, such as `db/migrations/**`. LavaFlow never merges a fix that changes one, matched without case | `[]`    |

`PATCH` changes `human_review_paths` only when you send it; send `[]` to clear
it. List anything LavaFlow must never merge there.

### Turn merging on

Merging lets LavaFlow change your repository with no one else looking. Only
the project's owner can change `autonomy` to `merge`, turn `enabled` on while
`autonomy` stays `merge`, or change `merge_policy`, `custom_context` or
`system_prompt`, to any value, while `autonomy` is or becomes `merge`. Under
settings saved with automatic runs off before this API, the runs LavaFlow
starts on its own stop at a draft pull request. Sending `enabled: true` or
`"autonomy": "merge"` again, while LavaFlow is on and `autonomy` is `merge`,
lets them merge, so it needs the check too. Anyone who can save can turn
LavaFlow off.

With the [CLI](/cli/lavaflow), run this for the current project. It says what
merging allows, then asks before it saves:

```bash
volcano cloud lavaflow settings set --autonomy merge
```

The owner makes these changes signed in as a person: with a Volcano sign-in
session, the platform token `volcano login` stores while that sign-in lasts, or
another platform token that expires. Your GitHub account must also be able to
push to the project's repository;
[checking the owner's access](../projects/git-deploy.md#check-that-the-owner-can-push)
says why it can't. These get `403` with code `person_required`, and nothing is
saved:

- A project access token, or a request through MCP
- A platform token that never expires
- A `volcano login` token whose sign-in ended
- An owner whose GitHub account can't push to the project's repository
- A project with no repository; [link one](#link-a-repository) and turn LavaFlow on again first

Anyone other than the owner can't save the settings at all. Apart from the
re-send that lets LavaFlow's own runs merge, sending the saved values again
changes nothing and needs no check.

`merge` belongs to the repository the project points at when you turn it on.
When the project points at another repository, or at none, `autonomy` changes
to `open_pr`. Pointing it back doesn't turn merging on again: turn it on again
yourself.

### Waiting and held

A fix that only waits, for its checks or a merge queue slot, keeps moving, and
LavaFlow merges it when the wait ends. A held fix is yours for good: LavaFlow
never merges, pushes to, rebases or dequeues it again. The run's
`hold_reasons` say why. Review it and merge it on GitHub if you want it, or
close it.

LavaFlow holds a fix for these reasons:

| Code                           | Why                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`                         | It changes a path in `human_review_paths`, as the settings were when its pull request opened or as they are now, or deploy or infrastructure configuration                                                                                 |
| `sensitive_path`               | It changes another path Volcano always holds: authentication code, secret files, agent instructions, CI, dependencies or configuration; see below                                                                                          |
| `label`                        | The pull request has the `needs-human-review` label                                                                                                                                                                                        |
| `client_reported_commit`       | The fix is built on a commit Volcano can't tie to a push                                                                                                                                                                                   |
| `no_checks`                    | No CI ran on it                                                                                                                                                                                                                            |
| `required_check_skipped`       | A required check was skipped                                                                                                                                                                                                               |
| `no_required_checks`           | The base branch requires no check, so passing checks alone don't vouch for the fix                                                                                                                                                         |
| `changes_requested`            | A reviewer requested changes on GitHub                                                                                                                                                                                                     |
| `repository_requires_approval` | The repository requires an approving review                                                                                                                                                                                                |
| `person_commits`               | Someone other than LavaFlow pushed to the fix's branch                                                                                                                                                                                     |
| `rules_bypass`                 | The Volcano GitHub App can bypass a ruleset on the base branch                                                                                                                                                                             |
| `unchecked_rules`              | The base branch has a rule LavaFlow doesn't check, such as required signatures                                                                                                                                                             |
| `ungated_workflows`            | The fix opened past workflows that can run it with the repository's secrets before a person approves it, as the project's owner allowed, or LavaFlow couldn't check its workflows; see [Allow ungated workflows](#allow-ungated-workflows) |
| `commit_convention`            | LavaFlow can't write a title that meets your repository's [commit convention](#match-your-commit-conventions)                                                                                                                              |
| Any other code                 | One of LavaFlow's reviewers raised a concern, or its review was cut short; the code names it                                                                                                                                               |

Volcano always holds a fix that changes deploy or infrastructure configuration,
such as `volcano-config.yaml`, Terraform, CloudFormation or Kubernetes files, or
a YAML file anywhere that declares a resource with `apiVersion` and `kind` or
doesn't parse, with `path`. It holds a fix that changes any of these with
`sensitive_path`:

- Authentication or authorization code, Next.js middleware included
- Secret, key, certificate or cryptography files
- A coding agent's instructions or settings, or Git hook configuration
- CI configuration
- A dependency manifest or lockfile, or a `package.json` change to what installs
  or to its install scripts
- Runtime, container or other configuration files

LavaFlow never merges a fix whose title can't meet your repository's commit
convention. When nothing else holds such a fix, LavaFlow keeps it on the run
and opens no pull request, with `pull_request_skipped` set to
`convention_unsatisfiable`.

A required check passes only when it succeeds: `neutral` and `skipped` don't
count, a check pinned to an app counts only as that app's check run, and
Volcano's own checks never count. An approving review on GitHub doesn't
release a hold.

A run that may merge carries `merge`:

```json
"merge": {
  "status": "held",
  "reason": null,
  "hold_reasons": [
    {
      "code": "path",
      "question": "Changes db/migrations/0042_orders.sql, which always needs a person.",
      "paths": ["db/migrations/0042_orders.sql"]
    }
  ],
  "merged_by_lavaflow": null
}
```

| `status`             | Meaning                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `waiting_for_checks` | Waits for the checks on the fix's commit                                                      |
| `queued`             | In the repository's merge queue                                                               |
| `merged`             | Merged; the run's `pull_request.state` is `merged`                                            |
| `held`               | Handed to you for good, for `hold_reasons`; each `question` is what you decide before merging |
| `stopped`            | LavaFlow left the pull request open for you, for `reason`                                     |

Once `status` is `merged`, `merged_by_lavaflow` says who merged the fix:
`true` when LavaFlow merged it, directly or through the merge queue, and
`false` when someone else merged the pull request while LavaFlow waited. It is
`null` until then, and stays `null` for a fix LavaFlow held or stopped, even
after you merge it.

`reason` says why a merge stopped, such as `checks_failed`, `blocked_by_rules`
or `not_mergeable`. While merging is paused, a waiting merge gets `reason`
`paused`. LavaFlow takes a queued fix out of the merge queue, so it shows
`waiting_for_checks`, and queues it again when merging resumes. A merge paused
for more than 7 days stops with `paused_too_long`. A merge LavaFlow stops waiting on because
the project is being deleted stops with `cancelled`. If LavaFlow fails to read the pull
request for about an hour while the fix may be in the merge queue, it takes the
fix out of the queue and stops with `reads_failed`. When it can't reach the
pull request to do that, its comment says the fix may still merge from the
queue.

`branch_behind` means the base branch requires pull requests to be up to date
with it and has no merge queue. LavaFlow doesn't update fix branches, so update
and merge it yourself.

These reasons stop the merge for good, and the fix goes to you:

| `reason`                   | Meaning                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request_rejected`         | GitHub refused LavaFlow's request to start the checks on the fix                                                                                                |
| `ci_start_commit_mismatch` | GitHub reports a different commit from the one LavaFlow made to start the checks                                                                                |
| `queue_carries_ci_skip`    | The repository's merge queue could carry an instruction to skip checks, from the fix's commits or its pull request's title or description, into the base branch |
| `merge_carries_ci_skip`    | Merging would carry an instruction to skip checks into the base branch, for example because the repository allows no squash merge                               |

LavaFlow doesn't bill merges.

## After a fix merges

Once a fix's pull request merges, by you or by LavaFlow, LavaFlow watches the
resource's deployments from the repository for a week. When one that includes
the merge goes live, LavaFlow resolves the [issue](issues.md) as of that
moment, unless the error was seen after it. A deployment whose
[reported commit](deployment-source.md#commit) has `verification: repository`
never counts, because Volcano didn't match its files against the commit.
[Resolve the issue](issues.md#resolve-or-ignore-an-issue) yourself, or deploy
the merge with a push to the repository.

If the error happens again, the issue reopens, as any resolved issue does. For
an issue with `exception: true`, LavaFlow then starts a new run on it, no
sooner than an hour after the issue's last run started. Reopening an issue
yourself doesn't start one.

## Follow runs

List the project's runs, newest first. Filter with `status` and `resource_id`,
and page with `limit` (default 25, at most 100) and `cursor`, set to the
previous page's `next_cursor`. A cursor continues only the list it came from:
the same project, read with the same credential.

```bash
curl "https://api.volcano.dev/lavaflow/runs?project_id=$PROJECT_ID&status=pr_open" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "id": "0d6e9b1a-2f4c-4e8d-9a7b-3c5d1e2f4a6b",
      "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
      "issue_id": "3f6c1a9e-6c1d-4f7e-9a51-2b8f0e4d7c21",
      "status": "pr_open",
      "resource": {
        "type": "function",
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "name": "checkout"
      },
      "title": "Guard against an empty cart in chargeCustomer",
      "created_at": "2026-11-02T14:10:02Z",
      "finished_at": "2026-11-02T14:13:47Z",
      "pull_request": {
        "number": 42,
        "url": "https://github.com/acme/shop/pull/42",
        "state": "open",
        "opened_at": "2026-11-02T14:13:44Z",
        "draft": true,
        "draft_reason": "open_pr"
      },
      "merge": null,
      "pull_request_skipped": null
    }
  ],
  "limit": 25,
  "has_more": false
}
```

| `status`     | Meaning                                              |
| ------------ | ---------------------------------------------------- |
| `queued`     | Waiting to start                                     |
| `diagnosing` | Running: finding the root cause                      |
| `fixing`     | Running: writing the fix                             |
| `reviewing`  | Running: reviewing the fix                           |
| `pr_open`    | Finished, and its pull request is open               |
| `completed`  | Finished, with no open pull request                  |
| `failed`     | Stopped before it finished; `failure` says why       |
| `cancelled`  | Stopped, for example because LavaFlow was turned off |

A pull request's `opened_at` is `null` when the run opened it before LavaFlow
recorded the time.

### Draft pull requests

`draft` says whether the pull request is a draft, as GitHub last reported it to
LavaFlow, and is `null` for one opened before LavaFlow recorded it. A draft
waits for a person to mark it ready; `draft_reason` says why it is one, and is
`null` otherwise.

| `draft_reason`       | Why the pull request is a draft                                                                                                                                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open_pr`            | LavaFlow doesn't merge the fix: autonomy is `open_pr`, merging was unavailable when it opened, LavaFlow started the run on its own under settings saved with automatic runs off before this API (send `"autonomy": "merge"` again as the owner to lift that), or it was already a draft when the run took it on. Review it and mark it ready |
| `review_unresolved`  | LavaFlow's review didn't pass the fix, so LavaFlow never merges it. Decide whether to finish it                                                                                                                                                                                                                                              |
| `converted_to_draft` | LavaFlow opened it ready for review, and someone made it a draft since                                                                                                                                                                                                                                                                       |

### Runs that open no pull request

A run that may open a pull request but opened none says why in
`pull_request_skipped`. It is `null` when the run opened one, when its
`max_stage` stops before the pull request, and while it runs. Match on the code.

| `pull_request_skipped`     | Why, and what to do                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `not_fixable`              | The diagnosis found no change in the code that fixes the error, for example because the cause is outside it. Read the diagnosis                                                                              |
| `low_confidence`           | The diagnosis isn't confident enough to propose a fix. Read the diagnosis                                                                                                                                    |
| `no_patch`                 | LavaFlow proposed no change. Read the diagnosis                                                                                                                                                              |
| `possible_credential`      | The fix or its description held what looks like a credential or a project secret, so LavaFlow pushed nothing. Apply the fix yourself from the diagnosis                                                      |
| `possible_personal_data`   | The fix adds an email address the repository lacks, and the repository isn't private, so LavaFlow pushed nothing. Apply the fix yourself                                                                     |
| `ungated_workflows`        | A workflow could run the fix with the repository's secrets before a person approves it. The run's `held_workflows` lists every such job. See [Gate workflows that run a fix](#gate-workflows-that-run-a-fix) |
| `convention_unsatisfiable` | LavaFlow would merge the fix, but no title can meet your repository's [commit convention](#match-your-commit-conventions), so it kept the fix on the run. Apply the fix yourself, or relax the convention    |
| `pull_request_open`        | Another LavaFlow pull request for the issue is open. Review or close it first                                                                                                                                |
| `source_unavailable`       | LavaFlow couldn't read the repository at the deployed commit, or the production branch lost it. Check the repository connection and the commit                                                               |
| `permission_missing`       | The Volcano GitHub App, or the owner's GitHub account, lacks a permission LavaFlow needs. Grant the App's requested permissions; the owner must be able to push                                              |
| `repository_changed`       | The project no longer deploys from the repository the run read. A new run uses the current one                                                                                                               |
| `publish_failed`           | Opening the pull request failed. A new run tries again                                                                                                                                                       |

New codes may appear.

A run's `title` is the title of the fix it proposed, else the diagnosis summary,
else `null`. The list carries no diagnosis. Get it from one run:

```bash
curl "https://api.volcano.dev/lavaflow/runs/$RUN_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

A run adds `source_commit`, the commit it read the code at (`sha`), and where
that commit came from (`origin`: `push`, `client_reported` for a
`verification: files` commit, `client_reported_repository` for a
`verification: repository` one, or `repository` for a reported problem's
production branch head). It is `null` when the run read no code, and `origin` is
`null` for a run recorded before Volcano kept it. A run also adds
`diagnosis` (its `summary`, `root_cause`, and the `evidence` behind
it, which cites the log lines and code it relies on; `log_lines` is empty for
now), `diff`, `diff_sha256`, `diff_truncated`, `diff_withheld`, its `review`
(`verdict` is `passed`, `changes_requested`, `blocked`, or `error`, with the
number of `rounds`), and `failure` with a `code` and a fixed `message`. Any
credential that can read the project's logs can read a run, including a
read-only project access token.

`diff` is the fix LavaFlow saved, as the unified diff its reviewers read.
`diff_sha256` is the SHA-256 of `diff` exactly as served. Both are `null` for a
run with no saved fix. What `diff` leaves out, it says in its own text:

- A diff cut short past 256 KiB ends with a line starting with
  `[diff truncated`, and `diff_truncated` is `true`.
- When a file's content, before or after the fix, or any change to it may hold
  a credential, or the file is too long for LavaFlow to read whole (over 64
  KiB, or past 256 KiB across the fix's files), every change to that file is
  left out, with one line in their place, such as
  `# LavaFlow withheld the changes to "config/deploy.sh" because they may contain a credential`.
  `diff_withheld` lists those files' paths.
- A run held with `possible_credential` leaves out every file.

A run held with `ungated_workflows` lists, in `held_workflows`, every job that
held it, and the commits LavaFlow read the workflows at:

```json
{
  "pull_request_skipped": "ungated_workflows",
  "diff_sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "diff_truncated": false,
  "diff_withheld": [],
  "held_workflows": {
    "read_at": [{ "source": "main", "commit_sha": "3f786850e387550fdab836ed7e6dc881de23001b" }],
    "jobs": [
      {
        "source": "main",
        "path": ".github/workflows/preview.yml",
        "job": "deploy-preview",
        "trigger": "pull_request_target"
      }
    ],
    "jobs_sha256": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
  }
}
```

`held_workflows` is `null` for any other run, and for a held run whose
workflows LavaFlow couldn't read to the end, such as one with a workflow it
couldn't parse, or more than 256 such jobs. Its `jobs` is empty when LavaFlow
read every workflow and found none, such as when they changed between the hold
and the read.

### Failure codes

A `failed` or `cancelled` run says why in `failure.code`, and a `queued` run
that waits says what for. Match on the code, not the message.

| Code                     | Why the run stopped or waits                                 |
| ------------------------ | ------------------------------------------------------------ |
| `feature_unavailable`    | Waits: LavaFlow isn't available. The run starts when it is   |
| `feature_paused`         | Waits: LavaFlow is paused. The run continues when it resumes |
| `lavaflow_disabled`      | LavaFlow was turned off, or the project is being deleted     |
| `plan_required`          | The owner's plan no longer includes LavaFlow                 |
| `account_held`           | The owner's account is read-only or inactive                 |
| `issue_not_found`        | The issue no longer exists                                   |
| `no_diagnosis`           | LavaFlow couldn't find a root cause                          |
| `budget_exhausted`       | The run reached its usage limit                              |
| `timed_out`              | The run didn't finish in time                                |
| `attempts_exhausted`     | LavaFlow retried the run as many times as it can             |
| `model_unavailable`      | LavaFlow couldn't reach its AI service                       |
| `model_refused`          | LavaFlow's AI service declined to diagnose the issue         |
| `model_request_rejected` | LavaFlow's AI service rejected the request                   |
| `internal_error`         | Something else went wrong                                    |

## Gate workflows that run a fix

LavaFlow opens a pull request only when no workflow could run the fix with
the repository's secrets before a person approves it. Otherwise the run
finishes as `completed` with no pull request, and the fix stays on the run.

The commits LavaFlow pushes skip `push` and `pull_request` workflows, except a
`pull_request` workflow whose `types` include `labeled`: LavaFlow labels its
pull request, so that workflow counts. Other triggers the fix's branch or pull
request fires, such as `pull_request_target`, `pull_request_review`,
`issue_comment`, `create`, `workflow_run`, and `repository_dispatch`, can still
start a job that fetches the fix. Every `repository_dispatch` workflow counts,
since LavaFlow can't tell who sends one, and so does a trigger GitHub adds
later. A `label` workflow counts too: LavaFlow creates its own label in a
repository that lacks it. LavaFlow reads the workflows on the production
branch, the default branch, and the fix's base commit, and holds the fix when a
job on such a trigger:

- can read a secret, has a token that can write, or runs on a runner GitHub
  doesn't host, itself or through a reusable workflow it calls; and
- isn't gated by a label.

A job without `permissions` that make its token read-only counts as having a
token that can write, whatever the repository's default. Only one of GitHub's
own runner labels, alone, counts as a runner GitHub hosts: a standard runner
label such as `ubuntu-latest`, `ubuntu-24.04`, `windows-2025`, or `macos-15`,
or a macOS larger runner label such as `macos-15-xlarge`. A runner group, a
custom runner's name, another larger runner's name, or an expression such as
`${{ matrix.os }}` doesn't.
A reusable workflow from another repository counts too.

LavaFlow doesn't try to tell what such a job does with the fix: any one
counts.

Gate such a job on a label a person adds. LavaFlow accepts exactly this
condition, with your label in place of `safe to test`:

```yaml
on:
  pull_request_target:
    types: [labeled]

jobs:
  test:
    if: github.event.label.name == 'safe to test' && github.event.sender.type == 'User'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}
      - run: npm test
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

Both terms are required, in the job's `if` or in the `if` of a job it
`needs`, joined to the rest of the condition by `&&` alone. The first runs the
job only when the label is added, not on later pushes; the second only when a
user adds it, not a GitHub App or a bot. If the trigger's `types` include
`unlabeled`, also require `github.event.action == 'labeled'`: removing the
label fires an event that names it too. No other label check is a gate:
`contains(github.event.pull_request.labels.*.name, '<label>')`, a label check
without the sender check, `github.event.sender.type != 'Bot'`, or a check of
`github.actor`. Nor is a label GitHub reads as the number 0, such as `0` or
`0.0`: on an event without a label, GitHub compares the missing label to it as
a number. A condition with `!`, `||`, or `always()` that can run the job
before a person approves, or with text around its `${{ }}`, even a space, isn't
a gate, and neither are required reviewers on an environment. A workflow
LavaFlow can't read, or that is too large or complex to read, holds the fix
too.

Only a pull request's events carry the label a person adds to it. On another
trigger, such as `issue_comment`, `workflow_run`, or `pull_request_review`, the
label check is never true, so it would stop the job for everyone. Keep such a job from
reaching secrets instead: name no secret in it or the workflow's `env`, hand
no secrets to a workflow it calls (`secrets: inherit` included), give it
read-only `permissions` such as `contents: read`, run it on a runner GitHub
hosts, call no reusable workflow from another repository, and keep each
workflow it calls in this repository from reaching secrets the same way.

A label is a gate only when nothing in the repository's workflows adds it. A
label that `actions/labeler`'s configuration lists, that
`gh pr edit --add-label` or the GitHub API adds, or that a step computes isn't
a person's approval. Everyone who can add the label must also have write
access; see [Let only people with write access add labels](#let-only-people-with-write-access-add-labels).

An action whose code LavaFlow doesn't read, from another repository or a
JavaScript or Docker action in yours, and every `run` step and
`actions/github-script` step, may add any label. Each counts against every gate
when its job holds a user credential: the job, including its steps, `env`,
inputs, container and services, or its workflow's `env` names a secret in any
form other than exactly `secrets.GITHUB_TOKEN` (`secrets['GITHUB_TOKEN']` and
`secrets.github_token` count), the job hands secrets to a reusable workflow,
it can request an OIDC token (`id-token: write`, or no `permissions` in a
reusable workflow, which takes its caller's), its token may write (a `write`
permission, `write-all`, or no `permissions` at all, which takes the
repository's default), or it runs on a runner GitHub doesn't host. With only a
read-only job token, such as `permissions: {}` or `contents: read`, it adds
labels as a bot, which start no workflow run, so they pass no gate. An action
or step in a job that runs only after a person adds a label to a pull request
doesn't count against that label, when every trigger of its workflow is
`pull_request` or `pull_request_target`, or one its condition rules out. A
reusable workflow in your repository whose only trigger is `workflow_call`
runs only when a job that calls it does, so its actions and steps don't count
against a label that every job calling it with a `./` path runs only after. A
reusable workflow from another repository picks its own runner, so it counts
against every gate except the labels that gate the job calling it, whatever
that job's credentials. LavaFlow reads each step of a composite action in your
repository, and counts `actions/checkout`, `actions/cache`, `actions/setup-*`,
`actions/upload-artifact`, and `actions/download-artifact` as adding no label.

If LavaFlow still holds fixes behind a gate like the one above, such an action
or step may add its label. It may run in another job, or in a job that runs
without the label on other branches, as under
[Gate only LavaFlow's branches](#gate-only-lavaflows-branches). Drop the secret
from that job, give it a read-only token such as `permissions: {}` or
`contents: read`, drop `id-token: write` or give a reusable workflow's jobs a
`permissions` block without it, move the job to a runner GitHub hosts, gate
that job on the same label alone under `pull_request` or
`pull_request_target`, or turn on
[`allow_ungated_workflows`](#allow-ungated-workflows).

Until you gate such a job, LavaFlow holds every fix in the repository.

### Allow ungated workflows

Gating the job is the safer fix. If you can't, the project's owner can let
LavaFlow open its pull requests anyway, signed in as a person: with a Volcano
sign-in session, the platform token `volcano login` stores, or another platform
token that expires. The owner's GitHub account must be able to push to the
project's repository:

```bash
curl -X PATCH "https://api.volcano.dev/lavaflow/settings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "allow_ungated_workflows": true}'
```

A project access token, a platform token that never expires, or anyone but the
owner gets `403` with `person_required`. Turning it off works with any of the
owner's credentials.

Those workflows may then run LavaFlow's pull requests, or put their text into
commands, with your repository's secrets before a person reviews them.
LavaFlow writes those changes from your error logs, which your users can
influence. Turn it on only if the workflows keep secrets away from untrusted
code; gating them on a label a person adds is safer.

LavaFlow still checks the workflows. A pull request it opens past them says so
in its description and names the first such job on each branch or commit it
checked, and the run lists them in `ungated_workflows`, which is null for a
pull request LavaFlow has no record of checking. A workflow LavaFlow
can't parse, or too complex to finish checking, is listed as one it couldn't
read, and the setting opens past it too. So is a job gated by a label that a
collaborator without write access may add. Workflows LavaFlow can't fetch, or
too many or too large to check, and collaborators it can't read in full still
hold the fix, and every other check still applies.

The setting covers opening a fix's pull request. LavaFlow never starts CI on a
fix it opened past ungated workflows, or merges it: where LavaFlow may merge,
it holds the fix with `ungated_workflows`, and the fix's commit keeps skipping
CI. While an ungated workflow is there, LavaFlow doesn't push revisions to that
pull request either.

The setting applies only to the repository the owner turned it on for. Pointing
the project at another repository, or at none, turns it off, and pointing back
doesn't turn it on again. Project access tokens and `volcano-config.yaml` can't
change it.

### Let only people with write access add labels

A label stands for a person's approval only when everyone who can add it has
write access. LavaFlow reads the repository's collaborators for every fix and
every revision, and holds the fix while any of them has:

- the triage role, which adds labels without write access;
- a custom role, which may add labels; or
- a role LavaFlow can't read.

LavaFlow also holds the fix when it can't read every collaborator. The admin,
maintain, write, and read roles are fine: read can't add labels, and the others
come with write access.

To open fixes again, give each such collaborator the read role, or the write
role if you trust them to approve fixes. Or the project's owner can turn on
`allow_ungated_workflows` to open fixes past the gate.

### Gate only LavaFlow's branches

To leave other pull requests as they are, gate the job only on the branches
LavaFlow pushes fixes to. They start with `volcano/lavaflow/`, or
`volcano/autofix/` for older fixes:

```yaml
on:
  pull_request_target:
    types: [opened, synchronize, reopened, labeled]

jobs:
  test:
    if: >-
      (!startsWith(github.head_ref, 'volcano/lavaflow/') &&
       !startsWith(github.head_ref, 'volcano/autofix/')) ||
      (github.event.label.name == 'safe to test' &&
       github.event.sender.type == 'User')
    permissions:
      contents: read
```

The condition has to stay false on each of LavaFlow's branches until a person
adds the label. A condition that misses one of the prefixes, or has another
`!`, `||`, or `always()` that can run the job, isn't a gate. LavaFlow reads
this form only on `pull_request_target` and `pull_request`, whose events name
the pull request's branch; on other triggers it gates nothing. Keep `labeled`
in the trigger's `types`, as above, so that adding the label runs the job on a
fix.
Write the condition in ASCII, and put a negated comparison in parentheses, as
in `!(github.event_name == 'push')`: LavaFlow doesn't read a condition with any
other character, or a `!` directly before a comparison.

LavaFlow reads each trigger on its own, so a job whose `if` tests
`github.event_name`, such as `github.event_name == 'workflow_dispatch'`, counts
only for the triggers it matches.

This job runs without the label on every other branch, so keep its token
read-only, as above. An action or step in it that LavaFlow doesn't read, with a
secret, a token that can write (including the default token), an OIDC token or
a runner GitHub doesn't host, may add the label to a fix's pull request, so
LavaFlow holds every fix. Move such steps to a job gated on the label alone, as
in the first example.

## See what LavaFlow found

Count the issues LavaFlow took on and the pull requests it opened per UTC day.
`days` is 30 by default and at most 90, ending today:

```bash
curl "https://api.volcano.dev/lavaflow/stats?project_id=$PROJECT_ID&days=7" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
  "window_start": "2026-10-27",
  "window_end": "2026-11-02",
  "days": [
    { "date": "2026-10-27", "issues_opened": 0, "pull_requests_opened": 0 },
    { "date": "2026-11-02", "issues_opened": 4, "pull_requests_opened": 1 }
  ],
  "totals": { "issues_opened": 4, "pull_requests_opened": 1 }
}
```

The response is shortened here; `days` has every day in the window.

List the same counts per function, durable function, and frontend:

```bash
curl "https://api.volcano.dev/lavaflow/resources?project_id=$PROJECT_ID&days=7" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
      "resource": {
        "type": "function",
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "name": "checkout"
      },
      "last_analyzed_at": "2026-11-02T14:10:03Z",
      "issues_opened": 4,
      "pull_requests_opened": 1,
      "anomaly": {
        "flagged": true,
        "reason": "4 issues in the last 24 hours, 4x its daily average"
      }
    }
  ]
}
```

Every resource in the project is listed, with zeros where LavaFlow found
nothing. A deleted resource with activity in the window is listed under its last
name, so the counts add up to the stats' totals.

A resource is flagged as an anomaly when the last 24 hours brought at least 3
issues and at least 3 times its daily average over the 29 days before. The
average counts as at least one issue a day.

## Agents

The [MCP endpoint](../interfaces/mcp.md) offers every LavaFlow read as a tool,
for the project the agent's token is bound to. Changing the settings is the
owner's decision, so no tool changes them.
