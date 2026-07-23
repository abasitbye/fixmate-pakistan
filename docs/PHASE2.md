# Phase 2 Marketplace

Phase 2 extends the production Phase 1 identity, verification, location, notification, security, and administration foundation into the FixMate managed-service marketplace.

## Release strategy

Marketplace capabilities are delivered through eight production checkpoints. Incomplete user workflows remain unavailable until their database-backed feature flag is enabled by a super administrator.

| Flag | Initial value | Purpose |
| --- | --- | --- |
| `phase2.marketplace_enabled` | `false` | Master marketplace release control |
| `phase2.requests_enabled` | `false` | Customer request workflow |
| `phase2.matching_enabled` | `false` | Matching and professional offers |
| `phase2.jobs_enabled` | `false` | Booking and job execution |
| `phase2.payments_enabled` | `false` | Payments and accounting |

The master flag and the capability flag must both be enabled. Flags are stored in `system_settings`, changed through the audited super-administrator settings API, and exposed publicly only as booleans.

## Foundation architecture

- Versioned APIs remain under `/api/v1`.
- React routes are consumers of reusable marketplace services, not the source of business rules.
- Money uses integer minor units and ISO currency codes.
- Mutable aggregates carry an optimistic-concurrency `version`.
- State changes use centralized transition maps and controlled transactional database operations.
- Multi-record operations emit an event into the transactional `domain_outbox`.
- Retryable commands use caller-scoped `idempotency_keys`.
- Private request media uses the `service-request-media` bucket and short-lived signed URLs.
- Unmatched professionals never receive the exact property address, coordinates, contact snapshot, internal ranking values, or competing offers.

## Checkpoint 1 schema

The first forward-only Phase 2 migration adds:

- `service_requests`, request media, and append-only status history
- matching runs and private candidate rankings
- professional offers, line items, and immutable accepted-offer snapshots
- bookings and reschedule requests
- jobs and append-only status history
- hashed arrival-verification records
- idempotency keys
- the transactional domain outbox

## Customer request workflow

Checkpoint 2 adds the guided customer request experience and versioned APIs:

- `GET|POST /api/v1/requests`
- `GET|PATCH /api/v1/requests/:id`
- `POST /api/v1/requests/:id/submit`
- `POST /api/v1/requests/:id/cancel`
- private signed request-media preparation, finalization, and deletion

Draft creation, submission, and cancellation use database transactions. They enforce ownership, account state, optimistic concurrency, caller idempotency, append-only history, audit records, notifications, and transactional outbox events. Exact property details are encrypted into a selection-time snapshot; unmatched professionals receive only a separately projected safe request view in the matching layer.

The customer pages are implemented but redirect to the existing dashboard while the request and marketplace flags remain disabled. This prevents a request from entering an unavailable matching workflow before Checkpoint 3 is ready.

## Matching and offers

Checkpoint 3 adds:

- deterministic hard eligibility for account, approval, role, required verifications, service, area, availability, and schedule conflicts
- controlled invitation batches with expiry and an auditable strategy version
- workload fairness so new or lightly loaded approved professionals are not permanently disadvantaged
- privacy-safe invitation projections that omit exact address, coordinates, contact data, competing offers, and internal scores
- professional invitation view/decline and offer draft/submit/withdraw APIs
- customer offer comparison using scope, schedule, professional context, price type, inspection fee, and warranty
- atomic offer acceptance with optimistic concurrency and idempotent replay
- immutable accepted-commercial-terms snapshots and controlled booking creation

The integration suite creates isolated customer and approved-professional records, verifies matching through booking creation, confirms acceptance replay does not duplicate a booking, confirms the exact address remains unreleased, and removes every test record.

## Booking, scheduling, and arrival

Checkpoint 4 adds:

- professional confirmation with an enforced confirmation deadline and idempotent job creation
- participant-driven reschedule proposals, response deadlines, explicit acceptance or rejection, conflict revalidation, notifications, and schedule history
- effective-dated cancellation policies with a fee preview and required acknowledgement only when an applicable policy permits a fee
- support-reviewed no-show outcomes with evidence references for unilateral findings, appeal-oriented notifications, and guards against early or post-arrival findings
- configurable en-route windows and customer notifications
- cryptographically generated six-digit arrival codes, bcrypt hashes at rest, short expiry, persistent attempt limits, regeneration, audit events, and automatic location-session shutdown after successful verification
- optional location sharing with explicit professional consent, visible stop controls, en-route-only collection, session expiry, arrival shutdown, and a short retention setting
- customer and professional booking/job lists and detail screens backed by the same `/api/v1` contracts intended for future mobile clients

The booking/arrival integration path now exercises request creation, matching, offers, selection, rescheduling, confirmation replay, job creation, en-route transition, an invalid attempt that remains counted, arrival verification, automatic location stop, cancellation preview, and a post-arrival no-show guard. Its isolated records are removed and verified absent after every run.

## Inspection, quotations, and job execution

Checkpoint 5 adds:

- verified-arrival inspection start/completion with findings, recommended work, and safety notes
- itemized quotations using integer minor units, immutable submitted versions, validity, deposits, warranty, terms, and exclusions
- explicit customer approval, rejection, clarification, or revision requests with idempotent financial authorization and preserved decisions
- customer-approved material responsibility records
- change orders for scope, price, material, and schedule changes; non-emergency affected work pauses until approval
- private signed job evidence for before, inspection, during, receipt, change-order, and after-work stages
- rate-limited plain-text job chat, system lifecycle messages, reply targets, read state, moderation status, and retained records
- approved-work start, documented pause/resume, final evidence enforcement, calculated completion totals, customer issue reporting, resubmission, and explicit completion confirmation
- dedicated customer and professional screens for inspections, quotations, change orders, job chat, evidence, and completion

The integration path now continues through inspection, a requested quotation revision, immutable version two approval, work start, chat/read state, a change order that pauses work, approval and resume, final evidence, an issue-reported completion, resubmission, and customer confirmation. Cleanup verifies the isolated records and users are absent.

## Payments, fees, and payout accounting

Checkpoint 6 adds:

- provider-neutral payment adapters with no unverified online provider enabled
- production-safe cash and manual-transfer intents, professional receipt reports, explicit customer confirmation, and documented staff reconciliation for disagreements
- configurable effective-dated percentage/fixed commission rules with optional category, city, minimum, and maximum scope; an absent rule means a zero fee
- payment transactions and idempotent command replay that prevent duplicate posting
- append-only double-entry journal lines, professional earnings, direct-cash settlement handling, and controlled payable balances
- maker-checker manual payouts requiring a verified Phase 1 payout profile, independent approval, a transfer reference, and private evidence
- accurately worded payment, refund, earnings, and payout documents that do not claim tax-invoice status
- partial/full refund limits, approval, evidence, proportional fee/earnings reversal, and retained accounting history
- signature-gated adapter webhooks with provider/event uniqueness and payload-hash conflict detection
- customer, professional, support, and admin financial screens backed by the shared APIs

The integration path now continues after completion through idempotent payment creation, a reported disagreement, staff reconciliation, customer confirmation, balanced journal verification, available earnings, maker-checker payout and evidence, partial refund accounting, webhook replay, and verified cleanup. Live online collection or payout is intentionally not claimed: no provider is enabled until credentials, signature verification, sandbox tests, account/legal approval, and authorized production tests exist.

All new user or sensitive tables have RLS. Direct browser mutation of controlled transactional records is denied; versioned APIs apply ownership, role, validation, transition, idempotency, audit, and transaction checks.

## Mobile readiness

Android and iOS clients will use the same API envelopes, authentication sessions, state names, money representation, idempotency headers, event semantics, and permission model. No marketplace rule is intentionally confined to the web UI.

## Data safety

Migrations are forward-only and do not rename, drop, or rewrite Phase 1 objects. Production fixtures are not inserted. Marketplace flags default to disabled, so applying a schema checkpoint cannot expose an unfinished customer workflow.
