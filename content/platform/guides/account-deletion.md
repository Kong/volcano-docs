---
title: Delete or keep your account
description: Stop account resources and automatic payments, with 30 days to change your mind.
---

Open **Settings → Your account → Delete my account** and confirm the request.
Volcano stops serving your projects, revokes existing sign-in sessions and access
tokens, turns off automatic credit recharge, and stops subscription renewal.
Running work finishes within its runtime limits. Your account then has a 30-day
recovery period, with the exact deletion date shown in the confirmation.

## Keep your account within 30 days

Sign in using your existing email or OAuth provider and choose **Restore my account**
in the confirmation dialog. After recovery succeeds, you continue to the page you
were opening. Choose **Log out** to leave deletion scheduled.
Signing in alone does not cancel deletion. Your existing account and retained data
are restored. Previously revoked access tokens stay revoked; create new tokens
when needed. Automatic recharge and subscription renewal remain off until you
explicitly enable them again.

Credit arrears and other billing restrictions still apply. An account with unpaid
credits returns in `read_only` status. Administrative restrictions also remain.

## After the recovery period

Once the deadline passes, you cannot restore the account. Volcano marks its auth
user `deleted`, releases email and OAuth bindings, and queues its resources for
permanent removal. After bindings are released, you can register a new account
using the same email or provider. It receives a new user ID and does not inherit
old resources, subscriptions, or credit balance.

Deletion does not refund previous payments or forgive existing debt. Retained
storage may incur charges during the recovery period. Financial and usage records
remain associated with the old account for reconciliation.

If shutdown or payment cancellation cannot finish immediately, Volcano retries
and displays a pending state. Once a deletion date is confirmed, you can still
restore your account before that date while shutdown retries continue. Remaining
automatic-payment cancellation finishes in the background; payment changes become
available when it completes. Contact Support if the request remains pending.
Accounts deleted under the earlier irreversible policy cannot be recovered.
