# Architecture

FixMate Pakistan is web-first and API-first. Browser pages and future mobile clients consume versioned `/api/v1` contracts. Supabase PostgreSQL stores business state behind Row Level Security; UI visibility is never authorization.

Public routes expose localized content and safe configuration. Account routes manage profiles, consents, properties, and notifications. Professional routes manage private applications and signed uploads. Support has limited context and audited notes. Administrators control reviews and account states; super administrators control roles and high-risk settings.

Supabase Auth owns sessions. Server Components and route handlers use cookie-backed SSR clients. The service-role key exists only in server modules. Sensitive state changes use PostgreSQL security-definer functions that validate transitions and append audit records.

Stable UUIDs, UTC timestamps, explicit enums, normalized service/location data, device registrations, and JSON API envelopes keep the foundation mobile-ready. Phase 2 requests, matching, offers, booking scheduling, jobs, arrival verification, and consent-limited en-route location are connected through transactional commands and an outbox. Quotations, payments, warranties, and disputes continue in later checkpoints.

Exact service addresses remain encrypted in request snapshots and are decrypted server-side only for the selected professional after booking confirmation. Arrival codes use a cryptographically secure generator and bcrypt at rest. Optional location sharing requires explicit consent, is limited to an en-route session, stops at verified arrival or expiry, and is covered by a retention purge command.

Submitted quotations are append-only commercial versions; revisions create a new version instead of overwriting the customer-reviewed record. Work start requires an approved quotation, and submitted non-emergency change orders pause in-progress work until a customer decision. Completion totals derive from the approved quotation plus approved change orders, while final after-work evidence is required before submission.

Job chat stores plain text and system events in PostgreSQL. Private evidence objects use the `job-evidence` bucket and short-lived signed access; database metadata and participant/staff RLS remain the authority.
