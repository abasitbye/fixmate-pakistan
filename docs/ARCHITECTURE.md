# Architecture

FixMate Pakistan is web-first and API-first. Browser pages and future mobile clients consume versioned `/api/v1` contracts. Supabase PostgreSQL stores business state behind Row Level Security; UI visibility is never authorization.

Public routes expose localized content and safe configuration. Account routes manage profiles, consents, properties, and notifications. Professional routes manage private applications and signed uploads. Support has limited context and audited notes. Administrators control reviews and account states; super administrators control roles and high-risk settings.

Supabase Auth owns sessions. Server Components and route handlers use cookie-backed SSR clients. The service-role key exists only in server modules. Sensitive state changes use PostgreSQL security-definer functions that validate transitions and append audit records.

Stable UUIDs, UTC timestamps, explicit enums, normalized service/location data, device registrations, and JSON API envelopes keep the foundation mobile-ready. Phase 2 requests, matching, offers, booking scheduling, jobs, arrival verification, consent-limited en-route location, quotations, job execution, and payments are connected through transactional commands and an outbox. Warranties and disputes continue in later checkpoints.

Exact service addresses remain encrypted in request snapshots and are decrypted server-side only for the selected professional after booking confirmation. Arrival codes use a cryptographically secure generator and bcrypt at rest. Optional location sharing requires explicit consent, is limited to an en-route session, stops at verified arrival or expiry, and is covered by a retention purge command.

Submitted quotations are append-only commercial versions; revisions create a new version instead of overwriting the customer-reviewed record. Work start requires an approved quotation, and submitted non-emergency change orders pause in-progress work until a customer decision. Completion totals derive from the approved quotation plus approved change orders, while final after-work evidence is required before submission.

Job chat stores plain text and system events in PostgreSQL. Private evidence objects use the `job-evidence` bucket and short-lived signed access; database metadata and participant/staff RLS remain the authority.

Payment providers sit behind a server adapter interface. Cash and manual transfers are the operational baseline; a professional can report receipt but cannot finalize it. Customer confirmation or documented staff reconciliation atomically posts the transaction, journal, earnings, document, job payment status, audit event, and outbox event. No online adapter or live payout is enabled without verified credentials and provider approval.

Marketplace accounting uses integer minor units, effective-dated fee rules, append-only double-entry journal lines, and mutable summaries only for operational state. Refunds add correction entries instead of editing completed journals. Manual payouts use Phase 1 payout-readiness records, separate maker/checker approval, private evidence, and a unique earning link to prevent double payout.
