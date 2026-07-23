# Security model

- Supabase verifies email OTP. Turnstile and database-backed limits protect abuse-sensitive endpoints.
- OTP challenge email stays in a short-lived HttpOnly, Secure, SameSite cookie, never a URL.
- Sensitive tables use RLS, ownership policies, and restricted column grants.
- Professional files use private buckets, signed upload tokens, and user-owned paths.
- Payout readiness references use AES-256-GCM. Phase 1 moves no money.
- Elevated decisions use controlled database functions and append-only audit records.
- CSP, HSTS, frame denial, MIME protection, a restrictive permissions policy, and no-store APIs are configured globally.
- Sentry filtering removes credential-like and personal fields.
- Distributed database-backed limits cover request creation, media, offers, chat, arrival codes, quotations, payment creation, reviews, warranty claims, disputes, evidence, staff reviews and provider webhooks.
- Risk signals are explainable review aids. Account consequences require a documented human decision and support an appeal path.
- Daily retention removes short-lived location points and expired control records without rewriting financial or audit history.

Never commit `.env.local`, credentials, service-account JSON, database dumps, or verification media.

## First administrator

The owner first completes production email-OTP sign-in. From a trusted operator machine, run:

```bash
pnpm admin:grant-super -- --email=owner@example.com --confirm=GRANT_SUPER_ADMIN
```

The explicit operator action is audited. It is intentionally not exposed as a public endpoint.
