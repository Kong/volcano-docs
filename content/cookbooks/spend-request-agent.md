---
title: Finance agent for budget requests
description: "A chat agent checks every figure in a budget request against company data, scores the case, and holds it in a durable function until finance decides."
tags:
  - agents
  - durable-functions
  - human-in-the-loop
  - row-level-security
  - openrouter
cover: /cookbook/spend-request-agent-cover.webp
kind: agent
uses: [durable-functions, database, auth]
---

Tested on Volcano CLI 0.62.0, SDK 2.2.0, Node 24.9.0, next 16.4.5, react 19.3.1, model anthropic/claude-haiku-5.5 on OpenRouter; last verified 2026-11-09 on CLI 0.62.0.

A budget request usually reaches finance half-built: two more support hires or a new vendor, a paragraph and a number. The finance partner who picks it up asks the same four questions every time: could someone already here do this, could it be automated, is the number real, and does the evidence back the outcome. The figures in the request are claims nobody has checked.

This agent asks those questions before finance sees the request. It checks every figure against company data, scores how ready the case is, and files it. The reviewer gets a case with answers and checked numbers, and approves it, pushes it back or denies it.

One Volcano project holds all of it. Postgres, with row-level security, holds the cases, the conversation and a ledger of every figure. A plain function runs each agent turn and owns every rule and number. A durable function holds each filed case open until a reviewer decides, an hour later or two weeks later. A push back and a refile resume the same execution, and waiting isn't billed as compute: the execution in the screenshot further down had been open 55 seconds and had run code for under 1 second. There is no queue, cron job, status-polling worker or second service.

![The agent catches a contradicted ticket count, scores the case at 36%, and the requester files it with a written reason](/cookbook/spend-request-agent-run.gif)

One real run on the deployed app: a Support headcount request from claim to filed case.

## One case, as the reviewer sees it

Acme's Support lead asks for two more agents: "We get 25,000 tickets a month and the team can't keep up." The agent ties the request to two of Support's priorities, and the requester confirms them with buttons. Code refuses any priority that isn't on the department's list.

Then the stress test. Company data says 18,400 tickets a month, and the agent asks where the 25,000 came from. It was the worst month. At the real volume, 23 agents with a target of 650 tickets each run at about 123% of target, and getting to target takes 29 agents, so two hires leave the team about 4 short.

Every figure lands in the ledger with one of four statuses:

- **verified**: matches a company-data lookup or a calculation.
- **claimed**: the requester said it and nothing checks it, like a $48,000 salary.
- **contradicted**: the requester said it and company data disagrees. The 25,000 sits next to "data: 18,400".
- **homework**: needed and missing. The value stays empty; the agent may not estimate it.

Code refuses a verified figure that matches no lookup or calculation, and a claimed one the requester never said.

Last, the model rates six dimensions as strong, moderate, weak or missing: business outcome, capacity evidence, automation considered, urgency, alternatives and success measure. Code turns the ratings into a percent with weights per request type, and a weak or missing business outcome or success measure caps it at 50% or 65%. This case scores 36%: nobody weighed automation, or deflecting the 31% of tickets that are repeats, and there is no target for after the hires. Filing needs 75%. Below that, the requester can file only with a written reason of at least 20 characters, which the reviewer sees.

The reviewer starts from a case that already says the headline number is wrong.

## The model judges, the code counts

The model decides which priority a request serves, whether the evidence holds up, and what to ask next. Code owns every number, rule and gate, and the model reaches them only through tools that refuse when a rule isn't met:

```js
case 'advance_step': {
  const v = rules.canAdvance(c, args.to, state.ledger.length);
  if (!v.ok) return { error: `refused: ${v.error}` };
  c.step = args.to;
  state.dirty.case = true;
  return { step: c.step };
}
```

The model can't skip the stress test or score a case with an empty ledger, however the conversation goes.

Every reply also passes a number check. Code finds each figure with a unit ($, %, k, M, x) and looks for a source of the right kind in a tool result, the case, or the requester's words. A figure with no source sends the reply back for a rewrite, at most twice:

```js
for (let attempt = 0; attempt <= MAX_REWRITES; attempt++) {
  reply = (await toolLoop(convo, state, callModel, usage)).trim();
  result = checkReply(reply, sources(state));
  attempts.push({ reply, unsourced: result.unsourced });
  if (result.passed || attempt === MAX_REWRITES) break;
  convo.push({ role: 'assistant', content: reply });
  convo.push({
    role: 'user',
    content: `[Automatic number check, not from the requester] These figures in your reply have no source: ${result.unsourced.join(', ')}. Rewrite the whole reply for the requester. Use a tool to look up or calculate any figure you need, or leave it out and say it's missing. Don't mention this check.`,
  });
}
```

The check covers figures with a unit. If two rewrites don't fix a reply, the reply is saved anyway, and the case page marks it "still unsourced" under the message, so the reviewer sees the flag. Tested across five models, with the prompt already forbidding unchecked numbers, the check still fired on 4 of 60 turns, and what it caught was confident and wrong: 154% utilization where the math gave 113%, a readiness of 45% where code had computed 43%. Each caught reply passed after one rewrite.

## Waiting for the reviewer

![The filed case, and the Volcano dashboard showing its review execution suspended on the reviewer's decision](/cookbook/spend-request-agent-screenshot.png)

Filing starts a durable function, `review-case`, that waits up to 14 days for a decision and accepts only messages sent with the project's service key:

```js
// Waits for a message from the service key; drops anything else.
async function trusted(ctx, name, timeout, isValid = () => true) {
  for (;;) {
    const msg = await ctx.waitForMessage(name, { timeout });
    if (msg === null) return null;
    if (msg.sender?.type === 'service_key' && isValid(msg.data)) return msg;
    ctx.log.warn('ignored message', { name, sender: msg.sender?.type });
  }
}
```

```js
const msg = await trusted(ctx, 'review-decision', '14d', (d) => DECISIONS.includes(d?.decision));
if (msg === null) {
  await ctx.step(`expire-${round}`, () => updateCase(caseId, { status: 'expired' }));
  return { case_id: caseId, decision: 'expired', rounds: round };
}
// ... record the decision on the case
if (decision !== 'push_back') return { case_id: caseId, decision, rounds: round };
```

An ignored message restarts the wait with the full timeout. If the 14-day deadline has to hold exactly, store it in a step and wait only for the time left.

Only the app's own function holds the service key, and it sends a decision after reading the reviewer role from the signed-in session, through row-level security, never from the request body:

```js
const me = await q((await asUser(auth)).from('reviewers').select('user_id').eq('user_id', auth.user_id).limit(1), 'reviewer check');
if (!me?.length) throw new HttpError(403, 'only reviewers can decide');
const c = await loadCase(auth, input.case_id);
if (c.user_id === auth.user_id) throw new HttpError(403, "reviewers can't decide their own case");
```

A requester can't approve their own case by claiming a reviewer role in the request, and a reviewer can't decide a case they filed. A push back sends the case back to the requester, and the same execution waits up to 30 days for the refile.

The wait uses [`waitForMessage`](/platform/functions/durable-messages) rather than [`waitForApproval`](/platform/functions/durable-approvals), because approvals are decided by Volcano project members in the dashboard and have two outcomes. Here the reviewer is a user of the app, and push back is a third outcome.

Clients only read, and row-level security decides what they see. A requester sees their own cases; a reviewer sees filed ones:

```sql
CREATE POLICY cases_select ON cases FOR SELECT USING (user_id = auth.uid() OR (filed_at IS NOT NULL AND is_reviewer()))
```

```sql
CREATE OR REPLACE FUNCTION is_reviewer() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM reviewers WHERE user_id = auth.uid())
$$
```

If a bug in the app asked for another team's case, the database would still return nothing. Every write goes through a function that checks ownership first.

## Build it with your coding agent

You need a Volcano account on SUPERAGENT, since agent turns run up to 35 seconds and [HOBBY stops a function at 30](/platform/guides/plans-and-limits), and an OpenRouter API key with a credit limit. Paste this into Claude Code, Codex or Cursor with the Volcano skills, in an empty folder:

```text
Build and deploy a Volcano app called "Spend requests" in a new Volcano project named spend-requests. Use the Volcano skills and the volcano CLI. Next.js frontend, plain JavaScript functions, @volcano.dev/sdk 2.2.0, model calls through OpenRouter with fetch (OPENROUTER_API_KEY is in my environment), model anthropic/claude-haiku-5.5.

What it does: an employee at a fictional company, Acme, turns a request for budget (headcount, vendor or other) into a case a reviewer can decide on. A chat agent asks the questions and makes the judgment calls. Plain code does every number, rule and gate; the model can only reach them as tool calls.

- Stub "company data" in code: departments Sales, Support, Engineering, Marketing, each with 2 or 3 named priorities and a few metrics (Support: 18,400 tickets a month, 23 agents, target 650 tickets per agent per month, repeat-ticket share 0.31). Location cost multipliers and a 1.3 loading factor on salary.
- Steps: priorities, stress test, scoring. The agent proposes priorities; the requester confirms them with buttons, and code refuses unless every name is on that department's list. Code refuses to move to scoring until the ledger has a figure.
- Tools: department priorities, propose priorities, advance step, company data lookup, ratio, coverage gap, loaded cost from salary and start date, ramp time against a deadline, location cost, arithmetic (a small parser, no eval), record a ledger figure, rate a dimension, get score.
- Ledger statuses: verified (must match a lookup or calculation), claimed (the requester said it), contradicted (the requester said it, company data differs), homework (needed and missing, value null). Code checks each status.
- Readiness: the model rates business outcome, capacity evidence, automation considered, urgency, alternatives and success measure as strong, moderate, weak or missing. Code turns that into a weighted percent with weights per request type. A weak or missing business outcome caps it at 50%, a weak or missing success measure at 65%. Return no percent until all six are rated. Filing is refused below 75% unless the requester gives a reason of at least 20 characters.
- Number check: after each reply, code finds every figure with a unit ($, %, k/M, x) and looks for a source of the right kind in tool results, the case, or what the requester said. If one has none, send the reply back to the model to rewrite, at most twice, and show the check under the message.
- Filing starts a durable function that waits with ctx.waitForMessage("review-decision") and accepts only messages sent with the service key. Reviewers are users listed in a reviewers table. They approve, push back or deny with a note through a function that reads the role from the signed-in session, never from the request body. Push back returns the case to the requester, and a refile resumes the same execution.
- Use row-level security on every table so the database refuses other users' rows even if app code is wrong: a requester reads only their own cases, a reviewer reads filed ones, and clients write nothing directly. Every write goes through an authenticated function that checks ownership. Only the anon key may reach the browser; the service key and the OpenRouter key stay in functions.
- Cap spend: per-case and per-user daily limits on agent turns.

Before you finish, test the live app: sign up two users and a reviewer, show that user B can't read user A's case, that confirming a priority not on the list is refused, that filing below 75% without a reason is refused, and that a reviewer's push back and approval reach the case. Tell me the URL.
```

Claude Code 2.1.319 (claude-opus-5-5) built and deployed the app from this prompt in 17 minutes, with Volcano plugin 0.2.51 and CLI 0.62.0. Its own live test passed every check the prompt asks for.

## What it costs

On anthropic/claude-haiku-5.5, a conversation of 3 to 5 turns cost $0.009 to $0.017 in model spend on the live deploy, about $1 to $2 for 100 requests a month. Each filing is one durable execution, which counts as one operation. [Each wait for a message is three more](/platform/functions/durable-messages) and recording a decision is one, so a case decided on its first review uses about 5, and each push back and refile adds about 7. A case waiting two weeks for a reviewer isn't billed as compute. Code caps agent turns per case and per user per day.

## Make it yours

The company data is a stub module with made-up numbers for four departments. Replace it with a table in the same database or a call from the function to your planning system's API. The agent sees company data only through its lookup tools, so nothing else changes.

The rules live in one file of plain code: the dimensions, the weights per request type, the caps, the 75% threshold and the reason length. Finance can read it and ask for a change, and the change is a deploy, not a prompt rewrite.

The same shape fits other requests that end in a decision: procurement checked against existing contracts, access checked against a role list, a discount checked against deal history. Each needs its own lookup tools and weights; the durable review, the ledger and row-level security carry over.

## Limits

The number check matches values, not meaning. In one test run, a real running total was presented as one dimension's score, and the check passed it because the value had a source. Tools now return no score until all six dimensions are rated, but the check can't tell what a number stands for. Figures without a unit, such as "80,600 a year", aren't checked at all.

Agent turns averaged 17 to 20 seconds and reached 35 seconds on the live deploy, past HOBBY's 30-second limit, so the app needs SUPERAGENT unless you cut tool rounds or rewrites.
