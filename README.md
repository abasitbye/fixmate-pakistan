# FixMate Pakistan

FixMate Pakistan is a managed home-services marketplace for Islamabad and Rawalpindi. The platform is being built web-first with reusable APIs and backend services for future Android and iOS applications.

Production: [fixmate-pakistan.vercel.app](https://fixmate-pakistan.vercel.app)

## Phase 1 scope

Phase 1 establishes the production platform, email OTP authentication, multi-role access, customer profiles and properties, professional applications and verification, support/admin operations, localization, notifications, audit trails, and security controls.

The job marketplace lifecycle—requests, matching, offers, bookings, quotations, work, payments, warranties, and disputes—is intentionally deferred to Phase 2.

## Technology

- Next.js App Router, React, and TypeScript
- Supabase Auth, PostgreSQL, Storage, and Row Level Security
- Vercel hosting
- Resend SMTP for Supabase email OTP
- Firebase Cloud Messaging
- Cloudflare Turnstile
- Sentry monitoring and source maps
- next-intl for English, Urdu, and Roman Urdu

## Local setup

1. Install Node.js 20.9 or newer and pnpm 11.
2. Copy `.env.example` to `.env.local` and provide authorized values.
3. Install dependencies with `pnpm install`.
4. Run `pnpm dev` for local engineering only.

The owner review and integration acceptance environment is the live Vercel deployment, not localhost.

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm check` runs the full gate in order.

## Security

Never commit `.env.local`, service-account files, credentials documents, verification media, or database exports. Server secrets must never use the `NEXT_PUBLIC_` prefix. Authorization is enforced server-side and in PostgreSQL RLS; frontend visibility is not treated as access control.

