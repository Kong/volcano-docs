---
title: Agent evals in Volcano sandboxes
description: "Run coding agent evals with Harbor, one Volcano sandbox per trial: six agents on one task in parallel, graded by hidden tests, with a live scoreboard."
tags:
  - agents
  - evals
  - sandboxes
  - harbor
  - realtime
cover: /cookbooks/agent-evals-in-volcano-sandboxes-cover.webp
---

Tested on Volcano CLI 0.62.0, SDK 2.2.0, Harbor 0.26.0, Claude Code 2.1.326, Codex 0.169.0, OpenCode 1.19.5, Node 22.23.5, next 16.4.6; last verified 2026-11-16 on CLI 0.62.0.

An agent eval runs an agent on a task, lets it do whatever it decides to do, and grades the result. Each trial needs its own clean machine: the agent installs packages, edits files and runs arbitrary commands with your API keys in its environment, and nothing it does may leak into the next trial or into the grading. Run six agents, or one agent five times, and that means six or more machines at once, booted from the same image and thrown away afterward. That is what a sandbox is for.

This recipe runs agent evals in Volcano sandboxes. [Harbor](https://github.com/harbor-framework/harbor), the harness behind Terminal-Bench 2.0, runs the agents and grades them; a small Harbor environment provider gives every trial its own Volcano sandbox. Each sandbox is a VM booted from a template that already holds the agent CLIs, so a trial is ready in about 20 seconds, and Harbor terminates it when grading ends. The example puts Claude Code, Codex and four open-weight models on OpenRouter on the same task in parallel.

The sandboxes are the part Harbor needs. The rest of the project is what makes the results useful: the same Volcano project holds a Postgres table of trials, a function that records them, realtime that pushes each change to the browser, and the frontend that shows the scoreboard in the GIF. The results page doesn't need a second service or another set of keys.

![Six agents work on the same task in six Volcano sandboxes while a live scoreboard fills in](/cookbooks/agent-evals-in-volcano-sandboxes-run.gif)

One real run, six agents on one task, sped up 12×. The terminal on the left is Harbor and each agent's live output; the scoreboard on the right is a Volcano frontend fed by realtime.

## A task is a folder

Harbor tasks have a fixed shape. The example task asks an agent to add CSV export to `ledger`, a small TypeScript expense tracker:

```text
csv-export/
  instruction.md        what the agent is asked to do
  task.toml             timeouts, cpus, memory
  environment/          the repo the agent starts with, plus a Dockerfile
  tests/test.sh         hidden grading; writes 1 or 0 to /logs/verifier/reward.txt
  solution/solve.sh     reference solution, to check the task is solvable
```

The agent sees only `instruction.md` and the repo in `/app`. After it stops, Harbor copies `tests/` in and runs `test.sh`. Here that is six Node tests, including edge cases the instruction states but an agent may skip, such as an empty list producing only the header line.

Bring your own task: a folder in this format built from your repo, with a `solution/` so Harbor's `oracle` agent can check the task is solvable. The csv-export files below are the task from the GIF, shown for illustration. Its repo, `environment/ledger/`, is a small TypeScript CLI that reads expenses from a JSON file. The instruction:

```markdown
Add a CSV export to ledger.

1. Create `src/export.ts` exporting `toCsv(expenses: Expense[]): string`.
   - First line is the header `date,category,amount,note`.
   - One line per expense, in the order given. `amount` has exactly two decimals (`12.50`). A missing note is an empty field.
   - Quote a field with double quotes if it contains a comma, a double quote or a newline, and double any quotes inside it (RFC 4180).
   - Lines end with `\n`, including the last one.
2. Add an `export` command to the CLI: `npm run ledger -- export` prints the CSV to stdout, and respects `--month=YYYY-MM` like the other commands.
3. Add tests for `toCsv` and make sure `npm test` passes.
```

The grading script and the hidden tests:

```bash
#!/bin/bash
# Runs the hidden tests against the agent's work in /app and writes the reward.
mkdir -p /logs/verifier
cd /app
mkdir -p test
cp /tests/export.hidden.test.ts test/export.hidden.test.ts

node --no-warnings --experimental-strip-types --test test/export.hidden.test.ts

if [ $? -eq 0 ]; then
  echo 1 > /logs/verifier/reward.txt
else
  echo 0 > /logs/verifier/reward.txt
fi
```

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { toCsv } from '../src/export.ts';

test('header and basic row', () => {
  assert.equal(toCsv([{ date: '2026-01-01', category: 'food', amount: 12.5, note: 'x' }]), 'date,category,amount,note\n2026-01-01,food,12.50,x\n');
});
test('empty list is just the header', () => assert.equal(toCsv([]), 'date,category,amount,note\n'));
// Three more tests (missing note, quotes and commas, newlines) are omitted here.
test('cli export respects --month', () => {
  const out = execFileSync('node', ['--no-warnings', '--experimental-strip-types', 'src/cli.ts', 'export', '--month=2026-11'], { encoding: 'utf8' });
  assert.equal(out.trim().split('\n').length, 3);
  assert.ok(out.startsWith('date,category,amount,note\n'));
  assert.ok(out.includes('2026-11-03,office,64.99,desk lamp'));
});
```

## Build it with your coding agent

You need Python 3.12 with [uv](https://docs.astral.sh/uv/), the [Volcano CLI](/get-started/install), a Volcano account (tested on SUPERAGENT), and a key for each model provider. Set `VOLCANO_TOKEN` (a service key with sandbox access), `VOLCANO_PROJECT_ID`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `OPENROUTER_API_KEY`. Put your task folder in `tasks/<your-task>/` in an empty folder, then paste this into Claude Code, Codex or Cursor with the Volcano skills (`volcano setup`):

```text
Build a Harbor environment provider that runs each trial of a Harbor eval in its own Volcano sandbox, plus the sandbox template and a job file, in this folder. The task to run is my own, in Harbor's task format, in tasks/<your-task>.

Harbor is the eval harness (github.com/harbor-framework/harbor). Install it with `uv tool install harbor==0.26.0` and read its installed source: `harbor/environments/base.py` (BaseEnvironment, the class to implement) and the Docker environment next to it. For Volcano, use `volcano docs search` and `volcano docs get`. Call the sandbox REST API with VOLCANO_TOKEN and VOLCANO_PROJECT_ID from the environment.

Write:
- volcano-harbor/: a Python package exposing `volcano_harbor:VolcanoEnvironment`, installed with `uv tool install harbor==0.26.0 --with-editable ./volcano-harbor`. The template id comes from a `template_id` kwarg (`--ek template_id=...`) or VOLCANO_TEMPLATE_ID.
- template/Dockerfile: a Volcano sandbox template that Harbor's claude-code, codex and opencode agents can run in.
- bake-off.yaml: one Harbor job that runs the task with claude-code (anthropic/claude-sonnet-5-5), codex (openai/gpt-6.1-sol) and opencode (openrouter/qwen/qwen3-coder-next) at the same time, each with `skip_install: true`.

Facts about Volcano sandboxes to build on:
- Sessions: POST /projects/{project_id}/sandbox-sessions with `sandbox_id` (the template id), `region` and `max_duration_seconds`. Poll GET /sandbox-sessions/{id} until `state` is `running`. DELETE /sandbox-sessions/{id} terminates it. Always terminate, also when a trial fails.
- Exec: POST /sandbox-sessions/{id}/exec with `command`, `timeout_seconds` and an optional `environment` map. There is no cwd field, output comes back only when the command ends, and a request closes after 1000 s. Run long commands (the agent itself) in the background with setsid nohup, write stdout, stderr and the exit code to files, and poll for the exit code with short execs.
- Files: POST /sandbox-sessions/{id}/files/write and files/read (base64, up to 8 MiB) and POST /sandbox-file-archives (multipart tar.gz with project_id, session_id and path, no symlinks) only reach paths under /workspace. Stage transfers there and move them with cp, mv or tar through exec.
- Sessions run as uid 1000 with HOME=/workspace and no root or sudo. Run Harbor's user="root" commands as the session user.
- Volcano doesn't build the task's Dockerfile. Upload the files its COPY lines name to their destinations, apply WORKDIR, and run its RUN lines in the session, best effort.
- A template is a Dockerfile fragment on Amazon Linux 2023 arm64: no FROM, USER or ARG, only RUN, COPY, ENV, WORKDIR and CMD. Build steps run as root. ENV doesn't reach session commands.

The template needs Node 22 and the claude, codex and opencode CLIs installed globally, so Harbor's version check passes and it skips its root-only install. Codex is a Rust binary and needs a CA bundle; point SSL_CERT_FILE at /etc/pki/tls/certs/ca-bundle.crt in the exec environment if it can't find one. Create /installed-agent, /logs/agent, /logs/verifier, /logs/artifacts, /tests, /solution and /app owned by uid 1000 (Harbor runs chmod and chown on them), and add a passwd entry for uid 1000. OpenCode fails with EPIPE unless its working directory is a git repo, so the task's Dockerfile should run `git init` in /app.

Deploy the template with `volcano cloud sandboxes templates deploy` and wait until it is active; the first deploy can take 20 to 30 minutes.

Done when, with the template id set:
- `harbor run -p tasks/<your-task> -e volcano_harbor:VolcanoEnvironment -a oracle` scores 1.0,
- the same command with `-a nop` scores 0.0,
- one real trial, `-a opencode -m openrouter/qwen/qwen3-coder-next --ak skip_install=true`, finishes with a reward,
- and no sandbox session is left running.
```

Tested with a fresh Claude Code agent (Claude Code 2.1.326, claude-sonnet-5-5) with the Volcano plugin 0.2.55, in a folder that held only this prompt and the csv-export example task, with the prompt's task path pointing at that task. To skip the template deploy, it was given the id of a template already deployed from the same Dockerfile and told to write `template/Dockerfile` without deploying it. It finished on the first try in about 22 minutes for $1.56. Its provider scored 1.0 with Harbor's `oracle` agent, 0.0 with `nop` and 1.0 with OpenCode on qwen3-coder-next, and every session it started was terminated. Its template Dockerfile built locally behind `FROM amazonlinux:2023`, and the CLIs it installed run as uid 1000 at the versions above. Claude Code and Codex weren't run against its provider, since the test machine gave it only an OpenRouter key.

### What the agent builds

The provider is one Python class. `start()` creates a session from the template and waits for it to run, and `stop()` always deletes it:

```python
session = await self._api("POST", f"/projects/{self._project_id}/sandbox-sessions", json=body, idempotent=True)
self._session_id = session["id"]
while session["state"] != "running":
    if session["state"] in ("terminating", "terminated", "unknown", "failed"):
        raise VolcanoError(f"session {self._session_id} is {session['state']}: {session.get('last_error_code')}")
    await asyncio.sleep(1)
    session = await self._api("GET", f"/sandbox-sessions/{self._session_id}")
# ...
await self._api("DELETE", f"/sandbox-sessions/{self._session_id}")
```

An agent's run can outlast one exec request, so it runs detached, and the provider asks whether it's done with requests that wait up to 300 seconds each:

```python
runner = f"{limit}bash {job}/cmd.sh >{job}/out 2>{job}/err </dev/null; echo $? >{job}/rc"
await self._run(f"setsid nohup bash -c {q(runner)} >/dev/null 2>&1 & echo $! >{job}/pid", env=env, check=True)
while True:
    wait = (
        f"for i in $(seq {WAIT_WINDOW_SEC * 5}); do [ -f {job}/rc ] && break; sleep 0.2; done; "
        f"[ -f {job}/rc ] && echo done || echo pending"
    )
    r = await self._run(wait, timeout_sec=WAIT_WINDOW_SEC + 30)
    if (r.stdout or "").strip() == "done":
        break
```

Sessions run as uid 1000 with no root, so the agent CLIs and the directories Harbor writes to have to exist before a trial starts. A sandbox template does that at build time. The lines that matter:

```dockerfile
RUN CLAUDE_CODE_VERSION=2.1.326 CODEX_VERSION=0.169.0 OPENCODE_VERSION=1.19.5 \
    && npm install -g \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
      "@openai/codex@${CODEX_VERSION}" \
      "opencode-ai@${OPENCODE_VERSION}"
RUN mkdir -p /installed-agent \
      /logs/agent /logs/verifier /logs/user-agent /logs/artifacts \
      /tests /solution /app /runtime/skills \
    && chown -R 1000:1000 /installed-agent /logs /tests /solution /app /runtime
```

The two template deploys for this recipe took about 21 and 27 minutes from submit to active, so build the Dockerfile locally first if you change it.

### Run the lineup

The job file lists the task and one entry per agent. `skip_install` tells Harbor to use the CLIs already in the template. The prompt's job file runs three agents; to run the six from the recorded run, add an `opencode` entry for each other OpenRouter model under `agents:`, such as:

```yaml
  - {name: opencode, model_name: openrouter/z-ai/glm-4.7, kwargs: {skip_install: true}}
```

Run it:

```bash
harbor run -c bake-off.yaml
```

Each trial boots a sandbox from the template, uploads the task's repo, runs the agent, runs the hidden tests and terminates the sandbox. Harbor prints a summary and writes `jobs/<job>/result.json`, with one folder per trial holding the agent's log and the test output. Harbor's summary also points to `harbor view jobs` for browsing them.

## What happened in the recorded run

All six trials ran at once. The job took 6 minutes 50 seconds of wall clock, and booting and preparing each sandbox took 17 to 23 seconds.

| Agent | Model | Hidden tests | Time | Model cost |
|---|---|---|---|---|
| Claude Code | claude-sonnet-5-5 | pass | 1m41s | $0.042 |
| OpenCode | qwen3-coder-next | pass | 1m46s | $0.011 |
| OpenCode | kimi-k2.7-code | pass | 1m59s | $0.026 |
| Codex | gpt-6.1-sol | pass | 2m01s | $0.059 |
| OpenCode | glm-4.7 | pass | 4m14s | $0.018 |
| OpenCode | deepseek-v3.2 | fail | 6m50s | $0.065 |

Time is from sandbox start to graded result. Model cost is what each agent reported; the lineup came to $0.22. DeepSeek V3.2 failed one of the six hidden tests: for an empty list, its `toCsv` returned the header followed by an extra blank line (`'date,category,amount,note\n\n'`).

This is one easy task and one attempt per agent, so it doesn't rank the agents. It shows the loop working: six agents in six isolated machines, graded by the same tests, from one command in about seven minutes.

## Make it yours

Copy `csv-export/` and replace the repo, the instruction and the tests with a real task from your own backlog: a bug that was fixed last month, with the test that proved the fix. Add more folders under `tasks:` to cover more kinds of work. Set `n_attempts: 5` on the job to run each agent five times per task; a single attempt can't tell a better agent from a lucky one. Because the run is one command with keys from the environment, it fits in a nightly CI job, and a new agent release or model shows up as a change in your own numbers.

A public leaderboard measures how agents do on tasks chosen to be hard for everyone. Your repo has its own conventions, test setup and edge cases, and an agent's score on someone else's tasks says little about those. In this run the one failure was a blank line: the logic was right, and the output for an empty list was wrong. A hidden test catches that kind of mistake, and a quick review often doesn't. A handful of tasks from your own backlog, graded by your own tests, is a better guide to which agent to trust with that backlog.

## Optional: a live scoreboard

The scoreboard in the GIF is a small Volcano app: two Postgres tables, one function, realtime and a Next.js frontend. A watcher script reads Harbor's job folder and posts each trial's status to the `report` function, which writes it with a service key. Row-level security lets everyone read and nobody else write:

```sql
ALTER TABLE trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY trials_public_read ON trials FOR SELECT USING (true);
```

The page signs each viewer in anonymously, creates the realtime client with `volcanoClient` set so each event carries the changed row in `c.record`, and subscribes to changes:

```js
const ch = realtime.channel("public:trials", { type: "postgres" });
ch.onPostgresChanges("*", "public", "trials", (c) => upsertTrial(c.record));
await ch.subscribe();
```

Realtime needs anonymous sign-ins turned on for the project and an anon key with `realtime.connect` and `realtime.subscribe`, since a project's default anon key has auth permissions only. Updates reached the browser 1 to 3 seconds after each write. The scoreboard isn't part of the tested prompt. To add one, give your coding agent this section as the description and point it at the job folder Harbor writes.

## Limits

Volcano sandboxes don't run as root and don't take a custom base image yet; the template is built on Amazon Linux 2023 and adds what Harbor needs. Memory tops out at 2 GiB on SUPERAGENT. On HOBBY a session gets 1 GiB and at most 5 run at once, so set `n_concurrent_trials` to 5 or less there. The provider doesn't build the task's Docker image: it uploads the task files, applies `COPY` and `WORKDIR`, and runs `RUN` lines as the session user, so `git init` or `npm ci` work and `apt-get install` doesn't. Most Terminal-Bench tasks don't run as is for that reason: 82 of 89 install packages in their verifier, and 18 ask for 4 to 8 GiB. Tasks written for your own repo, like the one here, avoid both.
