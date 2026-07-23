# Architecture

FixMate Pakistan is web-first and API-first. Browser pages and future mobile clients consume versioned `/api/v1` contracts. Supabase PostgreSQL stores business state behind Row Level Security; UI visibility is never authorization.

Public routes expose localized content and safe configuration. Account routes manage profiles, consents, properties, and notifications. Professional routes manage private applications and signed uploads. Support has limited context and audited notes. Administrators control reviews and account states; super administrators control roles and high-risk settings.

Supabase Auth owns sessions. Server Components and route handlers use cookie-backed SSR clients. The service-role key exists only in server modules. Sensitive state changes use PostgreSQL security-definer functions that validate transitions and append audit records.

Stable UUIDs, UTC timestamps, explicit enums, normalized service/location data, device registrations, and JSON API envelopes keep the foundation mobile-ready. Phase 2 will add requests, matching, offers, jobs, quotations, payments, warranties, and disputes as connected workflows.
