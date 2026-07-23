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

All new user or sensitive tables have RLS. Direct browser mutation of controlled transactional records is denied; versioned APIs apply ownership, role, validation, transition, idempotency, audit, and transaction checks.

## Mobile readiness

Android and iOS clients will use the same API envelopes, authentication sessions, state names, money representation, idempotency headers, event semantics, and permission model. No marketplace rule is intentionally confined to the web UI.

## Data safety

Migrations are forward-only and do not rename, drop, or rewrite Phase 1 objects. Production fixtures are not inserted. Marketplace flags default to disabled, so applying a schema checkpoint cannot expose an unfinished customer workflow.
