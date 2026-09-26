---
title: "Deployment performance"
description: "Understand deployment timing and platform latency objectives."
---

Volcano reports total deployment time from acceptance until the resource is
ready or the deployment fails. Platform overhead excludes the application
build interval; queueing, source checkout, image publication, provisioning,
rollout, and verification still count.

Successful, non-delete deployments use these platform-overhead objectives:

| Resource | Platform p95 target |
|----------|---------------------|
| Function | 150 seconds |
| Frontend | 180 seconds |

Total deployment time and application build time remain available separately.
A longer application build does not consume the platform-overhead budget.

The objectives apply to direct deploy, update, and redeploy operations in
staging and production. Project-wide operations and deletes are tracked
separately because lock contention and teardown work have different latency
profiles.

Build queue time is limited to five minutes. If regional build capacity remains
unavailable for that period, the deployment fails instead of waiting
indefinitely. Retry the deployment after regional capacity recovers; the
last-known-good function or frontend continues serving during a failed update.

Each deployment records the same ordered phases:

| Phase | Starts | Completes |
|-------|--------|-----------|
| Queue | The request is accepted | A build worker starts processing it |
| Checkout | Source processing starts | Source and build inputs are ready |
| Build | The application build starts | The deployable artifact is ready |
| Image | Image publication starts | Runtime images are published |
| Provisioning | Platform provisioning starts | Regional work is dispatched |
| Rollout | Regional deployment starts | Every target region is ready |
| Verification | Final checks start | The deployment reaches a terminal state |

Telemetry reports total, platform, and per-phase durations by resource type,
operation, and deployment scope (`direct` or `project`). Alerts select successful
direct deployments; project-wide changes and deletes remain separate. If build
timing is incomplete, the platform measurement is marked incomplete rather than
reported as zero. Total deployment time remains available.

Percentiles preserve the distribution of individual deployment durations.
Retrying a metrics export retains its original completion timestamp and does
not create another deployment observation.

## Deployment history statistics

The dashboard summarizes Function and Frontend deployment histories separately
because their build pipelines are not directly comparable. A selected time
range applies to both the history rows and the summary.

Deployment count includes every matching attempt. Success rate uses only
conclusive outcomes: `active` and `deleted` are successes, while `failed` and
`degraded` are failures. In-progress and `superseded` attempts are excluded from
the rate. Median build duration uses completed, non-superseded attempts with
recorded build work. Failed builds are included when they recorded a
duration.
