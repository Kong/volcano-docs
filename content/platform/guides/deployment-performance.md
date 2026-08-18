---
title: "Deployment performance"
description: "Volcano measures deployment latency from the time a deployment request is accepted until the resource is ready or the deployment fails."
---

Volcano measures deployment latency from the time a deployment request is
accepted until the resource is ready or the deployment fails. Successful,
non-delete deployments use these latency objectives:

| Resource | p50 target | p95 target |
|----------|------------|------------|
| Function | 90 seconds | 150 seconds |
| Frontend | 180 seconds | 300 seconds |

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

Staging telemetry reports total and per-phase durations by resource type,
operation, and deployment scope (`direct` or `project`). The SLO monitors select
only direct deployments; project-wide region changes and deletes remain
queryable without entering those percentiles. Each completed deployment uses a
stable completion timestamp and deployment identity so retrying an acknowledged
OTLP point overwrites the same intake point instead of double-counting it.
Percentile alerts use the targets above so a regression is visible even when the
average remains healthy.

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
