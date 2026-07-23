# API v1

JSON routes return `{ success: true, data, error: null }` or `{ success: false, data: null, error }`.

- `/api/v1/auth/*`: email OTP, session, logout.
- `/api/v1/me*`: profile, consent-backed setup, account purpose.
- `/api/v1/properties*`: customer-owned properties.
- `/api/v1/requests*`: idempotent customer request drafts, private media, submission, and cancellation (Phase 2 flag controlled).
- `/api/v1/professional/request-invitations*` and `/api/v1/professional/offers*`: privacy-safe matching invitations and controlled professional offers.
- `/api/v1/requests/:id/offers*`: customer offer comparison and atomic selection.
- `/api/v1/bookings*`: participant booking lists/details, professional confirmation, schedule proposals/responses, effective-policy cancellation preview/action, and staff-reviewed no-show outcomes.
- `/api/v1/jobs*`: participant job lists/details, professional en-route transition, customer-only arrival-code generation, professional-only verification, and consent-limited location start/point/stop commands.
- `/api/v1/professional/application*`: drafts, services, areas, availability, signed documents, references, payout readiness, submission.
- `/api/v1/notifications*` and `/api/v1/notification-devices`: in-app state and Firebase devices.
- `/api/v1/public/*`: catalog, locations, verification requirements.
- `/api/v1/admin/*`: applications, documents, users, roles, locations, categories, settings, audit.
- `/api/v1/support/notes`: staff-only support history.

Arrival codes never appear in URLs or logs. Raw codes are returned only to the owning customer immediately after generation; the database stores only a bcrypt hash. Invalid verification attempts commit their counter before a safe error response is returned.

Web authentication uses secure Supabase session cookies. Native clients can use equivalent Supabase bearer sessions while preserving the contracts. Staff authorization is checked per request and again in database workflows.
