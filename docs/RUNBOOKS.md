# Phase 2 Production Runbooks

## Background processing

Vercel calls `/api/internal/cron/marketplace` daily at 07:00 Pakistan time (02:00 UTC). `CRON_SECRET` is required. The database uses an advisory transaction lock so overlapping invocations do not duplicate work.

The maintenance command expires requests, invitations, offers and arrival codes; activates/expires warranties; dead-letters exhausted outbox records; raises safe operational alerts; creates explainable cancellation, no-show and payment-disagreement signals; and prunes expired idempotency, rate-limit and seven-day location records. Every run is recorded in `background_job_runs`.

The daily schedule is compatible with a low-cost Vercel plan. Minute-level dispatch and guaranteed external queues are intentionally not claimed.

## Retention

`data_retention_policies` is the source of documented defaults:

- consented location points: 7 days, deletion;
- request media: up to 730 days with warranty/dispute/legal-hold review;
- job chat and warranty evidence: up to 1,095 days with hold review;
- payment metadata, dispute evidence and audit logs: up to 2,555 days or the applicable legal/operational requirement;
- deleted-account profile data: controlled anonymization while required financial, safety, active warranty and active dispute records remain.

Deletion requests must be paused for active disputes, active warranties, fraud review or legal hold. Never delete or rewrite completed ledger entries.

## Financial reconciliation

1. Open Admin → Reconciliation and identify the payment reference.
2. Compare the customer statement, professional report and private evidence.
3. Record an evidence-based outcome; never use private bank credentials.
4. Confirm that every journal is balanced by currency.
5. Verify professional earnings state and any dispute hold.
6. Use corrections, refunds or reversals—never edit posted ledger lines.
7. Payouts require a verified payout profile, separate maker/checker approval, a provider reference and private evidence.

No online provider is operational until its account is approved, secrets are installed, webhook signatures are verified, sandbox cases pass and an authorized production test succeeds.

## Incident response

1. Triage severity and preserve the request/business reference ID.
2. Restrict the affected feature with database feature flags when needed.
3. Preserve audit, outbox, payment and evidence records.
4. Review Vercel and sanitized Sentry events; do not copy tokens, exact addresses, CNIC data, chat text or evidence URLs into tickets.
5. For financial incidents, hold affected earnings and stop payout settlement.
6. Apply a forward-only corrective migration or code release.
7. Verify health, readiness, unauthorized access and the affected lifecycle in production.
8. Record the resolution and user communication. Support an appeal for account consequences.

## Deployment checklist

1. Confirm a clean production branch and scan for credentials.
2. Run lint, type checking, unit tests, all integrations, production E2E and a production build.
3. Review migrations and create a schema/critical-data backup where the current Supabase plan permits.
4. Apply forward-only migrations once; run database status and verification.
5. Push `main`, monitor Vercel to Ready and confirm the commit at `/api/health`.
6. Confirm `/api/readiness`, security headers, PWA assets and all locales.
7. Exercise request → matching → offer → booking → arrival → quotation → change order → completion → cash payment → review → warranty → dispute.
8. Test anonymous and cross-account denial.
9. Review operational alerts, Vercel logs and sanitized Sentry.
10. Remove isolated test records and verify the final deployment.

## Daily operations checklist

- Review critical operational alerts, dead-letter events and failed scheduled runs.
- Review overdue disputes and payment disagreements.
- Triage risk signals with documented evidence; never automatically ban.
- Review matching exhaustion, booking confirmation deadlines and payout failures.
- Reconcile payment journals and dispute holds.
- Confirm external sender/provider health without exposing credentials.
