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
- `/api/v1/jobs/:id/inspection*`, `/work/*`, and `/completion*`: controlled inspection, approved-work progress, pause/resume, evidence-gated completion, and customer completion decisions.
- `/api/v1/jobs/:id/quotations*` and `/api/v1/quotations*`: itemized immutable quotation versions and explicit customer decisions.
- `/api/v1/jobs/:id/change-orders*` and `/api/v1/change-orders*`: changed-scope proposals and customer approval before non-emergency covered work continues.
- `/api/v1/jobs/:id/messages*` and `/media*`: rate-limited job chat/read state and private signed evidence uploads.
- `/api/v1/jobs/:id/payment*`, `/api/v1/payments*`, and `/api/v1/receipts`: payment lookup, idempotent cash/manual intent creation, professional receipt reporting, customer confirmation/disagreement, refund requests, and documents.
- `/api/v1/professional/earnings` and `/professional/payouts`: professional-owned earnings and settlement history.
- `/api/v1/admin/fees`, `/payouts`, `/refunds`, and `/reconciliation`: fee configuration, maker-checker payouts, refund accounting, and documented reconciliation.
- `/api/v1/webhooks/payments/:provider`: signature-gated, adapter-backed, idempotent provider ingress; unavailable while no verified online adapter exists.
- `/api/v1/jobs/:id/reviews` and `/api/v1/reviews/:id`: eligible mutual reviews and staff moderation without wording edits.
- `/api/v1/warranties*` and `/api/v1/warranty-claims*`: accepted-term warranty history, claims, private evidence, response, revisit, resolution, and escalation.
- `/api/v1/jobs/:id/disputes` and `/api/v1/disputes*`: idempotent case opening, visibility-controlled evidence/messages, details, and closure.
- `/api/v1/admin/reviews` and `/api/v1/admin/disputes*`: moderation, assignment/evidence requests, proposals, audited decisions, and reopening.
- `/api/v1/professional/application*`: drafts, services, areas, availability, signed documents, references, payout readiness, submission.
- `/api/v1/notifications*` and `/api/v1/notification-devices`: in-app state and Firebase devices.
- `/api/v1/public/*`: catalog, locations, verification requirements.
- `/api/v1/admin/*`: applications, documents, users, roles, locations, categories, settings, audit.
- `/api/v1/support/notes`: staff-only support history.
- `/api/v1/support/operations*`: staff-only workload, alerts, risk review and scheduled-run history.
- `/api/health` and `/api/readiness`: safe liveness and dependency/queue readiness without credential details.
- `/api/internal/cron/marketplace`: bearer-protected scheduled lifecycle maintenance; never a public client API.

Arrival codes never appear in URLs or logs. Raw codes are returned only to the owning customer immediately after generation; the database stores only a bcrypt hash. Invalid verification attempts commit their counter before a safe error response is returned.

Web authentication uses secure Supabase session cookies. Native clients can use equivalent Supabase bearer sessions while preserving the contracts. Staff authorization is checked per request and again in database workflows.

Financial amounts are integer minor units. Payment, confirmation, refund, and payout creation require caller idempotency where duplication could recognize or move value. Cash/manual confirmation and every refund/payout post all affected records in one database transaction.
