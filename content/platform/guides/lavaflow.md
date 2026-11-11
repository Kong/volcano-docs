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

LavaFlow's fix commits skip CI until LavaFlow or a person starts it; see
[Keep the CI skip out of your base branch](#keep-the-ci-skip-out-of-your-base-branch).

Turn it on as the project's owner. With no repository linked yet, the next one
the project [links](../projects/git-deploy.md) becomes the repository LavaFlow
fixes. The [CLI](/cli/lavaflow) says what LavaFlow does and where it sends data,
then asks first:

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
  "code_quality": {
    "enabled": false
  },
  "skill_learning": "auto",
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

LavaFlow works on the repository the project points at when you turn it on,
or, turned on with none, on the first one the project points at afterwards.
When the project then points at another repository, or at none, `enabled` stays
`true`, but LavaFlow starts no new run until you turn it on again as above, or
point the project back at that repository. Since `enabled` stayed `true`,
turning it on again starts no runs for earlier issues.

## When runs start

LavaFlow starts a run on its own when an open [issue](issues.md) with
`exception: true` happens a second time. An error seen once waits for another
occurrence. A resolved issue that reopens starts a new run too; see
[After a fix merges](#after-a-fix-merges). An issue you ignore or resolve
starts none, and neither does an issue with `exception: false`.

An open issue with `exception: true` that has no run, such as one seen twice
while LavaFlow was off, gets a run when it's seen again once LavaFlow has been
on for a few minutes. An issue that already has a run, yours included, gets
none this way, unless every run ended with `source_unavailable` in
`pull_request_skipped`. Then, once you deploy a commit LavaFlow can read (see
[Code LavaFlow reads](#code-lavaflow-reads)), the issue starts a new run when
it's seen again a few minutes later. Each deployment gets one such run: a deploy that records no commit
starts none, and if the new run also ends with `source_unavailable`, the next
one waits for another deploy. A run that ended `source_unavailable` because
LavaFlow couldn't tell which deployment threw the error
([`deployment_unattributed`](#why-lavaflow-read-no-code)) gets one more run
when the error recurs, without a deploy. That happens once in a row: if that
run also ends `deployment_unattributed`, the next waits for a new deploy, and a
`deployment_unattributed` run right after another one, even one a deploy
started, gets no such run. [Run limits](#start-a-run) still apply.

Turning LavaFlow on, from off, also starts runs for up to 5 open issues with
`exception: true` and an `event_count` of at least 2, last seen in the past 7
days, most recently seen first. Runs LavaFlow queued on its own and hasn't
started count toward the 5. An issue LavaFlow already ran is left out, so
turning LavaFlow off and on again starts runs only for issues that still have
none. These runs start like any other run LavaFlow starts on its own, one at a
time per project. Sending `enabled: true` while LavaFlow is on starts none, and
neither does LavaFlow becoming available to the project, such as after a plan
change.

Only the project's owner, signed in, starts these runs: turning LavaFlow on
starts them when the request carries a `volcano login` token whose sign-in is
live, or a platform token that expires. A platform token that never expires,
or a `volcano login` token whose sign-in ended, starts none.

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
room for the pull request number GitHub adds when you squash. It drops a
leading "fix" the type already says: `Fix crash when the cart is empty` becomes
`fix: crash when the cart is empty`.
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

When nothing asks for Conventional Commits, a private title uses the fix's
summary with the same privacy checks as its description. Verified repository
values may remain; other numbers and quoted values become `‹n›` and `‹str›`.
For newly opened fixes, a squash merge keeps the approved title and adds the
pull request number.
A fix LavaFlow may merge under `autonomy: merge` still gets a Conventional
`fix:` header with no scope, such as `fix: guard the empty cart`.

A title too long for its limit ends with `…` after its last whole word.

On a repository that isn't private, including one internal to your GitHub
enterprise, the title and commit subject name only the issue and the first 8
characters of its ID, never the fix's summary:
`LavaFlow: fix TypeError in function checkout (issue 3f9a2c71)`, or
`fix: the TypeError in function checkout (issue 3f9a2c71)` when your repository
asks for Conventional Commits. A title too long for your header length limit
leaves out the resource, then the issue ID, rather than cut either.

Such a title carries a scope only when one of your checks lists it by name, in
lowercase letters, digits and hyphens, at most 24 characters. A scope taken
from a changed path, or matched only by a pattern, is left out unless a check
lists it, since a directory can name a customer. When your repository requires a scope and such a
title can't carry one, LavaFlow doesn't merge the fix: it holds it with
`commit_convention` for you to add a scope and merge it yourself. List the
scopes your repository uses so LavaFlow can pick one.

Your repository chooses only the type and scope. Nothing in it changes what
LavaFlow redacts or whether its commit skips CI.

## Follow your repository's guidance

LavaFlow writes and reviews a fix by your repository's own agent guidance, the
`AGENTS.md` and `CLAUDE.md` files in the commit the fix was made against:

- The fix starts with the files at the root, and reads a directory's files the
  first time it reads a file under that directory.
- Each reviewer reads the files at the root and in each directory above a file
  the fix changes, and reports where the fix breaks a convention that bears on
  it.
- A revision reads the same files, from the same commit, never from the pull
  request's branch.

LavaFlow loads guidance only from your project's own files: never from a
`vendor`, `third_party`, or `node_modules` directory, or anything below one,
even when a guidance file imports it with `@path`. It reads at most 32 KiB of each file, 32 files, and 128 KiB in a run. It treats
the files as your repository's conventions, such as how it tests a change. They
rank below LavaFlow's own rules and can't change them: what a fix may change,
what LavaFlow redacts, whether its commit skips CI, and whether its pull
request opens as a draft.

### Tests and claims

When your repository tests the code a fix changes, the fix comes with a
regression test: a case that fails without the fix and passes with it, written
with your existing tests in their framework and style. LavaFlow doesn't add a
test framework, dependency, or configuration for it.

LavaFlow checks this itself, besides its reviewers. A file counts as a test
by its name or its directory, whatever test runner you use:

- a test's name: `*.test.*`, `*.spec.*`, `*.it.*`, `*.e2e.*`, `*_test.*`
  (Go's `_test.go` included), pytest's and unittest's `test*.py` (Django's
  `tests.py` included), `*_spec.rb` and `test_*.rb`, `*Test.java`,
  `*Tests.java`, `*Test.kt` and `*Tests.cs`, and Node's `test-*.js`,
  `*-test.js` and `test.js`
- a code file under a `__tests__`, `test`, `tests`, `spec`, `specs` or `e2e`
  directory, outside a `helpers` or `support` directory within it, unless its
  name says it supports tests: `setup.js`, `utils.ts`, `test-utils.js` or
  `cart-helpers.js`, for example. A test named after the module it tests,
  such as `__tests__/stringUtils.js`, counts, and so does
  `src/helpers/__tests__/formatDate.ts`.

A file with a test's name counts whatever else its name says, so pytest's
`test_helpers.py` and `spec/helpers/orders_helper_spec.rb` are tests. A
script directly under `__tests__` with the name of a file the fix changes is
that file's test, whatever its name says: `src/__tests__/utils.ts` counts for
`src/utils.ts`, as Jest runs it. A file under `fixtures`, `__fixtures__`,
`__mocks__`, `mocks` or `testdata`, or whose name starts with `_`, never
counts, and nor do Ruby's `test_helper.rb`, `spec_helper.rb` and
`rails_helper.rb`. Go counts only `_test.go` files outside `testdata`. In a
Next.js, Nuxt or Remix project, a file under its `app/` or `pages/` routes
counts only with a test's name, or in `__tests__`: the framework serves the
rest.

LavaFlow reads no runner's configuration to decide. The rule may count a
file your runner doesn't run, which leaves that file for reviewers to judge,
but it never rejects a test with a common name or in a common place. A test
whose custom name only your configuration gives, outside a directory of
tests, such as a Jest `testMatch` of `*.check.ts`, doesn't count.

A changed test counts only when the fix changes its code: its lines of code,
in order, differ. Blank lines and one-line comments, such as `// TODO` or
`# TODO`, don't count. So adding, removing or reordering a line counts,
including removing a `t.Skip` call or an `@pytest.mark.xfail` marker, which
turns the test back on. Renaming a test, emptying it, adding an empty file,
or changing only whitespace or such comments tests nothing new. LavaFlow
reads each line alone, so a docstring or a comment over several lines counts
as code. In a test file with a string that can run over lines, such as a
Python `"""` string, a JavaScript template literal or a Ruby heredoc, a line
that looks like a comment may be test input, so every line counts as it is,
blank lines and whitespace included. LavaFlow's reviewers judge whether the
changed test exercises the change.

Your repository tests a source file when it has a test in the usual place for
that file:

| Source                | Test                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/sync.ts`         | `lib/sync.test.ts`, `lib/sync.spec.ts`, `lib/sync-test.ts` or `lib/sync_test.ts`, the same in `lib/__tests__/`, or `lib/__tests__/sync.ts`, with any JavaScript or TypeScript extension |
| `sync/sync.go`        | `sync/sync_test.go`                                                                                                                                                                     |
| `app/sync.py`         | `app/test_sync.py`, `app/sync_test.py`, or `app/tests/test_sync.py`                                                                                                                     |
| `app/models/order.rb` | `app/models/order_spec.rb`, `app/models/order_test.rb`, `app/models/test_order.rb`, `spec/models/order_spec.rb`, or `test/models/order_test.rb`                                         |

Or, when the file has no test of its own, its project has one of these:

- a test in the file's language anywhere in the project, outside any project
  nested in it
- a `package.json` with a `test` script other than npm's placeholder, or with a
  test runner such as `jest`, `vitest`, `mocha` or `@playwright/test` among its
  dependencies
- a runner's configuration, such as `jest.config.ts`, `vitest.config.ts`,
  `.mocharc.yml`, `pytest.ini`, `conftest.py` or `.rspec`, `pytest` in
  `pyproject.toml`, or a requirements file that installs `pytest`, in the
  file's directory or any directory above it

A file's project is the nearest directory above it with a `package.json`,
`pyproject.toml`, `setup.py`, `setup.cfg`, `go.mod`, or `Gemfile`, or else the
repository's root. A monorepo root's `test` script doesn't count for a
workspace with a `package.json` of its own.

When a fix changes such a file and no test, LavaFlow asks for the test as the
fix is written, up to twice, before any review round. A fix that still changes
no test doesn't pass a review round, and LavaFlow revises it to add one.

A fix can instead give one of these reasons. Reviewers judge it, and block the
fix when a test could still cover the change.

| Reason              | Meaning                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `needs_new_harness` | Reaching the changed branch needs test infrastructure your tests don't have, such as a fake for an outside service. |
| `not_observable`    | The change has no effect a test can observe.                                                                        |

With `autonomy: merge`, LavaFlow doesn't merge a fix of code your repository
tests that changes no test and gives one of these reasons: it holds the fix
for you with `no_test` (see [Waiting and held](#waiting-and-held)), and may
start its CI once as it holds it. A fix of code nothing in your repository
tests, as in a repository with no tests, merges as before, whatever reason it
gives. With `open_pr`, every fix opens as a draft, as before.

Code nothing in your repository tests needs no test, and LavaFlow doesn't add
one. The pull request's description says which case applies under **Tests**:

```markdown
## Tests

LavaFlow added no test: nothing in the repository tests the code this fix changes.
```

On a private repository, the section lists the tests the fix adds or changes,
or follows the reason with the fix's own explanation. On any other repository,
it is one line that gives only the reason. For a repository too large for
LavaFlow to read whole, where it found no tests for the changed code, the
section says so instead of claiming the code is untested.

Documentation and configuration never need a test, including configuration
written as code, such as Django's `settings.py`, and a change to a tool's
existing configuration or test setup, such as `next.config.js`,
`jest.config.ts`, or `conftest.py`. A file the fix creates with such a name
counts as code. A test counts only when the
fix changes its content: a change that leaves a test as it was, or a change to a
fixture or data file among the tests, doesn't. Reviewers also check that
the fix is as narrow as its cause, that each claim the diagnosis or the fix's
comments make, such as that a record can never succeed, holds in the code that
decides it, and that the comments say what the code does.

### Your repository's checks

A run's `repository_checks` says whether LavaFlow ran your repository's own
checks, such as its tests, on the fix itself, and what they found:

```json
{
  "repository_checks": {
    "status": "failed",
    "message": "LavaFlow ran the repository's checks before opening this pull request, and they failed.",
    "commands": [
      { "command": "npm run lint", "status": "passed", "exit_code": 0 },
      {
        "command": "npm test",
        "status": "failed",
        "exit_code": 1,
        "output": "FAIL src/cart.test.ts\n  charges nothing for an empty cart\n    Expected: 0\n    Received: 12.5"
      }
    ]
  }
}
```

| `status`          | Meaning                                                    |
| ----------------- | ---------------------------------------------------------- |
| `passed`          | Every command the checks ran passed                        |
| `failed`          | A command failed or timed out                              |
| `no_checks_found` | LavaFlow found no checks in your repository to run         |
| `not_run`         | LavaFlow didn't run your checks, for the `reason` it gives |

Treat a status you don't know as `not_run`. `message` is fixed text for the
status and reason that names the pull request when one opened, such as
`LavaFlow didn't run the repository's tests before opening this pull request.`
For a fix that opened no pull request, such as one held for its workflows, it
names none: `LavaFlow didn't run the repository's tests.`

When the checks didn't run on a fix whose pull request opened, `message` then
says what became of your CI on that pull request, as the run stands when you
read it:

| Second sentence                                                                                                                                   | When                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LavaFlow then started the repository's CI on the pull request.`                                                                                  | LavaFlow started your CI on the fix                                                                                                                                                                                                 |
| `LavaFlow then tried to start the repository's CI on the pull request; the pull request's checks show whether it did.`                            | LavaFlow tried, and the run doesn't record how that went, as for a held fix's one CI start                                                                                                                                          |
| `Its commit skips CI, and LavaFlow starts the repository's CI once it finds nothing that needs a person.`                                         | LavaFlow may still merge the fix, and nothing holds it yet                                                                                                                                                                          |
| `Its commit skips CI. LavaFlow may start the repository's CI on it once; if it doesn't, push a commit to the branch to run them.`                 | The fix opened held only for reasons that ask whether to merge it, such as `billing`, and LavaFlow hasn't checked its pull request since: it may start your CI once before handing the fix to you                                   |
| `Its commit skips CI. LavaFlow may start the repository's CI on it once merging resumes; if it doesn't, push a commit to the branch to run them.` | The merge is paused (`merge.reason` is `paused`), and nothing held the fix when it opened, or only reasons that ask whether to merge it did. LavaFlow carries on once merging resumes, or stops with `paused_too_long` after 7 days |
| `Its commit skips CI; push a commit to the branch to run them.`                                                                                   | LavaFlow won't start your CI: it doesn't merge this fix, the fix is held for a person or its merge stopped                                                                                                                          |
| `LavaFlow didn't start the repository's CI on it.`                                                                                                | The pull request merged or closed before LavaFlow started your CI                                                                                                                                                                   |

`reason` appears only with `not_run`, and says why:

| `reason`                     | Why LavaFlow didn't run your checks                        |
| ---------------------------- | ---------------------------------------------------------- |
| `dependencies_changed`       | The fix changes your repository's dependencies             |
| `dependencies_not_installed` | LavaFlow couldn't install your repository's dependencies   |
| `run_deadline`               | The run reached its time limit                             |
| `sandbox_capacity`           | No sandbox slot was free in time to run them               |
| `sandbox_budget`             | LavaFlow's sandbox allowance for checks was used up        |
| `sandbox_not_isolated`       | LavaFlow couldn't confirm the sandbox was isolated         |
| `sandbox_plan_limit`         | LavaFlow couldn't start a sandbox large enough to run them |
| `sandbox_unavailable`        | LavaFlow couldn't run them itself                          |
| `source_too_large`           | Your repository is too large to copy into a sandbox        |
| `source_unavailable`         | LavaFlow couldn't fetch the fix's source to check it       |
| `tool_unavailable`           | A tool your checks need isn't available                    |

More reasons may appear: treat one you don't know like any other `not_run`.

When your checks fail, LavaFlow may revise the fix once without running them
again. `revised` is then `true`, with `status` `failed`, and `status` and
`commands` describe the earlier version, not the fix as saved:

```json
{
  "repository_checks": {
    "status": "failed",
    "revised": true,
    "message": "The repository's checks failed on an earlier version of this fix. LavaFlow revised the fix once and opened this pull request without running the checks again."
  }
}
```

`commands` lists each command the checks ran, in order, with its `status`
(`passed`, `failed`, or `timed_out`; treat one you don't know as `failed`) and
its `exit_code` (`null` when it gave none, as a command that timed out may
not). A command that failed or timed out also has `output`: the end of what it
printed, `""` when it printed nothing. `output` is absent when LavaFlow didn't
keep it. `commands` is absent when LavaFlow ran none, as with
`no_checks_found` and `not_run`.

When LavaFlow ran the checks more than once, `repository_checks` shows the
last time the run's last attempt ran them. A run whose last attempt didn't
run them reads `not_run`, even when an earlier attempt did, as when a retry
opens a fix an earlier attempt saved. So does a run that is still queued or
running. It is `null` for a run with no fix. It describes only what LavaFlow
ran itself: your CI may still run on the pull request after it opens. A fix whose review didn't pass says at the top of
its description that your tests haven't run on it.

Commands and their output are your repository's own text, so LavaFlow leaves
out what may contain a credential. A `command` reads
`LavaFlow left this command out because it may contain a credential`, and an
`output` reads `LavaFlow left this output out because it may contain a credential`,
when the text may contain a credential, holds one of your project's
[secret values](#read-a-reviews-findings), or is over 4,000 characters. Every
command and output reads so when the run is held with `possible_credential`.
`status` and `exit_code` always show.

## Name the project

Every LavaFlow endpoint names one project with `project_id`: a query parameter
on reads, a body field on writes. Write it as a hyphenated UUID, in either case.
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
  reads, and can still turn LavaFlow off with `{"enabled": false}`, Code
  Quality off with `{"code_quality": {"enabled": false}}`, skill learning off
  with `{"skill_learning": "off"}`, or several in one save, and
  `allow_ungated_workflows` off with LavaFlow or skill learning. Every other
  change is refused the same way.

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
| `code_quality`            | `enabled`: whether LavaFlow reviews the code each frontend production deploy changes; see [Code Quality](#code-quality)                                                         | `false`   |
| `custom_context`          | What LavaFlow should know about the project, such as its architecture. Up to 4000 characters                                                                                    | `""`      |
| `system_prompt`           | Instructions for LavaFlow's runs. Up to 4000 characters                                                                                                                         | `""`      |
| `allow_ungated_workflows` | Open a fix's pull request even where a workflow could run it with the repository's secrets before a person approves it. See [Allow ungated workflows](#allow-ungated-workflows) | `false`   |
| `skill_learning`          | `auto`, `review` or `off`: what LavaFlow does with a skill it learns. See [Learned skills](#learned-skills)                                                                     | `auto`    |

LavaFlow saves `custom_context` and `system_prompt`, but runs do not use them
yet.

`PATCH` changes only the settings you send; send `project_id` and at least one
setting. A setting you omit
keeps its saved value, or its default when the project never saved settings.
`PUT` takes the same body and answers a person the same way. It is
deprecated; use `PATCH`. `PUT` refuses every project access token.
`updated_at` is `null` until the first save. `updated_by` is the person who
made the last save. It is `null` when no person made it, such as a project
access token's save.

Only the project's owner changes the settings, signed in with a platform token,
while their account is active, except that a full-scope project access token
can turn Code Quality and `skill_learning` off with `PATCH`. `can_update` says
whether your credential can change the rest.

| Status | Code                  | Why                                                                                                                                                                                                                                                                                                                                   |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`  |                       | `project_id` is missing or not a UUID, a field is unknown, `autonomy` is not one of its values, a `merge_policy` field is invalid, or a text field is over 4000 characters                                                                                                                                                            |
| `400`  | `feature_unavailable` | The save sets `autonomy: merge` or changes `merge_policy` while the project's `lavaflow.merge` capability is unavailable, or turns `skill_learning` up while `lavaflow.skills` is unavailable                                                                                                                                         |
| `400`  | `feature_unavailable` | The save turns `code_quality` on while Code Quality is not available to the project                                                                                                                                                                                                                                                   |
| `401`  |                       | The request has no valid credential                                                                                                                                                                                                                                                                                                   |
| `403`  | `person_required`     | A full-scope project access token tried any change but [turning Code Quality off](#turn-code-quality-off) or turning `skill_learning` off, or MCP tried to change the settings                                                                                                                                                        |
| `403`  | `person_required`     | The save turns on `allow_ungated_workflows` or `code_quality`, turns `skill_learning` up, or changes a setting [Turn merging on](#turn-merging-on) lists, and the owner didn't make it with `volcano login` or a platform token that expires, or their GitHub account can't push to the project's repository, or the project has none |
| `403`  | `plan_required`       | The owner's plan does not include LavaFlow, or the save turns `code_quality` on and the plan allows no Code Quality findings                                                                                                                                                                                                          |
| `403`  |                       | A read-only project access token tried to change the settings, or the owner's account is read-only                                                                                                                                                                                                                                    |
| `403`  |                       | The owner's plan could not be read. Nothing was saved; retry                                                                                                                                                                                                                                                                          |
| `404`  |                       | The project doesn't exist, you can't read it, or it is being deleted                                                                                                                                                                                                                                                                  |
| `404`  | `feature_unavailable` | LavaFlow is not available to the project; see [Check availability](#check-availability)                                                                                                                                                                                                                                               |
| `409`  |                       | The settings, or the project's repository, kept changing while the save checked them. Nothing was saved; send it again                                                                                                                                                                                                                |
| `413`  |                       | The body is over 128 KiB                                                                                                                                                                                                                                                                                                              |
| `429`  |                       | The owner's GitHub push access was checked too often this hour. Nothing was saved; retry after `Retry-After`                                                                                                                                                                                                                          |
| `503`  |                       | The owner's GitHub push access couldn't be checked now. Nothing was saved; retry after `Retry-After`                                                                                                                                                                                                                                  |

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
    "message": "Link your project to GitHub to start automatically fixing your issues."
  }
}
```

| Code                  | Why                                                                                                                                                                                                             | What to do                                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `repository_required` | The project has no linked repository. With `autonomy` `open_pr` or `merge`, LavaFlow diagnoses issues but fixes none. If LavaFlow was turned on for a repository the project no longer links, it starts no runs | Link a repository. Turned on with none, LavaFlow fixes issues in the first one linked, unless the message asks you to turn it on again after the link. Linking the one it was turned on for resumes it |
| `repository_changed`  | The project is linked to a repository LavaFlow wasn't turned on for. LavaFlow starts no runs                                                                                                                    | Turn LavaFlow on again. The repository linked then is the one it fixes                                                                                                                                 |

Link a repository with `volcano git connect <git-url>`, or through the API with
`PUT /projects/{id}/git-connection`; see
[Bind the repository to a project](../projects/git-deploy.md#3-bind-the-repository-to-a-project).
LavaFlow turned on with no repository fixes issues in the first one the project
links, unless `fix_blocker`'s message asks you to turn it on again after the
link. Otherwise it works only in the repository the owner turned it on for, so
a project that links another reports `repository_changed`. Turn LavaFlow on
again as the owner:

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
serving when and where the issue was last seen. It never reads the uploaded
files. A deployment serves a few seconds before it reports it finished, so an
error a deploy throws as it goes live is read at that deploy's commit:

- For a function, a deployment serves a region once its rollout has updated
  that region. A deploy that adds a region reaches it first, while the other
  regions still run the previous code, so their errors read the previous
  commit until the rollout has updated them.
- For a frontend, a deployment serves once its rollout ends.

When a run starts while a deployment that may have thrown is still rolling out,
it waits for that deployment to finish first. A deployment that finished
before Volcano recorded its rollout also makes the run wait, usually for a few
seconds, unless Volcano saw it still building after the error. When the error
came while its region was changing over, either
deployment may have thrown it, so the run waits for the error to recur. A
deployment of the same commit as the one before it, such as a redeploy that
only changes variables, doesn't make the run wait, finished or not.

A run waits at most 10 minutes from its start, and for a recurrence, at most
10 minutes from the error. If LavaFlow still can't tell which deployment threw
the error, it reads neither one's code and diagnoses from the logs alone. A run
that would open a pull request ends with
`pull_request_skipped: source_unavailable` instead, with the reason
`deployment_unattributed`, and the error's next occurrence starts one more run.

The commit comes from one of these:

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

### Deploy code LavaFlow can read

To get fixes, deploy in one of these ways:

- Push to the linked repository's production branch, and let Volcano build it.
- Deploy with the CLI from a clean Git checkout: commit every change and push
  the commit to the production branch first. The CLI reports the checkout's
  commit, and Volcano checks it against the repository.

Each deployment's [`commit`](deployment-source.md#commit) shows whether
LavaFlow can read it. When the deployment that served an error can't be read,
the run diagnoses from the logs alone and ends with
`pull_request_skipped: source_unavailable`. The run's
[`source_unavailable.reason`](#why-lavaflow-read-no-code) says why:

| The deployment that served the error                                                                                                              | `reason`              |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Has no `commit`, as for an upload from outside a Git checkout                                                                                     | `no_commit`           |
| Has `dirty: true`: the uploaded files differ from the commit, as when the checkout had uncommitted changes                                        | `uncommitted_changes` |
| Has `dirty: false` and `verification: none`: Volcano couldn't verify the commit, for example because it was never pushed to the production branch | `unverified_commit`   |

A redeploy reports no commit of its own, so the reason is its build's. A
function redeploy of a `verification: repository` upload is
`unverified_commit`: LavaFlow reads that commit only for the upload itself.

LavaFlow reads only the deployment that served the error, never a later one.
After you deploy code it can read, the error has to happen again on that
deployment. An issue whose runs all ended with `source_unavailable` then
starts a new run when it's seen again a few minutes after the deploy; see
[When runs start](#when-runs-start).

## Read a fix's pull request

On a private repository, the pull request's description holds the diagnosis,
the suggested fix and the review. On any other repository, the description
leaves the diagnosis out: read it in the Volcano dashboard, with
`volcano cloud lavaflow show <run-id>`, or from
[`GET /lavaflow/runs/{run_id}`](#follow-runs).

If the review didn't pass, a warning leads the description. On a private
repository, it counts the open findings by severity and points to **Review**
below. On a public or internal repository, it gives the command to read the
review instead. The warning gives the CI steps once; the footer doesn't repeat
them. The review table counts blocking findings from both reviewers and
LavaFlow's own test check. **For a person to decide** labels each question with
what to check, such as its effect on payments or access. If a saved question
ends mid-sentence, LavaFlow shows only complete sentences and asks you to review
the change in **Files changed**.

The diagnosis can quote your logs, so LavaFlow checks each field before
publishing it. When masking would replace a value, the description leaves
the whole field out and points to the pull request changes and run details.
If either an evidence item's location or its detail needs masking, the
whole item is left out. Other readable fields, the review verdict and test
status stay present. Run details may also withhold credentials.

Prose outside code blocks can show these values as written:

- code, strings and whole numbers that appear whole in a file the fix
  changes, a file the diagnosis cites, or the fix itself, such as
  `coupon.expires` or `0`;
- a random-looking identifier declared at the top level of a complete,
  parseable JavaScript file (`.js`, `.cjs` or `.mjs`): a named function or
  class, or a single-name `const`, `let` or `var` declaration. A name found
  only in a string, comment, call or unsupported syntax stays masked;
- a line number in one of those files, as in `line 15` or `quote.js:15`;
- an HTTP status code from `100` to `599` where the words around it say it is
  one, as in `returns status 500`, `responded with HTTP 403`,
  `answered HTTP 404`, `HTTP 404`, `status code 503`, `a 500 error`, `404 Not Found` or
  `res.status(500)`. Any other number in that range, such as an amount, a
  count or an ID from your logs, stays masked, as in `returns 250 rows`,
  `responded with 120 items`, `answered with 250 rows`, `312 error responses`
  or `Status 250 items`.

The suggested fix prints as a code block only when it needs no masking
and its backticks and tildes pair up. Otherwise the description points to
the actual fix in **Files changed**. The same rule applies to fields that
hold code blocks, unpaired backticks or text that reads differently than
it's spelled, such as fullwidth or invisible characters.

These values prevent the affected field from being shown even when your
code holds them:

- values that look like credentials or keys, and random-looking tokens and
  IDs apart from the declared code names above;
- any value or line number that holds one of your project's secret values,
  or is part of one. A secret value shorter than four bytes, such as `1`
  or `us`, masks a value or line number only when it is part of that
  secret value or holds it as a separate word, which a hyphen or an
  underscore also ends: `10` masks `1`, `rounds=10` and `pin-10`, but not
  `1024`. A secret value is any variable whose
  name may hold a credential, such as `DB_PW`, and any password in a URL;
- email addresses, URLs, IP addresses, and `localhost`;
- host names under a public top-level domain in any script, such as
  `api.example.com`, `myapp.herokuapp.com`, `пример.рф` or `example.भारत`,
  or under a private name such as `.local`, `.internal`, `.corp`, `.home` or
  `.lan`;
- any name in a host's place, as `db` is in `psql -h db`, `mysql -hdb`,
  `host=db`, `DB_HOST=db` or `hosts: ['db']`, including a list or list items
  under a host key on later lines, and any value whose line, or one of the
  two lines before it, mentions a host at all, as `DB_HOST := 'db'` does;
- UUIDs, dates and times, including a day or year beside a month's name,
  as in `Nov 7, 2026`, `Nov-7-2026` or `7/Nov/2026`;
- every part of an IPv6 address, as in `fd00::42`;
- numbers of six or more digits, decimals, including the digits after a
  leading dot, as in `.75`, numbers written with a leading zero, and every
  group of a number in digit groups, such as `4111 1111`.

A credential that looks like ordinary code isn't detected by its shape. So a
description shows code and strings from your repository only when nothing in
it names a credential, a host or a command line, even spelled with
fullwidth or invisible characters, and only when it is plain ASCII apart
from en and em dashes, which print as hyphens. An accented word such as
`café`, a word in another alphabet, an emoji or other symbol, or
punctuation or a space outside ASCII, such as a curly quote or a no-break
space, masks every value. So does an escaped or encoded character anywhere
in the description, such as `\u0061`, `%61` or `&#97;`. When anything in the diagnosis, the review or the issue's
title names a credential, a host or a command line, holds a value the
description masks as a credential, or holds a CI-skip directive, every value
in the description stays masked. A command line is any option, such as `-h`, `-w` or `--password`, a
line that starts with a shell prompt, such as `$`, `>`, `#`, `%` or `PS>`, or
a code block marked as a shell session, such as `sh`, `bash`, `console` or
`powershell`. Common words count: a description that mentions a `token` or
`localhost`, or runs `mkdir -p`, shows none of your code's values. Ordinary
prose such as `passed an empty collection` does not name a password. Bare
`pass`, `auth` and names such as `http_auth_mode` still count. A quoted value
also stays masked when:

- its line, or one of the two lines before it, has a name that may hold a
  credential, such as `apiKey`, `dbpass`, `PGPASSWORD`, `token`, `dsn`,
  `sessionId`, `LICENSE`, `SLACK_WEBHOOK_URL`, `accountSid` or `nonce`, or
  `/p` after `schtasks`, `runas` or `net use`, whatever stands between the
  name and the value. A code fence's line doesn't count as one of the two, so
  a name just before a code block covers the block's first lines;
- a credential was masked on one of those lines;
- it's in a piece of evidence or a review finding whose location or file
  names a credential or a host, as `src/auth.js` does, or the other way
  round;
- it sits inside a URL or is joined to an address.

A host name with no dot that nothing names as a host, such as `db`, can show.
On a private repository, the pull request's title and commit message keep
the same repository values as its description. They mask those values when
the title itself or the description mentions a credential or host. On other
repositories, titles and commit messages keep their existing masking.

```text
The quote handler crashes for a coupon with no expiry, such as `SAVE10`.
Line 15 calls `coupon.expires.localeCompare(today)` without checking that
`coupon.expires` exists.

LavaFlow left this section out because it quotes values this description masks.
Review the pull request changes and the run details.
```

## Find LavaFlow's pull requests

Every pull request LavaFlow opens carries the `Volcano LavaFlow` label. Search
your repository's pull requests for it:

```text
is:pr label:"Volcano LavaFlow"
```

On a private repository, the pull request also carries `lavaflow/<category>`,
the run's category, and its description names the category. A pull request on a
repository that isn't private gets neither.

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
reviewers pass it, its required checks pass, and nothing holds it. It merges
only into a base branch that requires at least one status check: on any other,
it holds every fix with `no_required_checks`. See
[Require a status check before LavaFlow merges](#require-a-status-check-before-lavaflow-merges).
With
`open_pr`, LavaFlow opens each fix as a draft pull request, where the
repository's GitHub plan offers drafts, and never merges it: mark it ready for
review, then review and merge it like any other. Merging needs the project's `lavaflow.merge` capability. While it
is unavailable, a new fix opens its pull request as under `open_pr`, and
LavaFlow never merges it. A merge that was already waiting gets `reason`
`paused`. LavaFlow takes a queued fix out of the merge queue, so it shows
`waiting_for_checks`, and queues it again when the capability is back.

Turning on merge lets LavaFlow's fixes, including those from runs it starts on
its own, run your CI with the secrets your pull request workflows get. To
start that CI, LavaFlow may force-update the fix's branch while it still holds
only LavaFlow's commits; see [Check before CI starts](#check-before-ci-starts).
Under `open_pr`, a fix's commits skip CI.

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

### Require a status check before LavaFlow merges

LavaFlow merges a fix only when its base branch, usually your production
branch, requires at least one status check, so a check GitHub enforces vouches
for every fix it merges. On a branch that requires none, LavaFlow holds every
fix with `no_required_checks`, and saving `autonomy: merge` doesn't warn you.

Require a check your CI runs on pull requests, such as a `test` job, with a
branch ruleset:

1. In your repository on GitHub, open **Settings** > **Rules** >
   **Rulesets**, then choose **New ruleset** > **New branch ruleset**.
2. Name it, set **Enforcement status** to **Active**, and under **Target
   branches** add your production branch, such as `main`.
3. Turn on **Require status checks to pass**, choose **Add checks**, and add
   the name your pull request workflow's job reports, such as `test`. Leave
   **Require branches to be up to date before merging** off: LavaFlow doesn't
   update fix branches, so it stops a fix whose base branch requires that, with
   `branch_behind`.
4. Leave the Volcano GitHub App off the ruleset's bypass list. LavaFlow holds
   every fix on a base branch whose rules it can bypass, with `rules_bypass`.
5. Choose **Create**.

Or create the same ruleset with the GitHub CLI:

```bash
gh api -X POST repos/acme/storefront/rulesets --input - <<'EOF'
{
  "name": "Require CI",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "test" }]
      }
    }
  ]
}
EOF
```

A branch protection rule works too: in **Settings** > **Branches**, add a rule
for the branch, turn on **Require status checks to pass before merging**, and
add the check. GitHub lists a check there once it has reported on the
repository recently, so run your workflow on a pull request first.

LavaFlow's commit skips CI, so the check doesn't run when the fix opens. Once
the fix's review passes and nothing holds it, LavaFlow starts its CI; see
[Check before CI starts](#check-before-ci-starts).

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

The owner makes these changes signed in as a person: with a `volcano login`
token whose sign-in is live, or a platform token that expires. Your GitHub
account must also be able to push to the project's repository;
[checking the owner's access](../projects/git-deploy.md#check-that-the-owner-can-push)
says why it can't. These get `403` with code `person_required`, and nothing is
saved:

- A project access token, or a request through MCP
- A platform token that never expires
- A `volcano login` token whose sign-in ended
- An owner whose GitHub account can't push to the project's repository
- A project with no repository; [link one](#link-a-repository) first

Anyone other than the owner can't save the settings at all. Apart from the
re-send that lets LavaFlow's own runs merge, sending the saved values again
changes nothing and needs no check.

`merge` belongs to the repository the project points at when you turn it on,
through the Volcano GitHub App installation it's connected with. When the
project points at another repository, reaches its repository through another
installation, or points at none, `autonomy` changes to `open_pr`. Reconnecting
after you reinstall the App counts as another installation. Pointing it back
doesn't turn merging on again: turn it on again yourself.

### Waiting and held

A fix that only waits, for its checks or a merge queue slot, keeps moving, and
LavaFlow merges it when the wait ends. A held fix is yours for good: LavaFlow
never merges, pushes to, rebases or dequeues it again. The run's
`hold_reasons` say why. Review it and merge it on GitHub if you want it, or
close it.

A fix that needs a person when its pull request opens shows
`waiting_for_checks`, with no `hold_reasons`, until LavaFlow's first read
about a minute later (longer while merging is paused); LavaFlow never merges
it, and that read records it as `held`, starting its CI once first when every
reason asks only whether to merge the fix, as described below.

LavaFlow may start a held fix's CI once, as it holds the fix, when every
reason asks only whether to merge it, not whether your CI may run it. It
starts it the way it starts CI on a fix nothing holds (see
[Check before CI starts](#check-before-ci-starts)), so you review the fix with
its checks, and its hold comment says whether it did. Those reasons are:

- `billing` and `breaks_contract` from LavaFlow's reviewers
- `repository_requires_approval`
- `rules_bypass`
- `commit_convention`
- `no_test`
- `unchecked_rules`, when every such rule governs only what merges: required
  signatures, resolved review threads, commit message and author or committer
  email patterns, and file path, extension, path length and file size limits

Any other reason keeps the fix's CI from starting, a `workflows`,
`code_scanning` or `required_deployments` rule included. LavaFlow never adds
a held fix to a merge queue. When LavaFlow starts or tries to start the fix's
CI as it holds it, the hold comment says what happened and how to merge the
fix so CI runs on what merges: after a clean copy, any merge method; after a
commit on top, a merge commit, a rebase, or a squash with a message of your
own. It doesn't mention CI LavaFlow started on the fix before it held it; the
pull request's checks show that.

LavaFlow holds a fix for these reasons:

| Code                           | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`                         | It changes a path in `human_review_paths`, as the settings were when its pull request opened or as they are now, or deploy or infrastructure configuration                                                                                                                                                                                                                                                                                                                                                                                                          |
| `sensitive_path`               | It changes another path Volcano always holds: authentication code, secret files, agent instructions, CI, dependencies or configuration; see below                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `label`                        | The pull request has the `needs-human-review` label                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `client_reported_commit`       | The fix is built on a commit Volcano can't tie to a push                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `no_checks`                    | No CI ran on it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `required_check_skipped`       | A required check was skipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `no_required_checks`           | The base branch requires no check, so passing checks alone don't vouch for the fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `changes_requested`            | A reviewer requested changes on GitHub                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `repository_requires_approval` | The repository requires an approving review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `person_commits`               | Someone other than LavaFlow pushed to the fix's branch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `rules_bypass`                 | The Volcano GitHub App can bypass a ruleset on the base branch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `unchecked_rules`              | The base branch has a rule LavaFlow doesn't check, such as required signatures                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ungated_workflows`            | The fix opened past workflows that can run it with the repository's secrets before a person approves it, as the project's owner allowed, or LavaFlow couldn't check its workflows; see [Allow ungated workflows](#allow-ungated-workflows). Or, when LavaFlow was about to start its CI or add it to a merge queue, a workflow could run it with those secrets, or LavaFlow couldn't read one; see [Check before CI starts](#check-before-ci-starts). Or another reason held the fix before its CI started, and that check found such a workflow or couldn't finish |
| `ci_outside_actions`           | When LavaFlow was about to start its CI, the repository could run CI or previews outside GitHub Actions; see [Check before CI starts](#check-before-ci-starts)                                                                                                                                                                                                                                                                                                                                                                                                      |
| `commit_convention`            | LavaFlow can't write a title that meets your repository's [commit convention](#match-your-commit-conventions)                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `lineage_undoes_parent`        | The fix follows up an earlier LavaFlow fix and deletes or changes lines that fix added; see [Fix lineage](#fix-lineage)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `lineage_cap`                  | The fix's lineage opened as many pull requests as it may; see [Fix lineage](#fix-lineage)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `lineage_held`                 | An earlier pull request in the fix's lineage was held, stopped or closed; see [Fix lineage](#fix-lineage)                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `recent_regressions`           | Fixes LavaFlow merged in the project recently caused new errors; see [Fix lineage](#fix-lineage)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `no_test`                      | LavaFlow added no test, because testing the change needs test infrastructure your repository doesn't have or the change has no effect a test can observe, though your repository tests the code it changes. Check whether a test could cover the change; merge if the reason holds. See [Tests and claims](#tests-and-claims)                                                                                                                                                                                                                                       |
| Any other code                 | One of LavaFlow's reviewers raised a concern, or its review was cut short; the code names it                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Volcano always holds a fix that changes deploy or infrastructure configuration
with `path`: `volcano-config.yaml`, Terraform, CloudFormation and Kubernetes
files, and these wherever they are:

- A YAML or JSON file that declares a resource with `apiVersion` and `kind`
- A YAML file, or a JSON file that isn't a stream of JSON objects to its end,
  that doesn't parse as YAML; a YAML or JSON file that has a `%TAG` directive
  or is too dense to read; or a YAML template that mentions either key
- A file in or under a directory with a Helm chart's `Chart.yaml` or a
  `kustomization.yaml`
- A YAML, JSON or `.tpl` file under a `templates` directory that uses template
  syntax

When a repository is too large for LavaFlow to read in full, every file a fix
changes holds. A file that no other path reason holds, including
`sensitive_path`, holds with `path`, and its question says the repository was
too large to read in full.

It holds a fix that changes any of these with `sensitive_path`:

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
`convention_unsatisfiable`. A fix whose title can't carry the scope a
repository that isn't private requires opens, and LavaFlow holds it with
`commit_convention` before its checks start.

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
      "question": "Changes db/migrations/0042_orders.sql, which matches db/migrations/** in this project's human_review_paths.",
      "paths": ["db/migrations/0042_orders.sql"]
    }
  ],
  "merged_by_lavaflow": null
}
```

| `status`             | Meaning                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `waiting_for_checks` | Waits for the checks on the fix's commit                                                                                     |
| `queued`             | In the repository's merge queue                                                                                              |
| `merged`             | Merged; the run's `pull_request.state` is `merged`                                                                           |
| `held`               | Handed to you for good, for `hold_reasons`; each `question` says why LavaFlow holds it and what to check before you merge it |
| `stopped`            | LavaFlow left the pull request open for you, for `reason`                                                                    |

Once `status` is `merged`, `merged_by_lavaflow` says who merged the fix:
`true` when LavaFlow merged it, directly or through the merge queue, and
`false` when someone else merged the pull request while LavaFlow waited. It is
`null` until then, and stays `null` for a fix LavaFlow held or stopped, even
after you merge it.

`reason` says why a merge stopped, or what a waiting merge is paused for. A
stopped merge leaves the pull request open for you, and LavaFlow never merges,
pushes to, rebases or dequeues it again. Unless the table says otherwise,
review the change, then merge or close the pull request yourself.

| `reason`                   | Why LavaFlow stopped, and what to do                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handed_off`               | Someone drafted or closed the pull request, or moved it to another branch, so LavaFlow stopped. Nothing to do                                                                                                                                                                                                                                                    |
| `review_unresolved`        | LavaFlow's review didn't pass the fix; the run's [`review`](#why-a-review-stopped) says why. Finish the fix yourself, or close the pull request                                                                                                                                                                                                                  |
| `settings_changed`         | The project's settings no longer let LavaFlow merge: LavaFlow was turned off, `autonomy` is no longer `merge`, the owner's plan no longer includes LavaFlow, or the project is being deleted. Turning merging back on doesn't resume this fix                                                                                                                    |
| `checks_failed`            | A check on the fix failed. Its details are on the pull request                                                                                                                                                                                                                                                                                                   |
| `checks_timed_out`         | The checks didn't all finish within 24 hours. A required check pinned to a GitHub App counts only as that App's check run                                                                                                                                                                                                                                        |
| `blocked_by_rules`         | A rule of the repository that LavaFlow can't satisfy blocks the merge                                                                                                                                                                                                                                                                                            |
| `not_mergeable`            | GitHub can't merge the pull request, for example because it conflicts with its base branch. Resolve the conflict first                                                                                                                                                                                                                                           |
| `branch_behind`            | The base branch requires pull requests to be up to date with it and has no merge queue. LavaFlow doesn't update fix branches, so update the branch first                                                                                                                                                                                                         |
| `removed_from_queue`       | The fix isn't in the merge queue, and LavaFlow can't tell why: its checks may have failed there, or someone removed it                                                                                                                                                                                                                                           |
| `reads_failed`             | LavaFlow failed to read the pull request for about an hour while the fix may have been in the merge queue, so it took the fix out of the queue, or failed to read the project's settings or repository for about a day while merging was paused. When it couldn't reach the pull request to take it out, its comment says the fix may still merge from the queue |
| `unreadable`               | The pull request has more checks, reviews, labels or commits than LavaFlow reads, so it can't judge the fix                                                                                                                                                                                                                                                      |
| `permission_missing`       | The Volcano GitHub App, or the owner's GitHub account, lacks a permission the merge needs. Grant the App's requested permissions; the owner must be able to push                                                                                                                                                                                                 |
| `repository_changed`       | The project now deploys from another repository                                                                                                                                                                                                                                                                                                                  |
| `paused_too_long`          | Merging stayed paused for more than 7 days                                                                                                                                                                                                                                                                                                                       |
| `cancelled`                | The project is being deleted, so LavaFlow stopped waiting on the merge. Nothing to do                                                                                                                                                                                                                                                                            |
| `request_rejected`         | GitHub refused LavaFlow's request to start the fix's checks. Push a commit to the branch to run your CI                                                                                                                                                                                                                                                          |
| `ci_start_commit_mismatch` | GitHub reports a different commit from the one LavaFlow made to start the checks, so LavaFlow didn't move the branch. Push a commit to the branch to run your CI                                                                                                                                                                                                 |
| `branch_refused`           | LavaFlow didn't start the fix's checks because the pull request was no longer open, or its branch isn't a LavaFlow branch of a pull request LavaFlow opened. LavaFlow never starts checks on the default or production branch                                                                                                                                    |
| `head_unverified`          | GitHub doesn't report the fix's head as the signed commit LavaFlow pushed, so LavaFlow didn't start its checks. Check who pushed to the branch                                                                                                                                                                                                                   |
| `checks_not_started`       | LavaFlow couldn't give the fix a commit message that runs CI. Push a commit to the branch to run your CI                                                                                                                                                                                                                                                         |
| `queue_carries_ci_skip`    | The repository's merge queue could carry an instruction to skip checks, from the fix's commits or its pull request's title or description, into the base branch. Reword LavaFlow's commit to drop it and force-push, and take any such instruction out of the title and description, before you queue the fix                                                    |
| `merge_carries_ci_skip`    | A commit under the fix's head skips checks, and merging would carry that into the base branch, for example because the repository allows no squash merge. Reword LavaFlow's commit to drop it and force-push before you merge                                                                                                                                    |

New reasons may appear.

While merging is paused, a waiting merge gets `reason` `paused`. LavaFlow takes
a queued fix out of the merge queue, so it shows `waiting_for_checks`, and
queues it again when merging resumes. A fix that merged into a project that
doesn't deploy it automatically gets `reason` `manual_deploy`: deploy it to
ship the fix.

LavaFlow doesn't bill merges.

### Keep the CI skip out of your base branch

LavaFlow's commit on a fix branch can carry a CI-skip directive, so your CI
doesn't run code a model wrote before a person looks at it. When LavaFlow
[starts the fix's CI](#check-before-ci-starts), it force-updates its own fix
branch where it can, replacing its commits with one that has the same changes
and no directive. Otherwise it adds a commit on top, and the directive stays
in the commit below. To keep it out of your base branch, reword LavaFlow's
commit to drop the directive and force-push, or squash the fix with a message
of your own. Rebased, the commit becomes the head of the push to the base
branch; squashed with its commit messages, as GitHub does by default, the
directive is copied into the squash commit. Most CI services, GitHub Actions
included, then skip that push. Merged with a merge commit, or rebased with a
commit on top, the commit still lands in the base branch's history, where a CI
service that skips a push when any of its commits carries the directive, such
as Azure Pipelines, won't run.
No one can edit a merge queue's squash message: a queue that
squashes with the commits' messages lands the directive, even after you push a
commit to the fix. Before the fix enters the queue, replace LavaFlow's commit
with one whose message leaves the directive out, for example by rewording it and
force-pushing. Otherwise push-triggered workflows, such as deploys, don't run
for the merged commit. Run them by hand after it merges if they have a
`workflow_dispatch` trigger, for example with
`gh workflow run <workflow> --ref <base-branch>` or the **Run workflow** button
in your repository's Actions tab.

## After a fix merges

Once a fix's pull request merges, by you or by LavaFlow, LavaFlow watches the
resource's deployments from the repository for a week. When one that includes
the merge goes live, LavaFlow records the moment as the run's
`pull_request.deployed_at` and resolves the [issue](issues.md) as of that
moment, unless the error was seen after it. Where
[fix lineage](#fix-lineage) is available, LavaFlow waits 2 minutes and resolves
the issue as of then instead, so errors from instances still running the old
code don't keep it open; `resolved_at` is 2 minutes after `deployed_at`. A
deployment whose
[reported commit](deployment-source.md#commit) has `verification: repository`
never counts, because Volcano didn't match its files against the commit.
[Resolve the issue](issues.md#resolve-or-ignore-an-issue) yourself, or deploy
the merge with a push to the repository.

If the error happens again, the issue reopens, as any resolved issue does. For
an issue with `exception: true`, LavaFlow then starts a new run on it, no
sooner than an hour after the issue's last run started. Reopening an issue
yourself doesn't start one.

## Start a run

LavaFlow starts runs on its own only while it is on, and only for issues with
`exception: true`. An issue grouped from messages, structured logs or printed
tracebacks never starts one. Of the issues LavaFlow passed over while it was
off, turning it on as the owner, with a `volcano login` token whose sign-in is
live or a platform token that expires, starts runs for up to 5, and each of the
others starts one when it's seen again;
[When runs start](#when-runs-start) says which. Start a run on any of the
project's issues yourself, as the project's owner:

```bash
volcano cloud lavaflow runs start <issue-id>
```

Or with the API:

```bash
curl -X POST "https://api.volcano.dev/lavaflow/runs" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "issue_id": "'"$ISSUE_ID"'"}'
```

The run is queued and answers `202`. It follows the project's settings, as a
run LavaFlow starts on its own does. [Follow it](#follow-runs) by its `id`:

```json
{
  "id": "7e2a4c1d-9b3f-4a6e-8d2c-5f1b0a9e3d47",
  "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
  "issue_id": "3f6c1a9e-6c1d-4f7e-9a51-2b8f0e4d7c21",
  "status": "queued",
  "resource": {
    "type": "function",
    "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "name": "checkout"
  },
  "title": null,
  "created_at": "2026-11-05T15:20:04Z",
  "finished_at": null,
  "pull_request": null,
  "merge": null,
  "progress": { "stage": "queued", "step": 1, "steps": 4 },
  "pull_request_skipped": null,
  "mode": "live",
  "category": null,
  "diagnosis": null,
  "diff": null,
  "review": null,
  "failure": null,
  "ungated_workflows": null
}
```

A run on a [Code Quality](#code-quality) issue is a Code Quality run, with
`mode` `code_quality`. It starts only while `lavaflow.code_quality` in the
project's `GET /capabilities` is available and Code Quality is on for the
project.

Starting a run is the owner's decision. Start one with a platform token that
expires, or `volcano login`. A platform token that never expires, a
`volcano login` token whose sign-in ended, a full-scope project access token,
and an agent through [MCP](#agents) get `403` with code `person_required`; a
read-only project access token is refused as read-only first. Every start
counts toward the run limits: 5 runs per issue and 200 per project in any 24
hours. A start that doesn't run answers a code:

| Status | `code`                      | Why                                                                                  | What to do                                             |
| ------ | --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `400`  | `feature_unavailable`       | The issue is a Code Quality issue, and Code Quality is not available                 | Wait until `lavaflow.code_quality` is available        |
| `403`  | `plan_required`             | The issue is a Code Quality issue, and the owner's plan doesn't include Code Quality | Upgrade the owner's plan                               |
| `404`  | `issue_not_found`           | The project has no issue with that ID                                                | Copy the ID from [the project's issues](issues.md)     |
| `409`  | `lavaflow_disabled`         | LavaFlow is off for the project                                                      | Turn LavaFlow on                                       |
| `409`  | `lavaflow_disabled`         | The issue is a Code Quality issue, and Code Quality is off for the project           | [Turn Code Quality on](#turn-code-quality-on)          |
| `409`  | `repository_required`       | The project no longer links the repository LavaFlow was turned on for                | Link it again, or turn LavaFlow on again               |
| `409`  | `repository_changed`        | The project links another repository than LavaFlow was turned on for                 | Turn LavaFlow on again to fix issues in the linked one |
| `409`  | `lavaflow_run_in_progress`  | The issue has a run in progress                                                      | Follow that run                                        |
| `429`  | `issue_run_limit_reached`   | The issue started 5 runs in the last 24 hours                                        | Try again after `Retry-After`                          |
| `429`  | `project_run_limit_reached` | The project started 200 runs in the last 24 hours                                    | Try again after `Retry-After`                          |

## Learned skills

A skill is a short note on how this project wants something done, with
citations of the code it rests on. Skills are in preview: they need the
project's `lavaflow.skills` capability.

This release stores a project's skills and gives you the API to read, edit,
retire and delete them. It saves the `skill_learning` setting, and checks
every change to a skill before saving it. These come in a later release:

- Learning a skill when a writer of the repository corrects one of
  LavaFlow's fixes, by a commit, a review or a comment on its pull request
- Loading the skills that apply into later runs on the project
- Expiring proposals no one acts on, and retiring a skill on its own when the
  fixes that used it were corrected or closed more often than they merged,
  when no writer renewed it for 90 days, or when its citations stop holding

Until LavaFlow learns skills, a project has none.

`skill_learning` decides what LavaFlow does with a skill it learns. You can
set it now, and it applies once learning ships:

| Value    | What happens                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------- |
| `auto`   | The skill is active at once                                                                         |
| `review` | The skill waits as `proposed` until you activate it                                                 |
| `off`    | LavaFlow learns nothing and runs load no project skill. Existing skills stay readable and deletable |

Once LavaFlow learns, a writer of the repository can steer it through what it
learns, and a skill lives outside the repository's history, branch protection
and code owners. Use `review` if the repository protects its guidance that
way, or if it relays CI output, such as bot comments, through an account with
write access.

Turning learning on is the owner's decision: from `off` to `review` or
`auto`, or from `review` to `auto`. The owner makes it signed in as a person,
with a `volcano login` token whose sign-in is live, or a platform token that
expires, and their GitHub account must
be able to push to the project's repository. Anything else gets `403` with
code `person_required`, and nothing is saved. Turning learning down or off, or
sending the saved value again, needs no check. Any credential that can change
the settings can turn it off, including a full-scope project access token,
which may send only this, or this with
[`code_quality` turned off](#turn-code-quality-off) too:

```bash
curl -X PATCH "https://api.volcano.dev/lavaflow/settings" \
  -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "skill_learning": "off"}'
```

A token's save that sends any other field, even `null`, answers `403` with
code `person_required`.

### Review skills

List the project's skills, filtered by `status` (`proposed`, `active` or
`retired`):

```bash
curl "https://api.volcano.dev/lavaflow/skills?project_id=$PROJECT_ID&status=active" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "id": "7a1c3e5b-9d2f-4b6a-8c0e-1f3a5b7d9c2e",
      "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
      "scope": "project",
      "name": "guard-empty-cart",
      "status": "active",
      "retired_reason": null,
      "version": 1,
      "description": "When a checkout handler reads the cart total",
      "body": "Return early when the cart is empty; `cart.total` is undefined then.",
      "applies_to": { "resource_ids": [], "paths": ["src/checkout/**"] },
      "citations": [{ "path": "src/checkout/charge.ts", "anchor": "cart.total" }],
      "content_sha256": "3b8f0c1d2e4a6b7c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
      "source": {
        "kind": "run",
        "run_id": "0d6e9b1a-2f4c-4e8d-9a7b-3c5d1e2f4a6b",
        "pull_request": 42,
        "act": "review",
        "user_id": null
      },
      "counts": { "helpful": 0, "harmful": 0, "used": 0 },
      "last_used_at": null,
      "last_renewed_at": "2026-11-02T14:20:05Z",
      "retired_at": null,
      "created_at": "2026-11-02T14:20:05Z",
      "updated_at": "2026-11-02T14:20:05Z"
    }
  ]
}
```

Read one with `GET /lavaflow/skills/{skill_id}`, and its earlier versions with
`GET /lavaflow/skill-versions?project_id=…&skill_id=…`. Any credential that can
read the project reads skills, including a read-only project access token.
`GET /lavaflow/global-skills?project_id=…` lists the skills Volcano wrote for
every project; they hold no customer content.

When the project points at another repository, or none, its skills retire
with `retired_reason: repository_changed`, since their citations name the old
one.
You can restore one. The reasons `harmful`, `unused`, `stale` and `gate` are
reserved for retiring on its own, which comes in a later release.

### Change, retire and delete skills

Only the project's owner changes a skill, signed in as a person: with a
`volcano login` token whose sign-in is live, or a platform token that expires.
Every change but retiring also needs the
owner's GitHub account to be able to push to the project's repository. A
change applies only the fields you send. Edit its `description`, `body` or
`applies_to`, or set `status` to `active` to activate a proposed skill or
restore a retired one:

```bash
curl -X PATCH "https://api.volcano.dev/lavaflow/skills/$SKILL_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "Return early when the cart is empty."}'
```

`applies_to` changes member by member. Send `paths` alone and the skill keeps
its `resource_ids`, and the reverse. A list you send replaces the saved one,
so `[]` clears it:

```bash
curl -X PATCH "https://api.volcano.dev/lavaflow/skills/$SKILL_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"applies_to": {"paths": ["src/checkout/**", "src/cart/**"]}}'
```

Send `{"status": "retired"}` to retire it, or delete it with
`DELETE /lavaflow/skills/{skill_id}`. Both work while `lavaflow.skills` is
unavailable, and for a project with no repository or whose owner can't push to
it; every other change answers `400` with code `feature_unavailable` while
`lavaflow.skills` is unavailable. A project keeps its 200 most recently retired skills: retiring another
deletes the oldest retired skill and its versions.

Each change but retiring passes the skill check. Only a change to the text
adds a version; activating or restoring doesn't. A skill keeps its 20 newest
versions and its active one, and the 1 MiB cap counts the text of every
version the project keeps. A change is refused, saving nothing and keeping
none of its text, when it holds a credential, the value of a project variable
whose name marks it as a credential, such as `STRIPE_SECRET_KEY` or
`DB_PASSWORD`, an email address, a link or host name the skill doesn't cite,
an invisible or control character, or an instruction to skip CI or weaken
tests, CI or LavaFlow's rules.

| Status | Code                  | Why                                                                                                                                                                                                                                                                                                                                  |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `400`  | `skill_refused`       | The check refused the text; `rules` names which rules it failed                                                                                                                                                                                                                                                                      |
| `400`  | `feature_unavailable` | The change does more than retire the skill while `lavaflow.skills` is unavailable                                                                                                                                                                                                                                                    |
| `403`  | `person_required`     | A full-scope project access token, MCP, or a credential that isn't the owner signed in made the request, such as a platform token that never expires or a `volcano login` token whose sign-in ended. For a change but retiring, also when the owner's GitHub account can't push to the project's repository, or the project has none |
| `403`  |                       | A read-only project access token made the request, or the owner's account is read-only                                                                                                                                                                                                                                               |
| `409`  | `skill_limit_reached` | The change would pass a cap: 100 active or 50 proposed skills, or 1 MiB of skill text                                                                                                                                                                                                                                                |
| `409`  |                       | Another change to the skill landed first, or the project now points at another repository; read it and send yours again                                                                                                                                                                                                              |
| `429`  |                       | More than 10 skill changes in a minute, the day's 200 checks are used, or the owner's GitHub push access was checked too often. Retry after `Retry-After`                                                                                                                                                                            |
| `503`  | `scan_unavailable`    | The check couldn't run. Nothing was saved; retry after `Retry-After`                                                                                                                                                                                                                                                                 |
| `503`  |                       | The owner's GitHub push access couldn't be checked. Nothing was saved; retry after `Retry-After`                                                                                                                                                                                                                                     |

## Follow runs

List the project's runs, newest first. Each run names its category, the issue
it works on, and every resource it involves. Narrow the list with the filters
below, and page with `limit` (default 25, at most 100) and `cursor`, set to the
previous page's `next_cursor`. A cursor continues only the list it came from:
the same project, read with the same credential, in the same `order`. Keep the
filters while paging.

```bash
curl "https://api.volcano.dev/lavaflow/runs?project_id=$PROJECT_ID&category=bug&days=30&include=counts" \
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
      "title": "Checkout crashes when the cart is empty",
      "created_at": "2026-11-02T14:10:02Z",
      "finished_at": "2026-11-02T14:13:47Z",
      "pull_request": {
        "number": 42,
        "url": "https://github.com/acme/shop/pull/42",
        "state": "open",
        "opened_at": "2026-11-02T14:13:44Z",
        "merged_at": null,
        "deployed_at": null,
        "draft": true,
        "draft_reason": "open_pr"
      },
      "merge": null,
      "mode": "live",
      "category": "bug",
      "resources": [
        {
          "resource": {
            "type": "function",
            "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            "name": "checkout"
          },
          "roles": ["issue", "cause", "fix"]
        },
        {
          "resource": {
            "type": "function",
            "id": "b7c8d9e0-f1a2-4b3c-9d4e-5f6a7b8c9d0e",
            "name": "payments"
          },
          "roles": ["cause"]
        }
      ],
      "issue": {
        "id": "3f6c1a9e-6c1d-4f7e-9a51-2b8f0e4d7c21",
        "title": "TypeError: Cannot read properties of undefined (reading 'total')",
        "culprit": "chargeCustomer (src/cart.ts)",
        "status": "open",
        "event_count": 18,
        "last_seen_at": "2026-11-02T14:09:51Z",
        "resolved_at": null,
        "regressed_at": null,
        "run_count": 1
      },
      "progress": null,
      "pull_request_skipped": null
    }
  ],
  "limit": 25,
  "has_more": false,
  "counts": {
    "total": 1,
    "status": {
      "queued": 0,
      "diagnosing": 0,
      "fixing": 0,
      "reviewing": 0,
      "pr_open": 1,
      "completed": 0,
      "failed": 0,
      "cancelled": 0
    },
    "category": {
      "bug": 1,
      "performance": 0,
      "security": 0,
      "improvement": 2,
      "configuration": 0,
      "dependency": 1,
      "external": 0,
      "uncategorized": 0
    },
    "pull_request_state": { "open": 1, "merged": 0, "closed": 0, "none": 0 },
    "involved_resources": [
      {
        "resource": {
          "type": "function",
          "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          "name": "checkout"
        },
        "runs": 1
      },
      {
        "resource": {
          "type": "function",
          "id": "b7c8d9e0-f1a2-4b3c-9d4e-5f6a7b8c9d0e",
          "name": "payments"
        },
        "runs": 1
      }
    ]
  }
}
```

| Filter                 | Keeps runs that                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `status`               | are in this status (table below)                                                                     |
| `category`             | are in this category (table below); `uncategorized` for runs without one                             |
| `resource_id`          | work on an issue from this function, durable function or frontend                                    |
| `involved_resource_id` | involve this resource in any role: the issue came from it, the cause is in it, or the fix changes it |
| `issue_id`             | work on this issue. An issue the project doesn't have answers `404` `issue not found`                |
| `pull_request_state`   | have a pull request in this state: `open`, `merged` or `closed`; `none` for runs without one         |
| `days`                 | were created in the last `days` UTC days, today included, at most 90. Omit it for every run          |

Filters combine. `order` is `created_at.desc` (the default), `created_at.asc`,
or `issue_events.desc`: the issue's current `event_count`, most first, then
newest first. That count grows as errors arrive or scans see a finding again,
so paging this order can skip
runs, not only move them between pages. To read every run, for an export say,
page `created_at.desc` or `created_at.asc`.

`include=counts` adds `counts`: `total` runs that match, and how many match per
`status`, `category`, `pull_request_state`, and involved resource (at most 50,
most runs first). Each breakdown applies every filter but its own, so it shows
what picking another value would list. Ask for counts on the first page; they
don't depend on the cursor. Involved resource counts come from each run's
`resources`, so for runs whose list came from what they saved, described below,
they can leave out frontends.

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

While LavaFlow still works on a run, `progress` says how far it has come:

| `progress.stage`     | The run is                                         |
| -------------------- | -------------------------------------------------- |
| `queued`             | Waiting to start                                   |
| `diagnosing`         | Finding the root cause                             |
| `fixing`             | Writing the fix                                    |
| `reviewing`          | Reviewing the fix; the pull request opens after it |
| `waiting_for_checks` | Waiting for its pull request's checks to pass      |
| `merge_queued`       | Queued to merge                                    |

`step` is the stage's place, from 1, among the run's `steps`: 2 for
`diagnose_only`, 4 for `open_pr`, and 6 for `merge`, the autonomy when the run
was queued. `progress` is `null` once LavaFlow has nothing left to do on the
run, including while a person decides on a held fix. New stages may appear.

A run's `category` is the kind of problem LavaFlow found. A
[Code Quality](#code-quality) run carries its finding's, `bug` or
`improvement`, from the start. Any other run's is `null` until the run records a
diagnosis. Runs from before categories get one when their
diagnosis names one or their saved fix's paths imply one, and stay `null` only
when neither does. LavaFlow assigns `dependency` or `configuration` itself when
every file the fix changes is a dependency manifest or lockfile, or a
configuration file. New categories
may appear; treat one you don't know as uncategorized.

| `category`      | The problem                                                      |
| --------------- | ---------------------------------------------------------------- |
| `bug`           | The project's code is wrong                                      |
| `performance`   | The code is too slow or uses too much                            |
| `security`      | The code exposes data or access it shouldn't                     |
| `improvement`   | The code mishandles an edge case or an outside failure           |
| `configuration` | A setting, variable, or manifest value is wrong or missing       |
| `dependency`    | A package, or its version, causes the error                      |
| `external`      | A service outside the project fails, and no code change is right |

`resources` lists every resource the run involves, the issue's first, then by
name. Its `roles` say how: `issue` (the issue came from it), `cause` (the issue
came from it, or code the diagnosis cites as evidence is in its source), and
`fix` (the diagnosis proposes changing its source, or the fix changes it). A
change to code every function shares involves every function. A run without a
diagnosis lists only the issue's resource, with the role `issue`.

For some runs, `resources` comes from what the run saved rather than from its
source: runs that ended before LavaFlow recorded involved resources, and runs
that stopped after their last attempt. Their lists name the functions whose own
files the diagnosis or fix names, and may leave out frontends and the functions
involved through shared code or the build root's dependency files. A resource
missing from such a run's list may still be involved.

`issue` is the issue as it stands now: its `title` (the error type and message,
a Code Quality finding's title, or a reported problem's title), its `culprit`
(the innermost frame of your code; for a Code Quality finding, the symbol and
file it is in; `null` for an error without a stack and for a reported problem),
`status`, `event_count` (errors grouped so far; for a Code Quality finding, the
scans that saw it; 0 for a reported problem),
`last_seen_at`, `resolved_at` while it is resolved, `regressed_at` once a
resolved issue came back, and `run_count`, every LavaFlow run on it.

A pull request's `opened_at` is `null` when the run opened it before LavaFlow
recorded the time. `merged_at` is when it merged, `null` unless `state` is
`merged`. Its `deployed_at` is when the merged fix went live, as
[After a fix merges](#after-a-fix-merges) describes, and is `null` until then
and for a pull request that didn't merge. When more than 20 deployments went
live between the merge and the one LavaFlow found the fix in, LavaFlow can't
tell which first included it, and `deployed_at` is the merge time.

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

A finished run that opened no pull request says why in `pull_request_skipped`,
so a `completed` run without `pull_request` always has a code. It is `null`
when the run opened one, while it is queued or runs, and when it failed or was
cancelled. Match on the code.

| `pull_request_skipped`     | Why, and what to do                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnose_only`            | `autonomy` was `diagnose_only` when the run was queued, or became it before a pull request opened. Read the diagnosis. For later runs to open pull requests, run `volcano cloud lavaflow settings set --autonomy open_pr`, or send `"autonomy": "open_pr"` to `PATCH /lavaflow/settings`                                                                                                                                                                  |
| `not_fixable`              | The diagnosis found no change in the code that fixes the error, for example because the cause is outside it. Read the diagnosis                                                                                                                                                                                                                                                                                                                           |
| `low_confidence`           | The diagnosis isn't confident enough to propose a fix. Read the diagnosis                                                                                                                                                                                                                                                                                                                                                                                 |
| `no_patch`                 | LavaFlow proposed no change. Read the diagnosis                                                                                                                                                                                                                                                                                                                                                                                                           |
| `possible_credential`      | The fix or its description held what looks like a credential or a project secret, so LavaFlow pushed nothing. Apply the fix yourself from the diagnosis                                                                                                                                                                                                                                                                                                   |
| `possible_personal_data`   | The fix adds an email address the repository lacks, and the repository isn't private, so LavaFlow pushed nothing. Apply the fix yourself                                                                                                                                                                                                                                                                                                                  |
| `ungated_workflows`        | A workflow could run the fix with the repository's secrets before a person approves it. The run's `held_workflows` lists every such job. See [Gate workflows that run a fix](#gate-workflows-that-run-a-fix), or [open the fix yourself](#open-a-held-fix-yourself)                                                                                                                                                                                       |
| `convention_unsatisfiable` | LavaFlow would merge the fix, but no title can meet your repository's [commit convention](#match-your-commit-conventions), so it kept the fix on the run. Apply the fix yourself, or relax the convention                                                                                                                                                                                                                                                 |
| `pull_request_open`        | When the run checked, before opening a pull request, another LavaFlow pull request for the issue was open, or merged and not yet deployed, so this run opened none. A fix it wrote stays on the run. That pull request may have closed since. Find it among the issue's runs with `GET /lavaflow/runs?project_id=…&issue_id=…`, then review it, or close it if you don't want it                                                                          |
| `source_unavailable`       | LavaFlow couldn't read, or open a fix on, the code that threw the error. The run's [`source_unavailable`](#why-lavaflow-read-no-code) says why. Once a later deploy records a commit LavaFlow can read, the issue starts a new run when it's seen again a few minutes later, once per deployment. For `deployment_unattributed`, the issue's next occurrence starts one more run without a deploy, once in a row. See [When runs start](#when-runs-start) |
| `permission_missing`       | The Volcano GitHub App, or the owner's GitHub account, lacks a permission LavaFlow needs. Grant the App's requested permissions; the owner must be able to push                                                                                                                                                                                                                                                                                           |
| `repository_changed`       | The project no longer deploys from the repository the run read. A new run uses the current one                                                                                                                                                                                                                                                                                                                                                            |
| `publish_failed`           | Opening the pull request failed. A new run tries again                                                                                                                                                                                                                                                                                                                                                                                                    |
| `lineage_cap`              | LavaFlow opened as many pull requests in this fix's lineage as it may. Review the lineage's pull requests and fix the rest yourself                                                                                                                                                                                                                                                                                                                       |
| `lineage_held`             | An earlier pull request in this fix's lineage was held, stopped or closed, so LavaFlow opens no more in it. Apply the fix yourself from the diagnosis                                                                                                                                                                                                                                                                                                     |
| `review_unresolved`        | LavaFlow's review didn't pass a [Code Quality](#code-quality) fix. Read the diagnosis                                                                                                                                                                                                                                                                                                                                                                     |
| `duplicate_in_repository`  | When the run checked, another project on the repository already had the Code Quality pull request for the same finding. Review that pull request in the repository                                                                                                                                                                                                                                                                                        |
| `security_finding`         | The Code Quality finding has security impact and the repository isn't private, so the fix would disclose it. Fix it yourself                                                                                                                                                                                                                                                                                                                              |

New codes may appear.

A test's fixture doesn't count as a credential. A fix may add a fixture line to
a test's code, such as `cart.test.ts`, `checkout_test.go`, or
`test_orders.py`, for a key the file already set on a fixture line before the
fix, when the new value has the same shape as one of those: the same leading
word, the same separators and kinds of characters in the same order, and a
similar length. So `session_token: 'sess-abc-002',` passes beside the test's
existing `session_token: 'sess-abc-001',`. A fixture line gives one key one
quoted value and nothing else: an optional `export`, `const`, `let`, or
`var`, the key, bare or in matching quotes, `:` or `=`, a value in single or
double quotes of 8 to 64 letters, digits, `_`, `.`, `:`, or `-`, then an
optional `,` or `;` and comment. A comment is `#` in `.py` and `.rb` files and
`//` in `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts`, and `.go`
files. A value without a `;` after it, including one followed by a `,`, must
be followed by the end of the file or by a line of code that closes a bracket,
sets a key, or starts a declaration or `return`, such as `def` or `class` in
Python, `end` in Ruby, `const` or `export` in JavaScript and TypeScript, and
`func` in Go. A fixture line can't hold a carriage return or a Unicode line or
paragraph separator. Any other value, such as one with an escape sequence or an
entity, one joined to more, or one on the line after its key, gets no such
allowance and doesn't count as an existing value either. The fix is still held
as `possible_credential` when the value holds a known credential format, a long
random-looking run of characters or digits, or one of your project's secrets,
or when the key is new to the file. So is a value that your logs or issue, as
the run read them, hold whole, or one that holds an ID from them, such as
`a1b2c3d4` in `sess_a1b2c3d4`, or a number of four or more digits from them.
A fix that an earlier attempt of the run
saved and a later one publishes gets no such allowance: after an
interruption, or when you
[open a held fix yourself](#open-a-held-fix-yourself). A test's data and
configuration files, such as `fixtures.test.json` or `test_settings.yaml`, get
no such allowance.

A run's `title` names the problem in at most 80 characters: the diagnosis title,
else the title of the fix it proposed, else the first line or sentence of the
diagnosis summary, else `null`. A sentence too long for a title ends at its
last clause that fits, or, with none, is cut at a word and ends with `…`. `mode` is `live` for a run on an issue from the
project's logs and `code_quality` for one on a [Code Quality](#code-quality)
finding. Both the list and one run can also carry these optional fields:

- `issue.severity`: a confirmed Code Quality finding's recorded `nit`, `minor`,
  `major` or `critical` severity. Other issue sources and unknown severities
  omit it; absence does not mean low severity.
- `pull_request.branch`: the recorded branch name, unchanged. It is omitted
  when unknown or withheld by the project's text privacy checks.
- `fix_summary`: the saved proposed fix's title, on one line of at most 80
  characters. This describes a proposal, not a verified fix, successful review,
  merge or deployment. It never falls back to the diagnosis and is omitted
  when no saved patch title is available. The full title passes the project's
  text privacy checks before it is normalized and shortened, and the resulting
  text is checked again. A shortened title ends with `…`.

Both text fields are omitted when their full source is over the existing
4,000-character privacy budget, may contain a credential, holds a project
secret, or the fix is held with `possible_credential`.

The list carries no diagnosis, changed files or diff. Get them from
one run:

```bash
curl "https://api.volcano.dev/lavaflow/runs/$RUN_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

A run adds `source_commit`, the commit it read the code at (`sha`), and where
that commit came from (`origin`: `push`, `client_reported` for a
`verification: files` commit, `client_reported_repository` for a
`verification: repository` one, or `repository` for a reported problem's
production branch head). It is `null` when the run read no code, and `origin` is
`null` for a run recorded before Volcano kept it. A run that read no code says
why in [`source_unavailable`](#why-lavaflow-read-no-code). A run also adds
`diagnosis` (its `summary`, `root_cause`, and the `evidence` behind
it, which cites the log lines and code it relies on; `log_lines` is empty for
now), `changed_files` (the paths its fix changes, sorted; empty without a fix;
`""` for a path that may itself hold a credential, and for every path when
`diff` can't tell the fix's files apart), `diff`, `diff_sha256`,
`diff_truncated`, `diff_withheld`, its `review` (`verdict` is `passed`,
`changes_requested`, `blocked`, or `error`, with the number of `rounds`,
[`stopped`](#why-a-review-stopped), and the
[findings and questions](#read-a-reviews-findings) it leaves to you),
[`repository_checks`](#your-repositorys-checks) (whether your checks passed
when LavaFlow ran them on the fix, and the commands they ran), and `failure`
with a `code` and a fixed `message`. Any credential that can read the project's
logs can read a run, including a read-only project access token.

A run's `title` and `diagnosis` leave out what may contain a credential, as
the fix's pull request description does: a diagnosis text reads
`LavaFlow left this section out because it may contain a credential` (a log
line's `level` reads `""`), and `title` is `null`, when the text may contain a
credential, holds a secret value, or is over 4,000 characters. Hold reasons in
`merge.hold_reasons` do too, in the run and in the runs list: a path reads `""`
when it would, and a `question` reads
`LavaFlow left this question out because it may contain a credential` when it
holds a secret value, a value shaped like a credential, or a path left out, or
when LavaFlow's reviewers wrote it and it may contain a credential. On a run
held with `possible_credential`, every `question` reads so.

For new fixes, `diff` compares each file before and after all edits as a
unified diff. Unchanged lines appear as context around the changes.
`diff_sha256` is the SHA-256 of `diff` exactly as served. Both are `null` for a
run with no saved fix. What `diff` leaves out, it says in its own text:

- A diff cut short past 256 KiB ends with a line starting with
  `[diff truncated`, and `diff_truncated` is `true`. `changed_files` still
  lists every file the fix changes, including those past the cut.
- When a file's content, before, during or after the fix, or any change to it
  may hold a credential, every change to that file is left out, with a line
  such as `# LavaFlow withheld the changes to "config/deploy.sh" because they may contain a credential.`
- A file too long to check is also withheld: over 64 KiB for any version, or
  past 256 KiB across the fix's file versions. For newly saved fixes, its line
  says `because the file is too long to check for a credential.` Older fixes
  say `because they may contain a credential or were too long to check for one.`
  Their saved data does not distinguish these reasons.
- A run held with `possible_credential` leaves out every file.
- A saved diff LavaFlow can't split by file is left out whole, with one line
  in its place, and `diff_withheld` is `[""]`.

In source files, a credential's name alone does not withhold ordinary code:
calls, member access, empty values and state checks can show. A value bound
to that name still withholds the file, including fixed password text in a
template. Configuration files keep their stricter value checks.
Incomplete escapes and literal syntax LavaFlow cannot safely read also keep
the file withheld. A credential field whose dotted value could be literal
configuration stays withheld, as does fixed credential text after a
template interpolation.

LavaFlow checks complete file contents before saving the diff. When text in
a comment or source literal may contain a credential, every change to that
file stays withheld, including hunks that show none of that text. Quoted,
raw and multiline strings retain the value checks, and regular-expression
values and text outside a language's code regions cannot receive code exemptions.
Java Unicode escapes receive the same text and value checks.
Ambiguous marker boundaries also keep
the file withheld. LavaFlow distinguishes marker text inside recognized
closed strings and line comments from block comments, while checking their
text for credential values. Files also stay withheld when a source check
reaches its time or work limit.

`diff_withheld` lists every withheld path. When the run opened a pull request,
each withheld-file marker also says to read its changes in that pull request
on GitHub.

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

### Why LavaFlow read no code

A run that ended with `source_unavailable` says why in `source_unavailable`,
and names the deployment that served the error when the reason is about it:

```json
{
  "pull_request_skipped": "source_unavailable",
  "source_commit": null,
  "source_unavailable": {
    "reason": "uncommitted_changes",
    "deployment_id": "7c2e5a1f-3b8d-4e6a-9f0c-1d2e3f4a5b6c"
  }
}
```

A logs-only diagnosis describes the observed behavior and its limits. Differences
in log messages or stack locations do not establish what code a deployment or
commit added, removed, or changed; that needs a comparison of source versions
or commit diffs.

| `reason`                          | Why, and what to do                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no_repository`                   | LavaFlow is on for no repository. [Link one](#link-a-repository)                                                                                                                                                                                                                                                                                                                |
| `no_commit`                       | The deployment recorded no commit, or no deployment was serving when the error happened. [Deploy code LavaFlow can read](#deploy-code-lavaflow-can-read)                                                                                                                                                                                                                        |
| `uncommitted_changes`             | The deployment's files differ from its commit, as when the checkout had uncommitted changes. Commit and push them, then deploy from the clean checkout                                                                                                                                                                                                                          |
| `unverified_commit`               | Volcano couldn't verify the deployment's commit against the linked repository. Push the commit to the production branch, then deploy it again                                                                                                                                                                                                                                   |
| `other_repository`                | The commit LavaFlow would read is from a repository other than the one LavaFlow is on for, Volcano checked it under an earlier repository link, or the project no longer links that repository. For a deployment, deploy again from the linked one. For a reported problem or a Code Quality finding, start a new run while the project links the repository LavaFlow is on for |
| `repository_unreadable`           | LavaFlow couldn't read the repository at the commit, for example because the Volcano GitHub App lost access to it. Check the project's repository link and the App's access                                                                                                                                                                                                     |
| `commit_not_on_production_branch` | The production branch no longer holds the commit the fix is on, so LavaFlow opened no pull request. Deploy from the production branch                                                                                                                                                                                                                                           |
| `deployment_unattributed`         | A newer deployment was going live when the error happened, so LavaFlow couldn't tell which one threw it. If the error happens again, LavaFlow starts a new run once; if that run also ends `deployment_unattributed`, the next waits for a new deploy. A `deployment_unattributed` run right after another one, even one a deploy started, gets no such run                     |

`deployment_id` names a deployment of the run's `resource` for `no_commit`,
`uncommitted_changes`, `unverified_commit`, and `other_repository`, and is
`null` for other reasons, including `deployment_unattributed`, and when no
deployment was serving. Look it up in the
resource's deployments. `source_unavailable` is `null` for any other run, for
a run recorded before LavaFlow kept the reason, and when LavaFlow couldn't tell
why. New reasons may appear.

### Why a review stopped

`review.stopped` says why LavaFlow's review ended without passing the fix. It
is `null` when the review passed the fix, and when the run saved no fix. More
values may be added: treat one you don't know as other. When no reviewer could
run, `review` still says why: `rounds` is `0`, `verdict` is `error`, and
`stopped` is `too_few_reviewers`.

| `stopped`           | The review ended because                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `rounds`            | The last review round still found problems                                                    |
| `no_revision`       | LavaFlow gave no revised fix                                                                  |
| `budget_exhausted`  | The run used its token budget before LavaFlow could revise the fix, not the daily spend limit |
| `context_limit`     | The fix's conversation grew too long for the model before LavaFlow could revise it            |
| `timed_out`         | The run's time for review ran out                                                             |
| `reviewers_failed`  | No reviewer of the last round finished                                                        |
| `too_few_reviewers` | Fewer reviewers could run than a round needs to pass the fix                                  |
| `unreadable`        | A retried run couldn't read the review saved with its fix, so a person must review it         |

### Read a review's findings

When LavaFlow's review doesn't pass a fix, or asks a person to decide, the
run's `review` says what it found. Read it from the run, or with
`volcano cloud lavaflow show <run-id> --json`:

```json
{
  "review": {
    "verdict": "blocked",
    "rounds": 3,
    "stopped": "rounds",
    "open_findings": [
      {
        "severity": "major",
        "file": "src/cart.ts",
        "line": 42,
        "explanation": "An empty cart still reaches chargeCustomer, which reads cart.total before the new guard runs."
      }
    ],
    "person_reasons": [
      {
        "kind": "billing",
        "question": "The fix skips the charge for an empty cart. Is that intended?"
      }
    ]
  }
}
```

`open_findings` lists the findings the last round left open, as the fix's pull
request lists them: the `severity` (`nit`, `minor`, `major`, or `critical`),
the `file` and `line` the finding is about (`null` when it's about no file or
no one line), and the reviewer's `explanation`. It's absent once the review
passes the fix. `person_reasons` lists each decision the reviewers leave to a
person: its `kind` (`irreversible`, `trust_boundary`, `breaks_contract`,
`billing`, `unexplained`, or `not_reviewable`; more may appear) and the
`question` to answer. Both are absent when there's nothing to list, and when
the run saved no fix.

Findings and questions are the reviewers' own words, and can quote your code.
LavaFlow leaves out what may contain a credential, and a sentence in its place
says why:

| An `explanation` or `question` reads                                                                    | When                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LavaFlow left this explanation out because it may contain a credential`, or `this question`            | The text may contain a credential, or holds a secret value                                                                                                                   |
| `… because it's too long to check for a credential`                                                     | The text is over 4,000 characters                                                                                                                                            |
| `… because the fix may add a credential`                                                                | The run is held with `possible_credential`; every explanation and question reads so                                                                                          |
| `LavaFlow left this explanation out because it withheld the changes to this file`                       | `diff` withholds the changes to the finding's `file`, even past a truncated diff's cut. If the fix opened a pull request, its changes show there                             |
| `LavaFlow left this explanation out because it withheld this file's path`                               | `file` is `""`: the path itself may contain a credential, holds a secret value, or is over 4,000 characters                                                                  |
| `LavaFlow left this explanation out because it can't tell whether it withheld the changes to this file` | The finding has a `file`, and `diff` withholds a file it doesn't name, can't tell its files apart, or the run saved no `diff`, as a fix saved before LavaFlow kept diffs did |

A secret value is the value of one of your project's secret variables, such as
an `API_KEY`, or a password in a URL variable; either counts at 8 characters or
longer. LavaFlow matches a finding's file however the reviewer wrote its path,
such as `./src/cart.ts` or `b/src/cart.ts`.

### Failure codes

A `failed` or `cancelled` run says why in `failure.code`, and a `queued` run
that waits says what for. Match on the code, not the message.

| Code                     | Why the run stopped or waits                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `feature_unavailable`    | Waits: LavaFlow isn't available. The run starts when it is                                                                          |
| `feature_paused`         | Waits: LavaFlow is paused. The run continues when it resumes                                                                        |
| `pull_request_limit`     | Waits: the project's open Code Quality pull requests are at its plan's allowance                                                    |
| `spend_limit`            | Waits: Code Quality is at the project's daily spend limit                                                                           |
| `code_quality_disabled`  | Code Quality was turned off                                                                                                         |
| `lavaflow_disabled`      | LavaFlow was turned off, or the project is being deleted                                                                            |
| `plan_required`          | The owner's plan no longer includes LavaFlow, or Code Quality                                                                       |
| `account_held`           | The owner's account is read-only or inactive                                                                                        |
| `issue_not_found`        | The issue no longer exists                                                                                                          |
| `security_finding`       | The finding has security impact, and the repository isn't private                                                                   |
| `no_diagnosis`           | LavaFlow couldn't find a root cause                                                                                                 |
| `budget_exhausted`       | The run reached its usage limit                                                                                                     |
| `timed_out`              | The run didn't finish in time                                                                                                       |
| `attempts_exhausted`     | LavaFlow retried the run up to its limit and couldn't finish it. [Start a new run](#start-a-run)                                    |
| `model_unavailable`      | LavaFlow couldn't reach its AI service                                                                                              |
| `model_refused`          | LavaFlow's AI service declined to diagnose the issue                                                                                |
| `model_request_rejected` | LavaFlow's AI service rejected the request                                                                                          |
| `lineage_waiting`        | Waits: LavaFlow can't yet tell whether a recent fix caused the issue. A new run starts when it can. See [Fix lineage](#fix-lineage) |
| `lineage_covered`        | A fix for the change the issue was traced to covers it, so the run opened nothing. See [Fix lineage](#fix-lineage)                  |
| `internal_error`         | Something else went wrong                                                                                                           |

## Fix lineage

Fix lineage is not yet available. It is released where the
`lavaflow.lineage` capability is `available`.

LavaFlow follows up the fixes it merged. A follow-up run is linked to the
earlier fix it follows up, its parent, and every run linked that way forms a
lineage rooted at the first fix. The rules below keep a chain of follow-ups
from making things worse without a person:

- A lineage opens at most 3 pull requests, the first fix's included. A
  follow-up past that diagnoses the issue, opens nothing, and holds the
  lineage with `lineage_cap`.
- A held lineage is held for good. LavaFlow opens no pull request in it again,
  and its runs diagnose only. A lineage holds when one of its pull requests is
  held, stopped or closed, or when the project points at another repository.
- Under `autonomy: merge`, a follow-up holds with `lineage_undoes_parent`
  when it deletes, changes or moves a line its parent fix added, or moves
  another line across one, edited or not. Removing a line on one side of the
  parent's lines and adding one on the other side counts as a move. LavaFlow
  compares lines only: a follow-up that only adds lines, such as an early
  return, or re-adds lines its parent deleted can still merge.
- While 2 or more fixes LavaFlow merged in the project caused new errors in
  the last 7 days, LavaFlow holds every fix it would merge with
  `recent_regressions`. A fix it holds needs a person to merge it, even once
  that window passes.

### How a follow-up starts

- **Regression.** A new issue on a resource is traced to a fix LavaFlow
  merged there when the error's function or file is one the fix changed, and
  the deployment that served it deployed that fix alone. Any other overlap is
  shown as evidence on the run and links nothing. A deployment counts only as
  it does [after a fix merges](#after-a-fix-merges): one with
  `verification: repository` traces nothing, and a fix deployed over one
  didn't deploy alone.
- **Recurrence.** A fix resolves its issue as of 2 minutes after it goes live.
  For 14 days after that, its issue coming back, or never going away, starts a
  follow-up run linked to that fix.
- **One remedy per fix.** The first follow-up of a new issue traced to a fix
  is the fix's remedy; a recurrence of the fix's own issue never is. Another
  issue traced to the same fix waits for the remedy to go live, for at most 7
  days or until the lineage holds, and runs again then. If it hasn't occurred
  since, the run ends with `lineage_covered`, and LavaFlow reads the issue
  again daily for the 14 days after the remedy goes live. An occurrence in that time starts a follow-up of
  the remedy at the next read. If the issue stays quiet, LavaFlow then
  resolves it as of 2 minutes after the remedy went live, and a later
  occurrence reopens it as a regression, which runs like any other.
- **Your own runs.** A run you start on an issue that joined a lineage since
  it was first seen or last reopened joins that lineage too, so the lineage's
  cap and holds apply to it.
- **Deploys settle first.** An issue first seen within 2 minutes of a deploy
  finishing, while another deploy was rolling out, or while one was still in
  progress waits until LavaFlow can tell which deployment served it and which
  one that replaced. Its run
  ends with `lineage_waiting`, opens nothing, bills nothing, and a new run
  starts on its own. A run you start yourself never waits.

Follow-up runs aren't billed.

### Read a lineage

Each run in `GET /lavaflow/runs` and `GET /lavaflow/runs/{run_id}` carries
`lineage` and `fix_outcome`:

- `lineage` names the lineage's root run in `id`, the run's `depth` (0 for the
  root), its `relation` to its `parent` (`regression` or `recurrence`),
  `covered_by` for a covered issue, the lineage's `state` and `hold_reason`,
  and `pull_requests_opened` against `pull_request_cap`. It is `null` for a
  run in no lineage.
- `fix_outcome.state` is `watching` for 14 days after a merged fix goes live,
  then `effective`, unless its issue came back (`ineffective`) or a new issue
  was traced to it (`regressed`). An outcome never moves back.
  `follow_ups` counts the runs linked to the fix.
- A run read on its own adds `lineage_evidence`: the deployment's commit, the
  occurrence judged, and the functions and files the issue shares with the
  fix. A recurrence has none: its issue came back after the fix, so no deploy
  ties it. A `display` link is evidence only and joins no lineage.

## Gate workflows that run a fix

Until you gate every job that could run a fix with your repository's secrets
before a person approves it, LavaFlow holds every fix in the repository: the
run finishes as `completed` with `pull_request_skipped` set to
`ungated_workflows`, no pull request opens, and the fix stays on the run. The
run's `held_workflows` lists each such job. Gate each one on a label a person
adds, with exactly this condition, your label in place of `safe to test`:

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

[What counts as a gate](#what-counts-as-a-gate) has the exact rules. To let
fixes open without gating, see
[Allow ungated workflows](#allow-ungated-workflows); to open one held fix, see
[Open a held fix yourself](#open-a-held-fix-yourself).

### Which jobs hold a fix

LavaFlow opens a pull request only when no workflow could run the fix with
the repository's secrets before a person approves it.

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

- can read a secret, has a token that can write, runs on a runner GitHub
  doesn't host, or writes a cache that runs of the base branch restore,
  itself or through a reusable workflow it calls; and
- isn't gated by a label.

A job can read a secret when it or its workflow's `env` names the `secrets`
context in a `${{ }}` expression, or it hands secrets to a reusable workflow.
Outside an expression, `secrets` is plain text, as in an action named
`get-secretmanager-secrets` or a path such as `config/secrets/app.json`.

A job writes such a cache with `actions/cache`, `actions/cache/save`, or one
of GitHub's setup actions with caching on: `actions/setup-go` from v4 and
`actions/setup-node` from v5 unless you turn it off, `actions/setup-dotnet`
with `cache: true`, and any `actions/setup-*` action, such as
`actions/setup-node`, `actions/setup-python` or `actions/setup-java`, with a
`cache` input. A setup action pinned to a commit counts as its latest
version. Any other action whose code LavaFlow doesn't read counts as writing
a cache too: one from another repository, a JavaScript or Docker action in
yours, or a local action LavaFlow can't find or read. So does any local action
a step uses after an earlier step downloads an artifact with
`actions/download-artifact`, directly or in a composite action. So does
`actions/checkout` of code a pull request may control, as the list of what
may add a label below defines it, since later steps may run what it checks
out: a checkout with no `ref` counts under each trigger that list counts it
under. GitHub's `actions/checkout` of other code, `actions/cache/restore`,
`actions/upload-artifact`, and `actions/download-artifact` don't count, unless `uses:` names one at a ref with `pull/` or a `%` in it, such as `actions/cache/restore@refs/pull/7/head`, which counts as an action LavaFlow doesn't read. A cache written on `pull_request_review`,
`pull_request_review_comment`, `create`, a `push` to the fix's branch, or
`merge_group` stays with the pull request or branch it ran on, so it doesn't
count there. `run` steps can still write a cache that runs of the base branch
restore, or fetch code that later steps, a local action included, run.

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

### What counts as a gate

A gate is the condition in the example under
[Gate workflows that run a fix](#gate-workflows-that-run-a-fix):
`github.event.label.name == '<label>' && github.event.sender.type == 'User'`.
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
hosts, write no cache where its trigger saves caches for the base branch
(`actions/cache`, `actions/cache/save`, a setup action's cache, an action
LavaFlow doesn't read, a local action after an artifact download, or
`actions/checkout` of code a pull request may control), call no reusable
workflow from another repository, and
keep each workflow it calls in this repository from reaching secrets the same
way.

A label is a gate only when nothing in the repository's workflows adds it. A
label that `actions/labeler`'s configuration lists, that
`gh pr edit --add-label` or the GitHub API adds, or that a step computes isn't
a person's approval. A labeler configuration outside `.github/`, or one an
expression names, may add any label when its job holds a user credential (see
below), since a pull request may change it: keep it under `.github/` with a
literal path. So may a step that sets `configuration-path` more than once, in
different cases, or to a value that isn't a path, since LavaFlow can't tell
which configuration it reads: set it once, to a literal path under `.github/`.
Everyone who can add the label must also have write
access; see [Let only people with write access add labels](#let-only-people-with-write-access-add-labels).

These may add any label: an action whose code LavaFlow doesn't read, from
another repository or a JavaScript or Docker action in yours; every `run` step
and `actions/github-script` step; any action in your repository, composite or
not, since a job that checks out the fix runs the fix's version of it; one of
GitHub's own actions, `actions/labeler` included, at a ref with `pull/`
anywhere in it, in any case, or a `%`, such as
`actions/checkout@refs/pull/7/head`; `actions/labeler` at no ref; and
`actions/checkout` of
code a pull request may control: any `ref` but a full 40-character commit SHA
or the name of your production branch, default branch or the pull request's
base branch, as is or under `refs/heads/`, so a `ref` like
`refs/pull/7/merge`, an expression such as
`${{ github.head_ref }}`, even one that names your default branch, another
branch and a tag all count; any `repository` or `github-server-url`; or no
`ref` in a workflow with a
trigger whose runs may check out other code than your default branch's latest
commit. With no `ref`, only
`pull_request_target` and the triggers that check out your default branch,
such as `issues`, `issue_comment`, `schedule`, `workflow_run` and
`repository_dispatch`, don't count; `pull_request`, `pull_request_review`,
`merge_group`, `push`, `create`, a called workflow and any other trigger check
out the commit their event names, which may be the fix's. A full commit SHA
counts as your own pin.
Each counts against every gate when its job holds a user credential: the job,
including its steps, `env`, inputs, container and services, or its workflow's `env` names a secret in any
form other than exactly `secrets.GITHUB_TOKEN` (`secrets['GITHUB_TOKEN']` and
`secrets.github_token` count) inside a `${{ }}` expression, the job hands secrets to a reusable workflow,
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
repository too, and counts `actions/checkout`, `actions/cache`, `actions/setup-*`,
`actions/upload-artifact`, and `actions/download-artifact` as adding no label,
unless `uses:` names one at a ref with `pull/` anywhere in it, in any case, or
a `%`, or `actions/checkout` of code a pull request may control, as above.
A local action LavaFlow can't find, or whose `action.yml` doesn't parse, may
add any label whatever its job's credentials, and so may a workflow that
doesn't parse, or a step that adds a label LavaFlow can't tell, such as
`gh pr edit --add-label "$LABEL"` or a script that computes `labels`. So may a
step that sets labels some other way, such as `setLabels` or a request to a
`labels` endpoint, even with a literal label. When one of these holds a fix
behind a label gate, LavaFlow names it: add the action or fix its
`action.yml`, or stop using it; fix the workflow, whose parse error LavaFlow
quotes, or delete it; name the label as a literal, or add it with
`gh pr edit --add-label` or `addLabels` and a literal list; or drop the step.

If LavaFlow still holds fixes behind a gate like the one above, such an action
or step may add its label. It may run in another job, which LavaFlow names by
workflow and job ID, or in a job that runs without the label on other
branches, as under
[Gate only LavaFlow's branches](#gate-only-lavaflows-branches). Drop the secret
from that job, give it a read-only token such as `permissions: {}` or
`contents: read`, drop `id-token: write` or give a reusable workflow's jobs a
`permissions` block without it, move the job to a runner GitHub hosts, gate
that job on the same label alone under `pull_request` or
`pull_request_target`, or turn on
[`allow_ungated_workflows`](#allow-ungated-workflows).

### Check before CI starts

A fix opens with a commit that skips CI. Under `autonomy: merge`, once its
review passes and nothing holds it, LavaFlow starts its CI with a commit that
runs it. It may start the CI of a fix it holds only for reasons that ask
whether to merge it the same way, once, as it holds the fix; see
[Waiting and held](#waiting-and-held).
Where it can, that commit is a clean copy of the fix: the fix's tree, on the
merge base of the fix and the base commit its pull request names, with
LavaFlow's message less the directive. It replaces every commit LavaFlow put
on the branch, so the pull request holds one commit and no directive, and
merging it keeps everything the base branch did since, a revert included.
LavaFlow makes the copy only when each of those commits is its own signed
commit and the fix has one merge base with the pull request's base, and
force-updates the branch to it only while the branch is still at the commit
LavaFlow last pushed. When it can't, or the repository blocks the force
update, LavaFlow adds a commit on top of the fix instead.

Right before either commit lands on the fix's branch, LavaFlow checks the
commit and the base branch's current head again, and holds the fix if either
check fails. A fix held then keeps its first commit, which skips CI.

LavaFlow reads the workflows as above, and also counts the jobs that starting
CI runs:

- `pull_request` jobs
- `push` jobs, unless their branch filters leave out LavaFlow's branches
- `merge_group` jobs, and `push` jobs on the merge queue's branches, when the
  base branch merges through a merge queue, unless LavaFlow holds the fix:
  it never adds a held fix to the queue

A job that can reach secrets before a person approves it, or a workflow
LavaFlow can't read, holds the fix with `ungated_workflows`.

When something else holds a fix before its CI starts, LavaFlow runs this check
too, without starting CI, so the hold lists every reason at once. It checks the
pull request's head as it finds it, including commits someone else pushed. A job it finds adds
`ungated_workflows`, naming the job, and so does a check that can't finish.
The hold's comment then asks you to gate those workflows before CI runs on the
fix.

Before LavaFlow adds a fix to a merge queue, it runs this check again at the
fix's head and the base branch's current head, with the merge queue's jobs
counted. A job that can reach secrets before a person approves it, or a
workflow LavaFlow can't read, holds the fix with `ungated_workflows`, and
LavaFlow doesn't queue it.

LavaFlow starts CI only when it finds no sign that the repository runs CI or
previews outside GitHub Actions, whose approval gates it can't read. It holds
the fix with `ci_outside_actions` when either of these is true:

- The root of the fix's tree or the base branch's holds one of the
  configuration files in the table below, in any case. The hold's `paths`
  name them.
- An app other than GitHub Actions or Volcano's reported a check run or
  commit status on the base branch's head, or LavaFlow couldn't read them
  all. This catches a service you configured outside the repository.

| Service                      | Files at the repository's root                               |
| ---------------------------- | ------------------------------------------------------------ |
| Travis CI                    | `.travis.yml`                                                |
| Azure Pipelines              | `azure-pipelines*.yml`, `.azure-pipelines/`                  |
| AppVeyor                     | `appveyor.yml`, `.appveyor.yml`                              |
| CircleCI                     | `.circleci/`                                                 |
| Buildkite                    | `.buildkite/`                                                |
| GitLab CI                    | `.gitlab-ci.yml`                                             |
| Jenkins                      | `Jenkinsfile`                                                |
| Bitbucket Pipelines          | `bitbucket-pipelines.yml`                                    |
| Drone                        | `.drone.yml`, `.drone.jsonnet`, `.drone.star`                |
| Woodpecker                   | `.woodpecker.yml`, `.woodpecker/`                            |
| Codemagic                    | `codemagic.yaml`                                             |
| Google Cloud Build           | `cloudbuild.yaml`, `cloudbuild.json`                         |
| AWS CodeBuild                | `buildspec*.yml`                                             |
| Semaphore                    | `.semaphore/`                                                |
| Wercker                      | `wercker.yml`                                                |
| Bitrise                      | `bitrise.yml`                                                |
| Cirrus CI                    | `.cirrus.yml`, `.cirrus.star`                                |
| Vela, Codefresh              | `.vela.yml`, `codefresh.yml`                                 |
| Tekton, TeamCity, Harness    | `.tekton/`, `.teamcity/`, `.harness/`                        |
| Netlify                      | `netlify.toml`                                               |
| Vercel                       | `vercel.json`, `now.json`                                    |
| Cloudflare Pages and Workers | `wrangler.toml`, `wrangler.json`, `wrangler.jsonc`           |
| AWS Amplify, Render, Railway | `amplify.yml`, `render.yaml`, `railway.json`, `railway.toml` |
| Heroku, Platform.sh          | `heroku.yml`, `.platform.app.yaml`                           |

To have LavaFlow start CI again, move that CI to GitHub Actions and gate it as
above. Until then, review a held fix and run its CI yourself: push a commit
that runs CI, or merge it with a message that does.

### Allow ungated workflows

Gating the job is the safer fix. If you can't, the project's owner can let
LavaFlow open its pull requests anyway, signed in as a person: with the
platform token `volcano login` stores, or another platform token that expires. The owner's GitHub account must be able to push to the
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
in its description and links to [Gate workflows that run a fix](#gate-workflows-that-run-a-fix).
The description lists every job a complete scan finds. If that scan can't
finish, it keeps the first job found on each branch or commit and says there
may be more. A long workflow list leaves room for the review and run details:
LavaFlow keeps whole job entries and says how many were omitted. The run lists
those first jobs in `ungated_workflows`, which is null for a
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

### Open a held fix yourself

When LavaFlow holds one fix with `ungated_workflows`, the project's owner can
open that fix's pull request after reading it, without allowing ungated
workflows for every fix. Read the run first:

```bash
curl "https://api.volcano.dev/lavaflow/runs/$RUN_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

Read its `diff` and every job in `held_workflows.jobs`. Then open the fix,
naming the run and what you read by the run's `diff_sha256` and
`held_workflows.jobs_sha256`:

```bash
curl -X POST "https://api.volcano.dev/lavaflow/held-fix-opens" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "run_id": "'"$RUN_ID"'", "diff_sha256": "'"$DIFF_SHA256"'", "jobs_sha256": "'"$JOBS_SHA256"'"}'
```

The CLI can't open a held fix yet; use the request above. The response is
`202` with the run, its `status` `queued`. LavaFlow reads the workflows again
before it queues the run, before it opens the pull request, and once more as
it pushes. It pushes exactly the fix it saved, and opens the pull request past
the jobs you read only, against the production branch you read them on. The
pull request's description says the project's owner opened it, and lists
those jobs. If a job changed by then, a branch the workflows were read on has
a new commit, even one that changes no job, or the production branch changed,
LavaFlow holds the fix again and lists what it found, for you to read.

LavaFlow never starts CI on a fix you opened, or merges it; you push to its
branch or merge it. One exception: if, by the time the pull request opens, no
job runs the fix before a person approves it, because you gated the
workflows, the fix opens as any other and follows the project's merge
settings. If you gate them before you open the fix, the open answers
`run_changed` and the run lists no job; open it again with the new
`jobs_sha256`, and it opens the same way.

LavaFlow retries a run a few times before it gives up, and opening a fix
uses one of those retries. A fix held again on the run's last retry can't be
opened from the run. Apply it yourself from the run's `diff`, or from its
`diagnosis` where the diff is cut short or withholds a file. Opening a held
fix starts no new run and counts against no run limit. A fix that adds a
test fixture for a secret-named key is held again as `possible_credential`:
a test's fixture passes the credential check only in the attempt that wrote
the fix.

Only the project's owner opens a held fix, signed in as a person: with a
`volcano login` token whose sign-in is live, or a platform token that expires.
Their GitHub account must be able to push to the project's repository. A
project access token gets `403` with `person_required`, and MCP has no tool for
it.

| Status | `code`                     | Why, and what to do                                                                                                                                                                                                                         |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `409`  | `run_not_held`             | The run holds no fix held for ungated workflows, already opened it, cuts its diff short or withholds a file from it, or couldn't list every job that held it. Such a fix can't be opened from the run; apply it yourself from the diagnosis |
| `409`  | `run_changed`              | The diff or the jobs aren't the ones you named, or a job or a branch LavaFlow read them on changed since. Read the run again                                                                                                                |
| `409`  | `run_attempts_exhausted`   | The run used all its retries, so LavaFlow can't open its fix any more. Apply the fix yourself from the run's `diff`, and where the diff is cut short or withholds a file, from its `diagnosis`                                              |
| `409`  | `lavaflow_disabled`        | LavaFlow is off for the project. Turn it on, then open the fix                                                                                                                                                                              |
| `409`  | `repository_required`      | LavaFlow was turned on for a repository the project no longer links. Turn LavaFlow on again                                                                                                                                                 |
| `409`  | `repository_changed`       | The project links another repository than the fix was written for                                                                                                                                                                           |
| `409`  | `repository_unreadable`    | LavaFlow can no longer read the repository's workflows. Reconnect the repository                                                                                                                                                            |
| `409`  | `lavaflow_run_in_progress` | Another run of the issue is queued or running                                                                                                                                                                                               |
| `403`  | `person_required`          | The request didn't come from the owner signed in as a person, or their GitHub account can't push to the repository                                                                                                                          |
| `429`  |                            | Too many GitHub checks of the owner's access this hour. Nothing was queued; try again after `Retry-After`                                                                                                                                   |
| `503`  |                            | GitHub didn't answer. Nothing was queued; try again after `Retry-After`                                                                                                                                                                     |

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

## Read the review on the pull request

LavaFlow's AI reviewers check each fix before its pull request opens. The
run's `review` always has their verdict and
[the findings](#read-a-reviews-findings), and on a private repository the pull
request's description has the review's summary.

LavaFlow is starting to post the review on the pull request too, as Volcano's
GitHub App, so a pull request may not have one yet. A posted review is a
comment: it never approves the pull request or requests changes, so
it never counts as an approval. It is pinned to the commit it reviewed, or, when
LavaFlow has already replaced that commit with its clean copy to
[start CI](#check-before-ci-starts), to the copy, which holds the same files.

What the review shows depends on the repository:

| Repository  | Review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private     | A review that found nothing to fix is a short pass headed **LavaFlow review: passed**. It says how many rounds the review took, how many reviewers finished the last round, and what earlier rounds found that LavaFlow fixed. Any other review is headed **LavaFlow review: did not pass**, with each open finding's severity and explanation, and each open finding on a changed line is also a comment on that line. Both list the questions the reviewers ask a person, with values that look like credentials or identifiers removed |
| Not private | A note that LavaFlow reviewed the commit, with a link to the run in the Volcano dashboard and the `volcano cloud lavaflow show --json` command that reads it. It's the same whatever the review found: no verdict, findings, severities, or line comments, as the pull request's description has none                                                                                                                                                                                                                                     |

If your branch protection requires conversations to be resolved before
merging, resolve LavaFlow's open line comments once you've checked the
findings.

The review holds no log lines. LavaFlow posts it only while LavaFlow is on for
the project and its repository, and at most 20 reviews a project an hour. A
review that can't post leaves the fix and its pull request as they are.

## See what LavaFlow found

Count the issues LavaFlow took on and the pull requests it opened per UTC day.
`days` is 30 by default and accepts 1 to 217 UTC days, ending today:

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

Add `category` to count only runs in one category, on both stats and resources;
`uncategorized` counts runs without one.
These count issues taken on and pull requests opened, while
`GET /lavaflow/runs` counts runs, so the two need not match.

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

Every current resource in the project is listed, with zeros where LavaFlow
found nothing. A deleted resource is listed under its last name when it has
activity in the window (in that category, with `category` set), so the counts
add up to the stats' totals.

A resource is flagged as an anomaly when the last 24 hours brought at least 3
issues and at least 3 times its daily average over the 29 days before. The
average counts as at least one issue a day. With `category`, the counts and the
anomaly rule read only that category's runs; every current resource is still
listed, and `last_analyzed_at` reads every run.

## Code Quality

Code Quality reviews the code each production deploy of a frontend in the
project changes, and records what it finds as [issues](issues.md) that LavaFlow
diagnoses and fixes like any other. Function deploys ask for no scan yet. Its
runs show `mode: code_quality`. Code Quality is in preview; its allowances are
in [Plans and limits](plans-and-limits.md#lavaflow).

Check the project's `lavaflow.code_quality` capability first. It is
`available` only where `lavaflow` is, while Code Quality is offered, and while
the owner's plan allows Code Quality findings. Otherwise it is `unavailable`,
with `code` `plan_required` when the plan allows none.

### Turn Code Quality on

Code Quality reads the project's source, so turning it on is the owner's
decision, made the way [Turn merging on](#turn-merging-on) describes: signed in
as a person, with a `volcano login` token whose sign-in is live, or a platform
token that expires, while the owner's GitHub account can push to the project's
repository.

```bash
curl -X PATCH "https://api.volcano.dev/lavaflow/settings" \
  -H "Authorization: Bearer $VOLCANO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "enabled": true, "code_quality": {"enabled": true}}'
```

| Status | Code                  | Why                                                                   |
| ------ | --------------------- | --------------------------------------------------------------------- |
| `400`  | `feature_unavailable` | Code Quality is not available to the project                          |
| `403`  | `plan_required`       | The owner's plan allows no Code Quality findings                      |
| `403`  | `person_required`     | The save isn't the owner's, as in [Turn merging on](#turn-merging-on) |

Code Quality belongs to the repository the project points at when you turn it
on. When the project points at another repository, or at none,
`code_quality.enabled` reads `false`. Pointing it back doesn't turn Code
Quality on again: turn it on again yourself.

### Turn Code Quality off

Anyone who can save the settings can turn Code Quality off, and so can a
full-scope project access token, such as one your CI holds:

```bash
curl -X PATCH "https://api.volcano.dev/lavaflow/settings" \
  -H "Authorization: Bearer $VOLCANO_PROJECT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "'"$PROJECT_ID"'", "code_quality": {"enabled": false}}'
```

A project access token's body names `project_id` and
`code_quality.enabled: false`, each once, and nothing else, except that it may
also turn [skill learning](#learned-skills) off with `skill_learning: off`. Any
other body from a token, a token on `PUT`, and every request through MCP get
`403` with code `person_required`, and nothing is saved.

Turning Code Quality off, or LavaFlow off, drops the project's waiting scan.
Queued and running Code Quality runs end `cancelled` with code
`code_quality_disabled`, and a fix not yet open stays unopened. They end with
`plan_required` instead when the owner's plan stops allowing Code Quality.
When you turn it on again, Code Quality reviews what deploys change from then
on, not the code that shipped while it was off.

### How Code Quality fixes open

A Code Quality fix opens as a draft pull request, and LavaFlow never merges
it, even with `autonomy: merge`. It opens only when LavaFlow's review passed
the fix, and not while another project on the same repository has an open
Code Quality pull request for the same finding. The issue keeps its diagnosis
either way.

On a repository that isn't private, LavaFlow writes no fix for a finding with
security impact, since the diff would disclose the problem before it is fixed.
The finding's issue is recorded, and no run starts for it. Its `finding`, on
the issue in the [Issues API](issues.md), says where the problem is and why. A
run started on it ends `cancelled` with code `security_finding`, before
LavaFlow reads the code or bills anything.

While Code Quality is unavailable, a queued Code Quality run waits with
`feature_unavailable`, and one already running finishes. A Code Quality run
also waits, at its start or with its fix saved before it opens, while the
project has as many open Code Quality pull requests as the plan allows
(`pull_request_limit`), and starts no new work while Code Quality is at the
project's daily spend limit (`spend_limit`). A queued Code Quality run never
goes ahead of a Live run, but a Live run waits while a Code Quality run of the
project is in progress.
A run reads the commit its finding was found in.

Close a Code Quality pull request
without merging it, and LavaFlow ignores its issue and stops reporting the
finding. With `autonomy: diagnose_only`, Code Quality diagnoses its findings
and opens nothing. A Code Quality run reads the code a deploy changed, never
the project's logs.

### List scans

List the project's scans, newest first. The first page starts with the
project's waiting scan, if it has one: the deploys that went live since the
last scan. Page with `limit` (default 25, at most 100) and `cursor`, as for
[runs](#follow-runs).

```bash
curl "https://api.volcano.dev/lavaflow/scans?project_id=$PROJECT_ID" \
  -H "Authorization: Bearer $VOLCANO_TOKEN"
```

```json
{
  "data": [
    {
      "id": "8b2d4f6a-1c3e-4a5b-9d7f-0e2c4a6b8d1f",
      "project_id": "5c2e8f14-7a3b-4d9e-b1f6-0a8c3e5d7b92",
      "source": "deployment",
      "status": "completed",
      "outcome": "scanned",
      "waiting_reason": null,
      "repository_id": 4242,
      "base_sha": "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
      "head_sha": "9f3c2b7a4e1d6c8b0a5f2e9d7c4b1a8e6f3d0c2b",
      "resources": [
        {
          "resource_type": "frontend",
          "resource_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          "deployment_id": "c4d5e6f7-a8b9-4c0d-9e1f-2a3b4c5d6e7f"
        }
      ],
      "truncated": false,
      "counts": { "found": 4, "created": 1, "duplicate": 1, "suppressed": 0, "capped": 0, "rejected": 2 },
      "billed": [
        {
          "issue_id": "3f6c1a9e-6c1d-4f7e-9a51-2b8f0e4d7c21",
          "rule": "unhandled-error",
          "title": "chargeCustomer ignores the payment error",
          "billable_events": { "issue_diagnosed": 1, "pull_request_opened": 1 }
        }
      ],
      "requested_at": "2026-11-02T14:00:12Z",
      "started_at": "2026-11-02T14:05:12Z",
      "completed_at": "2026-11-02T14:06:40Z"
    }
  ],
  "limit": 25,
  "has_more": false
}
```

A waiting scan has `id: null` and `status: waiting`. `waiting_reason` names the
allowance it waits at, such as `findings_limit` or `pull_request_limit`, and is
`null` while it only waits a short while for more deploys. LavaFlow checks the
allowance again at least every 15 minutes, and starts the scan once it has
room. A waiting scan skips no deploy: when it starts, it covers every commit
since the last scan.
`counts` says what the scan did with what it found, and `billed` lists what
the runs on its findings billed. A finding that comes back bills under the
scan that found it again. Scans stay readable while LavaFlow or Code Quality is
off, and any credential that reads the project's runs reads them.

## Report problems from Slack

People in your Slack workspace can report a problem by mentioning `@Volcano`
in a channel bound to the project, and LavaFlow diagnoses it like an issue. See
[Report problems from Slack](lavaflow-slack.md).

## Agents

The [MCP endpoint](../interfaces/mcp.md) offers every LavaFlow read as a tool,
for the project the agent's token is bound to, skills included. Changing the
settings or a skill, and starting a run, are the owner's decisions, so no
tool does any of them.
