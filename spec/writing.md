---
title: Writing Volcano docs
description: Linking, wording, and release-timing rules for pages in the Volcano developer docs.
order: 2
---

These rules apply to every page under `content/`. The format rules
(frontmatter, headings, fences, filenames) are in
[`markdown-format.md`](markdown-format.md), and `pnpm lint:docs content`
enforces them.

## Linking

- Link within a section by relative path with `.md`
  (`../guides/deployment-source.md`).
- Link another section by site-absolute path without extension (`/cli`,
  `/platform/functions/overview`).
- Link the OpenAPI document at `https://api.volcano.dev/openapi.yaml`. The site
  serves only Markdown pages, so files such as YAML or source code under
  `content/` are not reachable by URL; `pnpm check:links` fails on links to
  them.

## Writing

- Lead with what the reader can do, then a runnable, copy-pasteable example
  showing request and response.
- Use real endpoints, payloads, and errors. Keep sections short, headings
  imperative, and options in tables. Cross-link instead of repeating.

## Volcano's infrastructure is Volcano's

- Describe what the platform does, not the vendor behind it: "Volcano builds
  your function and deploys it to every selected region", not "we run a
  CodeBuild job and publish a Lambda". Lambda, CloudFront, S3, Step Functions,
  CodeBuild, Neon, DynamoDB and Redis are not the reader's concern.
- Quote wire values exactly as the API spells them (`us-east-1`, `invoke_url`,
  error codes).
- Name technology the user works with directly (Postgres, their framework,
  Docker for local mode) and third-party services they configure with their own
  account, such as their SMTP provider.

## Release timing

A push to `main` publishes the site. Merge a page that describes a new or
changed product behavior when that behavior is released to production, not
when its code merges in the product repository. Check the production API or
the released CLI and SDK versions when in doubt.
